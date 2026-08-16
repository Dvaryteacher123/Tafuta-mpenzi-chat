// ============================================
// ROUTES - CHAT
// ============================================

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { authenticateToken, checkFreeLimits } = require('../middleware/auth');

const db = admin.firestore();

// ============================================
// 1. GET OR CREATE CONVERSATION - Pata au unda mazungumzo
// ============================================

router.post('/conversations/:userId', authenticateToken, async (req, res) => {
    try {
        const user1Id = req.user.id;
        const user2Id = req.params.userId;

        if (user1Id === user2Id) {
            return res.status(400).json({ error: 'Cannot chat with yourself.' });
        }

        // Check if blocked
        const blockCheck = await db.collection('blocked_users')
            .where('blocker_id', '==', user1Id)
            .where('blocked_id', '==', user2Id)
            .get();

        if (!blockCheck.empty) {
            return res.status(403).json({ error: 'You cannot chat with this user.' });
        }

        // Check if conversation exists
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
                // Create new conversation
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

// ============================================
// 2. GET USER'S CONVERSATIONS - Pata mazungumzo yote
// ============================================

router.get('/conversations', authenticateToken, async (req, res) => {
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

        // Get user details for each conversation
        const conversationsWithDetails = [];
        for (const conv of conversations) {
            const userDoc = await db.collection('users').doc(conv.other_user_id).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                
                // Get unread count
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

        // Sort by last message time
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

// ============================================
// 3. GET MESSAGES - Pata ujumbe wa mazungumzo
// ============================================

router.get('/messages/:conversationId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const conversationId = req.params.conversationId;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        // Verify user is part of conversation
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

        // Mark messages as read
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

// ============================================
// 4. SEND MESSAGE - Tuma ujumbe
// ============================================

router.post('/messages', authenticateToken, checkFreeLimits('message'), async (req, res) => {
    try {
        const senderId = req.user.id;
        const { conversation_id, receiver_id, message, message_type, image_data } = req.body;

        if (!conversation_id || !receiver_id) {
            return res.status(400).json({ error: 'Conversation ID and receiver ID are required.' });
        }

        // Check if blocked by receiver
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

        // Update conversation last message
        await db.collection('conversations').doc(conversation_id).update({
            last_message: messageData.message || '📷 Image',
            last_message_time: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Get sender info for socket
        const senderDoc = await db.collection('users').doc(senderId).get();
        const senderData = senderDoc.data();

        // Get socket.io instance
        const io = req.app.get('io');
        
        if (io) {
            // Emit to receiver
            io.to(`chat-${receiver_id}`).emit('new-message', {
                id: msgRef.id,
                ...messageData,
                sender_name: senderData.full_name || senderData.username,
                sender_username: senderData.username,
                created_at: new Date().toISOString(),
            });

            // Emit back to sender
            io.to(`chat-${senderId}`).emit('message-sent', {
                id: msgRef.id,
                ...messageData,
                created_at: new Date().toISOString(),
            });
        }

        // Create notification for receiver
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

// ============================================
// 5. DELETE MESSAGE - Futa ujumbe
// ============================================

router.delete('/messages/:messageId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const messageId = req.params.messageId;

        const msgDoc = await db.collection('messages').doc(messageId).get();
        if (!msgDoc.exists) {
            return res.status(404).json({ error: 'Message not found.' });
        }

        const msgData = msgDoc.data();
        
        // Only sender can delete
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

// ============================================
// 6. MARK MESSAGES AS READ - Weka ujumbe kuwa umesomwa
// ============================================

router.post('/messages/read', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'User ID is required.' });
        }

        // Get all conversations with this user
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

        // Mark messages as read
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
// 7. GET TYPING INDICATOR - Pata taarifa ya kuandika
// ============================================

router.post('/typing', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { receiver_id, is_typing } = req.body;

        if (!receiver_id) {
            return res.status(400).json({ error: 'Receiver ID is required.' });
        }

        const io = req.app.get('io');
        
        if (io) {
            if (is_typing) {
                io.to(`chat-${receiver_id}`).emit('typing', {
                    user_id: userId,
                    username: req.userData.username,
                });
            } else {
                io.to(`chat-${receiver_id}`).emit('stop-typing', {
                    user_id: userId,
                });
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Typing error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 8. GET NOTIFICATIONS - Pata arifa
// ============================================

router.get('/notifications', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 50;

        const snapshot = await db.collection('notifications')
            .where('user_id', '==', userId)
            .orderBy('created_at', 'desc')
            .limit(limit)
            .get();

        const notifications = [];
        snapshot.forEach(doc => {
            notifications.push({
                id: doc.id,
                ...doc.data(),
            });
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

// ============================================
// 9. MARK NOTIFICATION AS READ - Weka arifa kuwa imesomwa
// ============================================

router.post('/notifications/read/:notificationId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const notificationId = req.params.notificationId;

        const notifDoc = await db.collection('notifications').doc(notificationId).get();
        if (!notifDoc.exists) {
            return res.status(404).json({ error: 'Notification not found.' });
        }

        const notifData = notifDoc.data();
        if (notifData.user_id !== userId) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        await db.collection('notifications').doc(notificationId).update({
            is_read: true,
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ============================================
// 10. MARK ALL NOTIFICATIONS AS READ - Weka arifa zote kuwa zimesomwa
// ============================================

router.post('/notifications/read-all', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

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

module.exports = router;
