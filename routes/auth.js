// ============================================
// ROUTES - AUTHENTICATION
// ============================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const { authenticateToken } = require('../middleware/auth');

const db = admin.firestore();
const auth = admin.auth();

// ============================================
// 1. SIGNUP - Kuunda akaunti mpya
// ============================================

router.post('/signup', async (req, res) => {
    try {
        const { 
            full_name, username, email, phone, password, 
            date_of_birth, gender, location, bio, interests, profile_picture 
        } = req.body;

        // Check required fields
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email and password are required.' });
        }

        // Check if username exists
        const usernameCheck = await db.collection('users')
            .where('username', '==', username)
            .get();
        
        if (!usernameCheck.empty) {
            return res.status(400).json({ error: 'Username already taken.' });
        }

        // Check if email exists
        const emailCheck = await db.collection('users')
            .where('email', '==', email)
            .get();
        
        if (!emailCheck.empty) {
            return res.status(400).json({ error: 'Email already registered.' });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create in Firebase Auth
        let firebaseUser;
        try {
            firebaseUser = await auth.createUser({
                email: email,
                password: password,
                displayName: full_name || username,
            });
        } catch (authError) {
            console.error('Firebase auth error:', authError);
            return res.status(400).json({ error: 'Error creating user. Please try again.' });
        }

        // Check if this is the admin email
        const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'dullamanyama0@gmail.com';
        const isAdmin = email === ADMIN_EMAIL;

        // Calculate trial expiration (3 days from now)
        const FREE_TRIAL_DAYS = parseInt(process.env.FREE_TRIAL_DAYS) || 3;
        const trialExpiresAt = new Date();
        trialExpiresAt.setDate(trialExpiresAt.getDate() + FREE_TRIAL_DAYS);

        // Create user in Firestore
        const userData = {
            username,
            email,
            full_name: full_name || '',
            phone: phone || '',
            password_hash: passwordHash,
            date_of_birth: date_of_birth || '',
            gender: gender || '',
            location: location || '',
            bio: bio || '',
            interests: interests || [],
            profile_picture: profile_picture || '',
            is_premium: isAdmin ? true : false,
            is_admin: isAdmin,
            is_banned: false,
            is_verified: isAdmin ? true : false,
            online_status: 'offline',
            last_seen: admin.firestore.FieldValue.serverTimestamp(),
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            firebase_uid: firebaseUser.uid,
            // Free Trial fields
            trial_active: isAdmin ? false : true,
            trial_started_at: isAdmin ? null : admin.firestore.FieldValue.serverTimestamp(),
            trial_expires_at: isAdmin ? null : trialExpiresAt,
            trial_used: false,
            // Premium fields
            subscription_status: isAdmin ? 'active' : 'free',
            premium_expires_at: isAdmin ? null : null,
        };

        const userRef = await db.collection('users').add(userData);
        const userId = userRef.id;
        await userRef.update({ id: userId });

        // Generate JWT
        const JWT_SECRET = process.env.JWT_SECRET || 'tafuta-mpenzi-wako-super-secret-jwt-key-2026';
        const token = jwt.sign(
            { id: userId, username, email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'Account created successfully! 🎉',
            user: {
                id: userId,
                username,
                email,
                full_name: full_name || '',
                is_premium: isAdmin,
                is_admin: isAdmin,
                trial_active: !isAdmin,
                trial_expires_at: trialExpiresAt,
            },
            token,
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 2. LOGIN - Kuingia kwenye akaunti
// ============================================

router.post('/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Username/Email and password are required.' });
        }

        // Find user by username or email
        const userSnapshot = await db.collection('users')
            .where('username', '==', identifier)
            .get();

        let userDoc = null;
        let userId = null;

        if (userSnapshot.empty) {
            const emailSnapshot = await db.collection('users')
                .where('email', '==', identifier)
                .get();
            
            if (!emailSnapshot.empty) {
                userDoc = emailSnapshot.docs[0];
                userId = userDoc.id;
            }
        } else {
            userDoc = userSnapshot.docs[0];
            userId = userDoc.id;
        }

        if (!userDoc) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const userData = userDoc.data();

        // Check if user is banned
        if (userData.is_banned) {
            return res.status(403).json({ error: 'This account has been banned.' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, userData.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Update last seen and online status
        await db.collection('users').doc(userId).update({
            last_seen: admin.firestore.FieldValue.serverTimestamp(),
            online_status: 'online',
        });

        // Check premium status
        let isPremium = userData.is_premium;
        if (isPremium && userData.premium_expires_at) {
            const expiresAt = userData.premium_expires_at.toDate ? 
                userData.premium_expires_at.toDate() : 
                new Date(userData.premium_expires_at);
            
            if (new Date() > expiresAt) {
                await db.collection('users').doc(userId).update({
                    is_premium: false,
                    premium_expires_at: null,
                    subscription_status: 'expired',
                });
                isPremium = false;
            }
        }

        // Check trial status
        let trialActive = userData.trial_active || false;
        if (trialActive && userData.trial_expires_at) {
            const trialExpires = userData.trial_expires_at.toDate ? 
                userData.trial_expires_at.toDate() : 
                new Date(userData.trial_expires_at);
            
            if (new Date() > trialExpires) {
                await db.collection('users').doc(userId).update({
                    trial_active: false,
                });
                trialActive = false;
            }
        }

        // Generate JWT
        const JWT_SECRET = process.env.JWT_SECRET || 'tafuta-mpenzi-wako-super-secret-jwt-key-2026';
        const token = jwt.sign(
            { id: userId, username: userData.username, email: userData.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Login successful! 💕',
            user: {
                id: userId,
                username: userData.username,
                email: userData.email,
                full_name: userData.full_name || '',
                is_premium: isPremium,
                is_admin: userData.is_admin || false,
                profile_picture: userData.profile_picture || '',
                is_verified: userData.is_verified || false,
                premium_expires_at: userData.premium_expires_at,
                trial_active: trialActive,
                trial_expires_at: userData.trial_expires_at,
                subscription_status: userData.subscription_status || 'free',
            },
            token,
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 3. CHECK USERNAME - Angalia kama username ipo
// ============================================

router.post('/check-username', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) {
            return res.status(400).json({ error: 'Username required.' });
        }

        const snapshot = await db.collection('users')
            .where('username', '==', username)
            .get();

        res.json({ exists: !snapshot.empty });
    } catch (error) {
        console.error('Check username error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 4. CHECK ADMIN - Angalia kama mtumiaji ni admin
// ============================================

router.get('/check-admin', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found.' });
        }
        
        const userData = userDoc.data();
        const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'dullamanyama0@gmail.com';
        const isAdmin = userData.email === ADMIN_EMAIL || userData.is_admin === true;
        
        res.json({
            success: true,
            is_admin: isAdmin,
            email: userData.email,
            admin_email: ADMIN_EMAIL,
        });
    } catch (error) {
        console.error('Check admin error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 5. ADMIN LOGIN - Kuingia kwenye admin panel
// ============================================

router.post('/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'dullamanyama0@gmail.com';

        // Check if email matches admin email
        if (email !== ADMIN_EMAIL) {
            return res.status(401).json({ 
                error: `Invalid admin credentials. Only ${ADMIN_EMAIL} can access admin panel.`,
                admin_email: ADMIN_EMAIL 
            });
        }

        const snapshot = await db.collection('users')
            .where('email', '==', email)
            .get();

        if (snapshot.empty) {
            return res.status(401).json({ error: 'Admin account not found. Please sign up first.' });
        }

        const doc = snapshot.docs[0];
        const userData = doc.data();

        const valid = await bcrypt.compare(password, userData.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid admin credentials.' });
        }

        // Make sure admin flag is set
        if (!userData.is_admin) {
            await db.collection('users').doc(doc.id).update({
                is_admin: true,
                is_premium: true,
                is_verified: true,
            });
        }

        const JWT_SECRET = process.env.JWT_SECRET || 'tafuta-mpenzi-wako-super-secret-jwt-key-2026';
        const token = jwt.sign(
            { id: doc.id, username: userData.username, email: userData.email, is_admin: true },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Admin login successful!',
            token,
            admin: {
                id: doc.id,
                username: userData.username,
                email: userData.email,
                full_name: userData.full_name || 'Admin',
            },
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 6. LOGOUT - Kutoa token
// ============================================

router.post('/logout', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Update online status
        await db.collection('users').doc(userId).update({
            online_status: 'offline',
            last_seen: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({
            success: true,
            message: 'Logged out successfully!',
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 7. REFRESH TOKEN - Pata token mpya
// ============================================

router.post('/refresh-token', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found.' });
        }
        
        const userData = userDoc.data();
        const JWT_SECRET = process.env.JWT_SECRET || 'tafuta-mpenzi-wako-super-secret-jwt-key-2026';
        
        const token = jwt.sign(
            { id: userId, username: userData.username, email: userData.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;
