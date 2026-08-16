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
// ENVIRONMENT VARIABLES
// ============================================
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'tafuta-mpenzi-wako-super-secret-jwt-key-2026';

// ADMIN EMAIL - HUYU NDIE ANAYERUHUSIWA KUINGIA ADMIN PANEL
const ADMIN_EMAIL = 'dullamanyama0@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';

// HarakaPay Configuration
const HARAKAPAY_API_KEY = process.env.HARAKAPAY_API_KEY || 'hpk_5b1bce001f22cd9a3a3566e8a47176eb55b37a66419f6a29';
const HARAKAPAY_BASE_URL = process.env.HARAKAPAY_BASE_URL || 'https://harakapay.net';
const HARAKAPAY_WEBHOOK_URL = process.env.HARAKAPAY_WEBHOOK_URL || 'https://tafuta-mpenzi-chat.onrender.com/api/webhook/harakapay';

// Free Account Limits
const FREE_LIMITS = {
    daily_matches: 10,
    daily_likes: 20,
    max_chats: 50,
    max_messages_per_day: 100,
};

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
// ⭐⭐⭐ SERVE HTML FILES - ZIWE KWANZA KABISA ⭐⭐⭐
// ============================================

// Helper function to check if file exists
function fileExists(filePath) {
    try {
        return fs.existsSync(filePath);
    } catch (e) {
        return false;
    }
}

// ============================================
// 1. KWANZA: SERVE HTML FILES (HIZI ZIWE KWANZA)
// ============================================

app.get('/', (req, res) => {
    const filePath = path.join(__dirname, 'index.html');
    if (fileExists(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('index.html not found');
    }
});

app.get('/index.html', (req, res) => {
    const filePath = path.join(__dirname, 'index.html');
    if (fileExists(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('index.html not found');
    }
});

app.get('/login.html', (req, res) => {
    const filePath = path.join(__dirname, 'login.html');
    if (fileExists(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('login.html not found');
    }
});

app.get('/signup.html', (req, res) => {
    const filePath = path.join(__dirname, 'signup.html');
    if (fileExists(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('signup.html not found');
    }
});

// ============================================
// ⭐⭐⭐ ADMIN.HTML - ROUTE MAALUM ⭐⭐⭐
// ============================================
app.get('/admin.html', (req, res) => {
    console.log('🔍 Admin page requested');
    console.log('📧 Admin email:', ADMIN_EMAIL);
    
    const filePath = path.join(__dirname, 'admin.html');
    
    if (fileExists(filePath)) {
        console.log('✅ Serving admin.html from:', filePath);
        res.sendFile(filePath);
    } else {
        // Check in public folder
        const publicPath = path.join(__dirname, 'public', 'admin.html');
        if (fileExists(publicPath)) {
            console.log('✅ Serving admin.html from public folder:', publicPath);
            res.sendFile(publicPath);
        } else {
            console.log('❌ admin.html NOT FOUND');
            res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Admin Panel</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; background: #1A1A2E; color: white; text-align: center; }
                        .container { max-width: 600px; margin: 0 auto; background: #2A2A4A; padding: 40px; border-radius: 16px; }
                        h1 { color: #FF6B8A; }
                        .error { color: #FF4444; }
                        .info { color: #B0B0C8; margin: 20px 0; }
                        .btn { display: inline-block; padding: 12px 30px; background: #FF6B8A; color: white; text-decoration: none; border-radius: 25px; margin-top: 20px; }
                        .btn:hover { background: #E85577; }
                        .admin-email { background: #1A1A2E; padding: 10px; border-radius: 8px; color: #FFD700; font-family: monospace; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>🔐 Admin Panel</h1>
                        <p class="error">❌ admin.html Not Found</p>
                        <p class="info">File not found at: ${filePath}</p>
                        <p class="info">Admin Email: <span class="admin-email">${ADMIN_EMAIL}</span></p>
                        <p class="info">Tumia email hii ku-login kwenye admin panel.</p>
                        <a href="/login.html" class="btn">🔑 Login</a>
                    </div>
                </body>
                </html>
            `);
        }
    }
});

// Also serve /admin (without .html)
app.get('/admin', (req, res) => {
    res.redirect('/admin.html');
});

// ============================================
// 2. PILI: SERVE STATIC FILES
// ============================================
app.use(express.static(__dirname));

// ============================================
// 3. TATU: AUTHENTICATION MIDDLEWARE
// ============================================
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        
        const userDoc = await db.collection('users').doc(decoded.id).get();
        if (!userDoc.exists) {
            return res.status(401).json({ error: 'User not found.' });
        }
        
        const userData = userDoc.data();
        if (userData.is_banned) {
            return res.status(403).json({ error: 'User is banned.' });
        }
        
        req.userData = { id: decoded.id, ...userData };
        next();
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(403).json({ error: 'Invalid token.' });
    }
};

const authenticateAdmin = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const userDoc = await db.collection('users').doc(decoded.id).get();
        if (!userDoc.exists) {
            return res.status(401).json({ error: 'User not found.' });
        }
        
        const userData = userDoc.data();
        
        // Check if user is admin by email
        const isAdmin = userData.email === ADMIN_EMAIL || userData.is_admin === true;
        
        if (!isAdmin) {
            return res.status(403).json({ 
                error: 'Admin access required. Only ' + ADMIN_EMAIL + ' can access admin panel.',
                admin_email: ADMIN_EMAIL
            });
        }
        
        req.user = { id: decoded.id, ...userData };
        next();
    } catch (error) {
        console.error('Admin auth error:', error);
        return res.status(403).json({ error: 'Invalid token.' });
    }
};

// ============================================
// 4. API ROUTES
// ============================================

// ===== AUTH =====

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

        const usernameCheck = await db.collection('users')
            .where('username', '==', username)
            .get();
        
        if (!usernameCheck.empty) {
            return res.status(400).json({ error: 'Username already taken.' });
        }

        const emailCheck = await db.collection('users')
            .where('email', '==', email)
            .get();
        
        if (!emailCheck.empty) {
            return res.status(400).json({ error: 'Email already registered.' });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

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
        const isAdmin = email === ADMIN_EMAIL;

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
        };

        const userRef = await db.collection('users').add(userData);
        const userId = userRef.id;
        await userRef.update({ id: userId });

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

        const validPassword = await bcrypt.compare(password, userData.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        await db.collection('users').doc(userId).update({
            last_seen: admin.firestore.FieldValue.serverTimestamp(),
            online_status: 'online',
        });

        let isPremium = userData.is_premium;
        if (isPremium && userData.premium_expires_at) {
            const expiresAt = userData.premium_expires_at.toDate ? 
                userData.premium_expires_at.toDate() : 
                new Date(userData.premium_expires_at);
            
            if (new Date() > expiresAt) {
                await db.collection('users').doc(userId).update({
                    is_premium: false,
                    premium_expires_at: null,
                });
                isPremium = false;
            }
        }

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

// Check if current user is admin
app.get('/api/auth/check-admin', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userDoc = await db.collection('users').doc(userId).get();
        
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

// ============================================
// 5. ADMIN API ROUTES (Protected)
// ============================================

// Get all users (Admin only)
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('users').get();
        const users = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Don't send password hash
            delete data.password_hash;
            users.push({ id: doc.id, ...data });
        });
        res.json({ success: true, users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get all payments (Admin only)
app.get('/api/admin/payments', authenticateAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('payments').get();
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

// Get all reports (Admin only)
app.get('/api/admin/reports', authenticateAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('reports').get();
        const reports = [];
        snapshot.forEach(doc => {
            reports.push({ id: doc.id, ...doc.data() });
        });
        res.json({ success: true, reports });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Ban user (Admin only)
app.post('/api/admin/ban/:userId', authenticateAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;
        await db.collection('users').doc(userId).update({
            is_banned: true,
            banned_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        res.json({ success: true, message: 'User banned successfully!' });
    } catch (error) {
        console.error('Ban user error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Unban user (Admin only)
app.post('/api/admin/unban/:userId', authenticateAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;
        await db.collection('users').doc(userId).update({
            is_banned: false,
            banned_at: null,
        });
        res.json({ success: true, message: 'User unbanned successfully!' });
    } catch (error) {
        console.error('Unban user error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Make user premium (Admin only)
app.post('/api/admin/make-premium/:userId', authenticateAdmin, async (req, res) => {
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
        });
        res.json({ success: true, message: 'User is now Premium!' });
    } catch (error) {
        console.error('Make premium error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Remove premium (Admin only)
app.post('/api/admin/remove-premium/:userId', authenticateAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;
        await db.collection('users').doc(userId).update({
            is_premium: false,
            premium_expires_at: null,
        });
        res.json({ success: true, message: 'Premium removed!' });
    } catch (error) {
        console.error('Remove premium error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Delete user (Admin only)
app.delete('/api/admin/delete/:userId', authenticateAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;
        await db.collection('users').doc(userId).delete();
        res.json({ success: true, message: 'User deleted!' });
    } catch (error) {
        console.error('Delete user error:', error);
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
// 6. REGULAR API ROUTES (User endpoints)
// ============================================

// Get current user
app.get('/api/user/me', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userData = userDoc.data();
        
        let isPremium = userData.is_premium;
        if (isPremium && userData.premium_expires_at) {
            const expiresAt = userData.premium_expires_at.toDate ? 
                userData.premium_expires_at.toDate() : 
                new Date(userData.premium_expires_at);
            
            if (new Date() > expiresAt) {
                await db.collection('users').doc(userId).update({
                    is_premium: false,
                    premium_expires_at: null,
                });
                isPremium = false;
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
                premium_expires_at: userData.premium_expires_at,
            },
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get user by ID
app.get('/api/users/:id', authenticateToken, async (req, res) => {
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

// Update user profile
app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
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
app.post('/api/user/profile-picture', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
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
app.post('/api/user/change-password', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
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
app.delete('/api/user/delete', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        await db.collection('users').doc(userId).delete();
        res.json({ success: true, message: 'Account deleted.' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ===== DISCOVER =====
app.get('/api/discover', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { gender, location, interests } = req.query;

        let query = db.collection('users')
            .where('is_banned', '==', false);

        if (gender) {
            query = query.where('gender', '==', gender);
        }

        const snapshot = await query.get();
        const users = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            if (doc.id !== userId) {
                if (location && !data.location?.toLowerCase().includes(location.toLowerCase())) {
                    return;
                }
                if (interests && !(data.interests || []).includes(interests)) {
                    return;
                }
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

        res.json({
            success: true,
            users: users.slice(0, 50),
            count: users.length,
        });
    } catch (error) {
        console.error('Discover error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Search users
app.get('/api/search', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { q, gender, location, interests } = req.query;

        if (!q && !gender && !location && !interests) {
            return res.status(400).json({ error: 'At least one search parameter is required.' });
        }

        const snapshot = await db.collection('users')
            .where('is_banned', '==', false)
            .get();

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

        res.json({
            success: true,
            users: users.slice(0, 50),
            count: users.length,
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ===== MATCHES =====
app.post('/api/match/random', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const isPremium = await checkUserPremium(userId);

        if (!isPremium) {
            const limitCheck = await checkFreeLimits(userId, 'match');
            if (!limitCheck.allowed) {
                return res.status(403).json({
                    error: limitCheck.error,
                    requires_premium: true,
                });
            }
        }

        const snapshot = await db.collection('users')
            .where('is_banned', '==', false)
            .get();

        const availableUsers = [];
        snapshot.forEach(doc => {
            if (doc.id !== userId) {
                availableUsers.push({
                    id: doc.id,
                    ...doc.data(),
                });
            }
        });

        if (availableUsers.length === 0) {
            return res.json({
                success: false,
                message: 'No users available for matching right now. Try again later! 😔',
            });
        }

        const blockedSnapshot = await db.collection('blocked_users')
            .where('blocker_id', '==', userId)
            .get();
        
        const blockedIds = new Set();
        blockedSnapshot.forEach(doc => {
            blockedIds.add(doc.data().blocked_id);
        });

        const filteredUsers = availableUsers.filter(u => !blockedIds.has(u.id));

        if (filteredUsers.length === 0) {
            return res.json({
                success: false,
                message: 'No users available for matching. Try again later! 😔',
            });
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

app.get('/api/matches', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const snapshot = await db.collection('matches')
            .where('user1_id', '==', userId)
            .get();

        const snapshot2 = await db.collection('matches')
            .where('user2_id', '==', userId)
            .get();

        const matches = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            matches.push({
                id: doc.id,
                ...data,
                matched_user_id: data.user2_id,
            });
        });

        snapshot2.forEach(doc => {
            const data = doc.data();
            matches.push({
                id: doc.id,
                ...data,
                matched_user_id: data.user1_id,
            });
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

        res.json({
            success: true,
            matches: matchesWithDetails,
        });
    } catch (error) {
        console.error('Get matches error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ===== LIKES =====
app.post('/api/like/:userId', authenticateToken, async (req, res) => {
    try {
        const likerId = req.user.id;
        const likedId = req.params.userId;

        if (likerId === likedId) {
            return res.status(400).json({ error: 'You cannot like yourself.' });
        }

        const isPremium = await checkUserPremium(likerId);
        if (!isPremium) {
            const limitCheck = await checkFreeLimits(likerId, 'like');
            if (!limitCheck.allowed) {
                return res.status(403).json({
                    error: limitCheck.error,
                    requires_premium: true,
                });
            }
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

app.get('/api/likes', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const snapshot = await db.collection('likes')
            .where('liked_id', '==', userId)
            .get();

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

        res.json({
            success: true,
            likes: likes,
        });
    } catch (error) {
        console.error('Get likes error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ===== BLOCK =====
app.post('/api/block/:userId', authenticateToken, async (req, res) => {
    try {
        const blockerId = req.user.id;
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

// ===== REPORT =====
app.post('/api/report', authenticateToken, async (req, res) => {
    try {
        const reporterId = req.user.id;
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

// ============================================
// CONVERSATIONS & CHAT
// ============================================
app.post('/api/conversations/:userId', authenticateToken, async (req, res) => {
    try {
        const user1Id = req.user.id;
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
        let docRef;

        if (convSnapshot.empty) {
            const convSnapshot2 = await db.collection('conversations')
                .where('user1_id', '==', user2Id)
                .where('user2_id', '==', user1Id)
                .get();

            if (!convSnapshot2.empty) {
                docRef = convSnapshot2.docs[0];
                conversationId = docRef.id;
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
            docRef = convSnapshot.docs[0];
            conversationId = docRef.id;
        }

        res.json({
            success: true,
            conversation_id: conversationId,
        });
    } catch (error) {
        console.error('Get conversation error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.get('/api/conversations', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const snapshot = await db.collection('conversations')
            .where('user1_id', '==', userId)
            .get();

        const snapshot2 = await db.collection('conversations')
            .where('user2_id', '==', userId)
            .get();

        const conversations = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            conversations.push({
                id: doc.id,
                ...data,
                other_user_id: data.user2_id,
            });
        });

        snapshot2.forEach(doc => {
            const data = doc.data();
            conversations.push({
                id: doc.id,
                ...data,
                other_user_id: data.user1_id,
            });
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

        res.json({
            success: true,
            conversations: conversationsWithDetails,
        });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.get('/api/messages/:conversationId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const conversationId = req.params.conversationId;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

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
                messages.push({
                    id: doc.id,
                    ...data,
                });
            }
        });

        const unreadSnapshot = await db.collection('messages')
            .where('conversation_id', '==', conversationId)
            .where('receiver_id', '==', userId)
            .where('is_read', '==', false)
            .get();

        const batch = db.batch();
        unreadSnapshot.forEach(doc => {
            batch.update(doc.ref, { 
                is_read: true,
                is_delivered: true,
            });
        });
        await batch.commit();

        res.json({
            success: true,
            messages: messages.reverse(),
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
    try {
        const senderId = req.user.id;
        const { conversation_id, receiver_id, message, message_type, image_data } = req.body;

        if (!conversation_id || !receiver_id) {
            return res.status(400).json({ error: 'Conversation ID and receiver ID are required.' });
        }

        const isPremium = await checkUserPremium(senderId);
        if (!isPremium) {
            const limitCheck = await checkFreeLimits(senderId, 'message');
            if (!limitCheck.allowed) {
                return res.status(403).json({
                    error: limitCheck.error,
                    requires_premium: true,
                });
            }
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

        io.to(receiver_id).emit('new-message', {
            id: msgRef.id,
            ...messageData,
            sender_name: senderData.full_name || senderData.username,
            sender_username: senderData.username,
        });

        io.to(senderId).emit('message-sent', {
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

        res.json({
            success: true,
            message_id: msgRef.id,
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.post('/api/messages/read', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
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
                batch.update(doc.ref, { 
                    is_read: true,
                    is_delivered: true,
                });
            });
        }
        await batch.commit();

        res.json({ success: true });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// PREMIUM PLANS
// ============================================
app.get('/api/plans', async (req, res) => {
    try {
        const snapshot = await db.collection('premium_plans')
            .where('is_active', '==', true)
            .orderBy('price')
            .get();

        const plans = [];
        snapshot.forEach(doc => {
            plans.push({
                id: doc.id,
                ...doc.data(),
            });
        });

        res.json({
            success: true,
            plans: plans,
        });
    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.get('/api/plans/:planId', async (req, res) => {
    try {
        const planId = req.params.planId;
        const doc = await db.collection('premium_plans').doc(planId).get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Plan not found.' });
        }

        res.json({
            success: true,
            plan: {
                id: doc.id,
                ...doc.data(),
            },
        });
    } catch (error) {
        console.error('Get plan error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// HARAKAPAY PAYMENT INTEGRATION
// ============================================
app.post('/api/payments/initiate', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
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
            amount: plan.price,
            currency: 'TZS',
            phone: phone,
            plan_type: plan.name,
            plan_duration: plan.duration_days,
            status: 'pending',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        };

        const paymentRef = await db.collection('payments').add(paymentData);
        const paymentId = paymentRef.id;

        const axios = require('axios');
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
                message: 'Payment initiated successfully. Please check your phone for USSD push.',
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
                error: harakapayResponse.data.error || 'Payment initiation failed. Please try again.',
                status: 'failed',
            });
        }

    } catch (error) {
        console.error('Initiate payment error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Payment initiation failed. Please try again.',
        });
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

        if (completed_at) {
            updateData.completed_at = new Date(completed_at);
        }

        if (net_amount) {
            updateData.net_amount = net_amount;
        }

        if (fee_amount) {
            updateData.fee_amount = fee_amount;
        }

        await db.collection('payments').doc(paymentId).update(updateData);

        if (status === 'completed' || status === 'converted') {
            const userId = paymentData.user_id;
            
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + (paymentData.plan_duration || 30));

            await db.collection('users').doc(userId).update({
                is_premium: true,
                premium_started_at: admin.firestore.FieldValue.serverTimestamp(),
                premium_expires_at: expiresAt,
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
            });

            await db.collection('notifications').add({
                user_id: userId,
                type: 'premium',
                title: '⭐ Premium Activated!',
                message: `Congratulations! Your ${paymentData.plan_type} plan is now active. Enjoy all premium features! 🎉`,
                data: { 
                    plan: paymentData.plan_type,
                    expires_at: expiresAt,
                },
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

app.get('/api/payments/status/:orderId', authenticateToken, async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.user.id;

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
            const axios = require('axios');
            const response = await axios.get(
                `${HARAKAPAY_BASE_URL}/api/v1/status/${paymentData.harakapay_order_id}`,
                {
                    headers: {
                        'X-API-Key': HARAKAPAY_API_KEY,
                    },
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
                        const expiresAt = new Date();
                        expiresAt.setDate(expiresAt.getDate() + (paymentData.plan_duration || 30));

                        await db.collection('users').doc(userId).update({
                            is_premium: true,
                            premium_started_at: admin.firestore.FieldValue.serverTimestamp(),
                            premium_expires_at: expiresAt,
                        });

                        await db.collection('notifications').add({
                            user_id: userId,
                            type: 'premium',
                            title: '⭐ Premium Activated!',
                            message: `Your ${paymentData.plan_type} plan is now active! 🎉`,
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
                        plan_type: paymentData.plan_type,
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
                plan_type: paymentData.plan_type,
                status: paymentData.status,
            },
        });
    } catch (error) {
        console.error('Payment status error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 7. ENSURE ADMIN USER EXISTS
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
            };

            const adminRef = await db.collection('users').add(adminData);
            await adminRef.update({ id: adminRef.id });
            console.log('✅ Admin user created successfully!');
            console.log('🔐 Admin Email:', ADMIN_EMAIL);
            console.log('🔐 Admin Password:', ADMIN_PASSWORD);
            console.log('🔐 You can now login to admin panel with these credentials.');
        } else {
            // Make sure existing user is admin
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
// 8. CATCH-ALL - IKIWA HAKUNA ROUTE
// ============================================
app.use((req, res) => {
    // Check if it's an HTML file request
    if (req.path.endsWith('.html')) {
        const filePath = path.join(__dirname, req.path);
        if (fileExists(filePath)) {
            res.sendFile(filePath);
            return;
        }
    }
    // If no route found, send 404
    res.status(404).send(`
        <h1>404 - Page Not Found</h1>
        <p>${req.url} not found</p>
        <a href="/">Go Home</a>
    `);
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
        await ensureAdminUser();
        
        server.listen(PORT, () => {
            console.log('========================================');
            console.log('✅ Server running on http://localhost:' + PORT);
            console.log('🔐 Admin Email: ' + ADMIN_EMAIL);
            console.log('🔐 Admin Password: ' + ADMIN_PASSWORD);
            console.log('🔗 HarakaPay: ' + HARAKAPAY_BASE_URL);
            console.log('💕 TAFUTA MPENZI WAKO is ready!');
            console.log('========================================');
            console.log('📌 To access admin panel:');
            console.log('   1. Go to /login.html');
            console.log('   2. Login with: ' + ADMIN_EMAIL);
            console.log('   3. Then go to /admin.html');
            console.log('========================================');
        });
    } catch (error) {
        console.error('Server startup error:', error);
        process.exit(1);
    }
}

startServer();

module.exports = { app, server, io };
