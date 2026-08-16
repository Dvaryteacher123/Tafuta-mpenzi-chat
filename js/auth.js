// ============================================
// JAVASCRIPT - AUTH.JS
// ============================================
// KAZI: Authentication logic yote.
// Inashughulikia: Signup, Login, Logout,
// Password reset, Session management,
// Token refresh, Admin authentication.
// ============================================

// ============================================
// AUTH STATE
// ============================================

const Auth = {
    // Current user
    user: null,
    token: null,
    
    // Loading states
    isLoading: false,
    
    // Remember me
    rememberMe: localStorage.getItem('rememberMe') === 'true',
    
    // Redirect URL after login
    redirectUrl: localStorage.getItem('redirectUrl') || '/',
};

// ============================================
// DOM REFS
// ============================================

const AuthDOM = {
    // Login Form
    loginForm: document.getElementById('loginForm'),
    loginIdentifier: document.getElementById('identifier'),
    loginPassword: document.getElementById('password'),
    loginRemember: document.getElementById('rememberMe'),
    loginSubmit: document.getElementById('submitBtn'),
    loginError: document.getElementById('loginError'),
    
    // Signup Form
    signupForm: document.getElementById('signupForm'),
    signupFullName: document.getElementById('fullName'),
    signupUsername: document.getElementById('username'),
    signupEmail: document.getElementById('email'),
    signupPhone: document.getElementById('phone'),
    signupPassword: document.getElementById('password'),
    signupConfirm: document.getElementById('confirmPassword'),
    signupDob: document.getElementById('dob'),
    signupGender: document.getElementById('gender'),
    signupLocation: document.getElementById('location'),
    signupBio: document.getElementById('bio'),
    signupInterests: document.getElementById('interestsContainer'),
    signupTerms: document.getElementById('terms'),
    signupSubmit: document.getElementById('submitBtn'),
    signupSuccess: document.getElementById('successMessage'),
    
    // Password toggle
    togglePassword: document.querySelector('.toggle-password'),
};

// ============================================
// AUTH FUNCTIONS
// ============================================

/**
 * Check if user is logged in
 */
function isLoggedIn() {
    return !!(Auth.token && Auth.user);
}

/**
 * Get current user
 */
function getCurrentUser() {
    return Auth.user;
}

/**
 * Get auth token
 */
function getToken() {
    return Auth.token;
}

/**
 * Save authentication data
 */
function saveAuth(token, user, remember = false) {
    Auth.token = token;
    Auth.user = user;
    Auth.rememberMe = remember;
    
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    if (remember) {
        localStorage.setItem('rememberMe', 'true');
        if (user.email) {
            localStorage.setItem('savedEmail', user.email);
        }
    } else {
        localStorage.removeItem('rememberMe');
    }
}

/**
 * Clear authentication data
 */
function clearAuth() {
    Auth.token = null;
    Auth.user = null;
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberMe');
}

/**
 * Load auth from storage
 */
function loadAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        Auth.token = token;
        Auth.user = JSON.parse(user);
        return true;
    }
    return false;
}

/**
 * Check if token is valid
 */
async function validateToken() {
    if (!Auth.token) return false;
    
    try {
        const response = await API.getMe();
        if (response.success) {
            Auth.user = { ...Auth.user, ...response.user };
            localStorage.setItem('user', JSON.stringify(Auth.user));
            return true;
        } else {
            clearAuth();
            return false;
        }
    } catch (error) {
        return false;
    }
}

/**
 * Refresh token
 */
async function refreshToken() {
    try {
        const result = await API.request('/auth/refresh-token', 'POST');
        if (result.success) {
            Auth.token = result.token;
            localStorage.setItem('token', result.token);
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
}

// ============================================
// LOGIN
// ============================================

/**
 * Handle login form submission
 */
async function handleLogin(event) {
    if (event) event.preventDefault();
    
    if (Auth.isLoading) return;
    
    // Validate form
    const identifier = AuthDOM.loginIdentifier?.value.trim();
    const password = AuthDOM.loginPassword?.value;
    const remember = AuthDOM.loginRemember?.checked || false;
    
    if (!identifier || !password) {
        showToast('❌ Tafadhali jaza sehemu zote.', 'error');
        return;
    }
    
    // Show loading
    Auth.isLoading = true;
    if (AuthDOM.loginSubmit) {
        AuthDOM.loginSubmit.classList.add('loading');
        AuthDOM.loginSubmit.disabled = true;
    }
    
    try {
        const result = await API.login({ identifier, password, remember_me: remember });
        
        if (result.success) {
            // Save auth
            saveAuth(result.token, result.user, remember);
            
            showToast('✅ Login successful! Karibu tena 💕', 'success');
            
            // Check if user is admin
            if (result.user.is_admin) {
                setTimeout(() => {
                    window.location.href = '/admin.html';
                }, 1000);
            } else {
                // Redirect to dashboard or saved URL
                const redirect = Auth.redirectUrl || '/';
                setTimeout(() => {
                    window.location.href = redirect;
                }, 1000);
            }
        } else {
            // Show error
            let errorMsg = result.error || 'Login failed. Please try again.';
            
            if (errorMsg.toLowerCase().includes('invalid') || errorMsg.toLowerCase().includes('credentials')) {
                showToast('❌ Email/Username au Password si sahihi.', 'error');
                if (AuthDOM.loginPassword) {
                    AuthDOM.loginPassword.value = '';
                    AuthDOM.loginPassword.focus();
                }
            } else if (errorMsg.toLowerCase().includes('banned')) {
                showToast('🚫 Akaunti yako imezuiwa. Wasiliana na admin.', 'error');
            } else {
                showToast(`❌ ${errorMsg}`, 'error');
            }
            
            // Reset loading
            Auth.isLoading = false;
            if (AuthDOM.loginSubmit) {
                AuthDOM.loginSubmit.classList.remove('loading');
                AuthDOM.loginSubmit.disabled = false;
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('❌ Network error. Tafadhali jaribu tena.', 'error');
        
        Auth.isLoading = false;
        if (AuthDOM.loginSubmit) {
            AuthDOM.loginSubmit.classList.remove('loading');
            AuthDOM.loginSubmit.disabled = false;
        }
    }
}

// ============================================
// SIGNUP
// ============================================

/**
 * Handle signup form submission
 */
async function handleSignup(event) {
    if (event) event.preventDefault();
    
    if (Auth.isLoading) return;
    
    // Validate form
    if (!validateSignupForm()) {
        return;
    }
    
    // Get form data
    const formData = {
        full_name: AuthDOM.signupFullName?.value.trim() || '',
        username: AuthDOM.signupUsername?.value.trim() || '',
        email: AuthDOM.signupEmail?.value.trim() || '',
        phone: AuthDOM.signupPhone?.value.trim() || '',
        password: AuthDOM.signupPassword?.value || '',
        date_of_birth: AuthDOM.signupDob?.value || '',
        gender: AuthDOM.signupGender?.value || '',
        location: AuthDOM.signupLocation?.value.trim() || '',
        bio: AuthDOM.signupBio?.value.trim() || '',
        interests: selectedInterests || [],
        profile_picture: profilePicture || null,
    };
    
    // Show loading
    Auth.isLoading = true;
    if (AuthDOM.signupSubmit) {
        AuthDOM.signupSubmit.classList.add('loading');
        AuthDOM.signupSubmit.disabled = true;
    }
    
    try {
        const result = await API.signup(formData);
        
        if (result.success) {
            // Save auth
            saveAuth(result.token, result.user, true);
            
            // Show success
            if (AuthDOM.signupForm) {
                AuthDOM.signupForm.style.display = 'none';
            }
            if (AuthDOM.signupSuccess) {
                AuthDOM.signupSuccess.style.display = 'block';
            }
            
            showToast('🎉 Account created successfully!', 'success');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } else {
            let errorMsg = result.error || 'Error creating account';
            
            // Handle specific errors
            if (errorMsg.toLowerCase().includes('username')) {
                showToast('❌ Username tayari imetumika.', 'error');
                if (AuthDOM.signupUsername) {
                    AuthDOM.signupUsername.focus();
                    AuthDOM.signupUsername.classList.add('error');
                }
            } else if (errorMsg.toLowerCase().includes('email')) {
                showToast('❌ Email tayari imesajiliwa.', 'error');
                if (AuthDOM.signupEmail) {
                    AuthDOM.signupEmail.focus();
                    AuthDOM.signupEmail.classList.add('error');
                }
            } else {
                showToast(`❌ ${errorMsg}`, 'error');
            }
            
            // Reset loading
            Auth.isLoading = false;
            if (AuthDOM.signupSubmit) {
                AuthDOM.signupSubmit.classList.remove('loading');
                AuthDOM.signupSubmit.disabled = false;
            }
        }
    } catch (error) {
        console.error('Signup error:', error);
        showToast('❌ Network error. Tafadhali jaribu tena.', 'error');
        
        Auth.isLoading = false;
        if (AuthDOM.signupSubmit) {
            AuthDOM.signupSubmit.classList.remove('loading');
            AuthDOM.signupSubmit.disabled = false;
        }
    }
}

/**
 * Validate signup form
 */
function validateSignupForm() {
    let isValid = true;
    
    // Full Name
    const fullName = AuthDOM.signupFullName?.value.trim();
    if (!fullName) {
        showError('fullNameError');
        isValid = false;
    } else {
        hideError('fullNameError');
    }
    
    // Username
    const username = AuthDOM.signupUsername?.value.trim();
    if (!username || username.length < 3) {
        showError('usernameError');
        isValid = false;
    } else {
        hideError('usernameError');
    }
    
    // Email
    const email = AuthDOM.signupEmail?.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        showError('emailError');
        isValid = false;
    } else {
        hideError('emailError');
    }
    
    // Password
    const password = AuthDOM.signupPassword?.value || '';
    if (password.length < 8) {
        showError('passwordError');
        isValid = false;
    } else {
        hideError('passwordError');
    }
    
    // Confirm Password
    const confirm = AuthDOM.signupConfirm?.value || '';
    if (password !== confirm) {
        showError('confirmError');
        isValid = false;
    } else {
        hideError('confirmError');
    }
    
    // Date of Birth
    const dob = AuthDOM.signupDob?.value;
    if (dob) {
        const age = calculateAge(new Date(dob));
        if (age < 18) {
            showError('dobError');
            isValid = false;
        } else {
            hideError('dobError');
        }
    } else {
        showError('dobError');
        isValid = false;
    }
    
    // Gender
    const gender = AuthDOM.signupGender?.value;
    if (!gender) {
        showError('genderError');
        isValid = false;
    } else {
        hideError('genderError');
    }
    
    // Interests
    if (!selectedInterests || selectedInterests.length === 0) {
        showError('interestsError');
        isValid = false;
    } else {
        hideError('interestsError');
    }
    
    // Terms
    const terms = AuthDOM.signupTerms?.checked;
    if (!terms) {
        showError('termsError');
        isValid = false;
    } else {
        hideError('termsError');
    }
    
    return isValid;
}

/**
 * Calculate age from birth date
 */
function calculateAge(birthDate) {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

/**
 * Show form error
 */
function showError(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('visible');
    const parent = el?.closest('.form-group');
    if (parent) parent?.classList.add('has-error');
}

/**
 * Hide form error
 */
function hideError(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('visible');
    const parent = el?.closest('.form-group');
    if (parent) parent?.classList.remove('has-error');
    if (parent) parent?.classList.add('has-success');
}

// ============================================
// LOGOUT
// ============================================

/**
 * Handle logout
 */
async function handleLogout() {
    try {
        await API.logout();
    } catch (error) {
        // Ignore logout errors
    }
    
    clearAuth();
    
    // Close socket if exists
    if (window.App && App.socket) {
        App.socket.disconnect();
        App.socket = null;
    }
    
    showToast('🚪 Umefanikiwa kuingia nje!', 'success');
    
    // Redirect to landing page
    setTimeout(() => {
        window.location.href = '/';
    }, 500);
}

// ============================================
// PASSWORD RESET
// ============================================

/**
 * Request password reset
 */
async function requestPasswordReset(email) {
    if (!email) {
        showToast('❌ Tafadhali ingiza email yako.', 'error');
        return;
    }
    
    try {
        // This would call a backend endpoint to send reset email
        const result = await API.request('/auth/forgot-password', 'POST', { email });
        
        if (result.success) {
            showToast('📧 Email ya kuweka upya password imetumwa.', 'success');
        } else {
            showToast(result.error || 'Error sending reset email.', 'error');
        }
    } catch (error) {
        showToast('❌ Network error. Tafadhali jaribu tena.', 'error');
    }
}

/**
 * Reset password with token
 */
async function resetPassword(token, newPassword) {
    if (!token || !newPassword || newPassword.length < 8) {
        showToast('❌ Tafadhali ingiza password yenye herufi 8 au zaidi.', 'error');
        return;
    }
    
    try {
        const result = await API.request('/auth/reset-password', 'POST', {
            token,
            password: newPassword,
        });
        
        if (result.success) {
            showToast('✅ Password imebadilishwa!', 'success');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
        } else {
            showToast(result.error || 'Error resetting password.', 'error');
        }
    } catch (error) {
        showToast('❌ Network error. Tafadhali jaribu tena.', 'error');
    }
}

// ============================================
// ADMIN AUTH
// ============================================

/**
 * Check if user is admin
 */
function isAdmin() {
    return Auth.user?.is_admin === true;
}

/**
 * Admin login
 */
async function adminLogin(email, password) {
    if (!email || !password) {
        showToast('❌ Email na password zinahitajika.', 'error');
        return;
    }
    
    try {
        const result = await API.request('/admin/login', 'POST', { email, password });
        
        if (result.success) {
            saveAuth(result.token, result.admin, true);
            showToast('🔐 Admin login successful!', 'success');
            setTimeout(() => {
                window.location.href = '/admin.html';
            }, 1000);
        } else {
            showToast(result.error || 'Invalid admin credentials.', 'error');
        }
    } catch (error) {
        showToast('❌ Network error. Tafadhali jaribu tena.', 'error');
    }
}

// ============================================
// PASSWORD TOGGLE
// ============================================

/**
 * Toggle password visibility
 */
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        // Update button text
        const btn = document.querySelector(`[data-toggle="${inputId}"]`);
        if (btn) btn.textContent = '🙈';
    } else {
        input.type = 'password';
        const btn = document.querySelector(`[data-toggle="${inputId}"]`);
        if (btn) btn.textContent = '👁️';
    }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Check session and redirect if needed
 */
function requireAuth(redirectUrl = '/login.html') {
    if (!isLoggedIn()) {
        Auth.redirectUrl = window.location.pathname;
        localStorage.setItem('redirectUrl', Auth.redirectUrl);
        window.location.href = redirectUrl;
        return false;
    }
    return true;
}

/**
 * Check session and redirect if logged in
 */
function requireGuest(redirectUrl = '/') {
    if (isLoggedIn()) {
        window.location.href = redirectUrl;
        return false;
    }
    return true;
}

/**
 * Check admin access
 */
function requireAdmin(redirectUrl = '/') {
    if (!isLoggedIn()) {
        Auth.redirectUrl = window.location.pathname;
        localStorage.setItem('redirectUrl', Auth.redirectUrl);
        window.location.href = '/login.html';
        return false;
    }
    
    if (!isAdmin()) {
        showToast('❌ Admin access required.', 'error');
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 1000);
        return false;
    }
    
    return true;
}

// ============================================
// AUTO-LOGIN CHECK
// ============================================

/**
 * Check and refresh auth on page load
 */
async function checkAuthOnLoad() {
    if (loadAuth()) {
        // Validate token
        const valid = await validateToken();
        if (!valid) {
            clearAuth();
            return false;
        }
        
        // Initialize socket if available
        if (window.App && !App.socket) {
            initSocket();
        }
        
        return true;
    }
    return false;
}

// ============================================
// EVENT LISTENERS
// ============================================

// Login form
if (AuthDOM.loginForm) {
    AuthDOM.loginForm.addEventListener('submit', handleLogin);
}

// Signup form
if (AuthDOM.signupForm) {
    AuthDOM.signupForm.addEventListener('submit', handleSignup);
}

// Password toggle
document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', function() {
        const input = this.closest('.input-wrapper')?.querySelector('input');
        if (input) {
            if (input.type === 'password') {
                input.type = 'text';
                this.textContent = '🙈';
            } else {
                input.type = 'password';
                this.textContent = '👁️';
            }
        }
    });
});

// Enter key support for login
if (AuthDOM.loginPassword) {
    AuthDOM.loginPassword.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleLogin(e);
        }
    });
}

// Real-time validation for signup
if (AuthDOM.signupUsername) {
    let usernameTimeout;
    AuthDOM.signupUsername.addEventListener('input', function() {
        clearTimeout(usernameTimeout);
        const username = this.value.trim();
        if (username.length < 3) return;
        
        usernameTimeout = setTimeout(async () => {
            try {
                const result = await API.checkUsername(username);
                if (result.exists) {
                    showError('usernameError');
                    document.getElementById('usernameError').textContent = '❌ Username tayari imetumika.';
                } else {
                    hideError('usernameError');
                    document.getElementById('usernameError').textContent = 'Username inahitajika.';
                }
            } catch (error) {
                // Ignore network errors
            }
        }, 500);
    });
}

if (AuthDOM.signupEmail) {
    AuthDOM.signupEmail.addEventListener('input', function() {
        const email = this.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email && !emailRegex.test(email)) {
            showError('emailError');
            document.getElementById('emailError').textContent = '❌ Tafadhali ingiza email sahihi.';
        } else {
            hideError('emailError');
            document.getElementById('emailError').textContent = 'Tafadhali ingiza email sahihi.';
        }
    });
}

if (AuthDOM.signupConfirm) {
    AuthDOM.signupConfirm.addEventListener('input', function() {
        const password = AuthDOM.signupPassword?.value || '';
        if (this.value && this.value !== password) {
            showError('confirmError');
        } else {
            hideError('confirmError');
        }
    });
}

// ============================================
// EXPORTS
// ============================================

// Make functions globally available
window.Auth = Auth;
window.isLoggedIn = isLoggedIn;
window.getCurrentUser = getCurrentUser;
window.getToken = getToken;
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleLogout = handleLogout;
window.requireAuth = requireAuth;
window.requireGuest = requireGuest;
window.requireAdmin = requireAdmin;
window.checkAuthOnLoad = checkAuthOnLoad;
window.togglePasswordVisibility = togglePasswordVisibility;
window.requestPasswordReset = requestPasswordReset;
window.resetPassword = resetPassword;
window.adminLogin = adminLogin;
window.isAdmin = isAdmin;
window.validateToken = validateToken;
window.refreshToken = refreshToken;
