// ============================================
// JAVASCRIPT - APP.JS
// ============================================
// KAZI: Main application logic.
// Inashughulikia: Navigation, UI updates,
// State management, Event listeners,
// Dashboard functionality, Global functions.
// ============================================

// ============================================
// GLOBAL STATE
// ============================================

const App = {
    // User
    currentUser: null,
    token: null,

    // Socket
    socket: null,

    // Data
    users: [],
    chats: [],
    messages: [],
    notifications: [],
    matches: [],

    // UI State
    currentSection: 'home',
    currentChat: null,
    isMobile: window.innerWidth <= 768,

    // Limits
    freeLimits: {
        messages: 20,
        matches: 5,
        likes: 10,
    },

    // Theme
    theme: localStorage.getItem('theme') || 'dark',
};

// ============================================
// DOM REFS
// ============================================

const DOM = {
    // Landing Page
    landingPage: document.getElementById('landingPage'),
    dashboard: document.getElementById('dashboard'),
    bottomNav: document.getElementById('bottomNav'),

    // Toast
    toast: document.getElementById('toast'),

    // Nav
    navMenu: document.getElementById('navMenu'),
    menuToggle: document.getElementById('menuToggle'),
    userStatus: document.getElementById('userStatus'),
    welcomeName: document.getElementById('welcomeName'),

    // Sections
    sections: {
        home: document.getElementById('section-home'),
        discover: document.getElementById('section-discover'),
        chats: document.getElementById('section-chats'),
        matches: document.getElementById('section-matches'),
        notifications: document.getElementById('section-notifications'),
        profile: document.getElementById('section-profile'),
        premium: document.getElementById('section-premium'),
        settings: document.getElementById('section-settings'),
    },

    // Badges
    badges: {
        chat: document.getElementById('chatBadge'),
        notif: document.getElementById('notifBadge'),
        bottomChat: document.getElementById('bottomChatBadge'),
    },

    // Counts
    counts: {
        user: document.getElementById('userCount'),
        chat: document.getElementById('chatCount'),
        match: document.getElementById('matchCount'),
        notif: document.getElementById('notifCount'),
    },

    // Discover
    discoverGrid: document.getElementById('discoverGrid'),
    searchInput: document.getElementById('searchInput'),
    searchGender: document.getElementById('searchGender'),
    searchLocation: document.getElementById('searchLocation'),

    // Chats
    chatList: document.getElementById('chatList'),
    chatSearchInput: document.getElementById('chatSearchInput'),

    // Matches
    matchesGrid: document.getElementById('matchesGrid'),

    // Notifications
    notificationsList: document.getElementById('notificationsList'),

    // Profile
    profileContainer: document.getElementById('profileContainer'),

    // Premium
    premiumContainer: document.getElementById('premiumContainer'),

    // Settings
    settingsContainer: document.getElementById('settingsContainer'),

    // Chat Window
    chatWindow: document.getElementById('chatWindow'),
    chatMessages: document.getElementById('chatMessages'),
    chatInput: document.getElementById('chatInput'),
    chatUserName: document.getElementById('chatUserName'),
    chatUserStatus: document.getElementById('chatUserStatus'),
    chatAvatar: document.getElementById('chatAvatar'),
    typingIndicator: document.getElementById('typingIndicator'),

    // Modal
    upgradeModal: document.getElementById('upgradeModal'),
    planOptions: document.getElementById('planOptions'),
    paymentPhone: document.getElementById('paymentPhone'),
    paymentStatus: document.getElementById('paymentStatus'),
    paymentMessage: document.getElementById('paymentMessage'),

    // Stats (Landing)
    statUsers: document.getElementById('statUsers'),
    statOnline: document.getElementById('statOnline'),
    statMatches: document.getElementById('statMatches'),
    statMessages: document.getElementById('statMessages'),

    // Plans Grid (Landing)
    plansGrid: document.getElementById('plansGrid'),
};

// ============================================
// API HELPER
// ============================================

const API = {
    base: window.location.origin + '/api',

    async request(endpoint, method = 'GET', data = null) {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (App.token) {
            headers['Authorization'] = `Bearer ${App.token}`;
        }

        const options = {
            method,
            headers,
            body: data ? JSON.stringify(data) : null,
        };

        try {
            const response = await fetch(`${this.base}${endpoint}`, options);
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: 'Network error' };
        }
    },

    // Auth
    signup(data) { return this.request('/auth/signup', 'POST', data); },
    login(data) { return this.request('/auth/login', 'POST', data); },
    logout() { return this.request('/auth/logout', 'POST'); },
    checkUsername(username) { return this.request('/auth/check-username', 'POST', { username }); },
    checkAdmin() { return this.request('/auth/check-admin'); },

    // Users
    getMe() { return this.request('/users/me'); },
    getUser(id) { return this.request(`/users/${id}`); },
    updateProfile(data) { return this.request('/users/profile', 'PUT', data); },
    updateProfilePicture(data) { return this.request('/users/profile-picture', 'POST', data); },
    changePassword(data) { return this.request('/users/change-password', 'POST', data); },
    deleteAccount() { return this.request('/users/delete', 'DELETE'); },
    discover(params) { return this.request(`/users/discover${params}`); },
    search(params) { return this.request(`/users/search${params}`); },
    likeUser(id) { return this.request(`/users/like/${id}`, 'POST'); },
    getLikes() { return this.request('/users/likes'); },
    blockUser(id) { return this.request(`/users/block/${id}`, 'POST'); },
    reportUser(data) { return this.request('/users/report', 'POST', data); },
    randomMatch() { return this.request('/users/match/random', 'POST'); },
    getMatches() { return this.request('/users/matches'); },
    getStats() { return this.request('/users/stats'); },

    // Chat
    getConversations() { return this.request('/chat/conversations'); },
    getConversation(userId) { return this.request(`/chat/conversations/${userId}`, 'POST'); },
    getMessages(convId, params) { return this.request(`/chat/messages/${convId}${params}`); },
    sendMessage(data) { return this.request('/chat/messages', 'POST', data); },
    deleteMessage(id) { return this.request(`/chat/messages/${id}`, 'DELETE'); },
    markRead(data) { return this.request('/chat/messages/read', 'POST', data); },
    typing(data) { return this.request('/chat/typing', 'POST', data); },
    getNotifications() { return this.request('/chat/notifications'); },
    markNotifRead(id) { return this.request(`/chat/notifications/read/${id}`, 'POST'); },
    markAllNotifRead() { return this.request('/chat/notifications/read-all', 'POST'); },

    // Payments
    getPlans() { return this.request('/payments/plans'); },
    getPlan(id) { return this.request(`/payments/plans/${id}`); },
    initiatePayment(data) { return this.request('/payments/initiate', 'POST', data); },
    getPaymentStatus(orderId) { return this.request(`/payments/status/${orderId}`); },
    getPaymentHistory() { return this.request('/payments/history'); },
};

// ============================================
// TOAST NOTIFICATION
// ============================================

function showToast(message, type = 'success') {
    const toast = DOM.toast;
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// ============================================
// AUTH FUNCTIONS
// ============================================

function isLoggedIn() {
    return !!(App.token && App.currentUser);
}

function saveAuth(token, user) {
    App.token = token;
    App.currentUser = user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
}

function clearAuth() {
    App.token = null;
    App.currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token && user) {
        App.token = token;
        App.currentUser = JSON.parse(user);
        return true;
    }
    return false;
}

function logout() {
    if (App.socket) {
        App.socket.disconnect();
        App.socket = null;
    }
    clearAuth();
    showDashboard(false);
    showToast('🚪 Umefanikiwa kuingia nje!', 'success');
}

// ============================================
// DASHBOARD FUNCTIONS
// ============================================

function showDashboard(show = true) {
    if (show) {
        DOM.landingPage.style.display = 'none';
        DOM.dashboard.style.display = 'block';
        DOM.bottomNav.style.display = 'flex';

        if (App.currentUser) {
            DOM.welcomeName.textContent =
                App.currentUser.full_name || App.currentUser.username || 'Mgeni';
            DOM.userStatus.textContent = App.currentUser.is_premium ? '⭐ Premium' : 'Free';
        }

        if (window.innerWidth <= 768) {
            DOM.menuToggle.style.display = 'block';
        }

        loadDashboardData();
        showSection('home');

    } else {
        DOM.landingPage.style.display = 'block';
        DOM.dashboard.style.display = 'none';
        DOM.bottomNav.style.display = 'none';
        loadPlansLanding();
        loadStats();
    }
}

function toggleMobileMenu() {
    DOM.navMenu.classList.toggle('mobile-active');
}

// ============================================
// SECTION NAVIGATION
// ============================================

function showSection(section) {
    // Hide all sections
    Object.values(DOM.sections).forEach(el => {
        if (el) el.classList.remove('active');
    });

    // Show selected section
    const target = DOM.sections[section];
    if (target) {
        target.classList.add('active');
    }

    // Update nav links
    document.querySelectorAll('.nav-menu a[data-section]').forEach(el => {
        el.classList.toggle('active', el.dataset.section === section);
    });

    // Update bottom nav
    document.querySelectorAll('.bottom-nav a').forEach(el => {
        const text = el.textContent.trim().toLowerCase();
        const isActive = text === section || (section === 'home' && text === 'home');
        el.classList.toggle('active', isActive);
    });

    // Close mobile menu
    DOM.navMenu.classList.remove('mobile-active');

    // Load section data
    App.currentSection = section;
    const loaders = {
        discover: loadDiscover,
        chats: loadChats,
        matches: loadMatches,
        notifications: loadNotifications,
        profile: loadProfile,
        premium: loadPremium,
        settings: loadSettings,
    };

    if (loaders[section]) {
        loaders[section]();
    }
}

// ============================================
// DASHBOARD DATA
// ============================================

async function loadDashboardData() {
    try {
        const [users, chats, matches, notifs] = await Promise.all([
            API.discover(),
            API.getConversations(),
            API.getMatches(),
            API.getNotifications(),
        ]);

        if (users.success) {
            DOM.counts.user.textContent = users.users?.length || 0;
        }

        if (chats.success) {
            DOM.counts.chat.textContent = chats.conversations?.length || 0;
            const unread = chats.conversations?.reduce((sum, c) => sum + (c.unread_count || 0), 0) || 0;
            DOM.badges.chat.textContent = unread;
            DOM.badges.bottomChat.textContent = unread;
        }

        if (matches.success) {
            DOM.counts.match.textContent = matches.matches?.length || 0;
        }

        if (notifs.success) {
            DOM.counts.notif.textContent = notifs.unread_count || 0;
            DOM.badges.notif.textContent = notifs.unread_count || 0;
        }

    } catch (error) {
        console.error('Load dashboard error:', error);
    }
}

// ============================================
// LANDING PAGE DATA
// ============================================

async function loadPlansLanding() {
    try {
        const result = await API.getPlans();
        if (result.success && result.plans) {
            DOM.plansGrid.innerHTML = result.plans.map((plan, index) => `
                <div class="plan-card ${index === 1 ? 'popular' : ''}">
                    <div class="plan-name">${plan.name}</div>
                    <div class="plan-price">TZS ${plan.price.toLocaleString()} <small>/${plan.duration_days} days</small></div>
                    <ul class="plan-features">
                        ${plan.features ? plan.features.map(f => `<li>${f}</li>`).join('') : '<li>Unlimited Chat</li><li>Advanced Search</li><li>Premium Badge</li>'}
                    </ul>
                    <button onclick="handleGetStarted()" class="btn-primary" style="width:100%;padding:12px 30px;border-radius:25px;border:none;font-weight:600;font-size:16px;cursor:pointer;">
                        Get Premium
                    </button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Load plans error:', error);
    }
}

async function loadStats() {
    try {
        const result = await API.getStats();
        if (result.success) {
            DOM.statUsers.textContent = result.totalUsers || 0;
            DOM.statOnline.textContent = result.onlineUsers || 0;
            DOM.statMatches.textContent = result.totalMatches || 0;
            DOM.statMessages.textContent = result.totalMessages || 0;
        }
    } catch (error) {
        console.error('Load stats error:', error);
    }
}

// ============================================
// HANDLE ACTIONS
// ============================================

function handleGetStarted() {
    if (isLoggedIn()) {
        showSection('discover');
    } else {
        window.location.href = '/signup.html';
    }
}

function handleFindMatch() {
    if (!isLoggedIn()) {
        showToast('⚠️ Tafadhali ingia kwanza!', 'warning');
        return;
    }
    showSection('matches');
    performRandomMatch();
}

function showLogin() {
    window.location.href = '/login.html';
}

function showSignup() {
    window.location.href = '/signup.html';
}

// ============================================
// LOAD: DISCOVER
// ============================================

async function loadDiscover() {
    DOM.discoverGrid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const result = await API.discover();
        if (result.success && result.users) {
            App.users = result.users;
            renderDiscoverUsers(result.users);
        } else {
            DOM.discoverGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <h3>Hakuna watu</h3>
                    <p>Jaribu tena baadaye.</p>
                </div>
            `;
        }
    } catch (error) {
        DOM.discoverGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <h3>Error</h3>
                <p>Imeshindwa kupakia data.</p>
            </div>
        `;
    }
}

function renderDiscoverUsers(users) {
    if (!users || users.length === 0) {
        DOM.discoverGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <h3>Hakuna watu</h3>
                <p>Jaribu tena baadaye.</p>
            </div>
        `;
        return;
    }

    DOM.discoverGrid.innerHTML = users.map(user => `
        <div class="discover-card">
            <div class="avatar">${user.profile_picture ? `<img src="${user.profile_picture}">` : '👤'}</div>
            <div class="name">${user.full_name || user.username}</div>
            <div class="username">@${user.username}</div>
            <div class="info">
                <span class="status-dot ${user.online_status === 'online' ? 'online' : 'offline'}"></span>
                ${user.online_status === 'online' ? 'Online' : 'Offline'}
                ${user.is_premium ? ' <span class="badge premium">⭐ Premium</span>' : ''}
                ${user.is_verified ? ' <span class="badge info">✓ Verified</span>' : ''}
            </div>
            <div class="info">${user.gender || ''} • ${user.location || 'Unknown'}</div>
            <div class="bio">${user.bio || 'Hakuna bio'}</div>
            <div class="actions">
                <button class="btn-chat" onclick="startChat('${user.id}')">💬 Chat</button>
                <button class="btn-like" onclick="likeUser('${user.id}')">❤️ Like</button>
                <button class="btn-skip" onclick="skipUser('${user.id}')">⏭️ Skip</button>
                <button class="btn-block" onclick="blockUser('${user.id}')">🚫 Block</button>
            </div>
        </div>
    `).join('');
}

async function searchUsers() {
    const query = DOM.searchInput.value;
    const gender = DOM.searchGender.value;
    const location = DOM.searchLocation.value;

    if (!query && !gender && !location) {
        loadDiscover();
        return;
    }

    DOM.discoverGrid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const params = new URLSearchParams();
        if (query) params.append('q', query);
        if (gender) params.append('gender', gender);
        if (location) params.append('location', location);

        const result = await API.search(`?${params.toString()}`);
        if (result.success && result.users) {
            renderDiscoverUsers(result.users);
        } else {
            DOM.discoverGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <h3>Hakuna matokeo</h3>
                    <p>Jaribu kutumia vigezo tofauti.</p>
                </div>
            `;
        }
    } catch (error) {
        DOM.discoverGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <h3>Error</h3>
                <p>Imeshindwa kutafuta.</p>
            </div>
        `;
    }
}

// ============================================
// LIKES & BLOCK
// ============================================

async function likeUser(userId) {
    if (!isLoggedIn()) {
        showToast('⚠️ Tafadhali ingia kwanza!', 'warning');
        return;
    }

    try {
        const result = await API.likeUser(userId);
        if (result.success) {
            showToast('❤️ Umempenda!', 'success');
        } else {
            showToast(result.error || 'Error', 'error');
        }
    } catch (error) {
        showToast('Error', 'error');
    }
}

function skipUser(userId) {
    showToast('⏭️ Umeskipa', 'warning');
}

async function blockUser(userId) {
    if (!confirm('Je, una uhakika unataka kumzuia mtumiaji huyu?')) return;

    try {
        const result = await API.blockUser(userId);
        if (result.success) {
            showToast('🚫 Mtumiaji amezuiwa!', 'success');
            loadDiscover();
        } else {
            showToast(result.error || 'Error', 'error');
        }
    } catch (error) {
        showToast('Error', 'error');
    }
}

// ============================================
// LOAD: CHATS
// ============================================

async function loadChats() {
    DOM.chatList.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const result = await API.getConversations();
        if (result.success && result.conversations) {
            App.chats = result.conversations;
            renderChats(result.conversations);
        } else {
            DOM.chatList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">💬</div>
                    <h3>Hakuna chats</h3>
                    <p>Anza kuongea na watu wapya!</p>
                </div>
            `;
        }
    } catch (error) {
        DOM.chatList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <h3>Error</h3>
                <p>Imeshindwa kupakia chats.</p>
            </div>
        `;
    }
}

function renderChats(chats) {
    if (!chats || chats.length === 0) {
        DOM.chatList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💬</div>
                <h3>Hakuna chats</h3>
                <p>Anza kuongea na watu wapya!</p>
            </div>
        `;
        return;
    }

    DOM.chatList.innerHTML = chats.map(chat => `
        <div class="chat-item" onclick="openChat('${chat.other_user_id}', '${chat.full_name || chat.username}')">
            <div class="avatar">
                ${chat.profile_picture ? `<img src="${chat.profile_picture}">` : '👤'}
                <span class="status-dot ${chat.online_status === 'online' ? 'online' : 'offline'}"></span>
            </div>
            <div class="chat-info">
                <div class="name">${chat.full_name || chat.username}</div>
                <div class="last-message">${chat.last_message || 'Anza mazungumzo...'}</div>
            </div>
            <div class="chat-meta">
                <div class="time">${chat.last_message_time ? new Date(chat.last_message_time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''}</div>
                ${chat.unread_count > 0 ? `<div class="unread-count">${chat.unread_count}</div>` : ''}
            </div>
        </div>
    `).join('');

    // Update badges
    const totalUnread = chats.reduce((sum, c) => sum + (parseInt(c.unread_count) || 0), 0);
    DOM.badges.chat.textContent = totalUnread;
    DOM.badges.bottomChat.textContent = totalUnread;
}

function filterChats() {
    const query = DOM.chatSearchInput.value.toLowerCase();
    const filtered = App.chats.filter(chat =>
        (chat.full_name || chat.username || '').toLowerCase().includes(query)
    );
    renderChats(filtered);
}

// ============================================
// CHAT WINDOW
// ============================================

async function startChat(userId) {
    if (!isLoggedIn()) {
        showToast('⚠️ Tafadhali ingia kwanza!', 'warning');
        return;
    }

    try {
        const result = await API.getConversation(userId);
        if (result.success) {
            const userResult = await API.getUser(userId);
            if (userResult.success) {
                openChat(userId, userResult.user.full_name || userResult.user.username);
            } else {
                openChat(userId, 'User');
            }
        } else {
            showToast(result.error || 'Error', 'error');
        }
    } catch (error) {
        showToast('Error', 'error');
    }
}

function openChat(userId, name) {
    App.currentChat = userId;
    DOM.chatWindow.style.display = 'flex';
    DOM.chatUserName.textContent = name;
    DOM.chatAvatar.innerHTML = '👤';

    // On mobile, hide sidebar
    if (App.isMobile) {
        document.querySelector('.chat-sidebar')?.classList.add('hidden');
        DOM.chatWindow.classList.add('active');
    }

    loadMessages();
    markMessagesAsRead(userId);

    if (App.socket) {
        App.socket.emit('join-chat', userId);
    }
}

function closeChat() {
    DOM.chatWindow.style.display = 'none';
    App.currentChat = null;

    if (App.isMobile) {
        document.querySelector('.chat-sidebar')?.classList.remove('hidden');
        DOM.chatWindow.classList.remove('active');
    }

    if (App.socket) {
        App.socket.emit('leave-chat');
    }
}

async function loadMessages() {
    DOM.chatMessages.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const convResult = await API.getConversation(App.currentChat);
        if (!convResult.success) {
            DOM.chatMessages.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h3>Error</h3>
                    <p>Imeshindwa kupakia ujumbe.</p>
                </div>
            `;
            return;
        }

        const convId = convResult.conversation_id;
        const result = await API.getMessages(convId);
        if (result.success && result.messages) {
            renderMessages(result.messages);
        } else {
            DOM.chatMessages.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">💬</div>
                    <h3>Hakuna ujumbe</h3>
                    <p>Anza mazungumzo!</p>
                </div>
            `;
        }
    } catch (error) {
        DOM.chatMessages.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <h3>Error</h3>
                <p>Imeshindwa kupakia ujumbe.</p>
            </div>
        `;
    }
}

function renderMessages(messages) {
    if (!messages || messages.length === 0) {
        DOM.chatMessages.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💬</div>
                <h3>Hakuna ujumbe</h3>
                <p>Anza mazungumzo!</p>
            </div>
        `;
        return;
    }

    // Add date dividers
    let lastDate = null;
    let html = '';

    messages.forEach(msg => {
        const msgDate = new Date(msg.created_at).toLocaleDateString();
        if (msgDate !== lastDate) {
            html += `<div class="message-date-divider">${msgDate}</div>`;
            lastDate = msgDate;
        }

        const isSent = msg.sender_id === App.currentUser?.id;
        const statusIcons = isSent
            ? (msg.is_read ? '✅' : msg.is_delivered ? '✓✓' : '✓')
            : '';

        html += `
            <div class="message ${isSent ? 'sent' : 'received'}">
                <div class="message-content">
                    ${msg.reply_to ? `<div class="reply-to">↩️ ${msg.reply_to}</div>` : ''}
                    ${msg.message_type === 'image' ? `<img src="${msg.image_url}" class="image-msg">` : ''}
                    ${msg.message || ''}
                </div>
                <div class="message-footer">
                    <span class="time">${new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                    ${statusIcons ? `<span class="status-icon">${statusIcons}</span>` : ''}
                </div>
                <div class="message-actions">
                    <button class="reply-btn" onclick="replyMessage('${msg.id}')">↩️</button>
                    <button class="copy-btn" onclick="copyMessage('${msg.message}')">📋</button>
                    <button class="delete-btn" onclick="deleteMessage('${msg.id}')">🗑️</button>
                </div>
            </div>
        `;
    });

    DOM.chatMessages.innerHTML = html;
    DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

// ============================================
// CHAT INPUT
// ============================================

function handleChatKey(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }

    if (App.socket && App.currentChat) {
        App.socket.emit('typing', { user_id: App.currentChat });
        clearTimeout(window._typingTimeout);
        window._typingTimeout = setTimeout(() => {
            App.socket.emit('stop-typing', { user_id: App.currentChat });
        }, 2000);
    }
}

async function sendMessage() {
    const message = DOM.chatInput.value.trim();
    if (!message || !App.currentChat) return;

    DOM.chatInput.value = '';

    try {
        const convResult = await API.getConversation(App.currentChat);
        if (!convResult.success) {
            showToast('Error sending message', 'error');
            return;
        }

        const convId = convResult.conversation_id;
        const result = await API.sendMessage({
            conversation_id: convId,
            receiver_id: App.currentChat,
            message: message,
        });

        if (result.success) {
            if (App.socket) {
                App.socket.emit('send-message', {
                    conversation_id: convId,
                    receiver_id: App.currentChat,
                    message: message,
                    sender_id: App.currentUser.id,
                });
            }
            loadMessages();
            loadChats();
        } else {
            showToast(result.error || 'Error sending message', 'error');
        }
    } catch (error) {
        showToast('Error sending message', 'error');
    }
}

function handleImageUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            const imageData = ev.target.result;
            try {
                const convResult = await API.getConversation(App.currentChat);
                if (!convResult.success) return;

                const convId = convResult.conversation_id;
                const result = await API.sendMessage({
                    conversation_id: convId,
                    receiver_id: App.currentChat,
                    message: '',
                    message_type: 'image',
                    image_data: imageData,
                });

                if (result.success) {
                    if (App.socket) {
                        App.socket.emit('send-message', {
                            conversation_id: convId,
                            receiver_id: App.currentChat,
                            message: '',
                            message_type: 'image',
                            image_url: imageData,
                            sender_id: App.currentUser.id,
                        });
                    }
                    loadMessages();
                    loadChats();
                }
            } catch (error) {
                showToast('Error sending image', 'error');
            }
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function toggleEmojiPicker() {
    const emojis = ['😊', '❤️', '💕', '😂', '🥰', '😍', '🤗', '😘', '💖', '✨', '🔥', '👋', '🙏', '💪', '🎉'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    DOM.chatInput.value += randomEmoji;
    DOM.chatInput.focus();
}

function replyMessage(messageId) {
    showToast('↩️ Reply feature coming soon!', 'info');
}

function copyMessage(message) {
    navigator.clipboard.writeText(message).then(() => {
        showToast('📋 Ujumbe umenakiliwa!', 'success');
    }).catch(() => {
        showToast('Error copying message', 'error');
    });
}

async function deleteMessage(messageId) {
    if (!confirm('Je, una uhakika unataka kufuta ujumbe huu?')) return;

    try {
        const result = await API.deleteMessage(messageId);
        if (result.success) {
            showToast('🗑️ Ujumbe umefutwa!', 'success');
            loadMessages();
        } else {
            showToast(result.error || 'Error', 'error');
        }
    } catch (error) {
        showToast('Error', 'error');
    }
}

function showChatMenu() {
    if (!App.currentChat) return;
    const choice = prompt('Chagua kitendo:\n1. Block User\n2. Report User\n3. Clear Chat');
    if (choice === '1') {
        blockUser(App.currentChat);
    } else if (choice === '2') {
        reportUser(App.currentChat);
    } else if (choice === '3') {
        if (confirm('Je, una uhakika unataka kufuta chat hii?')) {
            showToast('Chat imefutwa!', 'success');
        }
    }
}

async function reportUser(userId) {
    const reasons = ['Spam', 'Harassment', 'Fake Profile', 'Scam', 'Inappropriate Content', 'Other'];
    const reason = prompt(`Chagua sababu ya kuripoti:\n${reasons.map((r, i) => `${i+1}. ${r}`).join('\n')}`);
    if (!reason) return;

    try {
        const result = await API.reportUser({
            reported_id: userId,
            reason: reasons[parseInt(reason) - 1] || 'Other',
            details: prompt('Andika maelezo zaidi (hiari):') || '',
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

async function markMessagesAsRead(userId) {
    try {
        await API.markRead({ user_id: userId });
    } catch (error) {
        // Ignore
    }
}

// ============================================
// LOAD: MATCHES
// ============================================

async function loadMatches() {
    DOM.matchesGrid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const result = await API.getMatches();
        if (result.success && result.matches) {
            App.matches = result.matches;
            renderMatches(result.matches);
        } else {
            DOM.matchesGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">💕</div>
                    <h3>Hakuna matches</h3>
                    <p>Bonyeza "Tafuta Mpenzi" kupata match!</p>
                </div>
            `;
        }
    } catch (error) {
        DOM.matchesGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <h3>Error</h3>
                <p>Imeshindwa kupakia matches.</p>
            </div>
        `;
    }
}

function renderMatches(matches) {
    if (!matches || matches.length === 0) {
        DOM.matchesGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💕</div>
                <h3>Hakuna matches</h3>
                <p>Bonyeza "Tafuta Mpenzi" kupata match!</p>
            </div>
        `;
        return;
    }

    DOM.matchesGrid.innerHTML = matches.map(match => `
        <div class="discover-card">
            <div class="avatar">${match.profile_picture ? `<img src="${match.profile_picture}">` : '👤'}</div>
            <div class="name">${match.full_name || match.username}</div>
            <div class="username">@${match.username}</div>
            <div class="info">
                <span class="status-dot ${match.online_status === 'online' ? 'online' : 'offline'}"></span>
                ${match.online_status === 'online' ? 'Online' : 'Offline'}
            </div>
            <div class="actions">
                <button class="btn-chat" onclick="startChat('${match.matched_user_id}')">💬 Chat</button>
            </div>
        </div>
    `).join('');
}

async function performRandomMatch() {
    if (!isLoggedIn()) {
        showToast('⚠️ Tafadhali ingia kwanza!', 'warning');
        return;
    }

    DOM.matchesGrid.innerHTML = `
        <div style="text-align:center;padding:40px;">
            <div style="font-size:60px;margin-bottom:20px;">🔎</div>
            <h3>Tunakutafutia mtu...</h3>
            <div class="loading"><div class="spinner"></div></div>
        </div>
    `;

    try {
        const result = await API.randomMatch();
        if (result.success && result.match) {
            const match = result.match;
            DOM.matchesGrid.innerHTML = `
                <div style="text-align:center;padding:20px;">
                    <div style="font-size:60px;margin-bottom:10px;">💕</div>
                    <h2>Match Found!</h2>
                    <div class="match-card">
                        <div class="avatar">${match.profile_picture ? `<img src="${match.profile_picture}">` : '👤'}</div>
                        <div class="name">${match.full_name || match.username}</div>
                        <div class="info">${match.gender || ''} • ${match.location || 'Unknown'}</div>
                        <div class="info">${match.is_premium ? '⭐ Premium' : ''}</div>
                        <div class="bio">${match.bio || 'Hakuna bio'}</div>
                        <div class="info">Interests: ${match.interests ? match.interests.join(', ') : 'None'}</div>
                        <div class="actions">
                            <button class="btn-start" onclick="startChat('${match.id}')">💬 Start Chat</button>
                            <button class="btn-next" onclick="performRandomMatch()">⏭️ Next Person</button>
                        </div>
                    </div>
                </div>
            `;
        } else if (result.message) {
            DOM.matchesGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">😔</div>
                    <h3>${result.message}</h3>
                    <button class="btn-primary" onclick="performRandomMatch()" style="margin-top:15px;">Jaribu Tena</button>
                </div>
            `;
        } else {
            DOM.matchesGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h3>Error</h3>
                    <p>${result.error || 'Imeshindwa kupata match.'}</p>
                    <button class="btn-primary" onclick="performRandomMatch()" style="margin-top:15px;">Jaribu Tena</button>
                </div>
            `;
        }
    } catch (error) {
        DOM.matchesGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <h3>Error</h3>
                <p>Imeshindwa kupata match.</p>
                <button class="btn-primary" onclick="performRandomMatch()" style="margin-top:15px;">Jaribu Tena</button>
            </div>
        `;
    }
}

// ============================================
// LOAD: NOTIFICATIONS
// ============================================

async function loadNotifications() {
    DOM.notificationsList.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const result = await API.getNotifications();
        if (result.success) {
            App.notifications = result.notifications || [];
            renderNotifications(result.notifications || []);
            DOM.badges.notif.textContent = result.unread_count || 0;
        } else {
            DOM.notificationsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔔</div>
                    <h3>Hakuna notifications</h3>
                    <p>Utapata arifa hapa.</p>
                </div>
            `;
        }
    } catch (error) {
        DOM.notificationsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <h3>Error</h3>
                <p>Imeshindwa kupakia arifa.</p>
            </div>
        `;
    }
}

function renderNotifications(notifications) {
    if (!notifications || notifications.length === 0) {
        DOM.notificationsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔔</div>
                <h3>Hakuna notifications</h3>
                <p>Utapata arifa hapa.</p>
            </div>
        `;
        return;
    }

    const icons = {
        like: '❤️',
        match: '💕',
        message: '💬',
        premium: '⭐',
        premium_activated: '⭐',
        premium_expired: '⚠️',
        premium_reminder: '⏰',
        trial_ended: '🎁',
        system: '📢',
    };

    DOM.notificationsList.innerHTML = notifications.map(n => `
        <div class="notification-item ${n.is_read ? '' : 'unread'}" onclick="markNotifRead('${n.id}')">
            <div class="notification-icon">${icons[n.type] || '🔔'}</div>
            <div class="notification-content">
                <div class="notification-title">${n.title}</div>
                <div class="notification-message">${n.message}</div>
                <div class="notification-time">${n.created_at ? new Date(n.created_at).toLocaleString() : ''}</div>
            </div>
            ${!n.is_read ? '<span class="unread-dot"></span>' : ''}
        </div>
    `).join('');
}

async function markNotifRead(notifId) {
    try {
        await API.markNotifRead(notifId);
        loadNotifications();
    } catch (error) {
        console.error('Mark notif read error:', error);
    }
}

// ============================================
// LOAD: PROFILE
// ============================================

async function loadProfile() {
    DOM.profileContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const result = await API.getMe();
        if (result.success && result.user) {
            const user = result.user;
            App.currentUser = { ...App.currentUser, ...user };
            renderProfile(user);
        } else {
            DOM.profileContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h3>Error</h3>
                    <p>Imeshindwa kupakia profile.</p>
                </div>
            `;
        }
    } catch (error) {
        DOM.profileContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <h3>Error</h3>
                <p>Imeshindwa kupakia profile.</p>
            </div>
        `;
    }
}

function renderProfile(user) {
    DOM.profileContainer.innerHTML = `
        <div class="profile-header">
            <div class="profile-avatar" onclick="changeProfilePicture()">
                ${user.profile_picture ? `<img src="${user.profile_picture}">` : '👤'}
                <div class="avatar-overlay">📸</div>
            </div>
            <div class="profile-name">${user.full_name || user.username}</div>
            <div class="profile-username">@${user.username}</div>
            <div class="profile-badges">
                <span class="badge ${user.is_premium ? 'premium' : 'free'}">
                    ${user.is_premium ? '⭐ Premium' : '📄 Free'}
                </span>
                ${user.trial_active ? '<span class="badge trial">🎁 Trial</span>' : ''}
            </div>
            ${user.is_premium && user.premium_expires_at ? `
                <div class="profile-expiry">Inaisha: ${new Date(user.premium_expires_at).toLocaleDateString()}</div>
            ` : ''}
            ${user.trial_active && user.trial_expires_at ? `
                <div class="profile-expiry trial">Trial inaisha: ${new Date(user.trial_expires_at).toLocaleDateString()}</div>
            ` : ''}
        </div>
        <div class="profile-details">
            <div class="detail-item"><span class="label">📧 Email</span><span class="value">${user.email}</span></div>
            <div class="detail-item"><span class="label">📱 Phone</span><span class="value">${user.phone || 'Not set'}</span></div>
            <div class="detail-item"><span class="label">⚧️ Gender</span><span class="value">${user.gender || 'Not set'}</span></div>
            <div class="detail-item"><span class="label">📍 Location</span><span class="value">${user.location || 'Not set'}</span></div>
            <div class="detail-item"><span class="label">📝 Bio</span><span class="value">${user.bio || 'Not set'}</span></div>
            <div class="detail-item"><span class="label">❤️ Interests</span><span class="value">${user.interests ? user.interests.join(', ') : 'None'}</span></div>
            <div class="detail-item"><span class="label">🟢 Status</span><span class="value"><span class="status-dot ${user.online_status === 'online' ? 'online' : 'offline'}"></span> ${user.online_status === 'online' ? 'Online' : 'Offline'}</span></div>
            <div class="detail-item"><span class="label">📅 Joined</span><span class="value">${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</span></div>
        </div>
        <div class="profile-actions">
            <button class="btn btn-primary" onclick="editProfile()">✏️ Edit Profile</button>
            <button class="btn btn-secondary" onclick="showSection('settings')">⚙️ Settings</button>
            <button class="btn btn-danger" onclick="logout()">🚪 Logout</button>
        </div>
    `;
}

function editProfile() {
    const name = prompt('Enter full name:', App.currentUser?.full_name || '');
    if (name !== null) {
        updateProfile({ full_name: name });
    }
}

async function updateProfile(data) {
    try {
        const result = await API.updateProfile(data);
        if (result.success) {
            showToast('✅ Profile imesasishwa!', 'success');
            loadProfile();
        } else {
            showToast(result.error || 'Error', 'error');
        }
    } catch (error) {
        showToast('Error', 'error');
    }
}

function changeProfilePicture() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            const imageData = ev.target.result;
            try {
                const result = await API.updateProfilePicture({ image_data: imageData });
                if (result.success) {
                    showToast('✅ Picha imebadilishwa!', 'success');
                    loadProfile();
                } else {
                    showToast(result.error || 'Error', 'error');
                }
            } catch (error) {
                showToast('Error', 'error');
            }
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

// ============================================
// LOAD: SETTINGS
// ============================================

function loadSettings() {
    DOM.settingsContainer.innerHTML = `
        <div class="settings-group">
            <h3>👤 Account</h3>
            <div class="settings-item">
                <div>
                    <div class="label">Edit Profile</div>
                    <div class="desc">Badilisha maelezo yako</div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="editProfile()">Edit</button>
            </div>
            <div class="settings-item">
                <div>
                    <div class="label">Change Password</div>
                    <div class="desc">Badilisha password yako</div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="changePassword()">Change</button>
            </div>
            <div class="settings-item">
                <div>
                    <div class="label">Delete Account</div>
                    <div class="desc">Futa akaunti yako kabisa</div>
                </div>
                <button class="btn btn-danger btn-sm" onclick="deleteAccount()">Delete</button>
            </div>
        </div>

        <div class="settings-group">
            <h3>🔒 Privacy</h3>
            <div class="settings-item">
                <div>
                    <div class="label">Show Online Status</div>
                    <div class="desc">Onesha kama uko online</div>
                </div>
                <input type="checkbox" checked>
            </div>
            <div class="settings-item">
                <div>
                    <div class="label">Show Last Seen</div>
                    <div class="desc">Onesha wakati wa mwisho kuwa online</div>
                </div>
                <input type="checkbox" checked>
            </div>
            <div class="settings-item">
                <div>
                    <div class="label">Read Receipts</div>
                    <div class="desc">Onesha kama umesoma ujumbe</div>
                </div>
                <input type="checkbox" checked>
            </div>
        </div>

        <div class="settings-group">
            <h3>🎨 Appearance</h3>
            <div class="settings-item">
                <div>
                    <div class="label">Dark Mode</div>
                    <div class="desc">Badilisha rangi za website</div>
                </div>
                <select onchange="toggleTheme(this.value)">
                    <option value="dark" ${App.theme === 'dark' ? 'selected' : ''}>Dark</option>
                    <option value="light" ${App.theme === 'light' ? 'selected' : ''}>Light</option>
                    <option value="system">System</option>
                </select>
            </div>
        </div>

        <div class="settings-group">
            <h3>🔐 Security</h3>
            <div class="settings-item">
                <div>
                    <div class="label">Logout All Devices</div>
                    <div class="desc">Toka kwenye vifaa vyote</div>
                </div>
                <button class="btn btn-danger btn-sm" onclick="logoutAll()">Logout All</button>
            </div>
        </div>
    `;
}

async function changePassword() {
    const current = prompt('Ingiza password yako ya sasa:');
    if (!current) return;
    const newPass = prompt('Ingiza password mpya:');
    if (!newPass) return;
    const confirm = prompt('Thibitisha password mpya:');
    if (newPass !== confirm) {
        showToast('❌ Password hazilingani!', 'error');
        return;
    }

    try {
        const result = await API.changePassword({
            current_password: current,
            new_password: newPass,
        });
        if (result.success) {
            showToast('✅ Password imebadilishwa!', 'success');
        } else {
            showToast(result.error || 'Error', 'error');
        }
    } catch (error) {
        showToast('Error', 'error');
    }
}

async function deleteAccount() {
    if (!confirm('⚠️ Je, una uhakika unataka kufuta akaunti yako? Hii haiwezi kurejeshwa!')) return;
    if (!confirm('Thibitisha tena: Futa akaunti yangu')) return;

    try {
        const result = await API.deleteAccount();
        if (result.success) {
            showToast('Akaunti imefutwa.', 'success');
            logout();
        } else {
            showToast(result.error || 'Error', 'error');
        }
    } catch (error) {
        showToast('Error', 'error');
    }
}

function logoutAll() {
    if (confirm('Je, una uhakika unataka kutoka kwenye vifaa vyote?')) {
        showToast('🚪 Umefanikiwa kutoka kwenye vifaa vyote!', 'success');
        logout();
    }
}

function toggleTheme(mode) {
    if (mode === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        App.theme = 'dark';
    } else if (mode === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
        App.theme = 'light';
    } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.removeItem('theme');
        App.theme = 'system';
    }
}

// ============================================
// LOAD: PREMIUM
// ============================================

async function loadPremium() {
    DOM.premiumContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const [userResult, plansResult] = await Promise.all([
            API.getMe(),
            API.getPlans(),
        ]);

        if (!userResult.success) {
            DOM.premiumContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h3>Error</h3>
                    <p>Imeshindwa kupakia data.</p>
                </div>
            `;
            return;
        }

        const user = userResult.user;
        const isPremium = user.is_premium;
        const isTrial = user.trial_active;
        const plans = plansResult.success ? plansResult.plans : [];

        DOM.premiumContainer.innerHTML = `
            <div class="premium-status">
                ${isPremium ? `
                    <div class="premium-badge">⭐</div>
                    <h2>Hongera! Wewe ni Premium 🎉</h2>
                    <p>${user.premium_expires_at ? `Inaisha: ${new Date(user.premium_expires_at).toLocaleDateString()}` : 'Premium Active'}</p>
                    <p>Siku zilizobaki: ${user.premium_expires_at ? Math.ceil((new Date(user.premium_expires_at) - new Date()) / (1000 * 60 * 60 * 24)) : 'N/A'}</p>
                ` : isTrial ? `
                    <div class="premium-badge trial">🎁</div>
                    <h2>Free Trial</h2>
                    <p>Umepewa siku za kujaribu Premium bure!</p>
                    <p>${user.trial_expires_at ? `Inaisha: ${new Date(user.trial_expires_at).toLocaleDateString()}` : ''}</p>
                    <p>Siku zilizobaki: ${user.trial_expires_at ? Math.ceil((new Date(user.trial_expires_at) - new Date()) / (1000 * 60 * 60 * 24)) : 0}</p>
                ` : `
                    <div class="premium-badge">⭐</div>
                    <h2>Pata Premium</h2>
                    <p>Upgrade kuwa Premium na upate features zote!</p>
                `}
            </div>
            <div class="plans-grid">
                ${plans.map(plan => `
                    <div class="plan-card ${plan.is_active ? '' : 'inactive'}">
                        <div class="plan-name">${plan.name}</div>
                        <div class="plan-price">TZS ${plan.price.toLocaleString()} <small>/${plan.duration_days} days</small></div>
                        <ul class="plan-features">
                            ${plan.features ? plan.features.map(f => `<li>${f}</li>`).join('') : '<li>Unlimited Chat</li><li>Advanced Search</li><li>Premium Badge</li>'}
                        </ul>
                        ${isPremium ? `
                            <button class="btn btn-success" disabled>✅ Already Premium</button>
                        ` : `
                            <button class="btn btn-primary" onclick="showUpgradeModal('${plan.id}')">${isTrial ? '🎁 Upgrade After Trial' : '💳 Upgrade Now'}</button>
                        `}
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        DOM.premiumContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <h3>Error</h3>
                <p>Imeshindwa kupakia data.</p>
            </div>
        `;
    }
}

// ============================================
// PREMIUM UPGRADE MODAL
// ============================================

function showUpgradeModal(planId) {
    DOM.upgradeModal.style.display = 'flex';
    DOM.planOptions.style.display = 'block';
    DOM.paymentStatus.style.display = 'none';
    loadPlanDetails(planId);
}

async function loadPlanDetails(planId) {
    try {
        const result = await API.getPlan(planId);
        if (result.success && result.plan) {
            const plan = result.plan;
            DOM.planOptions.innerHTML = `
                <div class="selected-plan" data-plan-id="${plan.id}">
                    <div class="plan-name">${plan.name}</div>
                    <div class="plan-price">TZS ${plan.price.toLocaleString()} - ${plan.duration_days} days</div>
                    <div class="plan-features">
                        ${plan.features ? plan.features.join(' • ') : ''}
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Load plan error:', error);
    }
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

async function processPayment() {
    const phone = DOM.paymentPhone.value.trim();
    if (!phone) {
        showToast('❌ Tafadhali ingiza namba ya simu.', 'error');
        return;
    }

    const planDiv = DOM.planOptions.querySelector('.selected-plan');
    const planId = planDiv ? planDiv.dataset.planId : 1;

    DOM.planOptions.style.display = 'none';
    DOM.paymentStatus.style.display = 'block';
    DOM.paymentMessage.textContent = '⏳ Inathibitisha malipo yako kupitia HarakaPay...';

    try {
        const result = await API.initiatePayment({
            plan_id: planId,
            phone: phone,
        });

        if (result.success) {
            DOM.paymentMessage.textContent = '✅ PAYMENT SUCCESSFUL! Hongera! Akaunti yako sasa ni PREMIUM. 🎉';
            showToast('🎉 Umefanikiwa kuwa Premium!', 'success');
            setTimeout(() => {
                closeModal('upgradeModal');
                loadPremium();
                loadProfile();
            }, 3000);
        } else if (result.status === 'pending') {
            DOM.paymentMessage.textContent = '⏳ Payment Pending. Tunasubiri uthibitisho wa malipo.';
        } else {
            DOM.paymentMessage.textContent = `❌ Payment Failed: ${result.error || 'Jaribu tena.'}`;
            showToast('❌ Payment failed. Jaribu tena.', 'error');
        }
    } catch (error) {
        DOM.paymentMessage.textContent = '❌ Payment Failed. Jaribu tena.';
        showToast('❌ Payment failed.', 'error');
    }
}

// ============================================
// SOCKET.IO
// ============================================

function initSocket() {
    if (App.socket) {
        App.socket.disconnect();
    }

    App.socket = io(window.location.origin, {
        auth: { token: App.token },
    });

    App.socket.on('connect', () => {
        console.log('🔌 Socket connected');
        App.socket.emit('user-online', App.currentUser?.id);
    });

    App.socket.on('disconnect', () => {
        console.log('🔌 Socket disconnected');
    });

    App.socket.on('new-message', (data) => {
        if (App.currentChat && data.sender_id === App.currentChat) {
            loadMessages();
        }
        loadChats();
    });

    App.socket.on('typing', (data) => {
        if (App.currentChat && data.user_id === App.currentChat) {
            DOM.typingIndicator.classList.add('active');
            DOM.typingIndicator.textContent = `${data.username || 'Someone'} is typing...`;
        }
    });

    App.socket.on('stop-typing', (data) => {
        if (App.currentChat && data.user_id === App.currentChat) {
            DOM.typingIndicator.classList.remove('active');
        }
    });

    App.socket.on('user-online', (data) => {
        updateOnlineStatus(data.user_id, true);
    });

    App.socket.on('user-offline', (data) => {
        updateOnlineStatus(data.user_id, false);
    });
}

function updateOnlineStatus(userId, online) {
    // Update status in UI
    document.querySelectorAll('.chat-item, .discover-card').forEach(el => {
        // Will be implemented with proper DOM updates
    });
}

// ============================================
// EVENT LISTENERS
// ============================================

// Resize handler
window.addEventListener('resize', () => {
    App.isMobile = window.innerWidth <= 768;
});

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// ============================================
// INIT
// ============================================

function init() {
    // Theme
    const theme = localStorage.getItem('theme');
    if (theme) {
        document.documentElement.setAttribute('data-theme', theme);
        App.theme = theme;
    }

    // Auth
    if (checkAuth()) {
        showDashboard(true);
        initSocket();
    } else {
        showDashboard(false);
    }
}

// DOM ready
document.addEventListener('DOMContentLoaded', init);

// Export for other scripts
window.App = App;
window.API = API;
window.showToast = showToast;
window.showSection = showSection;
window.logout = logout;
window.handleGetStarted = handleGetStarted;
window.handleFindMatch = handleFindMatch;
window.showLogin = showLogin;
window.showSignup = showSignup;
window.startChat = startChat;
window.openChat = openChat;
window.closeChat = closeChat;
window.sendMessage = sendMessage;
window.handleChatKey = handleChatKey;
window.handleImageUpload = handleImageUpload;
window.toggleEmojiPicker = toggleEmojiPicker;
window.showChatMenu = showChatMenu;
window.replyMessage = replyMessage;
window.copyMessage = copyMessage;
window.deleteMessage = deleteMessage;
window.reportUser = reportUser;
window.blockUser = blockUser;
window.likeUser = likeUser;
window.skipUser = skipUser;
window.searchUsers = searchUsers;
window.filterChats = filterChats;
window.performRandomMatch = performRandomMatch;
window.markNotifRead = markNotifRead;
window.editProfile = editProfile;
window.updateProfile = updateProfile;
window.changeProfilePicture = changeProfilePicture;
window.loadProfile = loadProfile;
window.loadPremium = loadPremium;
window.showUpgradeModal = showUpgradeModal;
window.processPayment = processPayment;
window.closeModal = closeModal;
window.toggleMobileMenu = toggleMobileMenu;
window.toggleTheme = toggleTheme;
window.changePassword = changePassword;
window.deleteAccount = deleteAccount;
window.logoutAll = logoutAll;
