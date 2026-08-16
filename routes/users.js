// ============================================
// ROUTES - USERS
// ============================================

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { authenticateToken, checkFreeLimits } = require('../middleware/auth');

const db = admin.firestore();

// ============================================
// 1. GET CURRENT USER - Pata maelezo ya mtumiaji aliyeingia
// ============================================

router.get('/me', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userData = userDoc.data();
        
        // Check premium status
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

        // Check trial status
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

// ============================================
// 2. GET USER BY ID - Pata maelezo ya mtumiaji mwingine
// ============================================

router.get('/:id', authenticateToken, async (req, res) => {
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

// ============================================
// 3. UPDATE PROFILE - Badilisha maelezo ya mtumiaji
// ============================================

router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { full_name, username, bio, location, gender, date_of_birth, interests } = req.body;

        // Check if username is taken
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

// ============================================
// 4. UPDATE PROFILE PICTURE - Badilisha picha ya mtumiaji
// ============================================

router.post('/profile-picture', authenticateToken, async (req, res) => {
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

// ============================================
// 5. CHANGE PASSWORD - Badilisha password
// ============================================

router.post('/change-password', authenticateToken, async (req, res) => {
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
        const bcrypt = require('bcrypt');

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

// ============================================
// 6. DELETE ACCOUNT - Futa akaunti
// ============================================

router.delete('/delete', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        await db.collection('users').doc(userId).delete();
        res.json({ success: true, message: 'Account deleted.' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 7. DISCOVER USERS - Pata watu wengine
// ============================================

router.get('/discover', authenticateToken, async (req, res) => {
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

// ============================================
// 8. SEARCH USERS - Tafuta watu
// ============================================

router.get('/search', authenticateToken, async (req, res) => {
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

// ============================================
// 9. LIKE USER - Penda mtumiaji
// ============================================

router.post('/like/:userId', authenticateToken, checkFreeLimits('like'), async (req, res) => {
    try {
        const likerId = req.user.id;
        const likedId = req.params.userId;

        if (likerId === likedId) {
            return res.status(400).json({ error: 'You cannot like yourself.' });
        }

        // Check if user exists
        const userDoc = await db.collection('users').doc(likedId).get();
        if (!userDoc.exists || userDoc.data().is_banned) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Check if already liked
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

        // Create notification
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

// ============================================
// 10. GET LIKES - Pata likes zako
// ============================================

router.get('/likes', authenticateToken, async (req, res) => {
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

// ============================================
// 11. BLOCK USER - Zuia mtumiaji
// ============================================

router.post('/block/:userId', authenticateToken, async (req, res) => {
    try {
        const blockerId = req.user.id;
        const blockedId = req.params.userId;

        if (blockerId === blockedId) {
            return res.status(400).json({ error: 'You cannot block yourself.' });
        }

        // Check if already blocked
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

// ============================================
// 12. REPORT USER - Ripoti mtumiaji
// ============================================

router.post('/report', authenticateToken, async (req, res) => {
    try {
        const reporterId = req.user.id;
        const { reported_id, reason, details } = req.body;

        if (!reported_id || !reason) {
            return res.status(400).json({ error: 'Reported user and reason are required.' });
        }

        if (reporterId === reported_id) {
            return res.status(400).json({ error: 'You cannot report yourself.' });
        }

        // Check if user exists
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
// 13. RANDOM MATCH - Pata match random
// ============================================

router.post('/match/random', authenticateToken, checkFreeLimits('match'), async (req, res) => {
    try {
        const userId = req.user.id;

        // Get all users except current user
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

        // Get blocked users
        const blockedSnapshot = await db.collection('blocked_users')
            .where('blocker_id', '==', userId)
            .get();
        
        const blockedIds = new Set();
        blockedSnapshot.forEach(doc => {
            blockedIds.add(doc.data().blocked_id);
        });

        // Filter out blocked users
        const filteredUsers = availableUsers.filter(u => !blockedIds.has(u.id));

        if (filteredUsers.length === 0) {
            return res.json({
                success: false,
                message: 'No users available for matching. Try again later! 😔',
            });
        }

        // Random select
        const randomIndex = Math.floor(Math.random() * filteredUsers.length);
        const matchedUser = filteredUsers[randomIndex];

        // Create match record
        await db.collection('matches').add({
            user1_id: userId,
            user2_id: matchedUser.id,
            status: 'pending',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Create notification for matched user
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

// ============================================
// 14. GET MATCHES - Pata matches zako
// ============================================

router.get('/matches', authenticateToken, async (req, res) => {
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

        // Get user details for each match
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

// ============================================
// 15. GET STATS - Pata takwimu za jumla
// ============================================

router.get('/stats', async (req, res) => {
    try {
        const usersSnapshot = await db.collection('users').get();
        const totalUsers = usersSnapshot.size;

        const onlineSnapshot = await db.collection('users')
            .where('online_status', '==', 'online')
            .get();
        const onlineUsers = onlineSnapshot.size;

        const matchesSnapshot = await db.collection('matches').get();
        const totalMatches = matchesSnapshot.size;

        const messagesSnapshot = await db.collection('messages').get();
        const totalMessages = messagesSnapshot.size;

        res.json({
            success: true,
            totalUsers,
            onlineUsers,
            totalMatches,
            totalMessages,
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;
