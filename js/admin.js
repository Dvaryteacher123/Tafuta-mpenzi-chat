// ============================================
// JAVASCRIPT - ADMIN.JS
// ============================================
// KAZI: Logic zote za admin panel.
// Inashughulikia: Dashboard stats, Users management,
// Payments management, Plans management, Reports,
// Notifications, Admin settings, Logs.
// ============================================

// ============================================
// ADMIN STATE
// ============================================

const Admin = {
    // Stats
    stats: null,
    
    // Users
    users: [],
    selectedUser: null,
    userFilter: 'all',
    userSearch: '',
    
    // Payments
    payments: [],
    paymentFilter: 'all',
    paymentSearch: '',
    
    // Plans
    plans: [],
    selectedPlan: null,
    isEditingPlan: false,
    
    // Reports
    reports: [],
    reportFilter: 'all',
    
    // Notifications
    notifications: [],
    notifTarget: 'all',
    
    // Logs
    logs: [],
    
    // Loading
    isLoading: false,
    isSubmitting: false,
};

// ============================================
// DOM REFS (Admin specific)
// ============================================

const AdminDOM = {
    // Sidebar
    sidebar: document.querySelector('.admin-sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    hamburger: document.querySelector('.hamburger'),
    
    // Sections
    sections: {
        dashboard: document.getElementById('section-dashboard'),
        users: document.getElementById('section-users'),
        payments: document.getElementById('section-payments'),
        plans: document.getElementById('section-plans'),
        reports: document.getElementById('section-reports'),
        notifications: document.getElementById('section-notifications'),
        settings: document.getElementById('section-settings'),
    },
    
    // Dashboard
    statsGrid: document.getElementById('statsGrid'),
    
    // Users
    usersTable: document.getElementById('usersTableBody'),
    userSearch: document.getElementById('userSearch'),
    userFilter: document.getElementById('userFilter'),
    
    // Payments
    paymentsTable: document.getElementById('paymentsTableBody'),
    paymentSearch: document.getElementById('paymentSearch'),
    paymentFilter: document.getElementById('paymentFilter'),
    
    // Plans
    plansTable: document.getElementById('plansTableBody'),
    planForm: document.getElementById('addPlanForm'),
    planName: document.getElementById('planName'),
    planPrice: document.getElementById('planPrice'),
    planDuration: document.getElementById('planDuration'),
    planFeatures: document.getElementById('planFeatures'),
    planActive: document.getElementById('planActive'),
    planSubmit: document.getElementById('planSubmit'),
    
    // Reports
    reportsTable: document.getElementById('reportsTableBody'),
    reportFilter: document.getElementById('reportFilter'),
    
    // Notifications
    notifTarget: document.getElementById('notifTarget'),
    notifUserId: document.getElementById('notifUserId'),
    notifTitle: document.getElementById('notifTitle'),
    notifMessage: document.getElementById('notifMessage'),
    notifSubmit: document.getElementById('notifSubmit'),
    notifTable: document.getElementById('notificationsTableBody'),
    
    // Settings
    settingsEmail: document.getElementById('adminSettingsEmail'),
    settingsPassword: document.getElementById('adminSettingsPassword'),
    settingsSubmit: document.getElementById('settingsSubmit'),
    adminTheme: document.getElementById('adminTheme'),
    
    // Modals
    userModal: document.getElementById('userModal'),
    paymentModal: document.getElementById('paymentModal'),
    reportModal: document.getElementById('reportModal'),
};

// ============================================
// DASHBOARD
// ============================================

/**
 * Load dashboard stats
 */
async function loadDashboard() {
    if (Admin.isLoading) return;
    Admin.isLoading = true;
    
    try {
        const result = await API.request('/admin/dashboard/stats', 'GET');
        
        if (result.success && result.stats) {
            Admin.stats = result.stats;
            renderStats(result.stats);
        } else {
            showToast('Error loading dashboard stats', 'error');
        }
    } catch (error) {
        console.error('Load dashboard error:', error);
        showToast('Error loading dashboard', 'error');
    }
    
    Admin.isLoading = false;
}

/**
 * Render stats cards
 */
function renderStats(stats) {
    if (!AdminDOM.statsGrid) return;
    
    const cards = [
        { icon: '👥', number: stats.totalUsers || 0, label: 'Total Users', color: 'primary' },
        { icon: '🟢', number: stats.onlineUsers || 0, label: 'Online Users', color: 'success' },
        { icon: '⭐', number: stats.premiumUsers || 0, label: 'Premium Users', color: 'warning' },
        { icon: '📄', number: stats.freeUsers || 0, label: 'Free Users', color: 'info' },
        { icon: '📝', number: stats.todaySignups || 0, label: "Today's Signups", color: 'primary' },
        { icon: '💰', number: stats.todayPayments || 0, label: "Today's Payments", color: 'success' },
        { icon: '💵', number: `TZS ${(stats.totalRevenue || 0).toLocaleString()}`, label: 'Total Revenue', color: 'warning' },
        { icon: '⏳', number: stats.pendingPayments || 0, label: 'Pending Payments', color: 'danger' },
        { icon: '🚨', number: stats.pendingReports || 0, label: 'Pending Reports', color: 'danger' },
    ];
    
    AdminDOM.statsGrid.innerHTML = cards.map(card => `
        <div class="stat-card ${card.color}">
            <div class="stat-icon">${card.icon}</div>
            <div class="stat-number">${card.number}</div>
            <div class="stat-label">${card.label}</div>
        </div>
    `).join('');
}

// ============================================
// USERS MANAGEMENT
// ============================================

/**
 * Load users
 */
async function loadUsers() {
    const filter = AdminDOM.userFilter?.value || 'all';
    const search = AdminDOM.userSearch?.value || '';
    
    Admin.userFilter = filter;
    Admin.userSearch = search;
    
    if (AdminDOM.usersTable) {
        AdminDOM.usersTable.innerHTML = '<tr><td colspan="6"><div class="loading"><div class="spinner"></div></div></td></tr>';
    }
    
    try {
        const params = new URLSearchParams();
        if (filter !== 'all') params.append('filter', filter);
        if (search) params.append('search', search);
        
        const result = await API.request(`/admin/users?${params.toString()}`, 'GET');
        
        if (result.success && result.users) {
            Admin.users = result.users;
            renderUsers(result.users);
        } else {
            AdminDOM.usersTable.innerHTML = `
                <tr><td colspan="6">
                    <div class="empty-state">
                        <div class="empty-icon">👥</div>
                        <h3>No users found</h3>
                    </div>
                </td></tr>
            `;
        }
    } catch (error) {
        console.error('Load users error:', error);
        AdminDOM.usersTable.innerHTML = `
            <tr><td colspan="6">
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h3>Error loading users</h3>
                </div>
            </td></tr>
        `;
    }
}

/**
 * Render users table
 */
function renderUsers(users) {
    if (!AdminDOM.usersTable) return;
    
    if (!users || users.length === 0) {
        AdminDOM.usersTable.innerHTML = `
            <tr><td colspan="6">
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <h3>No users found</h3>
                </div>
            </td></tr>
        `;
        return;
    }
    
    AdminDOM.usersTable.innerHTML = users.map(user => `
        <tr>
            <td>
                <div class="user-info">
                    <span class="avatar">${user.profile_picture ? `<img src="${user.profile_picture}">` : '👤'}</span>
                    <div>
                        <div class="name">${user.full_name || user.username}</div>
                        <div class="username">@${user.username}</div>
                    </div>
                </div>
            </td>
            <td>${user.email || 'N/A'}</td>
            <td>
                <span class="status-badge ${user.is_banned ? 'banned' : 'active'}">
                    ${user.is_banned ? '🚫 Banned' : '✅ Active'}
                </span>
                <br>
                <span class="status-dot ${user.online_status === 'online' ? 'online' : 'offline'}"></span>
                ${user.online_status === 'online' ? 'Online' : 'Offline'}
            </td>
            <td>
                <span class="status-badge ${user.is_premium ? 'premium' : 'free'}">
                    ${user.is_premium ? '⭐ Premium' : '📄 Free'}
                </span>
                ${user.is_premium && user.premium_expires_at ? `
                    <br><span style="font-size:10px;color:var(--text-muted);">
                        Expires: ${formatDate(user.premium_expires_at)}
                    </span>
                ` : ''}
            </td>
            <td>${formatDate(user.created_at)}</td>
            <td>
                <div class="table-actions-cell">
                    <button class="action-btn view" onclick="viewUser('${user.id}')">👁️</button>
                    ${!user.is_banned ? `
                        <button class="action-btn ban" onclick="banUser('${user.id}')">🚫</button>
                    ` : `
                        <button class="action-btn unban" onclick="unbanUser('${user.id}')">✅</button>
                    `}
                    ${!user.is_premium ? `
                        <button class="action-btn premium" onclick="makePremium('${user.id}')">⭐</button>
                    ` : `
                        <button class="action-btn delete" onclick="removePremium('${user.id}')">⬇️</button>
                    `}
                    <button class="action-btn delete" onclick="deleteUser('${user.id}')">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * View user details
 */
async function viewUser(userId) {
    try {
        const result = await API.request(`/admin/users/${userId}`, 'GET');
        if (result.success && result.user) {
            const user = result.user;
            alert(`
👤 USER PROFILE
━━━━━━━━━━━━━━━━━━
Name: ${user.full_name || 'N/A'}
Username: @${user.username}
Email: ${user.email || 'N/A'}
Phone: ${user.phone || 'N/A'}
Gender: ${user.gender || 'N/A'}
Location: ${user.location || 'N/A'}
Bio: ${user.bio || 'N/A'}
Status: ${user.is_banned ? '🚫 Banned' : '✅ Active'}
Plan: ${user.is_premium ? '⭐ Premium' : '📄 Free'}
Joined: ${formatDate(user.created_at)}
            `);
        }
    } catch (error) {
        console.error('View user error:', error);
        showToast('Error loading user', 'error');
    }
}

/**
 * Ban user
 */
async function banUser(userId) {
    if (!confirm('⚠️ Are you sure you want to ban this user?')) return;
    
    try {
        const result = await API.request(`/admin/users/ban/${userId}`, 'POST');
        if (result.success) {
            showToast('✅ User banned successfully!', 'success');
            loadUsers();
            loadDashboard();
        } else {
            showToast(result.error || 'Error banning user', 'error');
        }
    } catch (error) {
        showToast('Error banning user', 'error');
    }
}

/**
 * Unban user
 */
async function unbanUser(userId) {
    if (!confirm('⚠️ Are you sure you want to unban this user?')) return;
    
    try {
        const result = await API.request(`/admin/users/unban/${userId}`, 'POST');
        if (result.success) {
            showToast('✅ User unbanned successfully!', 'success');
            loadUsers();
            loadDashboard();
        } else {
            showToast(result.error || 'Error unbanning user', 'error');
        }
    } catch (error) {
        showToast('Error unbanning user', 'error');
    }
}

/**
 * Make user premium
 */
async function makePremium(userId) {
    const days = prompt('Enter number of days for premium access:', '30');
    if (!days) return;
    
    try {
        const result = await API.request(`/admin/users/make-premium/${userId}`, 'POST', {
            duration_days: parseInt(days),
        });
        if (result.success) {
            showToast('⭐ User is now Premium!', 'success');
            loadUsers();
            loadDashboard();
        } else {
            showToast(result.error || 'Error making user premium', 'error');
        }
    } catch (error) {
        showToast('Error making user premium', 'error');
    }
}

/**
 * Remove premium
 */
async function removePremium(userId) {
    if (!confirm('⚠️ Remove Premium from this user?')) return;
    
    try {
        const result = await API.request(`/admin/users/remove-premium/${userId}`, 'POST');
        if (result.success) {
            showToast('📄 Premium removed', 'success');
            loadUsers();
            loadDashboard();
        } else {
            showToast(result.error || 'Error removing premium', 'error');
        }
    } catch (error) {
        showToast('Error removing premium', 'error');
    }
}

/**
 * Delete user
 */
async function deleteUser(userId) {
    if (!confirm('⚠️⚠️⚠️ DELETE USER? This cannot be undone!')) return;
    if (!confirm('Are you absolutely sure?')) return;
    
    try {
        const result = await API.request(`/admin/users/${userId}`, 'DELETE');
        if (result.success) {
            showToast('🗑️ User deleted!', 'success');
            loadUsers();
            loadDashboard();
        } else {
            showToast(result.error || 'Error deleting user', 'error');
        }
    } catch (error) {
        showToast('Error deleting user', 'error');
    }
}

// ============================================
// PAYMENTS MANAGEMENT
// ============================================

/**
 * Load payments
 */
async function loadPayments() {
    const filter = AdminDOM.paymentFilter?.value || 'all';
    const search = AdminDOM.paymentSearch?.value || '';
    
    Admin.paymentFilter = filter;
    Admin.paymentSearch = search;
    
    if (AdminDOM.paymentsTable) {
        AdminDOM.paymentsTable.innerHTML = '<tr><td colspan="8"><div class="loading"><div class="spinner"></div></div></td></tr>';
    }
    
    try {
        const result = await API.request('/admin/payments', 'GET');
        
        if (result.success && result.payments) {
            let payments = result.payments;
            
            // Filter by status
            if (filter !== 'all') {
                payments = payments.filter(p => p.status === filter);
            }
            
            // Filter by search
            if (search) {
                const searchLower = search.toLowerCase();
                payments = payments.filter(p => 
                    (p.order_id || '').toLowerCase().includes(searchLower) ||
                    (p.user_name || '').toLowerCase().includes(searchLower) ||
                    (p.phone || '').toLowerCase().includes(searchLower)
                );
            }
            
            Admin.payments = payments;
            renderPayments(payments);
        } else {
            AdminDOM.paymentsTable.innerHTML = `
                <tr><td colspan="8">
                    <div class="empty-state">
                        <div class="empty-icon">💰</div>
                        <h3>No payments found</h3>
                    </div>
                </td></tr>
            `;
        }
    } catch (error) {
        console.error('Load payments error:', error);
        AdminDOM.paymentsTable.innerHTML = `
            <tr><td colspan="8">
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h3>Error loading payments</h3>
                </div>
            </td></tr>
        `;
    }
}

/**
 * Render payments table
 */
function renderPayments(payments) {
    if (!AdminDOM.paymentsTable) return;
    
    if (!payments || payments.length === 0) {
        AdminDOM.paymentsTable.innerHTML = `
            <tr><td colspan="8">
                <div class="empty-state">
                    <div class="empty-icon">💰</div>
                    <h3>No payments found</h3>
                </div>
            </td></tr>
        `;
        return;
    }
    
    AdminDOM.paymentsTable.innerHTML = payments.map(p => `
        <tr>
            <td style="font-size:12px;font-family:monospace;">${p.order_id || 'N/A'}</td>
            <td>${p.user_name || p.user_id || 'N/A'}</td>
            <td>${p.phone || 'N/A'}</td>
            <td><strong>TZS ${(p.amount || 0).toLocaleString()}</strong></td>
            <td>${p.plan_name || 'N/A'}</td>
            <td><span class="status-badge ${p.status || 'pending'}">${p.status || 'pending'}</span></td>
            <td style="font-size:12px;color:var(--text-muted);">${formatDate(p.created_at)}</td>
            <td>
                <div class="table-actions-cell">
                    <button class="action-btn view" onclick="viewPayment('${p.id}')">👁️</button>
                    ${p.status === 'pending' ? `
                        <button class="action-btn success" onclick="completePayment('${p.id}')">✅</button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * View payment details
 */
async function viewPayment(paymentId) {
    try {
        const result = await API.request(`/admin/payments/${paymentId}`, 'GET');
        if (result.success && result.payment) {
            const p = result.payment;
            alert(`
💳 PAYMENT DETAILS
━━━━━━━━━━━━━━━━━━
Order ID: ${p.order_id}
User: ${p.user_name || p.user_id}
Phone: ${p.phone}
Amount: TZS ${(p.amount || 0).toLocaleString()}
Plan: ${p.plan_name}
Status: ${p.status}
Created: ${formatDate(p.created_at)}
Completed: ${formatDate(p.completed_at)}
            `);
        }
    } catch (error) {
        showToast('Error loading payment', 'error');
    }
}

/**
 * Complete payment (admin override)
 */
async function completePayment(paymentId) {
    if (!confirm('✅ Mark this payment as completed?')) return;
    
    try {
        const result = await API.request(`/admin/payments/update/${paymentId}`, 'PUT', {
            status: 'completed',
        });
        if (result.success) {
            showToast('✅ Payment marked as completed!', 'success');
            loadPayments();
            loadDashboard();
        } else {
            showToast(result.error || 'Error updating payment', 'error');
        }
    } catch (error) {
        showToast('Error updating payment', 'error');
    }
}

// ============================================
// PLANS MANAGEMENT
// ============================================

/**
 * Load plans
 */
async function loadPlans() {
    if (AdminDOM.plansTable) {
        AdminDOM.plansTable.innerHTML = '<tr><td colspan="6"><div class="loading"><div class="spinner"></div></div></td></tr>';
    }
    
    try {
        const result = await API.request('/admin/plans', 'GET');
        
        if (result.success && result.plans) {
            Admin.plans = result.plans;
            renderPlans(result.plans);
        } else {
            AdminDOM.plansTable.innerHTML = `
                <tr><td colspan="6">
                    <div class="empty-state">
                        <div class="empty-icon">⭐</div>
                        <h3>No plans created yet</h3>
                    </div>
                </td></tr>
            `;
        }
    } catch (error) {
        console.error('Load plans error:', error);
        AdminDOM.plansTable.innerHTML = `
            <tr><td colspan="6">
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h3>Error loading plans</h3>
                </div>
            </td></tr>
        `;
    }
}

/**
 * Render plans table
 */
function renderPlans(plans) {
    if (!AdminDOM.plansTable) return;
    
    if (!plans || plans.length === 0) {
        AdminDOM.plansTable.innerHTML = `
            <tr><td colspan="6">
                <div class="empty-state">
                    <div class="empty-icon">⭐</div>
                    <h3>No plans created yet</h3>
                </div>
            </td></tr>
        `;
        return;
    }
    
    AdminDOM.plansTable.innerHTML = plans.map(p => `
        <tr>
            <td><strong>${p.name}</strong></td>
            <td>TZS ${(p.price || 0).toLocaleString()}</td>
            <td>${p.duration_days || 0} days</td>
            <td style="font-size:12px;">${p.features ? p.features.join(', ') : 'None'}</td>
            <td><span class="status-badge ${p.is_active !== false ? 'active' : 'inactive'}">${p.is_active !== false ? '✅ Active' : '❌ Inactive'}</span></td>
            <td>
                <div class="table-actions-cell">
                    <button class="action-btn edit" onclick="editPlan('${p.id}')">✏️</button>
                    <button class="action-btn delete" onclick="deletePlan('${p.id}')">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * Show add plan form
 */
function showAddPlanForm() {
    if (AdminDOM.planForm) {
        AdminDOM.planForm.style.display = AdminDOM.planForm.style.display === 'none' ? 'block' : 'none';
        if (AdminDOM.planForm.style.display === 'block') {
            // Clear form
            if (AdminDOM.planName) AdminDOM.planName.value = '';
            if (AdminDOM.planPrice) AdminDOM.planPrice.value = '';
            if (AdminDOM.planDuration) AdminDOM.planDuration.value = '';
            if (AdminDOM.planFeatures) AdminDOM.planFeatures.value = '';
            if (AdminDOM.planActive) AdminDOM.planActive.value = 'true';
            Admin.isEditingPlan = false;
            if (AdminDOM.planSubmit) AdminDOM.planSubmit.textContent = '💾 Create Plan';
        }
    }
}

/**
 * Save plan
 */
async function savePlan() {
    const name = AdminDOM.planName?.value.trim() || '';
    const price = parseFloat(AdminDOM.planPrice?.value || 0);
    const duration = parseInt(AdminDOM.planDuration?.value || 0);
    const features = AdminDOM.planFeatures?.value.split(',').map(f => f.trim()).filter(f => f) || [];
    const isActive = AdminDOM.planActive?.value === 'true';
    
    if (!name || !price || !duration) {
        showToast('❌ Please fill all required fields', 'error');
        return;
    }
    
    try {
        const data = { name, price, duration_days: duration, features, is_active: isActive };
        let result;
        
        if (Admin.isEditingPlan && Admin.selectedPlan) {
            result = await API.request(`/admin/plans/${Admin.selectedPlan}`, 'PUT', data);
        } else {
            result = await API.request('/admin/plans', 'POST', data);
        }
        
        if (result.success) {
            showToast(Admin.isEditingPlan ? '✅ Plan updated!' : '✅ Plan created!', 'success');
            if (AdminDOM.planForm) AdminDOM.planForm.style.display = 'none';
            loadPlans();
        } else {
            showToast(result.error || 'Error saving plan', 'error');
        }
    } catch (error) {
        showToast('Error saving plan', 'error');
    }
}

/**
 * Edit plan
 */
async function editPlan(planId) {
    try {
        const result = await API.request(`/admin/plans/${planId}`, 'GET');
        if (result.success && result.plan) {
            const plan = result.plan;
            Admin.selectedPlan = planId;
            Admin.isEditingPlan = true;
            
            if (AdminDOM.planForm) AdminDOM.planForm.style.display = 'block';
            if (AdminDOM.planName) AdminDOM.planName.value = plan.name || '';
            if (AdminDOM.planPrice) AdminDOM.planPrice.value = plan.price || '';
            if (AdminDOM.planDuration) AdminDOM.planDuration.value = plan.duration_days || '';
            if (AdminDOM.planFeatures) AdminDOM.planFeatures.value = (plan.features || []).join(', ');
            if (AdminDOM.planActive) AdminDOM.planActive.value = plan.is_active !== false ? 'true' : 'false';
            if (AdminDOM.planSubmit) AdminDOM.planSubmit.textContent = '💾 Update Plan';
        }
    } catch (error) {
        showToast('Error loading plan', 'error');
    }
}

/**
 * Delete plan
 */
async function deletePlan(planId) {
    if (!confirm('⚠️ Delete this plan?')) return;
    
    try {
        const result = await API.request(`/admin/plans/${planId}`, 'DELETE');
        if (result.success) {
            showToast('🗑️ Plan deleted!', 'success');
            loadPlans();
        } else {
            showToast(result.error || 'Error deleting plan', 'error');
        }
    } catch (error) {
        showToast('Error deleting plan', 'error');
    }
}

// ============================================
// REPORTS MANAGEMENT
// ============================================

/**
 * Load reports
 */
async function loadReports() {
    const filter = AdminDOM.reportFilter?.value || 'all';
    Admin.reportFilter = filter;
    
    if (AdminDOM.reportsTable) {
        AdminDOM.reportsTable.innerHTML = '<tr><td colspan="7"><div class="loading"><div class="spinner"></div></div></td></tr>';
    }
    
    try {
        const params = new URLSearchParams();
        if (filter !== 'all') params.append('status', filter);
        
        const result = await API.request(`/admin/reports?${params.toString()}`, 'GET');
        
        if (result.success && result.reports) {
            Admin.reports = result.reports;
            renderReports(result.reports);
        } else {
            AdminDOM.reportsTable.innerHTML = `
                <tr><td colspan="7">
                    <div class="empty-state">
                        <div class="empty-icon">🚨</div>
                        <h3>No reports found</h3>
                    </div>
                </td></tr>
            `;
        }
    } catch (error) {
        console.error('Load reports error:', error);
        AdminDOM.reportsTable.innerHTML = `
            <tr><td colspan="7">
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h3>Error loading reports</h3>
                </div>
            </td></tr>
        `;
    }
}

/**
 * Render reports table
 */
function renderReports(reports) {
    if (!AdminDOM.reportsTable) return;
    
    if (!reports || reports.length === 0) {
        AdminDOM.reportsTable.innerHTML = `
            <tr><td colspan="7">
                <div class="empty-state">
                    <div class="empty-icon">🚨</div>
                    <h3>No reports found</h3>
                </div>
            </td></tr>
        `;
        return;
    }
    
    AdminDOM.reportsTable.innerHTML = reports.map(r => `
        <tr>
            <td>${r.reporter_name || r.reporter_id || 'N/A'}</td>
            <td>${r.reported_name || r.reported_id || 'N/A'}</td>
            <td>${r.reason || 'N/A'}</td>
            <td style="font-size:12px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.details || 'N/A'}</td>
            <td><span class="status-badge ${r.status || 'pending'}">${r.status || 'pending'}</span></td>
            <td style="font-size:12px;color:var(--text-muted);">${formatDate(r.created_at)}</td>
            <td>
                <div class="table-actions-cell">
                    ${r.status === 'pending' ? `
                        <button class="action-btn view" onclick="reviewReport('${r.id}')">📋</button>
                        <button class="action-btn success" onclick="dismissReport('${r.id}')">✅</button>
                    ` : ''}
                    <button class="action-btn delete" onclick="deleteReport('${r.id}')">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * Review report
 */
async function reviewReport(reportId) {
    if (!confirm('📋 Mark this report as reviewed?')) return;
    
    try {
        const result = await API.request(`/admin/reports/${reportId}`, 'PUT', { status: 'reviewed' });
        if (result.success) {
            showToast('📋 Report marked as reviewed', 'success');
            loadReports();
        } else {
            showToast(result.error || 'Error reviewing report', 'error');
        }
    } catch (error) {
        showToast('Error reviewing report', 'error');
    }
}

/**
 * Dismiss report
 */
async function dismissReport(reportId) {
    if (!confirm('✅ Dismiss this report?')) return;
    
    try {
        const result = await API.request(`/admin/reports/${reportId}`, 'PUT', { status: 'dismissed' });
        if (result.success) {
            showToast('✅ Report dismissed', 'success');
            loadReports();
        } else {
            showToast(result.error || 'Error dismissing report', 'error');
        }
    } catch (error) {
        showToast('Error dismissing report', 'error');
    }
}

/**
 * Delete report
 */
async function deleteReport(reportId) {
    if (!confirm('🗑️ Delete this report?')) return;
    
    try {
        const result = await API.request(`/admin/reports/${reportId}`, 'DELETE');
        if (result.success) {
            showToast('🗑️ Report deleted!', 'success');
            loadReports();
        } else {
            showToast(result.error || 'Error deleting report', 'error');
        }
    } catch (error) {
        showToast('Error deleting report', 'error');
    }
}

// ============================================
// NOTIFICATIONS
// ============================================

/**
 * Send notification
 */
async function sendNotification() {
    const target = AdminDOM.notifTarget?.value || 'all';
    const userId = AdminDOM.notifUserId?.value.trim() || '';
    const title = AdminDOM.notifTitle?.value.trim() || '';
    const message = AdminDOM.notifMessage?.value.trim() || '';
    
    if (!title || !message) {
        showToast('❌ Title and message are required', 'error');
        return;
    }
    
    if (target === 'specific' && !userId) {
        showToast('❌ Please enter a user ID', 'error');
        return;
    }
    
    try {
        const result = await API.request('/admin/notifications/send', 'POST', {
            target,
            user_id: userId,
            title,
            message,
        });
        
        if (result.success) {
            showToast(`📨 Notification sent to ${result.count || 0} users!`, 'success');
            if (AdminDOM.notifTitle) AdminDOM.notifTitle.value = '';
            if (AdminDOM.notifMessage) AdminDOM.notifMessage.value = '';
            if (AdminDOM.notifUserId) AdminDOM.notifUserId.value = '';
            loadSentNotifications();
        } else {
            showToast(result.error || 'Error sending notification', 'error');
        }
    } catch (error) {
        showToast('Error sending notification', 'error');
    }
}

/**
 * Load sent notifications
 */
async function loadSentNotifications() {
    if (AdminDOM.notifTable) {
        AdminDOM.notifTable.innerHTML = '<tr><td colspan="4"><div class="loading"><div class="spinner"></div></div></td></tr>';
    }
    
    try {
        const result = await API.request('/admin/notifications/sent', 'GET');
        
        if (result.success && result.notifications) {
            Admin.notifications = result.notifications;
            renderSentNotifications(result.notifications);
        } else {
            AdminDOM.notifTable.innerHTML = `
                <tr><td colspan="4">
                    <div class="empty-state">
                        <div class="empty-icon">📨</div>
                        <h3>No notifications sent</h3>
                    </div>
                </td></tr>
            `;
        }
    } catch (error) {
        console.error('Load sent notifications error:', error);
        AdminDOM.notifTable.innerHTML = `
            <tr><td colspan="4">
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h3>Error loading notifications</h3>
                </div>
            </td></tr>
        `;
    }
}

/**
 * Render sent notifications
 */
function renderSentNotifications(notifications) {
    if (!AdminDOM.notifTable) return;
    
    if (!notifications || notifications.length === 0) {
        AdminDOM.notifTable.innerHTML = `
            <tr><td colspan="4">
                <div class="empty-state">
                    <div class="empty-icon">📨</div>
                    <h3>No notifications sent</h3>
                </div>
            </td></tr>
        `;
        return;
    }
    
    AdminDOM.notifTable.innerHTML = notifications.map(n => `
        <tr>
            <td><strong>${n.title}</strong></td>
            <td style="max-width:200px;">${n.message}</td>
            <td><span class="status-badge ${n.target === 'all' ? 'active' : 'info'}">${n.target || 'all'}</span></td>
            <td style="font-size:12px;color:var(--text-muted);">${formatDate(n.sent_at)}</td>
        </tr>
    `).join('');
}

// ============================================
// ADMIN SETTINGS
// ============================================

/**
 * Update admin settings
 */
async function updateAdminSettings() {
    const email = AdminDOM.settingsEmail?.value.trim() || '';
    const password = AdminDOM.settingsPassword?.value || '';
    
    if (!email && !password) {
        showToast('❌ No changes to save', 'warning');
        return;
    }
    
    try {
        const data = {};
        if (email) data.email = email;
        if (password && password.length >= 6) data.password = password;
        
        const result = await API.request('/admin/settings', 'PUT', data);
        
        if (result.success) {
            showToast('✅ Settings updated successfully!', 'success');
            if (AdminDOM.settingsPassword) AdminDOM.settingsPassword.value = '';
        } else {
            showToast(result.error || 'Error updating settings', 'error');
        }
    } catch (error) {
        showToast('Error updating settings', 'error');
    }
}

// ============================================
// SIDEBAR NAVIGATION
// ============================================

/**
 * Toggle sidebar on mobile
 */
function toggleSidebar() {
    if (AdminDOM.sidebar) {
        AdminDOM.sidebar.classList.toggle('open');
    }
    if (AdminDOM.sidebarOverlay) {
        AdminDOM.sidebarOverlay.classList.toggle('active');
    }
}

/**
 * Show admin section
 */
function showAdminSection(section) {
    // Hide all sections
    Object.values(AdminDOM.sections).forEach(el => {
        if (el) el.classList.remove('active');
    });
    
    // Show selected section
    if (AdminDOM.sections[section]) {
        AdminDOM.sections[section].classList.add('active');
    }
    
    // Update nav links
    document.querySelectorAll('.sidebar-nav a').forEach(el => {
        el.classList.toggle('active', el.dataset.section === section);
    });
    
    // Update page title
    const titles = {
        dashboard: '📊 Dashboard',
        users: '👥 Users',
        payments: '💰 Payments',
        plans: '⭐ Premium Plans',
        reports: '🚨 Reports',
        notifications: '🔔 Notifications',
        settings: '⚙️ Settings',
    };
    const titleEl = document.querySelector('.page-title');
    if (titleEl) {
        titleEl.innerHTML = `${titles[section] || section} <span class="subtitle">Admin Panel</span>`;
    }
    
    // Load section data
    const loaders = {
        dashboard: loadDashboard,
        users: loadUsers,
        payments: loadPayments,
        plans: loadPlans,
        reports: loadReports,
        notifications: loadSentNotifications,
        settings: () => {},
    };
    
    if (loaders[section]) {
        loaders[section]();
    }
    
    // Close sidebar on mobile
    if (window.innerWidth <= 992) {
        toggleSidebar();
    }
}

// ============================================
// HELPERS
// ============================================

/**
 * Format date
 */
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('sw', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// ============================================
// EVENT LISTENERS
// ============================================

// Sidebar toggle
if (AdminDOM.hamburger) {
    AdminDOM.hamburger.addEventListener('click', toggleSidebar);
}

if (AdminDOM.sidebarOverlay) {
    AdminDOM.sidebarOverlay.addEventListener('click', toggleSidebar);
}

// Search inputs
if (AdminDOM.userSearch) {
    AdminDOM.userSearch.addEventListener('input', loadUsers);
}
if (AdminDOM.userFilter) {
    AdminDOM.userFilter.addEventListener('change', loadUsers);
}
if (AdminDOM.paymentSearch) {
    AdminDOM.paymentSearch.addEventListener('input', loadPayments);
}
if (AdminDOM.paymentFilter) {
    AdminDOM.paymentFilter.addEventListener('change', loadPayments);
}
if (AdminDOM.reportFilter) {
    AdminDOM.reportFilter.addEventListener('change', loadReports);
}

// Notification target change
if (AdminDOM.notifTarget) {
    AdminDOM.notifTarget.addEventListener('change', function() {
        const specificUser = document.getElementById('specificUserGroup');
        if (specificUser) {
            specificUser.style.display = this.value === 'specific' ? 'block' : 'none';
        }
    });
}

// Theme
if (AdminDOM.adminTheme) {
    AdminDOM.adminTheme.addEventListener('change', function() {
        const mode = this.value;
        if (mode === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('adminTheme', 'dark');
        } else if (mode === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('adminTheme', 'light');
        }
    });
}

// ============================================
// EXPORTS
// ============================================

window.Admin = Admin;
window.loadDashboard = loadDashboard;
window.loadUsers = loadUsers;
window.loadPayments = loadPayments;
window.loadPlans = loadPlans;
window.loadReports = loadReports;
window.loadSentNotifications = loadSentNotifications;
window.showAdminSection = showAdminSection;
window.toggleSidebar = toggleSidebar;
window.viewUser = viewUser;
window.banUser = banUser;
window.unbanUser = unbanUser;
window.makePremium = makePremium;
window.removePremium = removePremium;
window.deleteUser = deleteUser;
window.viewPayment = viewPayment;
window.completePayment = completePayment;
window.showAddPlanForm = showAddPlanForm;
window.savePlan = savePlan;
window.editPlan = editPlan;
window.deletePlan = deletePlan;
window.reviewReport = reviewReport;
window.dismissReport = dismissReport;
window.deleteReport = deleteReport;
window.sendNotification = sendNotification;
window.updateAdminSettings = updateAdminSettings;
