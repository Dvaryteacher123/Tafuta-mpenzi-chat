// ============================================
// JAVASCRIPT - PROFILE.JS
// ============================================
// KAZI: Logic zote za profile management.
// Inashughulikia: View profile, Edit profile,
// Change password, Update profile picture,
// Delete account, View other users' profiles.
// ============================================

// ============================================
// PROFILE STATE
// ============================================

const Profile = {
    // Current profile data
    data: null,
    
    // Viewing other user
    viewingUserId: null,
    viewingUser: null,
    
    // Loading states
    isLoading: false,
    isEditing: false,
    
    // Form data
    formData: {},
    
    // Profile picture
    profilePicture: null,
    tempProfilePicture: null,
};

// ============================================
// DOM REFS (Profile specific)
// ============================================

const ProfileDOM = {
    // Profile container
    container: document.getElementById('profileContainer'),
    
    // Profile view
    avatar: document.querySelector('.profile-avatar'),
    name: document.querySelector('.profile-name'),
    username: document.querySelector('.profile-username'),
    badges: document.querySelector('.profile-badges'),
    expiry: document.querySelector('.profile-expiry'),
    details: document.querySelector('.profile-details'),
    actions: document.querySelector('.profile-actions'),
    
    // Edit form
    editModal: document.getElementById('editProfileModal'),
    editForm: document.getElementById('editProfileForm'),
    editFullName: document.getElementById('editFullName'),
    editUsername: document.getElementById('editUsername'),
    editBio: document.getElementById('editBio'),
    editLocation: document.getElementById('editLocation'),
    editGender: document.getElementById('editGender'),
    editDob: document.getElementById('editDob'),
    editInterests: document.getElementById('editInterests'),
    editSubmit: document.getElementById('editSubmit'),
    
    // Change password
    passwordModal: document.getElementById('changePasswordModal'),
    passwordForm: document.getElementById('changePasswordForm'),
    currentPassword: document.getElementById('currentPassword'),
    newPassword: document.getElementById('newPassword'),
    confirmPassword: document.getElementById('confirmPassword'),
    passwordSubmit: document.getElementById('passwordSubmit'),
    
    // Delete account
    deleteModal: document.getElementById('deleteAccountModal'),
    deleteConfirm: document.getElementById('deleteConfirm'),
    deleteSubmit: document.getElementById('deleteSubmit'),
};

// ============================================
// VIEW PROFILE
// ============================================

/**
 * Load current user profile
 */
async function loadProfile() {
    if (Profile.isLoading) return;
    Profile.isLoading = true;
    
    if (ProfileDOM.container) {
        ProfileDOM.container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    }
    
    try {
        const result = await API.getMe();
        
        if (result.success && result.user) {
            Profile.data = result.user;
            renderProfile(result.user);
            
            // Update global user
            if (window.App && App.currentUser) {
                App.currentUser = { ...App.currentUser, ...result.user };
            }
        } else {
            showError('Imeshindwa kupakia profile.');
        }
    } catch (error) {
        console.error('Load profile error:', error);
        showError('Imeshindwa kupakia profile.');
    }
    
    Profile.isLoading = false;
}

/**
 * Load another user's profile
 */
async function loadUserProfile(userId) {
    if (!userId) return;
    
    Profile.isLoading = true;
    Profile.viewingUserId = userId;
    
    try {
        const result = await API.getUser(userId);
        
        if (result.success && result.user) {
            Profile.viewingUser = result.user;
            renderUserProfile(result.user);
        } else {
            showToast('User not found', 'error');
            if (window.showSection) {
                window.showSection('profile');
            }
        }
    } catch (error) {
        console.error('Load user profile error:', error);
        showToast('Error loading profile', 'error');
    }
    
    Profile.isLoading = false;
}

// ============================================
// RENDER PROFILE
// ============================================

/**
 * Render current user profile
 */
function renderProfile(user) {
    if (!ProfileDOM.container) return;
    
    const isPremium = user.is_premium;
    const isTrial = user.trial_active;
    const hasPremium = isPremium || isTrial;
    
    let html = `
        <div class="profile-header">
            <div class="profile-avatar" onclick="changeProfilePicture()">
                ${user.profile_picture ? `<img src="${user.profile_picture}">` : '👤'}
                <div class="avatar-overlay">📸</div>
            </div>
            <div class="profile-name">${user.full_name || user.username}</div>
            <div class="profile-username">@${user.username}</div>
            <div class="profile-badges">
                ${isPremium ? '<span class="badge premium">⭐ Premium</span>' : ''}
                ${isTrial ? '<span class="badge trial">🎁 Trial</span>' : ''}
                ${!hasPremium ? '<span class="badge free">📄 Free</span>' : ''}
                ${user.is_verified ? '<span class="badge verified">✓ Verified</span>' : ''}
            </div>
            ${isPremium && user.premium_expires_at ? `
                <div class="profile-expiry">Inaisha: ${formatDate(user.premium_expires_at)}</div>
            ` : ''}
            ${isTrial && user.trial_expires_at ? `
                <div class="profile-expiry trial">Trial inaisha: ${formatDate(user.trial_expires_at)}</div>
            ` : ''}
            <div class="profile-status">
                <span class="status-dot ${user.online_status === 'online' ? 'online' : 'offline'}"></span>
                ${user.online_status === 'online' ? 'Online' : 'Offline'}
                ${user.last_seen && user.online_status !== 'online' ? ` • Last seen ${formatTime(user.last_seen)}` : ''}
            </div>
        </div>
        <div class="profile-details">
            <div class="detail-item">
                <span class="label">📧 Email</span>
                <span class="value">${user.email}</span>
            </div>
            <div class="detail-item">
                <span class="label">📱 Phone</span>
                <span class="value">${user.phone || 'Not set'}</span>
            </div>
            <div class="detail-item">
                <span class="label">⚧️ Gender</span>
                <span class="value">${user.gender || 'Not set'}</span>
            </div>
            <div class="detail-item">
                <span class="label">📍 Location</span>
                <span class="value">${user.location || 'Not set'}</span>
            </div>
            <div class="detail-item">
                <span class="label">📝 Bio</span>
                <span class="value">${user.bio || 'Not set'}</span>
            </div>
            <div class="detail-item">
                <span class="label">❤️ Interests</span>
                <span class="value">${user.interests && user.interests.length > 0 ? user.interests.join(', ') : 'None'}</span>
            </div>
            <div class="detail-item">
                <span class="label">📅 Joined</span>
                <span class="value">${user.created_at ? formatDate(user.created_at) : 'N/A'}</span>
            </div>
            <div class="detail-item">
                <span class="label">📊 Subscription</span>
                <span class="value">${isPremium ? '⭐ Premium' : isTrial ? '🎁 Trial' : '📄 Free'}</span>
            </div>
        </div>
        <div class="profile-actions">
            <button class="btn btn-primary" onclick="editProfile()">✏️ Edit Profile</button>
            <button class="btn btn-secondary" onclick="window.showSection('settings')">⚙️ Settings</button>
            <button class="btn btn-danger" onclick="window.logout()">🚪 Logout</button>
        </div>
    `;
    
    ProfileDOM.container.innerHTML = html;
}

/**
 * Render another user's profile
 */
function renderUserProfile(user) {
    if (!ProfileDOM.container) return;
    
    const isPremium = user.is_premium;
    const isVerified = user.is_verified;
    
    let html = `
        <div class="profile-header">
            <div class="profile-avatar">
                ${user.profile_picture ? `<img src="${user.profile_picture}">` : '👤'}
            </div>
            <div class="profile-name">${user.full_name || user.username}</div>
            <div class="profile-username">@${user.username}</div>
            <div class="profile-badges">
                ${isPremium ? '<span class="badge premium">⭐ Premium</span>' : ''}
                ${isVerified ? '<span class="badge verified">✓ Verified</span>' : ''}
            </div>
            <div class="profile-status">
                <span class="status-dot ${user.online_status === 'online' ? 'online' : 'offline'}"></span>
                ${user.online_status === 'online' ? 'Online' : 'Offline'}
                ${user.last_seen && user.online_status !== 'online' ? ` • Last seen ${formatTime(user.last_seen)}` : ''}
            </div>
        </div>
        <div class="profile-details">
            <div class="detail-item">
                <span class="label">📍 Location</span>
                <span class="value">${user.location || 'Not set'}</span>
            </div>
            <div class="detail-item">
                <span class="label">📝 Bio</span>
                <span class="value">${user.bio || 'Not set'}</span>
            </div>
            <div class="detail-item">
                <span class="label">❤️ Interests</span>
                <span class="value">${user.interests && user.interests.length > 0 ? user.interests.join(', ') : 'None'}</span>
            </div>
            <div class="detail-item">
                <span class="label">📅 Joined</span>
                <span class="value">${user.created_at ? formatDate(user.created_at) : 'N/A'}</span>
            </div>
        </div>
        <div class="profile-actions">
            <button class="btn btn-primary" onclick="window.startChat('${user.id}')">💬 Chat</button>
            <button class="btn btn-secondary" onclick="window.blockUser('${user.id}')">🚫 Block</button>
            <button class="btn btn-danger" onclick="window.reportUser('${user.id}')">🚨 Report</button>
            <button class="btn btn-secondary" onclick="window.showSection('discover')">🔙 Back</button>
        </div>
    `;
    
    ProfileDOM.container.innerHTML = html;
}

// ============================================
// EDIT PROFILE
// ============================================

/**
 * Open edit profile modal
 */
function editProfile() {
    if (!Profile.data) {
        loadProfile();
        return;
    }
    
    const user = Profile.data;
    
    // Fill form with current data
    if (ProfileDOM.editFullName) {
        ProfileDOM.editFullName.value = user.full_name || '';
    }
    if (ProfileDOM.editUsername) {
        ProfileDOM.editUsername.value = user.username || '';
    }
    if (ProfileDOM.editBio) {
        ProfileDOM.editBio.value = user.bio || '';
    }
    if (ProfileDOM.editLocation) {
        ProfileDOM.editLocation.value = user.location || '';
    }
    if (ProfileDOM.editGender) {
        ProfileDOM.editGender.value = user.gender || '';
    }
    if (ProfileDOM.editDob) {
        ProfileDOM.editDob.value = user.date_of_birth || '';
    }
    if (ProfileDOM.editInterests) {
        // Set interests tags
        const interests = user.interests || [];
        document.querySelectorAll('.interest-tag').forEach(tag => {
            tag.classList.toggle('selected', interests.includes(tag.textContent.trim()));
        });
        window.selectedInterests = interests;
    }
    
    // Show modal
    if (ProfileDOM.editModal) {
        ProfileDOM.editModal.style.display = 'flex';
        ProfileDOM.editModal.classList.add('active');
    }
}

/**
 * Save profile changes
 */
async function saveProfile() {
    if (Profile.isEditing) return;
    Profile.isEditing = true;
    
    const formData = {
        full_name: ProfileDOM.editFullName?.value.trim() || '',
        username: ProfileDOM.editUsername?.value.trim() || '',
        bio: ProfileDOM.editBio?.value.trim() || '',
        location: ProfileDOM.editLocation?.value.trim() || '',
        gender: ProfileDOM.editGender?.value || '',
        date_of_birth: ProfileDOM.editDob?.value || '',
        interests: window.selectedInterests || [],
    };
    
    // Validate username
    if (formData.username.length < 3) {
        showToast('❌ Username lazima iwe na herufi 3 au zaidi.', 'error');
        Profile.isEditing = false;
        return;
    }
    
    try {
        const result = await API.updateProfile(formData);
        
        if (result.success) {
            showToast('✅ Profile imesasishwa!', 'success');
            closeEditModal();
            loadProfile();
        } else {
            showToast(result.error || 'Error updating profile', 'error');
        }
    } catch (error) {
        console.error('Save profile error:', error);
        showToast('Error updating profile', 'error');
    }
    
    Profile.isEditing = false;
}

/**
 * Close edit modal
 */
function closeEditModal() {
    if (ProfileDOM.editModal) {
        ProfileDOM.editModal.style.display = 'none';
        ProfileDOM.editModal.classList.remove('active');
    }
}

// ============================================
// CHANGE PROFILE PICTURE
// ============================================

/**
 * Change profile picture
 */
function changeProfilePicture() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showToast('❌ Picha ni kubwa sana (max 5MB)', 'error');
            return;
        }
        
        // Show loading
        showToast('⏳ Inapakia picha...', 'info');
        
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const imageData = ev.target.result;
            try {
                const result = await API.updateProfilePicture({ image_data: imageData });
                
                if (result.success) {
                    showToast('✅ Picha imebadilishwa!', 'success');
                    loadProfile();
                } else {
                    showToast(result.error || 'Error updating picture', 'error');
                }
            } catch (error) {
                console.error('Update profile picture error:', error);
                showToast('Error updating picture', 'error');
            }
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

// ============================================
// CHANGE PASSWORD
// ============================================

/**
 * Open change password modal
 */
function openChangePassword() {
    if (ProfileDOM.passwordModal) {
        ProfileDOM.passwordModal.style.display = 'flex';
        ProfileDOM.passwordModal.classList.add('active');
        
        // Clear fields
        if (ProfileDOM.currentPassword) ProfileDOM.currentPassword.value = '';
        if (ProfileDOM.newPassword) ProfileDOM.newPassword.value = '';
        if (ProfileDOM.confirmPassword) ProfileDOM.confirmPassword.value = '';
    }
}

/**
 * Save new password
 */
async function savePassword() {
    const current = ProfileDOM.currentPassword?.value || '';
    const newPass = ProfileDOM.newPassword?.value || '';
    const confirm = ProfileDOM.confirmPassword?.value || '';
    
    // Validate
    if (!current) {
        showToast('❌ Tafadhali ingiza password yako ya sasa.', 'error');
        return;
    }
    
    if (newPass.length < 8) {
        showToast('❌ Password mpya lazima iwe na herufi 8 au zaidi.', 'error');
        return;
    }
    
    if (newPass !== confirm) {
        showToast('❌ Password mpya hazilingani.', 'error');
        return;
    }
    
    try {
        const result = await API.changePassword({
            current_password: current,
            new_password: newPass,
        });
        
        if (result.success) {
            showToast('✅ Password imebadilishwa!', 'success');
            closePasswordModal();
        } else {
            showToast(result.error || 'Error changing password', 'error');
        }
    } catch (error) {
        console.error('Change password error:', error);
        showToast('Error changing password', 'error');
    }
}

/**
 * Close password modal
 */
function closePasswordModal() {
    if (ProfileDOM.passwordModal) {
        ProfileDOM.passwordModal.style.display = 'none';
        ProfileDOM.passwordModal.classList.remove('active');
    }
}

// ============================================
// DELETE ACCOUNT
// ============================================

/**
 * Open delete account modal
 */
function openDeleteAccount() {
    if (ProfileDOM.deleteModal) {
        ProfileDOM.deleteModal.style.display = 'flex';
        ProfileDOM.deleteModal.classList.add('active');
        if (ProfileDOM.deleteConfirm) ProfileDOM.deleteConfirm.value = '';
        if (ProfileDOM.deleteSubmit) ProfileDOM.deleteSubmit.disabled = true;
    }
}

/**
 * Check delete confirmation
 */
function checkDeleteConfirmation() {
    const confirm = ProfileDOM.deleteConfirm?.value || '';
    if (ProfileDOM.deleteSubmit) {
        ProfileDOM.deleteSubmit.disabled = confirm.toLowerCase() !== 'delete';
    }
}

/**
 * Delete account
 */
async function deleteAccount() {
    if (!confirm('⚠️ Je, una uhakika unataka kufuta akaunti yako? Hii haiwezi kurejeshwa!')) return;
    if (!confirm('Thibitisha tena: Futa akaunti yangu')) return;
    
    try {
        const result = await API.deleteAccount();
        
        if (result.success) {
            showToast('Akaunti imefutwa.', 'success');
            closeDeleteModal();
            
            // Logout
            if (window.logout) {
                setTimeout(() => window.logout(), 500);
            }
        } else {
            showToast(result.error || 'Error deleting account', 'error');
        }
    } catch (error) {
        console.error('Delete account error:', error);
        showToast('Error deleting account', 'error');
    }
}

/**
 * Close delete modal
 */
function closeDeleteModal() {
    if (ProfileDOM.deleteModal) {
        ProfileDOM.deleteModal.style.display = 'none';
        ProfileDOM.deleteModal.classList.remove('active');
    }
}

// ============================================
// INTERESTS (Edit)
// ============================================

/**
 * Toggle interest selection
 */
function toggleInterest(el) {
    el.classList.toggle('selected');
    
    // Update selected interests
    const selected = document.querySelectorAll('.interest-tag.selected');
    window.selectedInterests = Array.from(selected).map(tag => tag.textContent.trim());
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
    return date.toLocaleDateString('sw', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

/**
 * Format time
 */
function formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Less than a minute
    if (diff < 60000) {
        return 'Sasa hivi';
    }
    
    // Less than an hour
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} min ago`;
    }
    
    // Less than a day
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} h ago`;
    }
    
    // More than a day
    return date.toLocaleDateString('sw', {
        month: 'short',
        day: 'numeric',
    });
}

/**
 * Show error
 */
function showError(message) {
    if (ProfileDOM.container) {
        ProfileDOM.container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <h3>Error</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="loadProfile()" style="margin-top:15px;">
                    🔄 Jaribu Tena
                </button>
            </div>
        `;
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

// Edit form
if (ProfileDOM.editForm) {
    ProfileDOM.editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveProfile();
    });
}

// Password form
if (ProfileDOM.passwordForm) {
    ProfileDOM.passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        savePassword();
    });
}

// Delete confirmation
if (ProfileDOM.deleteConfirm) {
    ProfileDOM.deleteConfirm.addEventListener('input', checkDeleteConfirmation);
}

// Delete submit
if (ProfileDOM.deleteSubmit) {
    ProfileDOM.deleteSubmit.addEventListener('click', deleteAccount);
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
    });
});

// Close modals on escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
            modal.style.display = 'none';
            modal.classList.remove('active');
        });
    }
});

// ============================================
// EXPORTS
// ============================================

window.Profile = Profile;
window.loadProfile = loadProfile;
window.loadUserProfile = loadUserProfile;
window.editProfile = editProfile;
window.saveProfile = saveProfile;
window.closeEditModal = closeEditModal;
window.changeProfilePicture = changeProfilePicture;
window.openChangePassword = openChangePassword;
window.savePassword = savePassword;
window.closePasswordModal = closePasswordModal;
window.openDeleteAccount = openDeleteAccount;
window.deleteAccount = deleteAccount;
window.closeDeleteModal = closeDeleteModal;
window.toggleInterest = toggleInterest;
