// ============================================
// ROUTES - ADMIN
// ============================================

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const bcrypt = require('bcrypt');
const { authenticateAdmin } = require('../middleware/auth');

const db = admin.firestore();

// ============================================
// 1. GET DASHBOARD STATS - Takwimu za dashibodi
// ============================================

router.get('/dashboard/stats', authenticateAdmin, async (req, res) => {
    try {
        // Get users
        const usersSnapshot = await db.collection('users').get();
        const totalUsers = usersSnapshot.size;

        // Online users
        const onlineSnapshot = await db.collection('users')
            .where('online_status', '==', 'online')
            .get();
        const onlineUsers = onlineSnapshot.size;

        // Premium users
        const premiumSnapshot = await db.collection('users')
            .where('is_premium', '==', true)
            .get();
        const premiumUsers = premiumSnapshot.size;

        // Free users
        const freeUsers = totalUsers - premiumUsers;

        // Today's signups
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todaySignupsSnapshot = await db.collection('users')
            .where('created_at', '>=', today)
            .where('created_at', '<', tomorrow)
            .get();
        const todaySignups = todaySignupsSnapshot.size;

        // Payments
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

        // Reports
        const reportsSnapshot = await db.collection('reports')
            .where('status', '==', 'pending')
            .get();
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

// ============================================
// 2. GET ALL USERS - Pata watumiaji wote
// ============================================

router.get('/users', authenticateAdmin, async (req, res) => {
    try {
        const { search, filter } = req.query;

        let query = db.collection('users');

        if (filter === 'premium') {
            query = query.where('is_premium', '==', true);
        } else if (filter === 'free') {
            query = query.where('is_premium', '==', false);
        } else if (filter === 'banned') {
            query = query.where('is_banned', '==', true);
        }

        const snapshot = await query.get();
        const users = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            // Don't send password hash
            delete data.password_hash;
            
            // Search filter
            if (search) {
                const searchLower = search.toLowerCase();
                const nameMatch = (data.full_name || '').toLowerCase().includes(searchLower);
                const usernameMatch = (data.username || '').toLowerCase().includes(searchLower);
                const emailMatch = (data.email || '').toLowerCase().includes(searchLower);
                if (!nameMatch && !usernameMatch && !emailMatch) {
                    return;
                }
            }

            users.push({
                id: doc.id,
                ...data,
            });
        });

        res.json({
            success: true,
            users: users,
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 3. GET USER BY ID - Pata mtumiaji mmoja
// ============================================

router.get('/users/:userId', authenticateAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userData = userDoc.data();
        delete userData.password_hash;

        res.json({
            success: true,
            user: {
                id: userId,
                ...userData,
            },
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 4. BAN USER - Zuia mtumiaji
// ============================================

router.post('/users/ban/:userId', authenticateAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;

        await db.collection('users').doc(userId).update({
            is_banned: true,
            banned_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Log admin action
        await logAdminAction(req.user.id, 'ban_user', `Banned user: ${userId}`);

        res.json({
            success: true,
            message: 'User banned successfully!',
        });
    } catch (error) {
        console.error('Ban user error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 5. UNBAN USER - Ondoa zuio
// ============================================

router.post('/users/unban/:userId', authenticateAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;

        await db.collection('users').doc(userId).update({
            is_banned: false,
            banned_at: null,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        await logAdminAction(req.user.id, 'unban_user', `Unbanned user: ${userId}`);

        res.json({
            success: true,
            message: 'User unbanned successfully!',
        });
    } catch (error) {
        console.error('Unban user error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 6. DELETE USER - Futa mtumiaji
// ============================================

router.delete('/users/:userId', authenticateAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;

        await db.collection('users').doc(userId).delete();

        await logAdminAction(req.user.id, 'delete_user', `Deleted user: ${userId}`);

        res.json({
            success: true,
            message: 'User deleted successfully!',
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 7. MAKE USER PREMIUM - Weka mtumiaji kuwa Premium
// ============================================

router.post('/users/make-premium/:userId', authenticateAdmin, async (req, res) => {
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
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        await logAdminAction(req.user.id, 'make_premium', `Made user ${userId} premium for ${days} days`);

        await db.collection('notifications').add({
            user_id: userId,
            type: 'premium_activated',
            title: '⭐ Premium Activated!',
            message: `Admin has activated your Premium subscription for ${days} days. Enjoy! 🎉`,
            is_read: false,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({
            success: true,
            message: 'User is now Premium!',
        });
    } catch (error) {
        console.error('Make premium error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 8. REMOVE PREMIUM - Ondoa Premium
// ============================================

router.post('/users/remove-premium/:userId', authenticateAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;

        await db.collection('users').doc(userId).update({
            is_premium: false,
            premium_expires_at: null,
            subscription_status: 'free',
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        await logAdminAction(req.user.id, 'remove_premium', `Removed premium from user: ${userId}`);

        res.json({
            success: true,
            message: 'Premium removed!',
        });
    } catch (error) {
        console.error('Remove premium error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 9. GET ALL PAYMENTS - Pata malipo yote
// ============================================

router.get('/payments', authenticateAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('payments')
            .orderBy('created_at', 'desc')
            .get();

        const payments = [];
        snapshot.forEach(doc => {
            payments.push({
                id: doc.id,
                ...doc.data(),
            });
        });

        res.json({
            success: true,
            payments: payments,
        });
    } catch (error) {
        console.error('Get payments error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 10. GET PREMIUM PLANS - Pata premium plans zote
// ============================================

router.get('/plans', authenticateAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('premium_plans')
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

// ============================================
// 11. CREATE PREMIUM PLAN - Unda plan mpya
// ============================================

router.post('/plans', authenticateAdmin, async (req, res) => {
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

        await logAdminAction(req.user.id, 'create_plan', `Created plan: ${name}`);

        res.json({
            success: true,
            message: 'Plan created successfully!',
            plan: {
                id: planRef.id,
                ...planData,
            },
        });
    } catch (error) {
        console.error('Create plan error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 12. UPDATE PREMIUM PLAN - Badilisha plan
// ============================================

router.put('/plans/:planId', authenticateAdmin, async (req, res) => {
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

        await logAdminAction(req.user.id, 'update_plan', `Updated plan: ${planId}`);

        res.json({
            success: true,
            message: 'Plan updated successfully!',
        });
    } catch (error) {
        console.error('Update plan error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 13. DELETE PREMIUM PLAN - Futa plan
// ============================================

router.delete('/plans/:planId', authenticateAdmin, async (req, res) => {
    try {
        const planId = req.params.planId;

        await db.collection('premium_plans').doc(planId).delete();

        await logAdminAction(req.user.id, 'delete_plan', `Deleted plan: ${planId}`);

        res.json({
            success: true,
            message: 'Plan deleted successfully!',
        });
    } catch (error) {
        console.error('Delete plan error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 14. GET ALL REPORTS - Pata ripoti zote
// ============================================

router.get('/reports', authenticateAdmin, async (req, res) => {
    try {
        const { status } = req.query;

        let query = db.collection('reports');

        if (status && status !== 'all') {
            query = query.where('status', '==', status);
        }

        const snapshot = await query
            .orderBy('created_at', 'desc')
            .get();

        const reports = [];
        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            // Get reporter name
            let reporterName = 'Unknown';
            try {
                const reporterDoc = await db.collection('users').doc(data.reporter_id).get();
                if (reporterDoc.exists) {
                    const reporterData = reporterDoc.data();
                    reporterName = reporterData.full_name || reporterData.username || 'Unknown';
                }
            } catch (e) {}

            // Get reported name
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

        res.json({
            success: true,
            reports: reports,
        });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 15. UPDATE REPORT STATUS - Badilisha hali ya ripoti
// ============================================

router.put('/reports/:reportId', authenticateAdmin, async (req, res) => {
    try {
        const reportId = req.params.reportId;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required.' });
        }

        await db.collection('reports').doc(reportId).update({
            status: status,
            reviewed_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        await logAdminAction(req.user.id, 'update_report', `Updated report ${reportId} to ${status}`);

        res.json({
            success: true,
            message: 'Report updated!',
        });
    } catch (error) {
        console.error('Update report error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 16. SEND NOTIFICATION - Tuma arifa kwa watumiaji
// ============================================

router.post('/notifications/send', authenticateAdmin, async (req, res) => {
    try {
        const { target, user_id, title, message, data } = req.body;

        if (!target || !title || !message) {
            return res.status(400).json({ error: 'Target, title and message are required.' });
        }

        const notificationData = {
            title,
            message,
            data: data || {},
            sent_by: req.user.id,
            sent_at: admin.firestore.FieldValue.serverTimestamp(),
            is_read: false,
        };

        let users = [];

        if (target === 'specific' && user_id) {
            // Send to specific user
            users = [user_id];
        } else if (target === 'all') {
            // Send to all users
            const snapshot = await db.collection('users').get();
            snapshot.forEach(doc => {
                users.push(doc.id);
            });
        } else if (target === 'premium') {
            // Send to premium users
            const snapshot = await db.collection('users')
                .where('is_premium', '==', true)
                .get();
            snapshot.forEach(doc => {
                users.push(doc.id);
            });
        } else if (target === 'free') {
            // Send to free users
            const snapshot = await db.collection('users')
                .where('is_premium', '==', false)
                .get();
            snapshot.forEach(doc => {
                users.push(doc.id);
            });
        }

        // Create notifications
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

        await logAdminAction(req.user.id, 'send_notification', `Sent notification to ${users.length} users`);

        res.json({
            success: true,
            message: `Notification sent to ${users.length} users!`,
            count: users.length,
        });
    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 17. GET ADMIN LOGS - Pata historia ya admin
// ============================================

router.get('/logs', authenticateAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;

        const snapshot = await db.collection('admin_logs')
            .orderBy('created_at', 'desc')
            .limit(limit)
            .get();

        const logs = [];
        snapshot.forEach(doc => {
            logs.push({
                id: doc.id,
                ...doc.data(),
            });
        });

        res.json({
            success: true,
            logs: logs,
        });
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 18. UPDATE FREE TRIAL SETTINGS - Badilisha mipangilio ya Trial
// ============================================

router.post('/settings/trial', authenticateAdmin, async (req, res) => {
    try {
        const { trial_days } = req.body;

        if (!trial_days || trial_days < 0) {
            return res.status(400).json({ error: 'Invalid trial days.' });
        }

        // Save to settings collection
        await db.collection('settings').doc('trial').set({
            trial_days: parseInt(trial_days),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_by: req.user.id,
        });

        await logAdminAction(req.user.id, 'update_trial', `Updated trial days to ${trial_days}`);

        res.json({
            success: true,
            message: `Trial settings updated to ${trial_days} days!`,
        });
    } catch (error) {
        console.error('Update trial settings error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 19. GET FREE TRIAL SETTINGS - Pata mipangilio ya Trial
// ============================================

router.get('/settings/trial', authenticateAdmin, async (req, res) => {
    try {
        const doc = await db.collection('settings').doc('trial').get();

        if (!doc.exists) {
            return res.json({
                success: true,
                trial_days: parseInt(process.env.FREE_TRIAL_DAYS) || 3,
            });
        }

        res.json({
            success: true,
            ...doc.data(),
        });
    } catch (error) {
        console.error('Get trial settings error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// HELPER: LOG ADMIN ACTION
// ============================================

async function logAdminAction(adminId, action, details) {
    try {
        await db.collection('admin_logs').add({
            admin_id: adminId,
            action: action,
            details: details || '',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.error('Log admin action error:', error);
    }
}

module.exports = router;
