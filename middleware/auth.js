// ============================================
// MIDDLEWARE - AUTHENTICATION
// ============================================
// KAZI: Hii middleware inalinda routes zetu.
// Inathibitisha kama mtumiaji ameingia (logged in)
// na kama ana ruhusa ya kufanya kitendo fulani.
// ============================================

const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

// ============================================
// 1. AUTHENTICATE TOKEN
// ============================================
// KAZI: Inathibitisha kama token ya mtumiaji ni sahihi.
// Inatumika kwenye routes zote zinazohitaji mtumiaji kuwa logged in.
// ============================================

const authenticateToken = async (req, res, next) => {
    // 1. Chukua token kutoka header ya Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // 2. Kama hakuna token, kataa access
    if (!token) {
        return res.status(401).json({ 
            error: 'Access denied. No token provided.' 
        });
    }

    try {
        // 3. Verify token kutumia JWT_SECRET
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        
        // 4. Angalia kama mtumiaji yupo kwenye database
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(decoded.id).get();
        
        if (!userDoc.exists) {
            return res.status(401).json({ error: 'User not found.' });
        }
        
        const userData = userDoc.data();
        
        // 5. Angalia kama mtumiaji amezuiwa (banned)
        if (userData.is_banned) {
            return res.status(403).json({ error: 'User is banned.' });
        }
        
        // 6. Weka data ya mtumiaji kwenye request
        req.userData = { id: decoded.id, ...userData };
        next();
        
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(403).json({ error: 'Invalid token.' });
    }
};

// ============================================
// 2. AUTHENTICATE ADMIN
// ============================================
// KAZI: Inathibitisha kama mtumiaji ni ADMIN.
// Inatumika kwenye routes za admin panel.
// ADMIN anaruhusiwa kuona na kubadilisha kila kitu.
// ============================================

const authenticateAdmin = async (req, res, next) => {
    // 1. Chukua token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        // 2. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 3. Angalia kama mtumiaji yupo kwenye database
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(decoded.id).get();
        
        if (!userDoc.exists) {
            return res.status(401).json({ error: 'User not found.' });
        }
        
        const userData = userDoc.data();
        
        // 4. Angalia kama mtumiaji ni ADMIN
        const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'dullamanyama0@gmail.com';
        const isAdmin = userData.email === ADMIN_EMAIL || userData.is_admin === true;
        
        if (!isAdmin) {
            return res.status(403).json({ 
                error: 'Admin access required. Only ' + ADMIN_EMAIL + ' can access admin panel.',
                admin_email: ADMIN_EMAIL 
            });
        }
        
        // 5. Weka data ya admin kwenye request
        req.user = { id: decoded.id, ...userData };
        next();
        
    } catch (error) {
        console.error('Admin auth error:', error);
        return res.status(403).json({ error: 'Invalid token.' });
    }
};

// ============================================
// 3. CHECK PREMIUM STATUS
// ============================================
// KAZI: Inaangalia kama mtumiaji ni Premium.
// Inatumika kwenye routes za premium features.
// ============================================

const checkPremium = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found.' });
        }
        
        const userData = userDoc.data();
        
        // Angalia kama mtumiaji ni Premium
        if (!userData.is_premium) {
            // Angalia kama ana Free Trial
            if (userData.trial_active && userData.trial_expires_at) {
                const trialExpires = userData.trial_expires_at.toDate ? 
                    userData.trial_expires_at.toDate() : 
                    new Date(userData.trial_expires_at);
                
                if (new Date() <= trialExpires) {
                    // Trial bado inaendelea, ruhusu
                    req.isTrial = true;
                    return next();
                }
            }
            
            return res.status(403).json({ 
                error: 'Premium access required. Upgrade to Premium to access this feature.',
                requires_premium: true 
            });
        }
        
        // Angalia kama premium imeisha
        if (userData.premium_expires_at) {
            const expiresAt = userData.premium_expires_at.toDate ? 
                userData.premium_expires_at.toDate() : 
                new Date(userData.premium_expires_at);
            
            if (new Date() > expiresAt) {
                // Premium imeisha
                await db.collection('users').doc(userId).update({
                    is_premium: false,
                    premium_expires_at: null,
                    subscription_status: 'expired',
                });
                
                return res.status(403).json({ 
                    error: 'Premium has expired. Renew to continue.',
                    requires_premium: true 
                });
            }
        }
        
        req.isPremium = true;
        next();
        
    } catch (error) {
        console.error('Check premium error:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
};

// ============================================
// 4. CHECK FREE LIMITS
// ============================================
// KAZI: Inaangalia kama mtumiaji wa FREE amefikia limit.
// Inatumika kwenye routes za messages, matches, likes.
// ============================================

const checkFreeLimits = (action) => {
    return async (req, res, next) => {
        try {
            const userId = req.user.id;
            const db = admin.firestore();
            
            // 1. Angalia kama mtumiaji ni Premium au Trial
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();
            
            // Premium au Trial - hakuna limits
            if (userData.is_premium) {
                return next();
            }
            
            if (userData.trial_active && userData.trial_expires_at) {
                const trialExpires = userData.trial_expires_at.toDate ? 
                    userData.trial_expires_at.toDate() : 
                    new Date(userData.trial_expires_at);
                
                if (new Date() <= trialExpires) {
                    return next();
                }
            }
            
            // 2. FREE - check limits
            const FREE_LIMITS = {
                messages: parseInt(process.env.FREE_LIMIT_MESSAGES) || 20,
                matches: parseInt(process.env.FREE_LIMIT_MATCHES) || 5,
                likes: parseInt(process.env.FREE_LIMIT_LIKES) || 10,
            };
            
            // 3. Hesabu actions za leo
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            let count = 0;
            let limit = 0;
            let actionName = '';
            
            if (action === 'message') {
                const snapshot = await db.collection('messages')
                    .where('sender_id', '==', userId)
                    .where('created_at', '>=', today)
                    .where('created_at', '<', tomorrow)
                    .get();
                count = snapshot.size;
                limit = FREE_LIMITS.messages;
                actionName = 'messages';
            } else if (action === 'match') {
                const snapshot = await db.collection('matches')
                    .where('user1_id', '==', userId)
                    .where('created_at', '>=', today)
                    .where('created_at', '<', tomorrow)
                    .get();
                count = snapshot.size;
                limit = FREE_LIMITS.matches;
                actionName = 'matches';
            } else if (action === 'like') {
                const snapshot = await db.collection('likes')
                    .where('liker_id', '==', userId)
                    .where('created_at', '>=', today)
                    .where('created_at', '<', tomorrow)
                    .get();
                count = snapshot.size;
                limit = FREE_LIMITS.likes;
                actionName = 'likes';
            }
            
            // 4. Ikiwa imefikia limit, kataa
            if (count >= limit) {
                return res.status(403).json({
                    error: `Free ${actionName} limit reached (${limit}/day). Upgrade to Premium for unlimited ${actionName}.`,
                    requires_premium: true,
                    limit: limit,
                    used: count,
                    remaining: 0
                });
            }
            
            // 5. Ruhusu, na weka remaining katika request
            req.remaining = limit - count;
            next();
            
        } catch (error) {
            console.error('Check limits error:', error);
            return res.status(500).json({ error: 'Internal server error.' });
        }
    };
};

// ============================================
// EXPORT MODULES
// ============================================

module.exports = {
    authenticateToken,
    authenticateAdmin,
    checkPremium,
    checkFreeLimits,
};
