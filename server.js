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

// Admin Email - HUYU NDIE ANAYERUHUSIWA KUINGIA ADMIN
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'dullamanyama0@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';

// HarakaPay Configuration
const HARAKAPAY_API_KEY = process.env.HARAKAPAY_API_KEY;
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
// SERVE STATIC FILES
// ============================================

// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/profile.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/chat.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.get('/premium.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'premium.html'));
});

app.get('/admin.html', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'admin.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('admin.html not found');
    }
});

// Serve static files from root
app.use(express.static(__dirname));

// ============================================
// AUTHENTICATION MIDDLEWARE
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
// HELPER FUNCTIONS
// ============================================

// Generate unique ID
function generateId() {
    return crypto.randomBytes(16).toString('hex');
}

// Calculate expiration date
function calculateExpiration(startDate, days) {
    return moment(startDate).add(days, 'days').toDate();
}

// Check if user has active premium
async function checkUserPremium(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) return { is_premium: false, error: 'User not found' };
        
        const userData = userDoc.data();
        
        // Check if premium is active
        if (userData.is_premium && userData.premium_expires_at) {
            const expiresAt = userData.premium_expires_at.toDate ? 
                userData.premium_expires_at.toDate() : 
                new Date(userData.premium_expires_at);
            
            const now = new Date();
            
            // Premium expired
            if (now > expiresAt) {
                await db.collection('users').doc(userId).update({
                    is_premium: false,
                    premium_expires_at: null,
                    subscription_status: 'expired',
                });
                return { is_premium: false, is_expired: true };
            }
            
            // Premium active
            return { 
                is_premium: true, 
                expires_at: expiresAt,
                days_remaining: moment(expiresAt).diff(now, 'days')
            };
        }
        
        // Check if user has trial
        if (userData.trial_active && userData.trial_expires_at) {
            const trialExpires = userData.trial_expires_at.toDate ? 
                userData.trial_expires_at.toDate() : 
                new Date(userData.trial_expires_at);
            
            const now = new Date();
            
            if (now > trialExpires) {
                await db.collection('users').doc(userId).update({
                    trial_active: false,
                });
                return { is_premium: false, trial_ended: true };
            }
            
            return { 
                is_premium: false, 
                is_trial: true,
                trial_expires_at: trialExpires,
                trial_days_remaining: moment(trialExpires).diff(now, 'days')
            };
        }
        
        return { is_premium: false };
    } catch (error) {
        console.error('Check premium error:', error);
        return { is_premium: false, error: error.message };
    }
}

// Check free limits
async function checkFreeLimits(userId, action) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) return { allowed: false, error: 'User not found' };
        
        const userData = userDoc.data();
        
        // Check if premium or trial
        const premiumStatus = await checkUserPremium(userId);
        if (premiumStatus.is_premium || premiumStatus.is_trial) {
            return { allowed: true, is_premium: true };
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Check different actions
        if (action === 'message') {
            const snapshot = await db.collection('messages')
                .where('sender_id', '==', userId)
                .where('created_at', '>=', today)
                .where('created_at', '<', tomorrow)
                .get();
            
            const count = snapshot.size;
            if (count >= FREE_LIMITS.messages) {
                return { 
                    allowed: false, 
                    error: `Free message limit reached (${FREE_LIMITS.messages}/day). Upgrade to Premium for unlimited messages.`,
                    requires_premium: true,
                    limit: FREE_LIMITS.messages,
                    used: count
                };
            }
        }
        
        if (action === 'match') {
            const snapshot = await db.collection('matches')
                .where('user1_id', '==', userId)
                .where('created_at', '>=', today)
                .where('created_at', '<', tomorrow)
                .get();
            
            const count = snapshot.size;
            if (count >= FREE_LIMITS.matches) {
                return { 
                    allowed: false, 
                    error: `Free match limit reached (${FREE_LIMITS.matches}/day). Upgrade to Premium for unlimited matches.`,
                    requires_premium: true,
                    limit: FREE_LIMITS.matches,
                    used: count
                };
            }
        }
        
        if (action === 'like') {
            const snapshot = await db.collection('likes')
                .where('liker_id', '==', userId)
                .where('created_at', '>=', today)
                .where('created_at', '<', tomorrow)
                .get();
            
            const count = snapshot.size;
            if (count >= FREE_LIMITS.likes) {
                return { 
                    allowed: false, 
                    error: `Free like limit reached (${FREE_LIMITS.likes}/day). Upgrade to Premium for unlimited likes.`,
                    requires_premium: true,
                    limit: FREE_LIMITS.likes,
                    used: count
                };
            }
        }
        
        return { allowed: true };
    } catch (error) {
        console.error('Check free limits error:', error);
        return { allowed: true }; // Allow on error
    }
}

// Create default premium plans
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

// Create default admin user
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
// SCHEDULED TASKS (CRON)
// ============================================

// Check expired premiums daily at midnight
cron.schedule('0 0 * * *', async () => {
    console.log('🔄 Running premium expiration check...');
    try {
        const now = new Date();
        const snapshot = await db.collection('users')
            .where('is_premium', '==', true)
            .get();
        
        let expiredCount = 0;
        for (const doc of snapshot.docs) {
            const data = doc.data();
            if (data.premium_expires_at) {
                const expiresAt = data.premium_expires_at.toDate ? 
                    data.premium_expires_at.toDate() : 
                    new Date(data.premium_expires_at);
                
                if (now > expiresAt) {
                    await db.collection('users').doc(doc.id).update({
                        is_premium: false,
                        premium_expires_at: null,
                        subscription_status: 'expired',
                    });
                    expiredCount++;
                    
                    // Send notification
                    await db.collection('notifications').add({
                        user_id: doc.id,
                        type: 'premium_expired',
                        title: '⚠️ Premium Expired',
                        message: 'Your Premium subscription has expired. Renew to continue enjoying premium features!',
                        is_read: false,
                        created_at: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
            }
        }
        
        if (expiredCount > 0) {
            console.log(`✅ Expired ${expiredCount} premium subscriptions`);
        } else {
            console.log('✅ No expired premiums found');
        }
    } catch (error) {
        console.error('Premium expiration check error:', error);
    }
});

// Check trial expirations daily
cron.schedule('0 1 * * *', async () => {
    console.log('🔄 Running trial expiration check...');
    try {
        const now = new Date();
        const snapshot = await db.collection('users')
            .where('trial_active', '==', true)
            .get();
        
        let expiredCount = 0;
        for (const doc of snapshot.docs) {
            const data = doc.data();
            if (data.trial_expires_at) {
                const expiresAt = data.trial_expires_at.toDate ? 
                    data.trial_expires_at.toDate() : 
                    new Date(data.trial_expires_at);
                
                if (now > expiresAt) {
                    await db.collection('users').doc(doc.id).update({
                        trial_active: false,
                    });
                    expiredCount++;
                    
                    await db.collection('notifications').add({
                        user_id: doc.id,
                        type: 'trial_ended',
                        title: '🎁 Free Trial Ended',
                        message: 'Your free trial has ended. Upgrade to Premium to continue enjoying premium features!',
                        is_read: false,
                        created_at: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
            }
        }
        
        if (expiredCount > 0) {
            console.log(`✅ Expired ${expiredCount} trials`);
        }
    } catch (error) {
        console.error('Trial expiration check error:', error);
    }
});

// Send premium reminders
cron.schedule('0 8 * * *', async () => {
    console.log('🔄 Sending premium reminders...');
    try {
        const now = new Date();
        const snapshot = await db.collection('users')
            .where('is_premium', '==', true)
            .get();
        
        for (const doc of snapshot.docs) {
            const data = doc.data();
            if (data.premium_expires_at) {
                const expiresAt = data.premium_expires_at.toDate ? 
                    data.premium_expires_at.toDate() : 
                    new Date(data.premium_expires_at);
                
                const daysRemaining = moment(expiresAt).diff(now, 'days');
                
                if (daysRemaining === 7) {
                    await db.collection('notifications').add({
                        user_id: doc.id,
                        type: 'premium_reminder',
                        title: '⭐ Premium Expires Soon',
                        message: `Your Premium will expire in ${daysRemaining} days. Renew now to continue enjoying premium features!`,
                        is_read: false,
                        created_at: admin.firestore.FieldValue.serverTimestamp(),
                    });
                } else if (daysRemaining === 3) {
                    await db.collection('notifications').add({
                        user_id: doc.id,
                        type: 'premium_reminder',
                        title: '⭐ Premium Expires Soon',
                        message: `Your Premium will expire in ${daysRemaining} days. Don\'t wait, renew today!`,
                        is_read: false,
                        created_at: admin.firestore.FieldValue.serverTimestamp(),
                    });
                } else if (daysRemaining === 1) {
                    await db.collection('notifications').add({
                        user_id: doc.id,
                        type: 'premium_reminder',
                        title: '⚠️ Premium Expires Tomorrow',
                        message: 'Your Premium will expire tomorrow. Renew now to avoid interruption!',
                        is_read: false,
                        created_at: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
            }
        }
        console.log('✅ Reminders sent');
    } catch (error) {
        console.error('Premium reminders error:', error);
    }
});

// ============================================
// IMPORT ROUTES
// ============================================

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chat');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');

// ============================================
// USE ROUTES
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

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
        // Create default plans
        await createDefaultPlans();
        
        // Ensure admin user exists
        await ensureAdminUser();
        
        server.listen(PORT, () => {
            console.log('========================================');
            console.log('✅ Server running on http://localhost:' + PORT);
            console.log('🔐 Admin Email: ' + ADMIN_EMAIL);
            console.log('🔐 Admin Password: ' + ADMIN_PASSWORD);
            console.log('📧 Admin Email for admin access: ' + ADMIN_EMAIL);
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
