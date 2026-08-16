// ============================================
// JAVASCRIPT - CHAT.JS
// ============================================
// KAZI: Logic zote za chat system.
// Inashughulikia: Conversations, Messages,
// Real-time updates, Typing indicator,
// Message status, Attachments, Emojis.
// ============================================

// ============================================
// CHAT STATE
// ============================================

const Chat = {
    // Current conversation
    currentConversation: null,
    currentUserId: null,
    
    // All conversations
    conversations: [],
    
    // Messages cache
    messages: {},
    
    // Typing
    typingUsers: {},
    
    // Unread counts
    unreadCounts: {},
    
    // Loading states
    isLoading: false,
    isSending: false,
    
    // Pagination
    pageSize: 50,
    hasMore: true,
};

// ============================================
// DOM REFS (Chat specific)
// ============================================

const ChatDOM = {
    // Chat list
    chatList: document.getElementById('chatList'),
    chatSearch: document.getElementById('chatSearchInput'),
    chatFilters: document.querySelector('.chat-filters'),
    
    // Chat window
    chatWindow: document.getElementById('chatWindow'),
    chatMessages: document.getElementById('chatMessages'),
    chatInput: document.getElementById('chatInput'),
    chatSendBtn: document.querySelector('.send-btn'),
    
    // Chat header
    chatHeader: document.querySelector('.chat-header'),
    chatUserName: document.getElementById('chatUserName'),
    chatUserStatus: document.getElementById('chatUserStatus'),
    chatAvatar: document.getElementById('chatAvatar'),
    
    // Typing indicator
    typingIndicator: document.getElementById('typingIndicator'),
    
    // Back button
    backBtn: document.querySelector('.back-btn'),
    
    // Emoji picker
    emojiPicker: document.querySelector('.emoji-picker'),
    emojiBtn: document.querySelector('.emoji-btn'),
    
    // Image upload
    imageBtn: document.querySelector('.image-btn'),
    imageInput: document.getElementById('imageInput'),
};

// ============================================
// CONVERSATIONS
// ============================================

/**
 * Load all conversations
 */
async function loadConversations() {
    if (Chat.isLoading) return;
    Chat.isLoading = true;
    
    try {
        const result = await API.getConversations();
        
        if (result.success && result.conversations) {
            Chat.conversations = result.conversations;
            renderConversations(result.conversations);
            updateUnreadBadges(result.conversations);
        } else {
            showEmptyState(ChatDOM.chatList, '💬', 'Hakuna chats', 'Anza kuongea na watu wapya!');
        }
    } catch (error) {
        console.error('Load conversations error:', error);
        showEmptyState(ChatDOM.chatList, '❌', 'Error', 'Imeshindwa kupakia chats.');
    }
    
    Chat.isLoading = false;
}

/**
 * Render conversations list
 */
function renderConversations(conversations) {
    if (!conversations || conversations.length === 0) {
        showEmptyState(ChatDOM.chatList, '💬', 'Hakuna chats', 'Anza kuongea na watu wapya!');
        return;
    }
    
    let html = '';
    
    conversations.forEach(conv => {
        const isActive = Chat.currentConversation && conv.other_user_id === Chat.currentUserId;
        const lastMsg = conv.last_message || 'Anza mazungumzo...';
        const time = conv.last_message_time ? formatTime(conv.last_message_time) : '';
        const unread = conv.unread_count || 0;
        const isOnline = conv.online_status === 'online';
        const isPremium = conv.is_premium;
        
        html += `
            <div class="chat-item ${isActive ? 'active' : ''}" data-userid="${conv.other_user_id}" onclick="openConversation('${conv.other_user_id}')">
                <div class="avatar">
                    ${conv.profile_picture ? `<img src="${conv.profile_picture}">` : '👤'}
                    <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
                </div>
                <div class="chat-info">
                    <div class="name">
                        ${conv.full_name || conv.username}
                        ${isPremium ? '<span class="premium-badge">⭐</span>' : ''}
                    </div>
                    <div class="last-message">${lastMsg}</div>
                </div>
                <div class="chat-meta">
                    ${time ? `<div class="time">${time}</div>` : ''}
                    ${unread > 0 ? `<div class="unread-count">${unread}</div>` : ''}
                </div>
            </div>
        `;
    });
    
    ChatDOM.chatList.innerHTML = html;
}

/**
 * Update unread badges
 */
function updateUnreadBadges(conversations) {
    let totalUnread = 0;
    
    conversations.forEach(conv => {
        const unread = conv.unread_count || 0;
        totalUnread += unread;
        Chat.unreadCounts[conv.other_user_id] = unread;
    });
    
    // Update badges
    const chatBadge = document.getElementById('chatBadge');
    const bottomBadge = document.getElementById('bottomChatBadge');
    
    if (chatBadge) chatBadge.textContent = totalUnread || '';
    if (bottomBadge) bottomBadge.textContent = totalUnread || '';
}

/**
 * Filter conversations by search
 */
function filterConversations(query) {
    if (!query || query.trim() === '') {
        renderConversations(Chat.conversations);
        return;
    }
    
    const filtered = Chat.conversations.filter(conv => {
        const name = (conv.full_name || conv.username || '').toLowerCase();
        return name.includes(query.toLowerCase());
    });
    
    renderConversations(filtered);
}

// ============================================
// CONVERSATION
// ============================================

/**
 * Open a conversation
 */
async function openConversation(userId, userName) {
    if (!userId) return;
    
    // Check if blocked
    const isBlocked = await checkIfBlocked(userId);
    if (isBlocked) {
        showToast('🚫 You cannot chat with this user.', 'error');
        return;
    }
    
    // Get or create conversation
    try {
        const result = await API.getConversation(userId);
        
        if (!result.success) {
            showToast(result.error || 'Error opening conversation', 'error');
            return;
        }
        
        Chat.currentUserId = userId;
        Chat.currentConversation = result.conversation_id;
        
        // Get user info if not provided
        if (!userName) {
            const userResult = await API.getUser(userId);
            if (userResult.success) {
                userName = userResult.user.full_name || userResult.user.username;
            }
        }
        
        // Update UI
        updateChatHeader(userId, userName);
        showChatWindow(true);
        
        // Load messages
        await loadMessages(Chat.currentConversation);
        
        // Mark messages as read
        await markConversationRead(userId);
        
        // Join socket room
        if (window.App && App.socket) {
            App.socket.emit('join-chat', userId);
        }
        
        // Update conversation list
        loadConversations();
        
    } catch (error) {
        console.error('Open conversation error:', error);
        showToast('Error opening conversation', 'error');
    }
}

/**
 * Update chat header
 */
function updateChatHeader(userId, userName) {
    const user = findUserInConversations(userId);
    
    ChatDOM.chatUserName.textContent = userName || user?.full_name || user?.username || 'User';
    
    const isOnline = user?.online_status === 'online';
    ChatDOM.chatUserStatus.textContent = isOnline ? '🟢 Online' : '⚫ Offline';
    ChatDOM.chatUserStatus.className = `status ${isOnline ? 'online' : ''}`;
    
    // Avatar
    const avatar = user?.profile_picture;
    if (avatar) {
        ChatDOM.chatAvatar.innerHTML = `<img src="${avatar}">`;
    } else {
        ChatDOM.chatAvatar.textContent = '👤';
    }
}

/**
 * Show/hide chat window
 */
function showChatWindow(show) {
    if (show) {
        ChatDOM.chatWindow.style.display = 'flex';
        ChatDOM.chatWindow.classList.add('active');
        
        // On mobile, hide sidebar
        if (window.innerWidth <= 768) {
            document.querySelector('.chat-sidebar')?.classList.add('hidden');
        }
    } else {
        ChatDOM.chatWindow.style.display = 'none';
        ChatDOM.chatWindow.classList.remove('active');
        
        if (window.innerWidth <= 768) {
            document.querySelector('.chat-sidebar')?.classList.remove('hidden');
        }
        
        Chat.currentUserId = null;
        Chat.currentConversation = null;
        
        if (window.App && App.socket) {
            App.socket.emit('leave-chat');
        }
    }
}

/**
 * Close chat
 */
function closeChat() {
    showChatWindow(false);
}

// ============================================
// MESSAGES
// ============================================

/**
 * Load messages for a conversation
 */
async function loadMessages(conversationId, loadMore = false) {
    if (Chat.isLoading) return;
    Chat.isLoading = true;
    
    try {
        const limit = Chat.pageSize;
        const params = `?limit=${limit}`;
        
        const result = await API.getMessages(conversationId, params);
        
        if (result.success && result.messages) {
            // Store messages
            Chat.messages[conversationId] = result.messages;
            renderMessages(result.messages);
            
            // Check if more messages exist
            Chat.hasMore = result.messages.length >= limit;
        } else {
            showEmptyState(ChatDOM.chatMessages, '💬', 'Hakuna ujumbe', 'Anza mazungumzo!');
        }
    } catch (error) {
        console.error('Load messages error:', error);
        showEmptyState(ChatDOM.chatMessages, '❌', 'Error', 'Imeshindwa kupakia ujumbe.');
    }
    
    Chat.isLoading = false;
}

/**
 * Render messages
 */
function renderMessages(messages) {
    if (!messages || messages.length === 0) {
        showEmptyState(ChatDOM.chatMessages, '💬', 'Hakuna ujumbe', 'Anza mazungumzo!');
        return;
    }
    
    let html = '';
    let lastDate = null;
    
    messages.forEach(msg => {
        const msgDate = new Date(msg.created_at).toLocaleDateString();
        
        // Add date divider
        if (msgDate !== lastDate) {
            html += `<div class="message-date-divider">${msgDate}</div>`;
            lastDate = msgDate;
        }
        
        const isSent = msg.sender_id === Auth.user?.id;
        const statusIcons = isSent ? getMessageStatus(msg) : '';
        
        html += `
            <div class="message ${isSent ? 'sent' : 'received'}" data-msgid="${msg.id}">
                ${msg.reply_to ? `<div class="reply-to">↩️ ${msg.reply_to}</div>` : ''}
                <div class="message-content">
                    ${msg.message_type === 'image' ? `<img src="${msg.image_url}" class="image-msg" onclick="viewImage('${msg.image_url}')">` : ''}
                    ${msg.message || ''}
                </div>
                <div class="message-footer">
                    <span class="time">${formatTime(msg.created_at)}</span>
                    ${statusIcons ? `<span class="status-icon">${statusIcons}</span>` : ''}
                </div>
                <div class="message-actions">
                    <button onclick="replyToMessage('${msg.id}')" title="Reply">↩️</button>
                    ${isSent ? `<button onclick="deleteMessage('${msg.id}')" title="Delete">🗑️</button>` : ''}
                    <button onclick="copyMessage('${msg.message || ''}')" title="Copy">📋</button>
                </div>
            </div>
        `;
    });
    
    ChatDOM.chatMessages.innerHTML = html;
    scrollToBottom();
}

/**
 * Get message status icons
 */
function getMessageStatus(msg) {
    if (msg.is_read) return '✅';
    if (msg.is_delivered) return '✓✓';
    return '✓';
}

/**
 * Format time
 */
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (msgDate.getTime() === today.getTime()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

/**
 * Scroll to bottom of messages
 */
function scrollToBottom() {
    const container = ChatDOM.chatMessages;
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

/**
 * Show empty state
 */
function showEmptyState(container, icon, title, message) {
    if (!container) return;
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">${icon}</div>
            <h3>${title}</h3>
            <p>${message}</p>
        </div>
    `;
}

// ============================================
// SEND MESSAGE
// ============================================

/**
 * Send a message
 */
async function sendMessage() {
    const message = ChatDOM.chatInput?.value.trim();
    if (!message || !Chat.currentUserId || Chat.isSending) return;
    
    Chat.isSending = true;
    ChatDOM.chatInput.value = '';
    
    try {
        const result = await API.sendMessage({
            conversation_id: Chat.currentConversation,
            receiver_id: Chat.currentUserId,
            message: message,
        });
        
        if (result.success) {
            // Emit via socket
            if (window.App && App.socket) {
                App.socket.emit('send-message', {
                    conversation_id: Chat.currentConversation,
                    receiver_id: Chat.currentUserId,
                    message: message,
                    sender_id: Auth.user?.id,
                });
            }
            
            // Reload messages
            await loadMessages(Chat.currentConversation);
            await loadConversations();
        } else {
            showToast(result.error || 'Error sending message', 'error');
            ChatDOM.chatInput.value = message;
        }
    } catch (error) {
        console.error('Send message error:', error);
        showToast('Error sending message', 'error');
        ChatDOM.chatInput.value = message;
    }
    
    Chat.isSending = false;
}

/**
 * Send image message
 */
async function sendImageMessage(file) {
    if (!file || !Chat.currentUserId) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        const imageData = e.target.result;
        
        try {
            const result = await API.sendMessage({
                conversation_id: Chat.currentConversation,
                receiver_id: Chat.currentUserId,
                message: '',
                message_type: 'image',
                image_data: imageData,
            });
            
            if (result.success) {
                if (window.App && App.socket) {
                    App.socket.emit('send-message', {
                        conversation_id: Chat.currentConversation,
                        receiver_id: Chat.currentUserId,
                        message: '',
                        message_type: 'image',
                        image_url: imageData,
                        sender_id: Auth.user?.id,
                    });
                }
                
                await loadMessages(Chat.currentConversation);
                await loadConversations();
            } else {
                showToast(result.error || 'Error sending image', 'error');
            }
        } catch (error) {
            console.error('Send image error:', error);
            showToast('Error sending image', 'error');
        }
    };
    reader.readAsDataURL(file);
}

/**
 * Handle enter key
 */
function handleChatKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
    
    // Typing indicator
    if (Chat.currentUserId && window.App && App.socket) {
        App.socket.emit('typing', { user_id: Chat.currentUserId });
        clearTimeout(window._typingTimeout);
        window._typingTimeout = setTimeout(() => {
            App.socket.emit('stop-typing', { user_id: Chat.currentUserId });
        }, 2000);
    }
}

// ============================================
// MESSAGE ACTIONS
// ============================================

/**
 * Delete a message
 */
async function deleteMessage(messageId) {
    if (!confirm('Je, una uhakika unataka kufuta ujumbe huu?')) return;
    
    try {
        const result = await API.deleteMessage(messageId);
        if (result.success) {
            showToast('🗑️ Ujumbe umefutwa!', 'success');
            await loadMessages(Chat.currentConversation);
        } else {
            showToast(result.error || 'Error deleting message', 'error');
        }
    } catch (error) {
        showToast('Error deleting message', 'error');
    }
}

/**
 * Reply to a message
 */
function replyToMessage(messageId) {
    const msg = findMessage(messageId);
    if (msg) {
        ChatDOM.chatInput.value = `@${msg.sender_name || 'User'}: ${msg.message || ''}`;
        ChatDOM.chatInput.focus();
    }
}

/**
 * Copy message
 */
function copyMessage(text) {
    if (!text) return;
    
    navigator.clipboard.writeText(text).then(() => {
        showToast('📋 Ujumbe umenakiliwa!', 'success');
    }).catch(() => {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('📋 Ujumbe umenakiliwa!', 'success');
    });
}

/**
 * View image full screen
 */
function viewImage(imageUrl) {
    if (!imageUrl) return;
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.9);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    `;
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        object-fit: contain;
        border-radius: 8px;
    `;
    
    overlay.appendChild(img);
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
    
    // Close on escape
    document.addEventListener('keydown', function handler(e) {
        if (e.key === 'Escape') {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
            document.removeEventListener('keydown', handler);
        }
    });
}

// ============================================
// MARK AS READ
// ============================================

/**
 * Mark conversation as read
 */
async function markConversationRead(userId) {
    try {
        await API.markRead({ user_id: userId });
        
        // Update local unread count
        if (Chat.unreadCounts[userId]) {
            Chat.unreadCounts[userId] = 0;
        }
    } catch (error) {
        // Ignore
    }
}

// ============================================
// TYPING INDICATOR
// ============================================

/**
 * Show typing indicator
 */
function showTypingIndicator(username) {
    if (!ChatDOM.typingIndicator) return;
    
    ChatDOM.typingIndicator.classList.add('active');
    ChatDOM.typingIndicator.innerHTML = `
        <span>${username || 'Someone'} is typing</span>
        <span class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
        </span>
    `;
}

/**
 * Hide typing indicator
 */
function hideTypingIndicator() {
    if (ChatDOM.typingIndicator) {
        ChatDOM.typingIndicator.classList.remove('active');
    }
}

// ============================================
// EMOJI PICKER
// ============================================

/**
 * Toggle emoji picker
 */
function toggleEmojiPicker() {
    if (!ChatDOM.emojiPicker) return;
    
    const isVisible = ChatDOM.emojiPicker.classList.contains('active');
    ChatDOM.emojiPicker.classList.toggle('active');
    
    if (!isVisible) {
        renderEmojis();
    }
}

/**
 * Render emojis
 */
function renderEmojis() {
    if (!ChatDOM.emojiPicker) return;
    
    const emojis = [
        '😊', '😍', '❤️', '💕', '😂', '🤣', '🥰', '😘',
        '💖', '💗', '💓', '💝', '✨', '🌟', '⭐', '🔥',
        '👋', '🙏', '💪', '🎉', '🎊', '🥳', '🎈', '🎁',
        '💎', '🌈', '🌺', '🌸', '🌹', '🌻', '💐', '🌷',
        '🍕', '🍔', '🍟', '🍩', '🍪', '🎂', '🍫', '🍭',
        '⚽', '🏀', '🎮', '🎯', '🎲', '🎳', '🎪', '🎨',
    ];
    
    let html = '<div class="emoji-grid">';
    emojis.forEach(emoji => {
        html += `<button onclick="insertEmoji('${emoji}')">${emoji}</button>`;
    });
    html += '</div>';
    
    ChatDOM.emojiPicker.innerHTML = html;
}

/**
 * Insert emoji into input
 */
function insertEmoji(emoji) {
    if (ChatDOM.chatInput) {
        const input = ChatDOM.chatInput;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        
        input.value = text.substring(0, start) + emoji + text.substring(end);
        input.selectionStart = input.selectionEnd = start + emoji.length;
        input.focus();
    }
    
    // Close emoji picker
    if (ChatDOM.emojiPicker) {
        ChatDOM.emojiPicker.classList.remove('active');
    }
}

// ============================================
// IMAGE UPLOAD
// ============================================

/**
 * Handle image upload
 */
function handleImageUpload() {
    if (ChatDOM.imageInput) {
        ChatDOM.imageInput.click();
    }
}

/**
 * Handle image selection
 */
function handleImageSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('❌ Picha ni kubwa sana (max 5MB)', 'error');
        return;
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
        showToast('❌ Tafadhali chagua picha tu.', 'error');
        return;
    }
    
    sendImageMessage(file);
    event.target.value = '';
}

// ============================================
// BLOCK / REPORT
// ============================================

/**
 * Check if user is blocked
 */
async function checkIfBlocked(userId) {
    try {
        const result = await API.request(`/users/check-block/${userId}`, 'GET');
        return result.blocked || false;
    } catch (error) {
        return false;
    }
}

/**
 * Block a user
 */
async function blockUser(userId) {
    if (!confirm('Je, una uhakika unataka kumzuia mtumiaji huyu?')) return;
    
    try {
        const result = await API.blockUser(userId);
        if (result.success) {
            showToast('🚫 Mtumiaji amezuiwa!', 'success');
            closeChat();
            loadConversations();
        } else {
            showToast(result.error || 'Error', 'error');
        }
    } catch (error) {
        showToast('Error', 'error');
    }
}

/**
 * Report a user
 */
async function reportUser(userId) {
    const reasons = ['Spam', 'Harassment', 'Fake Profile', 'Scam', 'Inappropriate Content', 'Other'];
    const choice = prompt(
        `Chagua sababu ya kuripoti:\n${reasons.map((r, i) => `${i+1}. ${r}`).join('\n')}`
    );
    
    if (!choice) return;
    
    const reason = reasons[parseInt(choice) - 1] || 'Other';
    const details = prompt('Andika maelezo zaidi (hiari):') || '';
    
    try {
        const result = await API.reportUser({
            reported_id: userId,
            reason: reason,
            details: details,
        });
        
        if (result.success) {
            showToast('✅ Mtumiaji ameripotiwa!', 'success');
        } else {
            showToast(result.error || 'Error', 'error');
        }
    } catch (error) {
        showToast('Error', 'error');
    }
}

// ============================================
// HELPERS
// ============================================

/**
 * Find user in conversations
 */
function findUserInConversations(userId) {
    const conv = Chat.conversations.find(c => c.other_user_id === userId);
    return conv || null;
}

/**
 * Find message by ID
 */
function findMessage(messageId) {
    const messages = Chat.messages[Chat.currentConversation] || [];
    return messages.find(m => m.id === messageId);
}

/**
 * Get chat menu actions
 */
function showChatMenu() {
    if (!Chat.currentUserId) return;
    
    const actions = [
        { label: '🚫 Block User', action: () => blockUser(Chat.currentUserId) },
        { label: '🚨 Report User', action: () => reportUser(Chat.currentUserId) },
        { label: '🗑️ Clear Chat', action: () => clearChat() },
        { label: '📋 View Profile', action: () => viewUserProfile(Chat.currentUserId) },
    ];
    
    const choice = prompt(
        `Chagua kitendo:\n${actions.map((a, i) => `${i+1}. ${a.label}`).join('\n')}`
    );
    
    if (!choice) return;
    
    const index = parseInt(choice) - 1;
    if (actions[index]) {
        actions[index].action();
    }
}

/**
 * Clear chat
 */
async function clearChat() {
    if (!confirm('Je, una uhakika unataka kufuta chat hii?')) return;
    
    try {
        // This would call a backend endpoint to clear chat
        const result = await API.request(`/chat/clear/${Chat.currentConversation}`, 'DELETE');
        if (result.success) {
            showToast('Chat imefutwa!', 'success');
            await loadMessages(Chat.currentConversation);
        } else {
            showToast(result.error || 'Error', 'error');
        }
    } catch (error) {
        showToast('Error', 'error');
    }
}

/**
 * View user profile
 */
function viewUserProfile(userId) {
    if (window.showSection) {
        window.showSection('profile');
    }
    // Load user profile
    if (window.loadUserProfile) {
        window.loadUserProfile(userId);
    }
}

// ============================================
// SOCKET EVENTS
// ============================================

/**
 * Setup socket events for chat
 */
function setupChatSocket(socket) {
    if (!socket) return;
    
    // New message received
    socket.on('new-message', (data) => {
        handleNewMessage(data);
    });
    
    // Message sent confirmation
    socket.on('message-sent', (data) => {
        // Update message status
    });
    
    // Typing indicator
    socket.on('typing', (data) => {
        if (data.user_id === Chat.currentUserId) {
            showTypingIndicator(data.username);
        }
    });
    
    // Stop typing
    socket.on('stop-typing', (data) => {
        if (data.user_id === Chat.currentUserId) {
            hideTypingIndicator();
        }
    });
    
    // User online
    socket.on('user-online', (data) => {
        updateUserStatus(data.user_id, true);
    });
    
    // User offline
    socket.on('user-offline', (data) => {
        updateUserStatus(data.user_id, false);
    });
}

/**
 * Handle new message
 */
function handleNewMessage(data) {
    // If message is for current conversation, reload messages
    if (Chat.currentUserId && data.sender_id === Chat.currentUserId) {
        loadMessages(Chat.currentConversation);
    }
    
    // Reload conversations to update last message and unread count
    loadConversations();
}

/**
 * Update user status in UI
 */
function updateUserStatus(userId, online) {
    // Update chat header if current user
    if (userId === Chat.currentUserId) {
        ChatDOM.chatUserStatus.textContent = online ? '🟢 Online' : '⚫ Offline';
        ChatDOM.chatUserStatus.className = `status ${online ? 'online' : ''}`;
    }
    
    // Update status dots in conversation list
    document.querySelectorAll('.chat-item').forEach(item => {
        const itemUserId = item.dataset.userid;
        if (itemUserId === userId) {
            const dot = item.querySelector('.status-dot');
            if (dot) {
                dot.className = `status-dot ${online ? 'online' : 'offline'}`;
            }
        }
    });
}

// ============================================
// EVENT LISTENERS
// ============================================

// Search input
if (ChatDOM.chatSearch) {
    ChatDOM.chatSearch.addEventListener('input', function() {
        filterConversations(this.value);
    });
}

// Chat input
if (ChatDOM.chatInput) {
    ChatDOM.chatInput.addEventListener('keydown', handleChatKey);
}

// Send button
if (ChatDOM.chatSendBtn) {
    ChatDOM.chatSendBtn.addEventListener('click', sendMessage);
}

// Image upload
if (ChatDOM.imageBtn) {
    ChatDOM.imageBtn.addEventListener('click', handleImageUpload);
}

if (ChatDOM.imageInput) {
    ChatDOM.imageInput.addEventListener('change', handleImageSelected);
}

// Emoji button
if (ChatDOM.emojiBtn) {
    ChatDOM.emojiBtn.addEventListener('click', toggleEmojiPicker);
}

// Back button
if (ChatDOM.backBtn) {
    ChatDOM.backBtn.addEventListener('click', closeChat);
}

// Close emoji picker on outside click
document.addEventListener('click', function(e) {
    if (ChatDOM.emojiPicker && ChatDOM.emojiPicker.classList.contains('active')) {
        if (!ChatDOM.emojiPicker.contains(e.target) && !ChatDOM.emojiBtn?.contains(e.target)) {
            ChatDOM.emojiPicker.classList.remove('active');
        }
    }
});

// ============================================
// EXPORTS
// ============================================

window.Chat = Chat;
window.loadConversations = loadConversations;
window.openConversation = openConversation;
window.closeChat = closeChat;
window.sendMessage = sendMessage;
window.loadMessages = loadMessages;
window.deleteMessage = deleteMessage;
window.copyMessage = copyMessage;
window.replyToMessage = replyToMessage;
window.viewImage = viewImage;
window.toggleEmojiPicker = toggleEmojiPicker;
window.insertEmoji = insertEmoji;
window.handleImageUpload = handleImageUpload;
window.handleImageSelected = handleImageSelected;
window.blockUser = blockUser;
window.reportUser = reportUser;
window.showChatMenu = showChatMenu;
window.setupChatSocket = setupChatSocket;
window.filterConversations = filterConversations;
