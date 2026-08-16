// ============================================
// JAVASCRIPT - PREMIUM.JS
// ============================================
// KAZI: Logic zote za premium system.
// Inashughulikia: View plans, Upgrade modal,
// Payment processing, Subscription status,
// Trial management, Renewals, Expiry checks.
// ============================================

// ============================================
// PREMIUM STATE
// ============================================

const Premium = {
    // User premium status
    isPremium: false,
    isTrial: false,
    trialDays: 0,
    trialRemaining: 0,
    premiumExpiresAt: null,
    
    // Plans
    plans: [],
    selectedPlan: null,
    
    // Payment
    paymentStatus: null,
    paymentOrderId: null,
    
    // Loading
    isLoading: false,
    isProcessing: false,
};

// ============================================
// DOM REFS (Premium specific)
// ============================================

const PremiumDOM = {
    // Premium container
    container: document.getElementById('premiumContainer'),
    
    // Plans
    plansGrid: document.querySelector('.plans-grid'),
    
    // Upgrade modal
    modal: document.getElementById('upgradeModal'),
    planOptions: document.getElementById('planOptions'),
    paymentPhone: document.getElementById('paymentPhone'),
    paymentStatus: document.getElementById('paymentStatus'),
    paymentMessage: document.getElementById('paymentMessage'),
    
    // Subscription status
    statusBadge: document.querySelector('.premium-status-badge'),
    statusText: document.querySelector('.premium-status-text'),
    expiryDate: document.querySelector('.premium-expiry'),
    daysRemaining: document.querySelector('.premium-days-remaining'),
    
    // Trial
    trialBadge: document.querySelector('.trial-badge'),
    trialCountdown: document.querySelector('.trial-countdown'),
};

// ============================================
// LOAD PREMIUM DATA
// ============================================

/**
 * Load premium data
 */
async function loadPremium() {
    if (Premium.isLoading) return;
    Premium.isLoading = true;
    
    if (PremiumDOM.container) {
        PremiumDOM.container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    }
    
    try {
        // Get user data and plans in parallel
        const [userResult, plansResult] = await Promise.all([
            API.getMe(),
            API.getPlans(),
        ]);
        
        if (!userResult.success) {
            showError('Imeshindwa kupakia data ya premium.');
            Premium.isLoading = false;
            return;
        }
        
        const user = userResult.user;
        Premium.isPremium = user.is_premium || false;
        Premium.isTrial = user.trial_active || false;
        Premium.premiumExpiresAt = user.premium_expires_at;
        
        if (user.trial_expires_at) {
            const trialExpires = user.trial_expires_at.toDate ? 
                user.trial_expires_at.toDate() : 
                new Date(user.trial_expires_at);
            Premium.trialRemaining = Math.ceil((trialExpires - new Date()) / (1000 * 60 * 60 * 24));
        }
        
        const plans = plansResult.success ? plansResult.plans : [];
        Premium.plans = plans;
        
        renderPremium(user, plans);
        
    } catch (error) {
        console.error('Load premium error:', error);
        showError('Imeshindwa kupakia data ya premium.');
    }
    
    Premium.isLoading = false;
}

// ============================================
// RENDER PREMIUM
// ============================================

/**
 * Render premium page
 */
function renderPremium(user, plans) {
    if (!PremiumDOM.container) return;
    
    const isPremium = user.is_premium;
    const isTrial = user.trial_active;
    const hasPremium = isPremium || isTrial;
    
    let html = `
        <div class="premium-status-section">
            <div class="premium-status-card ${isPremium ? 'premium' : isTrial ? 'trial' : 'free'}">
                <div class="status-icon">${isPremium ? '⭐' : isTrial ? '🎁' : '📄'}</div>
                <div class="status-title">${isPremium ? 'Premium Active' : isTrial ? 'Free Trial' : 'Free Account'}</div>
                ${isPremium && user.premium_expires_at ? `
                    <div class="status-expiry">Inaisha: ${formatDate(user.premium_expires_at)}</div>
                    <div class="status-days">Siku zilizobaki: ${calculateDaysRemaining(user.premium_expires_at)}</div>
                ` : ''}
                ${isTrial && user.trial_expires_at ? `
                    <div class="status-expiry">Trial inaisha: ${formatDate(user.trial_expires_at)}</div>
                    <div class="status-days">Siku zilizobaki: ${calculateDaysRemaining(user.trial_expires_at)}</div>
                ` : ''}
                ${!hasPremium ? `
                    <div class="status-desc">Upgrade kuwa Premium na upate features zote!</div>
                ` : ''}
                ${isPremium ? `
                    <button class="btn btn-primary" onclick="showRenewModal()">🔄 Renew Premium</button>
                ` : isTrial ? `
                    <button class="btn btn-primary" onclick="showUpgradeModal()">⭐ Upgrade to Premium</button>
                ` : `
                    <button class="btn btn-primary" onclick="showUpgradeModal()">⭐ Get Premium</button>
                `}
            </div>
        </div>
        <div class="premium-features-section">
            <h3>✨ Premium Features</h3>
            <div class="features-grid">
                <div class="feature-item ${hasPremium ? 'active' : 'locked'}">
                    <span class="feature-icon">${hasPremium ? '✅' : '🔒'}</span>
                    <span class="feature-name">Unlimited Messages</span>
                </div>
                <div class="feature-item ${hasPremium ? 'active' : 'locked'}">
                    <span class="feature-icon">${hasPremium ? '✅' : '🔒'}</span>
                    <span class="feature-name">Unlimited Matches</span>
                </div>
                <div class="feature-item ${hasPremium ? 'active' : 'locked'}">
                    <span class="feature-icon">${hasPremium ? '✅' : '🔒'}</span>
                    <span class="feature-name">Unlimited Likes</span>
                </div>
                <div class="feature-item ${hasPremium ? 'active' : 'locked'}">
                    <span class="feature-icon">${hasPremium ? '✅' : '🔒'}</span>
                    <span class="feature-name">Advanced Search</span>
                </div>
                <div class="feature-item ${hasPremium ? 'active' : 'locked'}">
                    <span class="feature-icon">${hasPremium ? '✅' : '🔒'}</span>
                    <span class="feature-name">Premium Badge</span>
                </div>
                <div class="feature-item ${hasPremium ? 'active' : 'locked'}">
                    <span class="feature-icon">${hasPremium ? '✅' : '🔒'}</span>
                    <span class="feature-name">Priority Matching</span>
                </div>
                <div class="feature-item ${hasPremium ? 'active' : 'locked'}">
                    <span class="feature-icon">${hasPremium ? '✅' : '🔒'}</span>
                    <span class="feature-name">Profile Boost</span>
                </div>
                <div class="feature-item ${hasPremium ? 'active' : 'locked'}">
                    <span class="feature-icon">${hasPremium ? '✅' : '🔒'}</span>
                    <span class="feature-name">VIP Support</span>
                </div>
            </div>
        </div>
        <div class="premium-plans-section">
            <h3>📦 Premium Plans</h3>
            <div class="plans-grid">
                ${plans.map((plan, index) => `
                    <div class="plan-card ${index === 1 ? 'popular' : ''} ${!plan.is_active ? 'inactive' : ''}">
                        <div class="plan-name">${plan.name}</div>
                        <div class="plan-price">TZS ${plan.price.toLocaleString()} <small>/${plan.duration_days} days</small></div>
                        <ul class="plan-features">
                            ${plan.features ? plan.features.map(f => `<li>${f}</li>`).join('') : `
                                <li>Unlimited Chat</li>
                                <li>Advanced Search</li>
                                <li>Premium Badge</li>
                            `}
                        </ul>
                        ${isPremium ? `
                            <button class="btn btn-success" disabled>✅ Already Premium</button>
                        ` : `
                            <button class="btn btn-primary" onclick="selectPlan('${plan.id}')">${isTrial ? '🎁 Upgrade After Trial' : '💳 Upgrade Now'}</button>
                        `}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    PremiumDOM.container.innerHTML = html;
}

// ============================================
// PLAN SELECTION
// ============================================

/**
 * Select a plan and show upgrade modal
 */
function selectPlan(planId) {
    const plan = Premium.plans.find(p => p.id === planId);
    if (!plan) {
        showToast('Plan not found', 'error');
        return;
    }
    
    Premium.selectedPlan = plan;
    showUpgradeModal(plan);
}

/**
 * Show upgrade modal
 */
function showUpgradeModal(plan) {
    if (!plan) {
        // If no plan selected, use first active plan
        plan = Premium.plans.find(p => p.is_active) || Premium.plans[0];
        Premium.selectedPlan = plan;
    }
    
    if (!plan) {
        showToast('No plans available', 'error');
        return;
    }
    
    // Show modal
    if (PremiumDOM.modal) {
        PremiumDOM.modal.style.display = 'flex';
        PremiumDOM.modal.classList.add('active');
    }
    
    // Show plan details
    if (PremiumDOM.planOptions) {
        PremiumDOM.planOptions.style.display = 'block';
        PremiumDOM.planOptions.innerHTML = `
            <div class="selected-plan" data-plan-id="${plan.id}">
                <div class="plan-name">${plan.name}</div>
                <div class="plan-price">TZS ${plan.price.toLocaleString()} - ${plan.duration_days} days</div>
                <div class="plan-features">
                    ${plan.features ? plan.features.join(' • ') : ''}
                </div>
            </div>
        `;
    }
    
    // Hide payment status
    if (PremiumDOM.paymentStatus) {
        PremiumDOM.paymentStatus.style.display = 'none';
    }
    
    // Clear phone input
    if (PremiumDOM.paymentPhone) {
        PremiumDOM.paymentPhone.value = '';
    }
}

/**
 * Show renew modal (for existing premium users)
 */
function showRenewModal() {
    // Use first active plan as default
    const plan = Premium.plans.find(p => p.is_active) || Premium.plans[0];
    if (plan) {
        showUpgradeModal(plan);
    } else {
        showToast('No renewal plans available', 'error');
    }
}

// ============================================
// PAYMENT PROCESSING
// ============================================

/**
 * Process payment
 */
async function processPayment() {
    const phone = PremiumDOM.paymentPhone?.value.trim() || '';
    
    if (!phone) {
        showToast('❌ Tafadhali ingiza namba ya simu.', 'error');
        return;
    }
    
    if (!Premium.selectedPlan) {
        showToast('❌ Tafadhali chagua plan.', 'error');
        return;
    }
    
    // Validate phone number (Tanzania format)
    const phoneRegex = /^(0|255)[67][0-9]{8}$/;
    if (!phoneRegex.test(phone)) {
        showToast('❌ Tafadhali ingiza namba sahihi ya simu (0712345678).', 'error');
        return;
    }
    
    // Show processing
    Premium.isProcessing = true;
    if (PremiumDOM.planOptions) PremiumDOM.planOptions.style.display = 'none';
    if (PremiumDOM.paymentStatus) {
        PremiumDOM.paymentStatus.style.display = 'block';
        PremiumDOM.paymentMessage.textContent = '⏳ Inathibitisha malipo yako kupitia HarakaPay...';
    }
    
    try {
        const result = await API.initiatePayment({
            plan_id: Premium.selectedPlan.id,
            phone: phone,
        });
        
        if (result.success) {
            Premium.paymentOrderId = result.order_id;
            Premium.paymentStatus = 'pending';
            
            // Start polling for status
            await pollPaymentStatus(result.order_id);
            
        } else if (result.status === 'pending') {
            PremiumDOM.paymentMessage.textContent = '⏳ Payment Pending. Tunasubiri uthibitisho wa malipo.';
            // Poll for status
            await pollPaymentStatus(result.order_id);
            
        } else {
            PremiumDOM.paymentMessage.textContent = `❌ Payment Failed: ${result.error || 'Jaribu tena.'}`;
            showToast('❌ Payment failed. Jaribu tena.', 'error');
            resetPaymentUI();
        }
        
    } catch (error) {
        console.error('Payment error:', error);
        PremiumDOM.paymentMessage.textContent = '❌ Payment Failed. Jaribu tena.';
        showToast('❌ Payment failed.', 'error');
        resetPaymentUI();
    }
}

/**
 * Poll payment status
 */
async function pollPaymentStatus(orderId, attempts = 0) {
    const maxAttempts = 30; // 30 * 5 seconds = 2.5 minutes
    const interval = 5000; // 5 seconds
    
    if (attempts >= maxAttempts) {
        PremiumDOM.paymentMessage.textContent = '⏳ Payment is taking longer than expected. Please check your phone for confirmation.';
        resetPaymentUI();
        return;
    }
    
    try {
        const result = await API.getPaymentStatus(orderId);
        
        if (result.success) {
            const status = result.status;
            
            if (status === 'completed' || status === 'converted') {
                // Payment successful!
                PremiumDOM.paymentMessage.textContent = '✅ PAYMENT SUCCESSFUL! Hongera! Akaunti yako sasa ni PREMIUM. 🎉';
                showToast('🎉 Umefanikiwa kuwa Premium!', 'success');
                
                // Reload premium data
                setTimeout(() => {
                    closeModal('upgradeModal');
                    loadPremium();
                    if (window.loadProfile) window.loadProfile();
                }, 2000);
                
                resetPaymentUI();
                return;
                
            } else if (status === 'failed' || status === 'cancelled' || status === 'expired') {
                PremiumDOM.paymentMessage.textContent = `❌ Payment ${status}. Jaribu tena.`;
                showToast(`❌ Payment ${status}.`, 'error');
                resetPaymentUI();
                return;
                
            } else {
                // Still pending
                PremiumDOM.paymentMessage.textContent = `⏳ Inathibitisha malipo... (${attempts + 1}/${maxAttempts})`;
                
                // Continue polling
                setTimeout(() => {
                    pollPaymentStatus(orderId, attempts + 1);
                }, interval);
            }
        } else {
            // Error checking status
            setTimeout(() => {
                pollPaymentStatus(orderId, attempts + 1);
            }, interval);
        }
        
    } catch (error) {
        console.error('Poll payment status error:', error);
        setTimeout(() => {
            pollPaymentStatus(orderId, attempts + 1);
        }, interval);
    }
}

/**
 * Reset payment UI
 */
function resetPaymentUI() {
    Premium.isProcessing = false;
    
    if (PremiumDOM.planOptions) {
        PremiumDOM.planOptions.style.display = 'block';
    }
    
    // Add retry button
    if (PremiumDOM.paymentStatus) {
        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn btn-primary';
        retryBtn.textContent = '🔄 Jaribu Tena';
        retryBtn.style.marginTop = '15px';
        retryBtn.onclick = () => {
            if (PremiumDOM.paymentStatus) {
                PremiumDOM.paymentStatus.style.display = 'none';
                PremiumDOM.planOptions.style.display = 'block';
                retryBtn.remove();
            }
        };
        PremiumDOM.paymentStatus.appendChild(retryBtn);
    }
}

// ============================================
// MODAL HELPERS
// ============================================

/**
 * Close modal
 */
function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    resetPaymentUI();
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
 * Calculate days remaining
 */
function calculateDaysRemaining(timestamp) {
    if (!timestamp) return 0;
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = date - now;
    
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Show error
 */
function showError(message) {
    if (PremiumDOM.container) {
        PremiumDOM.container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <h3>Error</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="loadPremium()" style="margin-top:15px;">
                    🔄 Jaribu Tena
                </button>
            </div>
        `;
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

// Payment phone input - format
if (PremiumDOM.paymentPhone) {
    PremiumDOM.paymentPhone.addEventListener('input', function() {
        // Remove non-digits
        this.value = this.value.replace(/\D/g, '');
        // Limit to 10 digits
        if (this.value.length > 10) {
            this.value = this.value.slice(0, 10);
        }
    });
}

// Enter key on phone input
if (PremiumDOM.paymentPhone) {
    PremiumDOM.paymentPhone.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            processPayment();
        }
    });
}

// ============================================
// EXPORTS
// ============================================

window.Premium = Premium;
window.loadPremium = loadPremium;
window.selectPlan = selectPlan;
window.showUpgradeModal = showUpgradeModal;
window.showRenewModal = showRenewModal;
window.processPayment = processPayment;
window.closeModal = closeModal;
