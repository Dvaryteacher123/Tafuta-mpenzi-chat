// ============================================
// TAFUTA MPENZI WAKO - Server.js
// ============================================

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const crypto = require('crypto');
const fs = require('fs');
const axios = require('axios');
const moment = require('moment');
const cron = require('node-cron');

// ============================================
// ENVIRONMENT VARIABLES
// ============================================
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'tafuta-mpenzi-wako-super-secret-jwt-key-2026';

// Admin Email
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'dullamanyama0@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';

// HarakaPay Configuration
const HARAKAPAY_API_KEY = process.env.HARAKAPAY_API_KEY || 'hpk_5b1bce001f22cd9a3a3566e8a47176eb55b37a66419f6a29';
const HARAKAPAY_BASE_URL = process.env.HARAKAPAY_BASE_URL || 'https://harakapay.net';
const HARAKAPAY_WEBHOOK_URL = process.env.HARAKAPAY_WEBHOOK_URL || 'https://tafuta-mpenzi-chat.onrender.com/api/webhook/harakapay';

// Free Trial Settings
const FREE_TRIAL_DAYS = parseInt(process.env.FREE_TRIAL_DAYS) || 3;

// Free Limits
const FREE_LIMITS = {
    messages: parseInt(process.env.FREE_LIMIT_MESSAGES) || 20,
    matches: parseInt(process.env.FREE_LIMIT_MATCHES) || 5,
    likes: parseInt(process.env.FREE_LIMIT_LIKES) || 10,
};

// ============================================
// FIREBASE ADMIN SDK
// ============================================
const admin = require('firebase-admin');

// Load Firebase service account
let serviceAccount;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else if (process.env.FIREBASE_PRIVATE_KEY) {
        serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        };
    } else {
        try {
            serviceAccount = require('./serviceAccountKey.json');
        } catch (e) {
            console.log('⚠️ No Firebase service account found.');
            serviceAccount = {
                projectId: process.env.FIREBASE_PROJECT_ID,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            };
        }
    }
} catch (error) {
    console.error('❌ Error loading Firebase service account:', error);
    serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    };
}

// Initialize Firebase Admin
if (admin.apps.length === 0) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log('✅ Firebase Admin initialized successfully!');
    } catch (error) {
        console.error('❌ Firebase Admin initialization error:', error);
    }
}

const db = admin.firestore();
const auth = admin.auth();

// ============================================
// EXPRESS APP
// ============================================
const app = express();
const server = http.createServer(app);

// ============================================
// SOCKET.IO
// ============================================
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

// ============================================
// MIDDLEWARE
// ============================================
app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session
app.use(session({
    secret: JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    },
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
});
app.use('/api/', limiter);

// ============================================
// ⭐⭐⭐ SERVE STATIC FILES ⭐⭐⭐
// ============================================

// Serve static files from root and public
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// ⭐⭐⭐ SERVE HTML FILES ⭐⭐⭐
// ============================================

function serveHTMLFile(filename, res) {
    const locations = [
        path.join(__dirname, filename),
        path.join(__dirname, 'public', filename),
    ];
    
    for (const loc of locations) {
        if (fs.existsSync(loc)) {
            return res.sendFile(loc);
        }
    }
    return res.status(404).send(`${filename} not found`);
}

app.get('/', (req, res) => serveHTMLFile('index.html', res));
app.get('/index.html', (req, res) => serveHTMLFile('index.html', res));
app.get('/login.html', (req, res) => serveHTMLFile('login.html', res));
app.get('/signup.html', (req, res) => serveHTMLFile('signup.html', res));
app.get('/admin.html', (req, res) => serveHTMLFile('admin.html', res));
app.get('/profile.html', (req, res) => serveHTMLFile('profile.html', res));
app.get('/chat.html', (req, res) => serveHTMLFile('chat.html', res));
app.get('/premium.html', (req, res) => serveHTMLFile('premium.html', res));
app.get('*.html', (req, res) => serveHTMLFile(req.path.substring(1), res));

// ============================================
// ⭐⭐⭐ API ROUTES - ZOTE ZIKO HAPA ⭐⭐⭐
// ============================================

// ============================================
// 1. AUTH ROUTES
// ============================================

// Signup
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { 
            full_name, username, email, phone, password, 
            date_of_birth, gender, location, bio, interests, profile_picture 
        } = req.body;

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

        const isAdmin = email === ADMIN_EMAIL;

        // Calculate trial expiration
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
            trial_active: isAdmin ? false : true,
            trial_started_at: isAdmin ? null : admin.firestore.FieldValue.serverTimestamp(),
            trial_expires_at: isAdmin ? null : trialExpiresAt,
            trial_used: false,
            subscription_status: isAdmin ? 'active' : 'free',
            premium_expires_at: isAdmin ? null : null,
        };

        const userRef = await db.collection('users').add(userData);
        const userId = userRef.id;
        await userRef.update({ id: userId });

        // Generate JWT
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

// Login
app.post('/api/auth/login', async (req, res) => {
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

        if (userData.is_banned) {
            return res.status(403).json({ error: 'This account has been banned.' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, userData.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Update last seen
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

// Check username
app.post('/api/auth/check-username', async (req, res) => {
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

// Check admin
app.get('/api/auth/check-admin', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userDoc = await db.collection('users').doc(decoded.id).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found.' });
        }
        
        const userData = userDoc.data();
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

// Admin login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

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

        if (!userData.is_admin) {
            await db.collection('users').doc(doc.id).update({
                is_admin: true,
                is_premium: true,
                is_verified: true,
            });
        }

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
// 2. USER ROUTES
// ============================================

// Get current user
app.get('/api/users/me', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userData = userDoc.data();
        
        let isPremium = userData.is_premium;
        let premiumExpiresAt = userData.premium_expires_at;
        
        if (isPremium && premiumExpiresAt) {
            const expiresAt = premiumExpiresAt.toDate ? 
                premiumExpiresAt.toDate() : 
                new Date(premiumExpiresAt);
            
            if (new Date() > expiresAt) {
                await db.collection('users').doc(userId).update({
                    is_premium: false,
                    premium_expires_at: null,
                    subscription_status: 'expired',
                });
                isPremium = false;
                premiumExpiresAt = null;
            }
        }

        let trialActive = userData.trial_active || false;
        let trialExpiresAt = userData.trial_expires_at;
        
        if (trialActive && trialExpiresAt) {
            const trialExpires = trialExpiresAt.toDate ? 
                trialExpiresAt.toDate() : 
                new Date(trialExpiresAt);
            
            if (new Date() > trialExpires) {
                await db.collection('users').doc(userId).update({
                    trial_active: false,
                });
                trialActive = false;
            }
        }

        res.json({
            success: true,
            user: {
                id: userId,
                username: userData.username,
                email: userData.email,
                full_name: userData.full_name || '',
                phone: userData.phone || '',
                date_of_birth: userData.date_of_birth || '',
                gender: userData.gender || '',
                location: userData.location || '',
                bio: userData.bio || '',
                interests: userData.interests || [],
                profile_picture: userData.profile_picture || '',
                is_premium: isPremium,
                is_admin: userData.is_admin || false,
                is_verified: userData.is_verified || false,
                online_status: userData.online_status || 'offline',
                last_seen: userData.last_seen,
                created_at: userData.created_at,
                premium_expires_at: premiumExpiresAt,
                trial_active: trialActive,
                trial_expires_at: trialExpiresAt,
                trial_used: userData.trial_used || false,
                subscription_status: userData.subscription_status || 'free',
            },
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userData = userDoc.data();
        if (userData.is_banned) {
            return res.status(403).json({ error: 'User is banned.' });
        }

        res.json({
            success: true,
            user: {
                id: userId,
                username: userData.username,
                full_name: userData.full_name || '',
                gender: userData.gender || '',
                location: userData.location || '',
                bio: userData.bio || '',
                interests: userData.interests || [],
                profile_picture: userData.profile_picture || '',
                is_premium: userData.is_premium || false,
                is_verified: userData.is_verified || false,
                online_status: userData.online_status || 'offline',
                last_seen: userData.last_seen,
            },
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Update profile
app.put('/api/users/profile', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const { full_name, username, bio, location, gender, date_of_birth, interests } = req.body;

        if (username) {
            const snapshot = await db.collection('users')
                .where('username', '==', username)
                .get();
            
            if (!snapshot.empty) {
                for (const doc of snapshot.docs) {
                    if (doc.id !== userId) {
                        return res.status(400).json({ error: 'Username already taken.' });
                    }
                }
            }
        }

        const updateData = {};
        if (full_name !== undefined) updateData.full_name = full_name;
        if (username !== undefined) updateData.username = username;
        if (bio !== undefined) updateData.bio = bio;
        if (location !== undefined) updateData.location = location;
        if (gender !== undefined) updateData.gender = gender;
        if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth;
        if (interests !== undefined) updateData.interests = interests;
        updateData.updated_at = admin.firestore.FieldValue.serverTimestamp();

        await db.collection('users').doc(userId).update(updateData);

        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        res.json({
            success: true,
            message: 'Profile updated successfully! ✅',
            user: {
                id: userId,
                username: userData.username,
                full_name: userData.full_name || '',
                bio: userData.bio || '',
                location: userData.location || '',
                gender: userData.gender || '',
                date_of_birth: userData.date_of_birth || '',
                interests: userData.interests || [],
            },
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Update profile picture
app.post('/api/users/profile-picture', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const { image_data } = req.body;

        if (!image_data) {
            return res.status(400).json({ error: 'Image data is required.' });
        }

        await db.collection('users').doc(userId).update({
            profile_picture: image_data,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({
            success: true,
            message: 'Profile picture updated! ✅',
            profile_picture: image_data,
        });
    } catch (error) {
        console.error('Update profile picture error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Change password
app.post('/api/users/change-password', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Current and new password are required.' });
        }

        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userData = userDoc.data();
        const valid = await bcrypt.compare(current_password, userData.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        const saltRounds = 10;
        const newHash = await bcrypt.hash(new_password, saltRounds);

        await db.collection('users').doc(userId).update({
            password_hash: newHash,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({ success: true, message: 'Password changed successfully! ✅' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Delete account
app.delete('/api/users/delete', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        await db.collection('users').doc(userId).delete();
        res.json({ success: true, message: 'Account deleted.' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Discover users
app.get('/api/users/discover', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const { gender, location, interests } = req.query;

        let query = db.collection('users').where('is_banned', '==', false);
        if (gender) query = query.where('gender', '==', gender);

        const snapshot = await query.get();
        const users = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            if (doc.id !== userId) {
                if (location && !data.location?.toLowerCase().includes(location.toLowerCase())) return;
                if (interests && !(data.interests || []).includes(interests)) return;
                users.push({
                    id: doc.id,
                    username: data.username,
                    full_name: data.full_name || '',
                    gender: data.gender || '',
                    location: data.location || '',
                    bio: data.bio || '',
                    interests: data.interests || [],
                    profile_picture: data.profile_picture || '',
                    is_premium: data.is_premium || false,
                    is_verified: data.is_verified || false,
                    online_status: data.online_status || 'offline',
                    last_seen: data.last_seen,
                });
            }
        });

        res.json({ success: true, users: users.slice(0, 50), count: users.length });
    } catch (error) {
        console.error('Discover error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Search users
app.get('/api/users/search', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const { q, gender, location, interests } = req.query;

        if (!q && !gender && !location && !interests) {
            return res.status(400).json({ error: 'At least one search parameter is required.' });
        }

        const snapshot = await db.collection('users').where('is_banned', '==', false).get();
        const users = [];

        snapshot.forEach(doc => {
            if (doc.id === userId) return;
            const data = doc.data();
            
            if (q) {
                const searchText = `${data.username} ${data.full_name} ${data.bio}`.toLowerCase();
                if (!searchText.includes(q.toLowerCase())) return;
            }
            if (gender && data.gender !== gender) return;
            if (location && !data.location?.toLowerCase().includes(location.toLowerCase())) return;
            if (interests && !(data.interests || []).includes(interests)) return;

            users.push({
                id: doc.id,
                username: data.username,
                full_name: data.full_name || '',
                gender: data.gender || '',
                location: data.location || '',
                bio: data.bio || '',
                interests: data.interests || [],
                profile_picture: data.profile_picture || '',
                is_premium: data.is_premium || false,
                is_verified: data.is_verified || false,
                online_status: data.online_status || 'offline',
                last_seen: data.last_seen,
            });
        });

        res.json({ success: true, users: users.slice(0, 50), count: users.length });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Like user
app.post('/api/users/like/:userId', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const likerId = decoded.id;
        const likedId = req.params.userId;

        if (likerId === likedId) {
            return res.status(400).json({ error: 'You cannot like yourself.' });
        }

        const userDoc = await db.collection('users').doc(likedId).get();
        if (!userDoc.exists || userDoc.data().is_banned) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const likeSnapshot = await db.collection('likes')
            .where('liker_id', '==', likerId)
            .where('liked_id', '==', likedId)
            .get();

        if (!likeSnapshot.empty) {
            return res.status(400).json({ error: 'Already liked this user.' });
        }

        await db.collection('likes').add({
            liker_id: likerId,
            liked_id: likedId,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        await db.collection('notifications').add({
            user_id: likedId,
            type: 'like',
            title: '❤️ New Like!',
            message: 'Someone liked your profile!',
            data: { liker_id: likerId },
            is_read: false,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({ success: true, message: 'User liked! ❤️' });
    } catch (error) {
        console.error('Like error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get likes
app.get('/api/users/likes', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const snapshot = await db.collection('likes').where('liked_id', '==', userId).get();
        const likes = [];

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const userDoc = await db.collection('users').doc(data.liker_id).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                likes.push({
                    id: doc.id,
                    ...data,
                    username: userData.username,
                    full_name: userData.full_name || '',
                    profile_picture: userData.profile_picture || '',
                });
            }
        }

        res.json({ success: true, likes });
    } catch (error) {
        console.error('Get likes error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Block user
app.post('/api/users/block/:userId', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const blockerId = decoded.id;
        const blockedId = req.params.userId;

        if (blockerId === blockedId) {
            return res.status(400).json({ error: 'You cannot block yourself.' });
        }

        const blockSnapshot = await db.collection('blocked_users')
            .where('blocker_id', '==', blockerId)
            .where('blocked_id', '==', blockedId)
            .get();

        if (!blockSnapshot.empty) {
            return res.status(400).json({ error: 'Already blocked this user.' });
        }

        await db.collection('blocked_users').add({
            blocker_id: blockerId,
            blocked_id: blockedId,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({ success: true, message: 'User blocked! 🚫' });
    } catch (error) {
        console.error('Block error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Report user
app.post('/api/users/report', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const reporterId = decoded.id;

        const { reported_id, reason, details } = req.body;

        if (!reported_id || !reason) {
            return res.status(400).json({ error: 'Reported user and reason are required.' });
        }

        if (reporterId === reported_id) {
            return res.status(400).json({ error: 'You cannot report yourself.' });
        }

        const userDoc = await db.collection('users').doc(reported_id).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found.' });
        }

        await db.collection('reports').add({
            reporter_id: reporterId,
            reported_id: reported_id,
            reason: reason,
            details: details || '',
            status: 'pending',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({ success: true, message: 'User reported! ✅' });
    } catch (error) {
        console.error('Report error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Random match
app.post('/api/users/match/random', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const snapshot = await db.collection('users').where('is_banned', '==', false).get();
        const availableUsers = [];

        snapshot.forEach(doc => {
            if (doc.id !== userId) {
                availableUsers.push({ id: doc.id, ...doc.data() });
            }
        });

        if (availableUsers.length === 0) {
            return res.json({ success: false, message: 'No users available for matching.' });
        }

        const blockedSnapshot = await db.collection('blocked_users')
            .where('blocker_id', '==', userId)
            .get();
        
        const blockedIds = new Set();
        blockedSnapshot.forEach(doc => blockedIds.add(doc.data().blocked_id));

        const filteredUsers = availableUsers.filter(u => !blockedIds.has(u.id));

        if (filteredUsers.length === 0) {
            return res.json({ success: false, message: 'No users available for matching.' });
        }

        const randomIndex = Math.floor(Math.random() * filteredUsers.length);
        const matchedUser = filteredUsers[randomIndex];

        await db.collection('matches').add({
            user1_id: userId,
            user2_id: matchedUser.id,
            status: 'pending',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        await db.collection('notifications').add({
            user_id: matchedUser.id,
            type: 'match',
            title: '💕 New Match!',
            message: 'Someone matched with you!',
            data: { matched_user_id: userId },
            is_read: false,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({
            success: true,
            match: {
                id: matchedUser.id,
                username: matchedUser.username,
                full_name: matchedUser.full_name || '',
                gender: matchedUser.gender || '',
                location: matchedUser.location || '',
                bio: matchedUser.bio || '',
                interests: matchedUser.interests || [],
                profile_picture: matchedUser.profile_picture || '',
                is_premium: matchedUser.is_premium || false,
                is_verified: matchedUser.is_verified || false,
                online_status: matchedUser.online_status || 'offline',
                last_seen: matchedUser.last_seen,
            },
            message: '💕 Match Found!',
        });
    } catch (error) {
        console.error('Random match error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get matches
app.get('/api/users/matches', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const snapshot = await db.collection('matches').where('user1_id', '==', userId).get();
        const snapshot2 = await db.collection('matches').where('user2_id', '==', userId).get();

        const matches = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            matches.push({ id: doc.id, ...data, matched_user_id: data.user2_id });
        });

        snapshot2.forEach(doc => {
            const data = doc.data();
            matches.push({ id: doc.id, ...data, matched_user_id: data.user1_id });
        });

        const matchesWithDetails = [];
        for (const match of matches) {
            const userDoc = await db.collection('users').doc(match.matched_user_id).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                matchesWithDetails.push({
                    ...match,
                    username: userData.username,
                    full_name: userData.full_name || '',
                    profile_picture: userData.profile_picture || '',
                    is_premium: userData.is_premium || false,
                    is_verified: userData.is_verified || false,
                    online_status: userData.online_status || 'offline',
                    last_seen: userData.last_seen,
                });
            }
        }

        res.json({ success: true, matches: matchesWithDetails });
    } catch (error) {
        console.error('Get matches error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get stats
app.get('/api/users/stats', async (req, res) => {
    try {
        const usersSnapshot = await db.collection('users').get();
        const totalUsers = usersSnapshot.size;

        const onlineSnapshot = await db.collection('users').where('online_status', '==', 'online').get();
        const onlineUsers = onlineSnapshot.size;

        const matchesSnapshot = await db.collection('matches').get();
        const totalMatches = matchesSnapshot.size;

        const messagesSnapshot = await db.collection('messages').get();
        const totalMessages = messagesSnapshot.size;

        res.json({ success: true, totalUsers, onlineUsers, totalMatches, totalMessages });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 3. CHAT ROUTES
// ============================================

// Get or create conversation
app.post('/api/chat/conversations/:userId', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user1Id = decoded.id;
        const user2Id = req.params.userId;

        if (user1Id === user2Id) {
            return res.status(400).json({ error: 'Cannot chat with yourself.' });
        }

        const blockCheck = await db.collection('blocked_users')
            .where('blocker_id', '==', user1Id)
            .where('blocked_id', '==', user2Id)
            .get();

        if (!blockCheck.empty) {
            return res.status(403).json({ error: 'You cannot chat with this user.' });
        }

        const convSnapshot = await db.collection('conversations')
            .where('user1_id', '==', user1Id)
            .where('user2_id', '==', user2Id)
            .get();

        let conversationId;

        if (convSnapshot.empty) {
            const convSnapshot2 = await db.collection('conversations')
                .where('user1_id', '==', user2Id)
                .where('user2_id', '==', user1Id)
                .get();

            if (!convSnapshot2.empty) {
                conversationId = convSnapshot2.docs[0].id;
            } else {
                const newConv = await db.collection('conversations').add({
                    user1_id: user1Id,
                    user2_id: user2Id,
                    last_message: '',
                    last_message_time: admin.firestore.FieldValue.serverTimestamp(),
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                });
                conversationId = newConv.id;
            }
        } else {
            conversationId = convSnapshot.docs[0].id;
        }

        res.json({ success: true, conversation_id: conversationId });
    } catch (error) {
        console.error('Get conversation error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get conversations
app.get('/api/chat/conversations', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const snapshot = await db.collection('conversations').where('user1_id', '==', userId).get();
        const snapshot2 = await db.collection('conversations').where('user2_id', '==', userId).get();

        const conversations = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            conversations.push({ id: doc.id, ...data, other_user_id: data.user2_id });
        });

        snapshot2.forEach(doc => {
            const data = doc.data();
            conversations.push({ id: doc.id, ...data, other_user_id: data.user1_id });
        });

        const conversationsWithDetails = [];
        for (const conv of conversations) {
            const userDoc = await db.collection('users').doc(conv.other_user_id).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                
                const unreadSnapshot = await db.collection('messages')
                    .where('conversation_id', '==', conv.id)
                    .where('receiver_id', '==', userId)
                    .where('is_read', '==', false)
                    .get();

                conversationsWithDetails.push({
                    id: conv.id,
                    other_user_id: conv.other_user_id,
                    username: userData.username,
                    full_name: userData.full_name || '',
                    profile_picture: userData.profile_picture || '',
                    is_premium: userData.is_premium || false,
                    is_verified: userData.is_verified || false,
                    online_status: userData.online_status || 'offline',
                    last_seen: userData.last_seen,
                    last_message: conv.last_message || '',
                    last_message_time: conv.last_message_time,
                    unread_count: unreadSnapshot.size,
                    created_at: conv.created_at,
                });
            }
        }

        conversationsWithDetails.sort((a, b) => {
            const aTime = a.last_message_time?.toDate ? a.last_message_time.toDate() : new Date(0);
            const bTime = b.last_message_time?.toDate ? b.last_message_time.toDate() : new Date(0);
            return bTime - aTime;
        });

        res.json({ success: true, conversations: conversationsWithDetails });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get messages
app.get('/api/chat/messages/:conversationId', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const conversationId = req.params.conversationId;
        const limit = parseInt(req.query.limit) || 50;

        const convDoc = await db.collection('conversations').doc(conversationId).get();
        if (!convDoc.exists) {
            return res.status(404).json({ error: 'Conversation not found.' });
        }

        const convData = convDoc.data();
        if (convData.user1_id !== userId && convData.user2_id !== userId) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const messages = [];
        const snapshot = await db.collection('messages')
            .where('conversation_id', '==', conversationId)
            .orderBy('created_at', 'desc')
            .limit(limit)
            .get();

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.is_deleted) {
                messages.push({ id: doc.id, ...data });
            }
        });

        const unreadSnapshot = await db.collection('messages')
            .where('conversation_id', '==', conversationId)
            .where('receiver_id', '==', userId)
            .where('is_read', '==', false)
            .get();

        const batch = db.batch();
        unreadSnapshot.forEach(doc => {
            batch.update(doc.ref, { is_read: true, is_delivered: true });
        });
        await batch.commit();

        res.json({ success: true, messages: messages.reverse() });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Send message
app.post('/api/chat/messages', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const senderId = decoded.id;

        const { conversation_id, receiver_id, message, message_type, image_data } = req.body;

        if (!conversation_id || !receiver_id) {
            return res.status(400).json({ error: 'Conversation ID and receiver ID are required.' });
        }

        const blockCheck = await db.collection('blocked_users')
            .where('blocker_id', '==', receiver_id)
            .where('blocked_id', '==', senderId)
            .get();

        if (!blockCheck.empty) {
            return res.status(403).json({ error: 'You have been blocked by this user.' });
        }

        const messageData = {
            conversation_id: conversation_id,
            sender_id: senderId,
            receiver_id: receiver_id,
            message_type: message_type || 'text',
            is_read: false,
            is_delivered: false,
            is_deleted: false,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (message_type === 'image' && image_data) {
            messageData.image_url = image_data;
            messageData.message = '';
        } else {
            messageData.message = message || '';
        }

        const msgRef = await db.collection('messages').add(messageData);

        await db.collection('conversations').doc(conversation_id).update({
            last_message: messageData.message || '📷 Image',
            last_message_time: admin.firestore.FieldValue.serverTimestamp(),
        });

        const senderDoc = await db.collection('users').doc(senderId).get();
        const senderData = senderDoc.data();

        io.to(`chat-${receiver_id}`).emit('new-message', {
            id: msgRef.id,
            ...messageData,
            sender_name: senderData.full_name || senderData.username,
            sender_username: senderData.username,
        });

        io.to(`chat-${senderId}`).emit('message-sent', {
            id: msgRef.id,
            ...messageData,
        });

        await db.collection('notifications').add({
            user_id: receiver_id,
            type: 'message',
            title: '💬 New Message',
            message: `${senderData.full_name || senderData.username} sent you a message`,
            data: { 
                sender_id: senderId,
                conversation_id: conversation_id,
                message_id: msgRef.id,
            },
            is_read: false,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({ success: true, message_id: msgRef.id });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Delete message
app.delete('/api/chat/messages/:messageId', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const messageId = req.params.messageId;
        const msgDoc = await db.collection('messages').doc(messageId).get();

        if (!msgDoc.exists) {
            return res.status(404).json({ error: 'Message not found.' });
        }

        const msgData = msgDoc.data();
        if (msgData.sender_id !== userId) {
            return res.status(403).json({ error: 'You can only delete your own messages.' });
        }

        await db.collection('messages').doc(messageId).update({
            is_deleted: true,
            message: 'This message was deleted',
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({ success: true, message: 'Message deleted.' });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Mark messages as read
app.post('/api/chat/messages/read', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'User ID is required.' });
        }

        const convSnapshot = await db.collection('conversations')
            .where('user1_id', '==', userId)
            .where('user2_id', '==', user_id)
            .get();

        const convSnapshot2 = await db.collection('conversations')
            .where('user1_id', '==', user_id)
            .where('user2_id', '==', userId)
            .get();

        const conversations = [];
        convSnapshot.forEach(doc => conversations.push(doc.id));
        convSnapshot2.forEach(doc => conversations.push(doc.id));

        const batch = db.batch();
        for (const convId of conversations) {
            const msgSnapshot = await db.collection('messages')
                .where('conversation_id', '==', convId)
                .where('receiver_id', '==', userId)
                .where('is_read', '==', false)
                .get();

            msgSnapshot.forEach(doc => {
                batch.update(doc.ref, { is_read: true, is_delivered: true });
            });
        }
        await batch.commit();

        res.json({ success: true });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get notifications
app.get('/api/chat/notifications', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const limit = parseInt(req.query.limit) || 50;

        const snapshot = await db.collection('notifications')
            .where('user_id', '==', userId)
            .orderBy('created_at', 'desc')
            .limit(limit)
            .get();

        const notifications = [];
        snapshot.forEach(doc => {
            notifications.push({ id: doc.id, ...doc.data() });
        });

        res.json({
            success: true,
            notifications: notifications,
            unread_count: notifications.filter(n => !n.is_read).length,
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Mark notification as read
app.post('/api/chat/notifications/read/:notificationId', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const notificationId = req.params.notificationId;

        const notifDoc = await db.collection('notifications').doc(notificationId).get();
        if (!notifDoc.exists) {
            return res.status(404).json({ error: 'Notification not found.' });
        }

        const notifData = notifDoc.data();
        if (notifData.user_id !== userId) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        await db.collection('notifications').doc(notificationId).update({ is_read: true });

        res.json({ success: true });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Mark all notifications as read
app.post('/api/chat/notifications/read-all', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const snapshot = await db.collection('notifications')
            .where('user_id', '==', userId)
            .where('is_read', '==', false)
            .get();

        const batch = db.batch();
        snapshot.forEach(doc => {
            batch.update(doc.ref, { is_read: true });
        });
        await batch.commit();

        res.json({ success: true });
    } catch (error) {
        console.error('Mark all notifications read error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 4. PAYMENT ROUTES
// ============================================

// Get plans
app.get('/api/payments/plans', async (req, res) => {
    try {
        const snapshot = await db.collection('premium_plans')
            .where('is_active', '==', true)
            .orderBy('price')
            .get();

        const plans = [];
        snapshot.forEach(doc => {
            plans.push({ id: doc.id, ...doc.data() });
        });

        res.json({ success: true, plans });
    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get plan by ID
app.get('/api/payments/plans/:planId', async (req, res) => {
    try {
        const planId = req.params.planId;
        const doc = await db.collection('premium_plans').doc(planId).get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Plan not found.' });
        }

        res.json({ success: true, plan: { id: doc.id, ...doc.data() } });
    } catch (error) {
        console.error('Get plan error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Initiate payment
app.post('/api/payments/initiate', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const { plan_id, phone } = req.body;

        if (!plan_id || !phone) {
            return res.status(400).json({ error: 'Plan ID and phone number are required.' });
        }

        const planDoc = await db.collection('premium_plans').doc(plan_id).get();
        if (!planDoc.exists) {
            return res.status(404).json({ error: 'Plan not found.' });
        }

        const plan = planDoc.data();

        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userData = userDoc.data();

        const orderId = `HP${Date.now()}${Math.random().toString(36).substring(2, 10)}`;

        const paymentData = {
            user_id: userId,
            user_name: userData.full_name || userData.username,
            order_id: orderId,
            plan_id: plan_id,
            plan_name: plan.name,
            amount: plan.price,
            currency: 'TZS',
            phone: phone,
            status: 'pending',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        };

        const paymentRef = await db.collection('payments').add(paymentData);
        const paymentId = paymentRef.id;

        try {
            const harakapayResponse = await axios.post(
                `${HARAKAPAY_BASE_URL}/api/v1/collect`,
                {
                    phone: phone,
                    amount: plan.price,
                    description: `Premium Upgrade - ${plan.name} - ${orderId}`,
                    webhook_url: HARAKAPAY_WEBHOOK_URL,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': HARAKAPAY_API_KEY,
                    },
                    timeout: 30000,
                }
            );

            if (harakapayResponse.data.success) {
                await db.collection('payments').doc(paymentId).update({
                    harakapay_order_id: harakapayResponse.data.order_id,
                });

                res.json({
                    success: true,
                    message: 'Payment initiated successfully.',
                    order_id: orderId,
                    harakapay_order_id: harakapayResponse.data.order_id,
                    status: 'pending',
                });
            } else {
                await db.collection('payments').doc(paymentId).update({
                    status: 'failed',
                    error: harakapayResponse.data.error || 'Payment initiation failed',
                });

                res.status(400).json({
                    success: false,
                    error: harakapayResponse.data.error || 'Payment initiation failed.',
                    status: 'failed',
                });
            }
        } catch (harakaError) {
            console.error('HarakaPay error:', harakaError);
            await db.collection('payments').doc(paymentId).update({
                status: 'failed',
                error: harakaError.message || 'Payment gateway error',
            });

            res.status(500).json({
                success: false,
                error: 'Payment gateway error. Please try again.',
                status: 'failed',
            });
        }
    } catch (error) {
        console.error('Initiate payment error:', error);
        res.status(500).json({ success: false, error: 'Payment initiation failed.' });
    }
});

// HarakaPay Webhook
app.post('/api/webhook/harakapay', async (req, res) => {
    try {
        const payload = req.body;
        console.log('📨 HarakaPay Webhook received:', JSON.stringify(payload, null, 2));

        const { order_id, status, amount, net_amount, fee_amount, completed_at } = payload;

        if (!order_id) {
            console.error('No order_id in webhook payload');
            return res.status(400).json({ error: 'Invalid webhook payload' });
        }

        const paymentSnapshot = await db.collection('payments')
            .where('harakapay_order_id', '==', order_id)
            .get();

        if (paymentSnapshot.empty) {
            console.error('Payment not found for order_id:', order_id);
            return res.status(404).json({ error: 'Payment not found' });
        }

        const paymentDoc = paymentSnapshot.docs[0];
        const paymentId = paymentDoc.id;
        const paymentData = paymentDoc.data();

        if (paymentData.status === 'completed') {
            console.log('Payment already completed:', order_id);
            return res.json({ status: 'already_processed' });
        }

        const updateData = {
            status: status,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (completed_at) updateData.completed_at = new Date(completed_at);
        if (net_amount) updateData.net_amount = net_amount;
        if (fee_amount) updateData.fee_amount = fee_amount;

        await db.collection('payments').doc(paymentId).update(updateData);

        if (status === 'completed' || status === 'converted') {
            const userId = paymentData.user_id;
            
            const planDoc = await db.collection('premium_plans').doc(paymentData.plan_id).get();
            const plan = planDoc.data();

            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();

            let expiresAt = new Date();
            
            if (userData.is_premium && userData.premium_expires_at) {
                const currentExpiry = userData.premium_expires_at.toDate ? 
                    userData.premium_expires_at.toDate() : 
                    new Date(userData.premium_expires_at);
                
                if (new Date() < currentExpiry) {
                    expiresAt = new Date(currentExpiry);
                    expiresAt.setDate(expiresAt.getDate() + plan.duration_days);
                } else {
                    expiresAt.setDate(expiresAt.getDate() + plan.duration_days);
                }
            } else {
                expiresAt.setDate(expiresAt.getDate() + plan.duration_days);
            }

            await db.collection('users').doc(userId).update({
                is_premium: true,
                premium_started_at: admin.firestore.FieldValue.serverTimestamp(),
                premium_expires_at: expiresAt,
                subscription_status: 'active',
            });

            if (userData.trial_active) {
                await db.collection('users').doc(userId).update({ trial_active: false });
            }

            await db.collection('notifications').add({
                user_id: userId,
                type: 'premium_activated',
                title: '⭐ Premium Activated!',
                message: `Congratulations! Your ${plan.name} is now active. Expires: ${expiresAt.toLocaleDateString()}`,
                data: { plan: plan.name, expires_at: expiresAt },
                is_read: false,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`✅ User ${userId} upgraded to Premium!`);
        }

        res.json({ status: 'success' });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Check payment status
app.get('/api/payments/status/:orderId', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const orderId = req.params.orderId;

        const snapshot = await db.collection('payments')
            .where('order_id', '==', orderId)
            .where('user_id', '==', userId)
            .get();

        if (snapshot.empty) {
            return res.status(404).json({ error: 'Payment not found.' });
        }

        const doc = snapshot.docs[0];
        const paymentData = doc.data();

        try {
            const response = await axios.get(
                `${HARAKAPAY_BASE_URL}/api/v1/status/${paymentData.harakapay_order_id}`,
                {
                    headers: { 'X-API-Key': HARAKAPAY_API_KEY },
                    timeout: 15000,
                }
            );

            if (response.data.success && response.data.payment) {
                const harakaStatus = response.data.payment.status;
                
                if (harakaStatus !== paymentData.status) {
                    await db.collection('payments').doc(doc.id).update({
                        status: harakaStatus,
                        updated_at: admin.firestore.FieldValue.serverTimestamp(),
                    });

                    if (harakaStatus === 'completed' || harakaStatus === 'converted') {
                        const userId = paymentData.user_id;
                        const planDoc = await db.collection('premium_plans').doc(paymentData.plan_id).get();
                        const plan = planDoc.data();

                        const userDoc = await db.collection('users').doc(userId).get();
                        const userData = userDoc.data();

                        let expiresAt = new Date();
                        
                        if (userData.is_premium && userData.premium_expires_at) {
                            const currentExpiry = userData.premium_expires_at.toDate ? 
                                userData.premium_expires_at.toDate() : 
                                new Date(userData.premium_expires_at);
                            
                            if (new Date() < currentExpiry) {
                                expiresAt = new Date(currentExpiry);
                                expiresAt.setDate(expiresAt.getDate() + plan.duration_days);
                            } else {
                                expiresAt.setDate(expiresAt.getDate() + plan.duration_days);
                            }
                        } else {
                            expiresAt.setDate(expiresAt.getDate() + plan.duration_days);
                        }

                        await db.collection('users').doc(userId).update({
                            is_premium: true,
                            premium_started_at: admin.firestore.FieldValue.serverTimestamp(),
                            premium_expires_at: expiresAt,
                            subscription_status: 'active',
                        });

                        await db.collection('notifications').add({
                            user_id: userId,
                            type: 'premium_activated',
                            title: '⭐ Premium Activated!',
                            message: `Your ${plan.name} is now active! 🎉`,
                            is_read: false,
                            created_at: admin.firestore.FieldValue.serverTimestamp(),
                        });
                    }
                }

                return res.json({
                    success: true,
                    status: harakaStatus,
                    payment: {
                        order_id: paymentData.order_id,
                        amount: paymentData.amount,
                        plan_name: paymentData.plan_name,
                        status: harakaStatus,
                    },
                });
            }
        } catch (harakaError) {
            console.error('HarakaPay status check error:', harakaError);
        }

        res.json({
            success: true,
            status: paymentData.status,
            payment: {
                order_id: paymentData.order_id,
                amount: paymentData.amount,
                plan_name: paymentData.plan_name,
                status: paymentData.status,
            },
        });
    } catch (error) {
        console.error('Payment status error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get payment history
app.get('/api/payments/history', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const limit = parseInt(req.query.limit) || 50;

        const snapshot = await db.collection('payments')
            .where('user_id', '==', userId)
            .orderBy('created_at', 'desc')
            .limit(limit)
            .get();

        const payments = [];
        snapshot.forEach(doc => {
            payments.push({ id: doc.id, ...doc.data() });
        });

        res.json({ success: true, payments });
    } catch (error) {
        console.error('Get payment history error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 5. ADMIN ROUTES
// ============================================

// Dashboard stats
app.get('/api/admin/dashboard/stats', async (req, res) => {
    try {
        const usersSnapshot = await db.collection('users').get();
        const totalUsers = usersSnapshot.size;

        const onlineSnapshot = await db.collection('users').where('online_status', '==', 'online').get();
        const onlineUsers = onlineSnapshot.size;

        const premiumSnapshot = await db.collection('users').where('is_premium', '==', true).get();
        const premiumUsers = premiumSnapshot.size;

        const freeUsers = totalUsers - premiumUsers;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todaySignupsSnapshot = await db.collection('users')
            .where('created_at', '>=', today)
            .where('created_at', '<', tomorrow)
            .get();
        const todaySignups = todaySignupsSnapshot.size;

        const paymentsSnapshot = await db.collection('payments').get();
        let totalRevenue = 0;
        let todayRevenue = 0;
        let pendingPayments = 0;
        let todayPayments = 0;

        paymentsSnapshot.forEach(doc => {
            const data = doc.data();
            const amount = data.amount || 0;
            const status = data.status || 'pending';
            const createdAt = data.created_at?.toDate ? data.created_at.toDate() : new Date(data.created_at);

            if (status === 'completed') {
                totalRevenue += amount;
                if (createdAt >= today && createdAt < tomorrow) {
                    todayRevenue += amount;
                    todayPayments++;
                }
            }
            if (status === 'pending') {
                pendingPayments++;
            }
        });

        const reportsSnapshot = await db.collection('reports').where('status', '==', 'pending').get();
        const pendingReports = reportsSnapshot.size;

        res.json({
            success: true,
            stats: {
                totalUsers,
                onlineUsers,
                premiumUsers,
                freeUsers,
                todaySignups,
                totalRevenue,
                todayRevenue,
                todayPayments,
                pendingPayments,
                pendingReports,
            },
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get all users (admin)
app.get('/api/admin/users', async (req, res) => {
    try {
        const { search, filter } = req.query;

        let query = db.collection('users');

        if (filter === 'premium') query = query.where('is_premium', '==', true);
        else if (filter === 'free') query = query.where('is_premium', '==', false);
        else if (filter === 'banned') query = query.where('is_banned', '==', true);

        const snapshot = await query.get();
        const users = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            delete data.password_hash;
            
            if (search) {
                const searchLower = search.toLowerCase();
                const nameMatch = (data.full_name || '').toLowerCase().includes(searchLower);
                const usernameMatch = (data.username || '').toLowerCase().includes(searchLower);
                const emailMatch = (data.email || '').toLowerCase().includes(searchLower);
                if (!nameMatch && !usernameMatch && !emailMatch) return;
            }

            users.push({ id: doc.id, ...data });
        });

        res.json({ success: true, users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get user by ID (admin)
app.get('/api/admin/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userData = userDoc.data();
        delete userData.password_hash;

        res.json({ success: true, user: { id: userId, ...userData } });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Ban user (admin)
app.post('/api/admin/users/ban/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        await db.collection('users').doc(userId).update({
            is_banned: true,
            banned_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        res.json({ success: true, message: 'User banned!' });
    } catch (error) {
        console.error('Ban user error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Unban user (admin)
app.post('/api/admin/users/unban/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        await db.collection('users').doc(userId).update({
            is_banned: false,
            banned_at: null,
        });
        res.json({ success: true, message: 'User unbanned!' });
    } catch (error) {
        console.error('Unban user error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Make premium (admin)
app.post('/api/admin/users/make-premium/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const { duration_days } = req.body;
        const days = duration_days || 30;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);

        await db.collection('users').doc(userId).update({
            is_premium: true,
            premium_started_at: admin.firestore.FieldValue.serverTimestamp(),
            premium_expires_at: expiresAt,
            subscription_status: 'active',
        });

        await db.collection('notifications').add({
            user_id: userId,
            type: 'premium_activated',
            title: '⭐ Premium Activated!',
            message: `Admin activated your Premium for ${days} days. Enjoy! 🎉`,
            is_read: false,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({ success: true, message: 'User is now Premium!' });
    } catch (error) {
        console.error('Make premium error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Remove premium (admin)
app.post('/api/admin/users/remove-premium/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        await db.collection('users').doc(userId).update({
            is_premium: false,
            premium_expires_at: null,
            subscription_status: 'free',
        });
        res.json({ success: true, message: 'Premium removed!' });
    } catch (error) {
        console.error('Remove premium error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Delete user (admin)
app.delete('/api/admin/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        await db.collection('users').doc(userId).delete();
        res.json({ success: true, message: 'User deleted!' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get all payments (admin)
app.get('/api/admin/payments', async (req, res) => {
    try {
        const snapshot = await db.collection('payments').orderBy('created_at', 'desc').get();
        const payments = [];
        snapshot.forEach(doc => {
            payments.push({ id: doc.id, ...doc.data() });
        });
        res.json({ success: true, payments });
    } catch (error) {
        console.error('Get payments error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get payment by ID (admin)
app.get('/api/admin/payments/:paymentId', async (req, res) => {
    try {
        const paymentId = req.params.paymentId;
        const doc = await db.collection('payments').doc(paymentId).get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Payment not found.' });
        }

        res.json({ success: true, payment: { id: doc.id, ...doc.data() } });
    } catch (error) {
        console.error('Get payment error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Update payment (admin)
app.put('/api/admin/payments/update/:paymentId', async (req, res) => {
    try {
        const paymentId = req.params.paymentId;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required.' });
        }

        const paymentDoc = await db.collection('payments').doc(paymentId).get();
        if (!paymentDoc.exists) {
            return res.status(404).json({ error: 'Payment not found.' });
        }

        await db.collection('payments').doc(paymentId).update({
            status: status,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        if (status === 'completed') {
            const paymentData = paymentDoc.data();
            const userId = paymentData.user_id;
            const planDoc = await db.collection('premium_plans').doc(paymentData.plan_id).get();
            const plan = planDoc.data();

            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();

            let expiresAt = new Date();
            
            if (userData.is_premium && userData.premium_expires_at) {
                const currentExpiry = userData.premium_expires_at.toDate ? 
                    userData.premium_expires_at.toDate() : 
                    new Date(userData.premium_expires_at);
                
                if (new Date() < currentExpiry) {
                    expiresAt = new Date(currentExpiry);
                    expiresAt.setDate(expiresAt.getDate() + plan.duration_days);
                } else {
                    expiresAt.setDate(expiresAt.getDate() + plan.duration_days);
                }
            } else {
                expiresAt.setDate(expiresAt.getDate() + plan.duration_days);
            }

            await db.collection('users').doc(userId).update({
                is_premium: true,
                premium_started_at: admin.firestore.FieldValue.serverTimestamp(),
                premium_expires_at: expiresAt,
                subscription_status: 'active',
            });

            await db.collection('notifications').add({
                user_id: userId,
                type: 'premium_activated',
                title: '⭐ Premium Activated!',
                message: `Your ${plan.name} is now active! 🎉`,
                is_read: false,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        res.json({ success: true, message: 'Payment updated!' });
    } catch (error) {
        console.error('Update payment error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get plans (admin)
app.get('/api/admin/plans', async (req, res) => {
    try {
        const snapshot = await db.collection('premium_plans').orderBy('price').get();
        const plans = [];
        snapshot.forEach(doc => {
            plans.push({ id: doc.id, ...doc.data() });
        });
        res.json({ success: true, plans });
    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Create plan (admin)
app.post('/api/admin/plans', async (req, res) => {
    try {
        const { name, price, duration_days, features, is_active } = req.body;

        if (!name || !price || !duration_days) {
            return res.status(400).json({ error: 'Name, price and duration are required.' });
        }

        const planData = {
            name,
            price: parseFloat(price),
            duration_days: parseInt(duration_days),
            features: features || [],
            is_active: is_active !== undefined ? is_active : true,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        };

        const planRef = await db.collection('premium_plans').add(planData);

        res.json({ success: true, message: 'Plan created!', plan: { id: planRef.id, ...planData } });
    } catch (error) {
        console.error('Create plan error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Update plan (admin)
app.put('/api/admin/plans/:planId', async (req, res) => {
    try {
        const planId = req.params.planId;
        const { name, price, duration_days, features, is_active } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (price !== undefined) updateData.price = parseFloat(price);
        if (duration_days !== undefined) updateData.duration_days = parseInt(duration_days);
        if (features !== undefined) updateData.features = features;
        if (is_active !== undefined) updateData.is_active = is_active;
        updateData.updated_at = admin.firestore.FieldValue.serverTimestamp();

        await db.collection('premium_plans').doc(planId).update(updateData);

        res.json({ success: true, message: 'Plan updated!' });
    } catch (error) {
        console.error('Update plan error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Delete plan (admin)
app.delete('/api/admin/plans/:planId', async (req, res) => {
    try {
        const planId = req.params.planId;
        await db.collection('premium_plans').doc(planId).delete();
        res.json({ success: true, message: 'Plan deleted!' });
    } catch (error) {
        console.error('Delete plan error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get reports (admin)
app.get('/api/admin/reports', async (req, res) => {
    try {
        const { status } = req.query;
        let query = db.collection('reports');

        if (status && status !== 'all') {
            query = query.where('status', '==', status);
        }

        const snapshot = await query.orderBy('created_at', 'desc').get();
        const reports = [];

        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            let reporterName = 'Unknown';
            try {
                const reporterDoc = await db.collection('users').doc(data.reporter_id).get();
                if (reporterDoc.exists) {
                    const reporterData = reporterDoc.data();
                    reporterName = reporterData.full_name || reporterData.username || 'Unknown';
                }
            } catch (e) {}

            let reportedName = 'Unknown';
            try {
                const reportedDoc = await db.collection('users').doc(data.reported_id).get();
                if (reportedDoc.exists) {
                    const reportedData = reportedDoc.data();
                    reportedName = reportedData.full_name || reportedData.username || 'Unknown';
                }
            } catch (e) {}

            reports.push({
                id: doc.id,
                ...data,
                reporter_name: reporterName,
                reported_name: reportedName,
            });
        }

        res.json({ success: true, reports });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Update report (admin)
app.put('/api/admin/reports/:reportId', async (req, res) => {
    try {
        const reportId = req.params.reportId;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required.' });
        }

        await db.collection('reports').doc(reportId).update({
            status: status,
            reviewed_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({ success: true, message: 'Report updated!' });
    } catch (error) {
        console.error('Update report error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Delete report (admin)
app.delete('/api/admin/reports/:reportId', async (req, res) => {
    try {
        const reportId = req.params.reportId;
        await db.collection('reports').doc(reportId).delete();
        res.json({ success: true, message: 'Report deleted!' });
    } catch (error) {
        console.error('Delete report error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Send notification (admin)
app.post('/api/admin/notifications/send', async (req, res) => {
    try {
        const { target, user_id, title, message, data } = req.body;

        if (!target || !title || !message) {
            return res.status(400).json({ error: 'Target, title and message are required.' });
        }

        const notificationData = {
            title,
            message,
            data: data || {},
            sent_by: 'admin',
            sent_at: admin.firestore.FieldValue.serverTimestamp(),
            is_read: false,
        };

        let users = [];

        if (target === 'specific' && user_id) {
            users = [user_id];
        } else if (target === 'all') {
            const snapshot = await db.collection('users').get();
            snapshot.forEach(doc => users.push(doc.id));
        } else if (target === 'premium') {
            const snapshot = await db.collection('users').where('is_premium', '==', true).get();
            snapshot.forEach(doc => users.push(doc.id));
        } else if (target === 'free') {
            const snapshot = await db.collection('users').where('is_premium', '==', false).get();
            snapshot.forEach(doc => users.push(doc.id));
        }

        const batch = db.batch();
        for (const uid of users) {
            const notifRef = db.collection('notifications').doc();
            batch.set(notifRef, {
                user_id: uid,
                ...notificationData,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        await batch.commit();

        res.json({ success: true, message: `Notification sent to ${users.length} users!`, count: users.length });
    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get sent notifications (admin)
app.get('/api/admin/notifications/sent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const snapshot = await db.collection('notifications')
            .where('sent_by', '==', 'admin')
            .orderBy('sent_at', 'desc')
            .limit(limit)
            .get();

        const notifications = [];
        snapshot.forEach(doc => {
            notifications.push({ id: doc.id, ...doc.data() });
        });

        res.json({ success: true, notifications });
    } catch (error) {
        console.error('Get sent notifications error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// CREATE DEFAULT PLANS
// ============================================

async function createDefaultPlans() {
    try {
        const snapshot = await db.collection('premium_plans').get();
        if (snapshot.empty) {
            console.log('📝 Creating default premium plans...');
            const plans = [
                {
                    name: 'Premium 7 Days',
                    price: 2000,
                    duration_days: 7,
                    features: ['Unlimited Chat', 'Advanced Search', 'See Who Liked You', 'Premium Badge', 'Priority Matching'],
                    is_active: true,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                },
                {
                    name: 'Premium 30 Days',
                    price: 5000,
                    duration_days: 30,
                    features: ['Unlimited Chat', 'Advanced Search', 'See Who Liked You', 'Premium Badge', 'Priority Matching', 'Profile Boost'],
                    is_active: true,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                },
                {
                    name: 'Premium 90 Days',
                    price: 12000,
                    duration_days: 90,
                    features: ['Unlimited Chat', 'Advanced Search', 'See Who Liked You', 'Premium Badge', 'Priority Matching', 'Profile Boost', 'VIP Support'],
                    is_active: true,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                },
                {
                    name: 'Premium 365 Days',
                    price: 40000,
                    duration_days: 365,
                    features: ['Unlimited Chat', 'Advanced Search', 'See Who Liked You', 'Premium Badge', 'Priority Matching', 'Profile Boost', 'VIP Support', 'Best Value'],
                    is_active: true,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                },
            ];
            
            for (const plan of plans) {
                await db.collection('premium_plans').add(plan);
            }
            console.log('✅ Default premium plans created!');
        }
    } catch (error) {
        console.error('Create default plans error:', error);
    }
}

// ============================================
// CREATE DEFAULT ADMIN USER
// ============================================

async function ensureAdminUser() {
    try {
        console.log('🔐 Checking admin user...');
        console.log('📧 Admin Email:', ADMIN_EMAIL);
        
        const snapshot = await db.collection('users')
            .where('email', '==', ADMIN_EMAIL)
            .get();

        if (snapshot.empty) {
            console.log('🔐 Creating admin user:', ADMIN_EMAIL);
            
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);

            let firebaseUser;
            try {
                firebaseUser = await auth.createUser({
                    email: ADMIN_EMAIL,
                    password: ADMIN_PASSWORD,
                    displayName: 'Admin',
                });
                console.log('✅ Firebase admin user created');
            } catch (authError) {
                console.error('Firebase admin create error:', authError);
            }

            const adminData = {
                username: 'admin',
                email: ADMIN_EMAIL,
                full_name: 'Admin',
                password_hash: passwordHash,
                is_admin: true,
                is_premium: true,
                is_banned: false,
                is_verified: true,
                online_status: 'offline',
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                firebase_uid: firebaseUser?.uid || '',
                subscription_status: 'active',
            };

            const adminRef = await db.collection('users').add(adminData);
            await adminRef.update({ id: adminRef.id });
            console.log('✅ Admin user created successfully!');
            console.log('🔐 Admin Email:', ADMIN_EMAIL);
            console.log('🔐 Admin Password:', ADMIN_PASSWORD);
        } else {
            const doc = snapshot.docs[0];
            const userData = doc.data();
            if (!userData.is_admin) {
                await db.collection('users').doc(doc.id).update({
                    is_admin: true,
                    is_premium: true,
                    is_verified: true,
                });
                console.log('✅ Updated existing user to admin:', ADMIN_EMAIL);
            }
            console.log('✅ Admin user exists:', ADMIN_EMAIL);
        }
    } catch (error) {
        console.error('Ensure admin error:', error);
    }
}

// ============================================
// 404 HANDLER - LAST RESORT
// ============================================

app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    serveHTMLFile('index.html', res);
});

// ============================================
// SOCKET.IO EVENTS
// ============================================

const onlineUsers = new Map();

io.on('connection', (socket) => {
    console.log('🟢 New client connected:', socket.id);

    socket.on('user-online', async (userId) => {
        if (userId) {
            onlineUsers.set(userId, socket.id);
            try {
                await db.collection('users').doc(userId).update({
                    online_status: 'online',
                    last_seen: admin.firestore.FieldValue.serverTimestamp(),
                });
            } catch (error) {
                console.error('Update online status error:', error);
            }
            socket.broadcast.emit('user-online', { user_id: userId });
        }
    });

    socket.on('join-chat', (userId) => {
        socket.join(`chat-${userId}`);
        console.log(`User joined chat-${userId}`);
    });

    socket.on('leave-chat', () => {
        socket.rooms.forEach(room => {
            if (room.startsWith('chat-')) {
                socket.leave(room);
            }
        });
    });

    socket.on('send-message', async (data) => {
        const { conversation_id, receiver_id, message, message_type, image_url, sender_id } = data;
        
        io.to(`chat-${receiver_id}`).emit('new-message', {
            conversation_id,
            sender_id,
            message,
            message_type,
            image_url,
            created_at: new Date().toISOString(),
        });
        
        io.to(`chat-${sender_id}`).emit('message-sent', {
            conversation_id,
            message,
            message_type,
            image_url,
            created_at: new Date().toISOString(),
        });
    });

    socket.on('typing', (data) => {
        const { user_id } = data;
        io.to(`chat-${user_id}`).emit('typing', { user_id: socket.userId });
    });

    socket.on('stop-typing', (data) => {
        const { user_id } = data;
        io.to(`chat-${user_id}`).emit('stop-typing', { user_id: socket.userId });
    });

    socket.on('disconnect', async () => {
        console.log('🔴 Client disconnected:', socket.id);
        
        for (const [userId, socketId] of onlineUsers) {
            if (socketId === socket.id) {
                onlineUsers.delete(userId);
                try {
                    await db.collection('users').doc(userId).update({
                        online_status: 'offline',
                        last_seen: admin.firestore.FieldValue.serverTimestamp(),
                    });
                } catch (error) {
                    console.error('Update offline status error:', error);
                }
                socket.broadcast.emit('user-offline', { user_id: userId });
                break;
            }
        }
    });
});

// ============================================
// START SERVER
// ============================================

async function startServer() {
    try {
        await createDefaultPlans();
        await ensureAdminUser();
        
        server.listen(PORT, () => {
            console.log('========================================');
            console.log(`✅ Server running on http://localhost:${PORT}`);
            console.log(`🔐 Admin Email: ${ADMIN_EMAIL}`);
            console.log(`🔐 Admin Password: ${ADMIN_PASSWORD}`);
            console.log(`💳 HarakaPay: ${HARAKAPAY_BASE_URL}`);
            console.log('💕 TAFUTA MPENZI WAKO is ready!');
            console.log('========================================');
            console.log('📌 To access admin panel:');
            console.log(`   1. Go to /login.html`);
            console.log(`   2. Login with: ${ADMIN_EMAIL}`);
            console.log(`   3. Then go to /admin.html`);
            console.log('========================================');
        });
    } catch (error) {
        console.error('Server startup error:', error);
        process.exit(1);
    }
}

startServer();

module.exports = { app, server, io };
