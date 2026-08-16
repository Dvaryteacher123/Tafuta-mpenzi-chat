// ============================================
// ROUTES - PAYMENTS
// ============================================

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const axios = require('axios');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');

const db = admin.firestore();

// ============================================
// 1. GET ALL PREMIUM PLANS - Pata plans zote
// ============================================

router.get('/plans', async (req, res) => {
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

// ============================================
// 2. GET PLAN BY ID - Pata plan moja
// ============================================

router.get('/plans/:planId', async (req, res) => {
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
// 3. INITIATE PAYMENT - Anza malipo
// ============================================

router.post('/initiate', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { plan_id, phone } = req.body;

        if (!plan_id || !phone) {
            return res.status(400).json({ error: 'Plan ID and phone number are required.' });
        }

        // Get plan details
        const planDoc = await db.collection('premium_plans').doc(plan_id).get();
        if (!planDoc.exists) {
            return res.status(404).json({ error: 'Plan not found.' });
        }

        const plan = planDoc.data();

        // Get user details
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userData = userDoc.data();

        // Generate order ID
        const orderId = `HP${Date.now()}${Math.random().toString(36).substring(2, 10)}`;

        // Create payment record
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

        // Send payment request to HarakaPay
        const HARAKAPAY_API_KEY = process.env.HARAKAPAY_API_KEY;
        const HARAKAPAY_BASE_URL = process.env.HARAKAPAY_BASE_URL || 'https://harakapay.net';
        const HARAKAPAY_WEBHOOK_URL = process.env.HARAKAPAY_WEBHOOK_URL || 'https://tafuta-mpenzi-chat.onrender.com/api/webhook/harakapay';

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
        res.status(500).json({
            success: false,
            error: 'Payment initiation failed. Please try again.',
        });
    }
});

// ============================================
// 4. HARAKAPAY WEBHOOK - Malipo yanapothibitishwa
// ============================================

router.post('/webhook/harakapay', async (req, res) => {
    try {
        const payload = req.body;
        console.log('📨 HarakaPay Webhook received:', JSON.stringify(payload, null, 2));

        const { order_id, status, amount, net_amount, fee_amount, completed_at } = payload;

        if (!order_id) {
            console.error('No order_id in webhook payload');
            return res.status(400).json({ error: 'Invalid webhook payload' });
        }

        // Find payment by harakapay_order_id
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

        // Prevent duplicate processing
        if (paymentData.status === 'completed') {
            console.log('Payment already completed:', order_id);
            return res.json({ status: 'already_processed' });
        }

        // Update payment status
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

        // If payment is completed, upgrade user to premium
        if (status === 'completed' || status === 'converted') {
            const userId = paymentData.user_id;
            
            // Get plan details
            const planDoc = await db.collection('premium_plans').doc(paymentData.plan_id).get();
            const plan = planDoc.data();

            // Get user current expiry (if any)
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();

            let expiresAt = new Date();
            
            // If user already has premium, extend from current expiry
            if (userData.is_premium && userData.premium_expires_at) {
                const currentExpiry = userData.premium_expires_at.toDate ? 
                    userData.premium_expires_at.toDate() : 
                    new Date(userData.premium_expires_at);
                
                if (new Date() < currentExpiry) {
                    // Extend from current expiry
                    expiresAt = new Date(currentExpiry);
                    expiresAt.setDate(expiresAt.getDate() + plan.duration_days);
                } else {
                    // Premium expired, start fresh
                    expiresAt.setDate(expiresAt.getDate() + plan.duration_days);
                }
            } else {
                // New premium user
                expiresAt.setDate(expiresAt.getDate() + plan.duration_days);
            }

            // Activate premium
            await db.collection('users').doc(userId).update({
                is_premium: true,
                premium_started_at: admin.firestore.FieldValue.serverTimestamp(),
                premium_expires_at: expiresAt,
                subscription_status: 'active',
            });

            // Turn off trial if active
            if (userData.trial_active) {
                await db.collection('users').doc(userId).update({
                    trial_active: false,
                });
            }

            // Create notification for user
            await db.collection('notifications').add({
                user_id: userId,
                type: 'premium_activated',
                title: '⭐ Premium Activated!',
                message: `Congratulations! Your ${plan.name} is now active. Expires: ${expiresAt.toLocaleDateString()}`,
                data: { 
                    plan: plan.name,
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

// ============================================
// 5. CHECK PAYMENT STATUS - Angalia hali ya malipo
// ============================================

router.get('/status/:orderId', authenticateToken, async (req, res) => {
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

        // Check with HarakaPay for latest status
        try {
            const HARAKAPAY_API_KEY = process.env.HARAKAPAY_API_KEY;
            const HARAKAPAY_BASE_URL = process.env.HARAKAPAY_BASE_URL || 'https://harakapay.net';
            
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
                
                // Update local status if different
                if (harakaStatus !== paymentData.status) {
                    await db.collection('payments').doc(doc.id).update({
                        status: harakaStatus,
                        updated_at: admin.firestore.FieldValue.serverTimestamp(),
                    });

                    // If completed, upgrade user
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
            // Return local status if HarakaPay check fails
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

// ============================================
// 6. GET USER PAYMENT HISTORY - Historia ya malipo
// ============================================

router.get('/history', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 50;

        const snapshot = await db.collection('payments')
            .where('user_id', '==', userId)
            .orderBy('created_at', 'desc')
            .limit(limit)
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
        console.error('Get payment history error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 7. ADMIN - GET ALL PAYMENTS
// ============================================

router.get('/admin/all', authenticateAdmin, async (req, res) => {
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
        console.error('Admin get payments error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 8. ADMIN - GET PAYMENT STATS
// ============================================

router.get('/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('payments').get();
        
        let totalRevenue = 0;
        let todayRevenue = 0;
        let pending = 0;
        let completed = 0;
        let failed = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        snapshot.forEach(doc => {
            const data = doc.data();
            const amount = data.amount || 0;
            const status = data.status || 'pending';
            const createdAt = data.created_at?.toDate ? data.created_at.toDate() : new Date(data.created_at);

            if (status === 'completed') {
                totalRevenue += amount;
                if (createdAt >= today) {
                    todayRevenue += amount;
                }
                completed++;
            } else if (status === 'pending') {
                pending++;
            } else if (status === 'failed') {
                failed++;
            }
        });

        res.json({
            success: true,
            stats: {
                totalRevenue,
                todayRevenue,
                pending,
                completed,
                failed,
                total: snapshot.size,
            },
        });
    } catch (error) {
        console.error('Admin payment stats error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 9. ADMIN - UPDATE PAYMENT STATUS
// ============================================

router.put('/admin/update/:paymentId', authenticateAdmin, async (req, res) => {
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

        // If marking as completed, activate premium
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

        res.json({
            success: true,
            message: 'Payment status updated.',
        });
    } catch (error) {
        console.error('Admin update payment error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;
