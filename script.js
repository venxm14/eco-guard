// ===============================
// Goa Eco-Guard - Final Script
// ===============================

const API_BASE =
    window.__API_BASE__ ||
    document.querySelector('meta[name="api-base"]')?.content ||
    ((location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:')
        ? 'http://localhost:3000'
        : location.origin);

/**
 * Premium Toast Notifications
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container') || (() => {
        const c = document.createElement('div');
        c.id = 'toast-container';
        document.body.appendChild(c);
        return c;
    })();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">${type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️')}</span>
            <span class="toast-msg">${message}</span>
        </div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 500);
    }, 3500);
}

function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    const secure = location.protocol === 'https:' ? '; secure' : '';
    document.cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; samesite=lax' + secure;
}

function getCookie(name) {
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    for (let i = 0; i < cookies.length; i++) {
        const parts = cookies[i].split('=');
        const key = decodeURIComponent(parts.shift());
        if (key === name) return decodeURIComponent(parts.join('='));
    }
    return null;
}

function eraseCookie(name) {
    const secure = location.protocol === 'https:' ? '; secure' : '';
    document.cookie = encodeURIComponent(name) + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; samesite=lax' + secure;
}

// ---------- Dark mode support (also used by login/theme.js) ----------
(function() {
    const themeToggle = document.getElementById('themeToggle');
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark');
        if (themeToggle) themeToggle.innerText = '☀️ Light';
    }
    themeToggle?.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        if (document.body.classList.contains('dark')) {
            localStorage.setItem('theme', 'dark');
            if (themeToggle) themeToggle.innerText = '☀️ Light';
        } else {
            localStorage.setItem('theme', 'light');
            if (themeToggle) themeToggle.innerText = '🌙 Dark';
        }
    });
})();

/* ===============================
   JOINED MISSIONS (localStorage — per user)
================================ */
function _getJoinedKey() {
    try {
        const u = JSON.parse(localStorage.getItem('ecoUser') || '{}');
        if (u && u.id) return 'ecoguard_joined_' + u.id;
    } catch {}
    return null;
}

function getJoinedMissions() {
    const key = _getJoinedKey();
    if (!key) return [];
    try {
        const ls = localStorage.getItem(key);
        return ls ? JSON.parse(ls) : [];
    } catch { return []; }
}

function markMissionJoined(missionId) {
    const key = _getJoinedKey();
    if (!key) return;
    const joined = getJoinedMissions();
    if (!joined.includes(String(missionId))) {
        joined.push(String(missionId));
        localStorage.setItem(key, JSON.stringify(joined));
    }
}

/**
 * Resolve an image field from the DB to a usable <img> src.
 */
function resolveImageUrl(image) {
    if (!image) return null;
    return image.startsWith('http') ? image : `${API_BASE}/uploads/${encodeURIComponent(image)}`;
}

/* ===============================
   AUTH MANAGER
================================ */
class AuthManager {
    constructor() {
        const lsToken = localStorage.getItem('ecoToken');
        const lsUser = localStorage.getItem('ecoUser');
        const ckToken = getCookie('ecoToken');
        const ckUser = getCookie('ecoUser');
        let userObj = null;
        if (lsUser) {
            try { userObj = JSON.parse(lsUser); } catch { userObj = null; }
        } else if (ckUser) {
            try { userObj = JSON.parse(ckUser); } catch { userObj = null; }
        }
        this.token = lsToken || ckToken || null;
        this.user = userObj;
        if (!lsToken && ckToken) localStorage.setItem('ecoToken', ckToken);
        if (!lsUser && ckUser) localStorage.setItem('ecoUser', ckUser);
    }

    isAuthenticated() {
        return !!this.token && !!this.user;
    }

    isAdmin() {
        return this.user?.role === 'admin';
    }

    getAuthHeader() {
        return this.token ? { Authorization: `Bearer ${this.token}` } : {};
    }
    // In AuthManager class, add these methods

async fetchUserLikes() {
    if (!this.isAuthenticated()) return {};
    
    try {
        const res = await this.apiFetch('/api/social/user-likes');
        const data = await res.json();
        
        if (data.success) {
            // Store in localStorage for persistence
            localStorage.setItem('ecoUserLikes', JSON.stringify(data.liked_items));
            return data.liked_items;
        }
        return {};
    } catch (err) {
        console.error('Error fetching user likes:', err);
        // Fallback to localStorage if API fails
        const cached = localStorage.getItem('ecoUserLikes');
        return cached ? JSON.parse(cached) : {};
    }
}

getUserLikes() {
    const cached = localStorage.getItem('ecoUserLikes');
    return cached ? JSON.parse(cached) : {};
}

updateUserLikes(itemId, itemType, isLiked) {
    const likes = this.getUserLikes();
    const key = `${itemType}_${itemId}`;
    
    if (isLiked) {
        likes[key] = true;
    } else {
        delete likes[key];
    }
    
    localStorage.setItem('ecoUserLikes', JSON.stringify(likes));
}
    async apiFetch(endpoint, options = {}) {
        const headers = {
            ...options.headers,
            ...this.getAuthHeader()
        };

        const res = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });

        if (res.status === 401 || res.status === 403) {
            console.warn(`[Auth] Session expired or invalid token (Status ${res.status}). Logging out...`);
            alert("Your session has expired. Please log in again.");
            this.logout();
            throw new Error("Session expired");
        }

        return res;
    }

    async login(email, password) {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');

        this.token = data.token;
        this.user = data.user;

        localStorage.setItem('ecoToken', data.token);
        localStorage.setItem('ecoUser', JSON.stringify(data.user));
        setCookie('ecoToken', data.token, 30);
        setCookie('ecoUser', JSON.stringify(data.user), 30);

        return data;
    }

    updateUser(userData) {
        this.user = { ...this.user, ...userData };
        localStorage.setItem('ecoUser', JSON.stringify(this.user));
        setCookie('ecoUser', JSON.stringify(this.user), 30);
    }

    async register(payload) {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');

        this.token = data.token;
        this.user = data.user;

        localStorage.setItem('ecoToken', data.token);
        localStorage.setItem('ecoUser', JSON.stringify(data.user));
        setCookie('ecoToken', data.token, 30);
        setCookie('ecoUser', JSON.stringify(data.user), 30);

        return data;
    }

    logout() {
        localStorage.removeItem('ecoToken');
        localStorage.removeItem('ecoUser');
        eraseCookie('ecoToken');
        eraseCookie('ecoUser');
        window.location.reload();
    }
}

/* ===============================
   MAIN APPLICATION
================================ */
class GoaEcoGuard {
    constructor() {
        this.auth = new AuthManager();
        this.map = null;
        this.markerLayers = {};
        this.allHotspots = [];
        this.hotspotsGrouped = {};
        this.markersByLocation = {};
        this.handleProfileItemClick = this.handleProfileItemClick.bind(this);
        this.init();
    }

    init() {
        this.initEventListeners();
        this.checkAuthState();
        this.loadAllData();
        this.testBackendConnection();
        this.initIntersectionObserver();
        this.initNavbarScroll();
        this.initViewOnMapButtons();
        this.initLeafParticles();
        this.initSettingsHandlers();
        this.showToast('Welcome to Goa Eco-Guard!', 'success');
    }

    // Add this method to the GoaEcoGuard class

attachCommentReplyListeners() {
    // Toggle reply section
    document.querySelectorAll('.reply-toggle-btn').forEach(btn => {
        // Remove existing listeners to prevent duplicates
        btn.removeEventListener('click', this.handleReplyToggle);
        
        this.handleReplyToggle = (e) => {
            const commentId = e.target.dataset.commentId;
            const replySection = document.querySelector(`.reply-section-${commentId}`);
            if (replySection) {
                const isVisible = replySection.style.display !== 'none';
                replySection.style.display = isVisible ? 'none' : 'block';
                if (!isVisible) {
                    // Focus the input when opened
                    setTimeout(() => {
                        document.querySelector(`.reply-input-${commentId}`)?.focus();
                    }, 100);
                }
            }
        };
        
        btn.addEventListener('click', this.handleReplyToggle);
    });
    
    // Cancel reply
    document.querySelectorAll('.cancel-reply-btn').forEach(btn => {
        btn.removeEventListener('click', this.handleCancelReply);
        
        this.handleCancelReply = (e) => {
            const commentId = e.target.dataset.commentId;
            const replySection = document.querySelector(`.reply-section-${commentId}`);
            const replyInput = document.querySelector(`.reply-input-${commentId}`);
            if (replySection) {
                replySection.style.display = 'none';
            }
            if (replyInput) {
                replyInput.value = '';
            }
        };
        
        btn.addEventListener('click', this.handleCancelReply);
    });
    
    // Send reply
    document.querySelectorAll('.send-reply-btn').forEach(btn => {
        btn.removeEventListener('click', this.handleSendReply);
        
        this.handleSendReply = async (e) => {
            const btn = e.target;
            const commentId = btn.dataset.commentId;
            const targetId = btn.dataset.targetId;
            const targetType = btn.dataset.targetType;
            const replyInput = document.querySelector(`.reply-input-${commentId}`);
            
            if (!replyInput) return;
            
            const replyText = replyInput.value.trim();
            if (!replyText) {
                this.showToast('Please enter a reply', 'error');
                return;
            }
            
            if (!this.auth.isAuthenticated()) {
                this.showToast('Please login to reply', 'error');
                return;
            }
            
            try {
                // Show loading state
                btn.disabled = true;
                btn.innerHTML = 'Sending...';
                
                // Post the reply as a comment
                const res = await this.auth.apiFetch('/api/social/comment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        item_id: targetId, 
                        item_type: targetType, 
                        text: replyText,
                        parent_id: commentId // Optional: if you want threading
                    })
                });
                
                const data = await res.json();
                
                if (data.success) {
                    this.showToast('Reply sent! 💬', 'success');
                    
                    // Clear and hide the reply section
                    replyInput.value = '';
                    const replySection = document.querySelector(`.reply-section-${commentId}`);
                    if (replySection) {
                        replySection.style.display = 'none';
                    }
                    
                    // Refresh comments after a short delay
                    setTimeout(() => {
                        this.fetchDashboardComments();
                    }, 500);
                } else {
                    throw new Error(data.error || 'Failed to send reply');
                }
            } catch (err) {
                console.error('Reply error:', err);
                this.showToast(err.message || 'Failed to send reply', 'error');
            } finally {
                // Reset button state
                btn.disabled = false;
                btn.innerHTML = 'Send';
            }
        };
        
        btn.addEventListener('click', this.handleSendReply);
    });
    
    // Allow Enter key to send
    document.querySelectorAll('[class^="reply-input-"]').forEach(input => {
        input.removeEventListener('keypress', this.handleReplyKeypress);
        
        this.handleReplyKeypress = (e) => {
            if (e.key === 'Enter') {
                const commentId = e.target.dataset.commentId;
                const sendBtn = document.querySelector(`.send-reply-btn[data-comment-id="${commentId}"]`);
                if (sendBtn) {
                    sendBtn.click();
                }
            }
        };
        
        input.addEventListener('keypress', this.handleReplyKeypress);
    });
}
    /* ---------- PROFILE SCROLLING METHODS ---------- */
    
    attachProfileClickListeners() {
        const modalContent = document.querySelector('#settingsModal .modal-content');
        if (!modalContent) {
            console.log('⚠️ Modal content not ready yet');
            return false;
        }
        
        modalContent.removeEventListener('click', this.handleProfileItemClick);
        modalContent.addEventListener('click', this.handleProfileItemClick);
        console.log('✅ Profile click listeners attached');
        return true;
    }

    handleProfileItemClick = (e) => {
        const item = e.target.closest('.profile-clickable-item');
        if (!item) return;
        
        const itemType = item.dataset.profileItem;
        const itemId = item.dataset.itemId;
        const parentType = item.dataset.parentType;
        
        if (!itemType || !itemId) return;
        
        console.log(`🔍 Profile item clicked: ${itemType} - ${itemId}`, parentType);
        
        this.closeModal();
        
        setTimeout(() => {
            switch(itemType) {
                case 'reports':
                    this.scrollToReport(itemId);
                    break;
                case 'sightings':
                    this.scrollToSighting(itemId);
                    break;
                case 'stories':
                    this.scrollToStory(itemId);
                    break;
                case 'missions':
                    this.scrollToMission(itemId);
                    break;
                case 'comments':
                    this.scrollToComment(itemId, parentType);
                    break;
                default:
                    console.log('Unknown item type:', itemType);
            }
        }, 300);
    };

// Update the scrollToComment method

scrollToComment(itemId, parentType) {
    console.log('💬 Scrolling to comment on:', parentType, itemId);
    
    if (parentType === 'report') {
        this.scrollToReport(itemId);
    } else if (parentType === 'sighting') {
        this.scrollToSighting(itemId);
    } else if (parentType === 'story') {
        this.scrollToStory(itemId);
    } else {
        this.scrollToSection('eco-reporting');
    }
    
    setTimeout(() => {
        const commentsSection = document.getElementById(`comments-${itemId}`);
        if (commentsSection) {
            commentsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            this.highlightElement(commentsSection);
            
            const commentBtn = document.querySelector(`.comment-btn[onclick*="${itemId}"]`);
            if (commentBtn && !commentsSection.classList.contains('active')) {
                commentBtn.click();
            }
        } else {
            // If no comments section found, try to find and highlight the comment in profile
            const profileComment = document.querySelector(`.profile-comment-item[data-comment-id="${itemId}"]`);
            if (profileComment) {
                profileComment.scrollIntoView({ behavior: 'smooth', block: 'center' });
                this.highlightElement(profileComment);
                
                // Auto-open the reply section for this comment
                setTimeout(() => {
                    const replyToggle = document.querySelector(`.reply-toggle-btn[data-comment-id="${itemId}"]`);
                    if (replyToggle) {
                        replyToggle.click();
                    }
                }, 500);
            }
        }
    }, 800);
}

    scrollToReport(reportId) {
        console.log('📋 Scrolling to report:', reportId);
        this.scrollToSection('eco-reporting');
        
        setTimeout(() => {
            const reportCard = document.querySelector(`.report-card[data-report-id="${reportId}"]`);
            if (reportCard) {
                reportCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                this.highlightElement(reportCard);
            } else {
                this.switchFeed('reports');
            }
        }, 500);
    }

    scrollToSighting(sightingId) {
        console.log('🦎 Scrolling to sighting:', sightingId);
        this.scrollToSection('nf-sightings');
        
        setTimeout(() => {
            const sightingItem = document.querySelector(`.nf-sighting-item[data-sighting-id="${sightingId}"]`);
            if (sightingItem) {
                sightingItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                this.highlightElement(sightingItem);
            }
        }, 500);
    }

    scrollToStory(storyId) {
        console.log('📖 Scrolling to story:', storyId);
        this.scrollToSection('nf-stories');
        
        setTimeout(() => {
            const storyCard = document.querySelector(`.nf-story-card[data-story-id="${storyId}"]`);
            if (storyCard) {
                storyCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                this.highlightElement(storyCard);
            } else {
                this.scrollToSection('eco-reporting');
                setTimeout(() => {
                    const feedStory = document.querySelector(`#storiesFeed .nf-story-card[data-story-id="${storyId}"]`);
                    if (feedStory) {
                        feedStory.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        this.highlightElement(feedStory);
                    }
                }, 500);
            }
        }, 500);
    }

    scrollToMission(missionId) {
        console.log('🎯 Scrolling to mission:', missionId);
        this.scrollToSection('volunteer');
        
        setTimeout(() => {
            const missionBtn = document.querySelector(`.join-mission-btn[data-mission-id="${missionId}"]`);
            if (missionBtn) {
                const missionCard = missionBtn.closest('.mission-card');
                if (missionCard) {
                    missionCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    this.highlightElement(missionCard);
                }
            }
        }, 500);
    }

    highlightElement(element) {
        element.classList.add('profile-highlight');
        setTimeout(() => {
            element.classList.remove('profile-highlight');
        }, 2000);
    }
    // Add this helper method to refresh comments

    refreshComments() {
        if (document.getElementById('settingsModal')?.classList.contains('active')) {
            this.fetchDashboardComments();
        }
    }

    /* ---------- TEST BACKEND ---------- */
    async testBackendConnection() {
        try {
            console.log('Testing backend connection to:', API_BASE);
            const response = await fetch(`${API_BASE}/api/health`, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache'
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Backend is reachable:', data);
                return true;
            } else {
                console.error('❌ Backend responded with error:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ Cannot connect to backend:', error.message);
            return false;
        }
    }

    getMarkerIcon(status) {
        const colors = {
            pending: '#f97316',
            approved: '#2563eb',
            resolved: '#16a34a',
            rejected: '#dc2626'
        };

        return L.divIcon({
            className: '',
            html: `
                <div style="
                    width:18px;
                    height:18px;
                    background:${colors[status] || '#6b7280'};
                    border-radius:50%;
                    border:3px solid white;
                    box-shadow:0 0 6px rgba(0,0,0,0.4);
                "></div>
            `,
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });
    }

    /* ---------- NAVBAR SCROLL ---------- */
    initNavbarScroll() {
        const header = document.querySelector('.header');
        if (!header) return;

        let lastScrollY = 0;

        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
            lastScrollY = currentScrollY;
        });
    }

    /* ---------- AUTH UI ---------- */
    checkAuthState() {
        this.auth.isAuthenticated()
            ? this.updateUIForUser()
            : this.updateUIForGuest();
    }

    updateUIForUser() {
        document.querySelector('.auth-buttons')?.remove();

        const menu = document.createElement('div');
        menu.className = 'user-menu';
        menu.innerHTML = `
            <div class="user-dropdown">
                <button class="user-btn">${this.auth.user.name.split(' ')[0]}</button>
                <div class="dropdown-content">
                    <a href="#" id="logoutBtn">Logout</a>
                </div>
            </div>
        `;
        document.querySelector('.header-content')?.appendChild(menu);
    }

    updateUIForGuest() {
        if (document.querySelector('.auth-buttons')) return;

        const cta = document.querySelector('.header-cta');
        cta.innerHTML = `
            <div class="auth-buttons">
                <button class="btn btn-outline btn-sm" id="loginBtn">Login</button>
                <button class="btn btn-primary btn-sm" id="signupBtn">Sign Up</button>
            </div>
        `;
    }

    /* ---------- EVENTS ---------- */
    initEventListeners() {
        document.addEventListener('click', async (e) => {
            const section = e.target.closest('[data-section]');
            if (section) {
                const sectionId = section.getAttribute('data-section');
                this.scrollToSection(sectionId);
                document.getElementById('mobileNav')?.classList.remove('active');
                document.getElementById('mobileMenuBtn')?.classList.remove('active');
                document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
                e.target.closest('.nav-link')?.classList.add('active');
                return;
            }

            if (e.target.id === 'loginBtn') {
                window.location.href = 'login/login.html';
                return;
            }
            if (e.target.id === 'signupBtn') {
                window.location.href = 'login/signup.html';
                return;
            }

            if (e.target.id === 'getLocationBtn' || e.target.closest('#getLocationBtn')) {
                e.preventDefault();
                this.getCurrentLocation();
                return;
            }

            if (e.target.id === 'logoutBtn') this.auth.logout();

            if (e.target.id === 'mobileMenuBtn' || e.target.closest('#mobileMenuBtn')) {
                const mobileNav = document.getElementById('mobileNav');
                const menuBtn = document.getElementById('mobileMenuBtn');
                mobileNav?.classList.toggle('active');
                menuBtn?.classList.toggle('active');
                return;
            }

            if (e.target.classList.contains('modal-close') || e.target.classList.contains('close') || e.target.classList.contains('close-modal') || e.target.id === 'closeJoin') {
                document.querySelectorAll('.modal.active, .modal.closing').forEach(m => {
                    m.classList.remove('active');
                    m.classList.add('closing');
                    setTimeout(() => {
                        m.classList.remove('closing');
                        m.classList.add('hidden');
                        m.style.display = '';
                    }, 250);
                });
                return;
            }

            if (e.target.classList.contains('join-mission-btn')) {
                const missionId = e.target.dataset.missionId;
                this.openMissionModal(missionId);
                return;
            }

            if (e.target.id === 'confirmJoinBtn') {
                const missionId = e.target.dataset.missionId;
                this.showJoinForm(missionId);
                return;
            }

            if (e.target.closest('#joinForm')) {
                e.preventDefault();
                this.handleJoinMission(e);
                return;
            }

            if (e.target.classList.contains('know-more-btn') || e.target.closest('.know-more-btn')) {
                const btn = e.target.closest('.know-more-btn') || e.target;
                const spotId = btn.dataset.spotId;
                if (spotId) {
                    this.openEcoSpotModal(parseInt(spotId));
                }
                return;
            }

            if (e.target.classList.contains('filter-btn')) {
                const filterBtn = e.target;
                const filter = filterBtn.dataset.filter;

                document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                filterBtn.classList.add('active');

                this.renderMarkers();
                this.renderHotspotCards();

                if (this.map && this.hotspotsGrouped) {
                    setTimeout(() => {
                        const filteredHotspots = Object.values(this.hotspotsGrouped).filter(h =>
                            filter === 'all' || h.severity === filter
                        );

                        if (filteredHotspots.length > 0) {
                            const bounds = L.latLngBounds();
                            filteredHotspots.forEach(h => {
                                bounds.extend([h.lat, h.lng]);
                            });
                            this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
                        }
                    }, 100);
                }
                return;
            }

            if (e.target.id === 'galleryBtn' || e.target.closest('#galleryBtn')) {
                const img = document.getElementById('image');
                if (img) img.click();
                return;
            }

            if (e.target.id === 'cameraBtn' || e.target.closest('#cameraBtn')) {
                const img = document.getElementById('image');
                if (!img) return;
                const cameraAvailable = await this.hasCamera();
                if (!cameraAvailable) {
                    this.showToast('No camera detected, please choose from gallery', 'error');
                    img.click();
                    return;
                }
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    try {
                        const file = await this.openCameraCapture();
                        if (file) {
                            const dt = new DataTransfer();
                            dt.items.add(file);
                            img.files = dt.files;
                            if (typeof previewImage === 'function') {
                                previewImage(img);
                            } else if (window.app && typeof window.app.previewImageFromCamera === 'function') {
                                window.app.previewImageFromCamera(file);
                            }
                        }
                    } catch (err) {
                        console.warn('camera capture error', err);
                        img.click();
                    }
                } else {
                    const cameraInput = document.createElement('input');
                    cameraInput.type = 'file';
                    cameraInput.accept = 'image/*';
                    cameraInput.capture = 'environment';
                    cameraInput.style.display = 'none';
                    cameraInput.addEventListener('change', (ev) => {
                        if (ev.target.files && ev.target.files[0]) {
                            const dt = new DataTransfer();
                            dt.items.add(ev.target.files[0]);
                            img.files = dt.files;
                            if (typeof previewImage === 'function') {
                                previewImage(img);
                            } else if (window.app && typeof window.app.previewImageFromCamera === 'function') {
                                window.app.previewImageFromCamera(ev.target.files[0]);
                            }
                        }
                    });
                    document.body.appendChild(cameraInput);
                    cameraInput.click();
                    document.body.removeChild(cameraInput);
                }
                return;
            }
        });

        document.getElementById('loginForm')?.addEventListener('submit', e => this.handleLogin(e));
        document.getElementById('signupForm')?.addEventListener('submit', e => this.handleSignup(e));
        document.getElementById('reportingForm')?.addEventListener('submit', e => this.submitReport(e));

        const locationInput = document.getElementById('location');
        const getLocationBtn = document.getElementById('getLocationBtn');
        if (locationInput) {
            let debounceTimer;
            locationInput.addEventListener('input', () => {
                if (locationInput.value.length > 3) {
                    getLocationBtn.style.display = 'none';
                } else if (locationInput.value.length === 0) {
                    getLocationBtn.style.display = 'block';
                }

                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => this.searchLocation(locationInput.value), 800);
            });
        }
    }

    scrollToSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (!section) return;

        const headerOffset = 80;
        const targetPosition = section.getBoundingClientRect().top + window.pageYOffset - headerOffset;
        const startPosition = window.pageYOffset;
        const distance = targetPosition - startPosition;
        const duration = 800;
        let startTime = null;

        function ease(t) {
            return t < 0.5
                ? 4 * t * t * t
                : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }

        function animateScroll(currentTime) {
            if (!startTime) startTime = currentTime;
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            window.scrollTo(0, startPosition + distance * ease(progress));

            if (progress < 1) {
                requestAnimationFrame(animateScroll);
            }
        }

        requestAnimationFrame(animateScroll);
    }

    async hasCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            return false;
        }
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.some(d => d.kind === 'videoinput');
        } catch (err) {
            console.warn('Camera detection failed', err);
            return false;
        }
    }

    openCameraCapture() {
        return new Promise(async (resolve, reject) => {
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
            } catch (err) {
                reject(err);
                return;
            }

            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.background = 'rgba(0,0,0,0.8)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.zIndex = '10000';

            const container = document.createElement('div');
            container.style.position = 'relative';
            container.style.maxWidth = '90%';
            container.style.maxHeight = '90%';

            const video = document.createElement('video');
            video.autoplay = true;
            video.srcObject = stream;
            video.style.maxWidth = '100%';
            video.style.maxHeight = '100%';
            container.appendChild(video);

            const captureBtn = document.createElement('button');
            captureBtn.textContent = '📸 Capture';
            captureBtn.style.position = 'absolute';
            captureBtn.style.bottom = '10px';
            captureBtn.style.left = '50%';
            captureBtn.style.transform = 'translateX(-50%)';
            captureBtn.className = 'btn btn-primary';
            container.appendChild(captureBtn);

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = '✖';
            cancelBtn.style.position = 'absolute';
            cancelBtn.style.top = '10px';
            cancelBtn.style.right = '10px';
            cancelBtn.className = 'btn btn-outline';
            container.appendChild(cancelBtn);

            overlay.appendChild(container);
            document.body.appendChild(overlay);

            const cleanup = () => {
                stream.getTracks().forEach(t => t.stop());
                document.body.removeChild(overlay);
            };

            captureBtn.addEventListener('click', () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0);
                canvas.toBlob(blob => {
                    if (blob) {
                        const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
                        cleanup();
                        resolve(file);
                    } else {
                        cleanup();
                        reject(new Error('Failed to capture image'));
                    }
                }, 'image/jpeg');
            });

            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(null);
            });
        });
    }

    /* ---------- AUTH HANDLERS ---------- */
    async handleLogin(e) {
        e.preventDefault();

        const email = loginEmail.value;
        const password = loginPassword.value;

        try {
            const result = await this.auth.login(email, password);

            if (result.user.role === 'admin') {
                window.location.href = 'admin/admin.html';
                return;
            }

            this.closeModal();
            this.checkAuthState();
            this.loadAllData();
            this.showToast('Login successful!', 'success');

        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    async handleSignup(e) {
        e.preventDefault();

        if (signupPassword.value !== confirmPassword.value) {
            this.showToast('Passwords do not match', 'error');
            return;
        }

        try {
            await this.auth.register({
                name: signupName.value,
                email: signupEmail.value,
                phone: signupPhone.value,
                password: signupPassword.value
            });

            this.closeModal();
            this.checkAuthState();
            this.showToast('Account created!', 'success');

        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    /* ---------- DATA LOADING ---------- */
    loadAllData() {
        this.loadReports();
        this.loadHotspots();
        this.loadMissions();
        this.loadLeaderboard();
        this.loadPolicies();
        this.loadExperiences();
        this.loadEcoSpots();
    }

    async fetchJSON(endpoint, auth = false) {
        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                headers: auth ? this.auth.getAuthHeader() : {}
            });
            if (!res.ok) {
                console.warn(`API ${endpoint} returned status ${res.status}`);
                return [];
            }
            const data = await res.json();
            if (data === null || data === undefined) {
                return [];
            }
            return Array.isArray(data) ? data : (data || []);
        } catch (err) {
            console.error(`Error fetching ${endpoint}:`, err);
            return [];
        }
    }

    /* ---------- REPORTS ---------- */
    async loadReports() {
        try {
            this.reports = await this.fetchJSON('/api/reports');
            if (!Array.isArray(this.reports)) {
                this.reports = [];
            }
            this.renderReports();
        } catch (err) {
            console.error('Error loading reports:', err);
            this.reports = [];
            this.renderReports();
        }
    }

    async submitReport(e) {
        e.preventDefault();
        if (!this.auth.isAuthenticated()) {
            window.location.href = 'login/login.html';
            return;
        }

        const formData = new FormData(e.target);
        const lat = formData.get('latitude');
        const lng = formData.get('longitude');

        if (!lat || !lng) {
            this.showToast('Please use current location before submitting', 'error');
            return;
        }

        try {
            const res = await this.auth.apiFetch('/api/report', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.type === 'duplicate_report') {
                    this.showToast('⚠️ Duplicate report: This issue has already been reported at this location.', 'error');
                    const imageInput = document.getElementById('image');
                    if (imageInput) imageInput.value = '';
                    document.getElementById('imagePreview').innerHTML = '';
                    document.getElementById('imagePreview').style.display = 'none';
                    document.getElementById('uploadArea').style.display = 'flex';
                    document.getElementById('description').value = '';
                    return;
                }

                if (data.type === 'sensitive_content') {
                    this.showSensitiveContentAlert();
                    const imageInput = document.getElementById('image');
                    if (imageInput) imageInput.value = '';
                    document.getElementById('imagePreview').innerHTML = '';
                    document.getElementById('imagePreview').style.display = 'none';
                    document.getElementById('uploadArea').style.display = 'flex';
                    return;
                }

                throw new Error(data.error || 'Failed to submit report');
            }

            this.showToast('✅ Report submitted and auto-approved by AI! (Admin can reject)', 'success');
            e.target.reset();
            document.getElementById('locationStatus').style.display = 'none';
            document.getElementById('imagePreview').innerHTML = '';
            document.getElementById('imagePreview').style.display = 'none';
            document.getElementById('uploadArea').style.display = 'flex';

            this.loadReports();
            this.loadHotspots();
        } catch (err) {
            this.showToast(err.message || 'Failed to submit report', 'error');
        }
    }

    getCurrentLocation() {
        console.log('🗺️ Getting current location...');

        const locationBtn = document.getElementById('getLocationBtn');
        const locationStatus = document.getElementById('locationStatus');
        const locationInput = document.getElementById('location');
        const latInput = document.getElementById('latitude');
        const lngInput = document.getElementById('longitude');

        if (!navigator.geolocation) {
            this.showToast('Geolocation is not supported by your browser', 'error');
            return;
        }

        const originalText = locationBtn.innerHTML;
        locationBtn.innerHTML = '🔄 Getting location...';
        locationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                latInput.value = lat;
                lngInput.value = lng;

                this.updateLocalReportMarker(lat, lng);
                await this.reverseGeocode(lat, lng);

                locationStatus.style.display = 'block';
                this.showToast('Location captured successfully!', 'success');

                locationBtn.innerHTML = originalText;
                locationBtn.disabled = false;
            },
            (error) => {
                console.error('❌ Geolocation error:', error);
                let errorMessage = 'Could not get your location';

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location permission denied. Please enable location access.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information unavailable';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location request timed out';
                        break;
                }

                this.showToast(errorMessage, 'error');

                locationBtn.innerHTML = originalText;
                locationBtn.disabled = false;
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }

    renderReports() {
        const container = document.getElementById('reportsList');
        if (!container) return;

        if (!this.reports || !Array.isArray(this.reports)) {
            this.reports = [];
        }

        container.innerHTML = this.reports.length
            ? this.reports.map(r => {
                const status = (r.status || 'pending').toLowerCase();
                const statusClass = `status-${status}`;
                const timeStr = this.formatReportTime(r.created_at || r.createdAt || r.timestamp);
                const userName = r.users?.name || 'Anonymous';
                const isVerified = r.users?.is_verified;
                const likesCount = r.likes_count || 0;

                return `
                <div class="report-card ${statusClass} glass-card" data-report-id="${r.id}">
                    <div class="report-header">
                        ${r.image ? `<img src="${resolveImageUrl(r.image)}" alt="${this.escapeHtml(r.location || 'Report')}" class="report-image" onclick="window.app.openImagePopup('${resolveImageUrl(r.image)}')">` : `<div class="report-image-placeholder">📷</div>`}
                        <div class="report-info">
                            <div class="report-user-line">
                                <span class="report-user" onclick="window.app.openUserProfile('${r.user_id}')">${this.escapeHtml(userName)}</span>
                                ${isVerified ? `<span class="verified-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg></span>` : ''}
                                <span class="report-time-mini">• ${this.escapeHtml(timeStr)}</span>
                            </div>
                            <div class="report-location">${this.escapeHtml(r.location || 'Location not specified')}</div>
                            <div class="report-description">${this.escapeHtml(r.description || 'No description')}</div>
                            
                            <div class="social-actions">
                                <button class="social-btn like-btn" onclick="window.app.handleSocialAction('like', '${r.id}', 'report', this)">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                                    <span class="count">${likesCount}</span>
                                </button>
                                <button class="social-btn comment-btn" onclick="window.app.toggleComments('${r.id}', 'report', this)">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                                    <span class="count">${r.comments_count || 0}</span>
                                </button>
                                <button class="social-btn repost-btn" onclick="window.app.handleSocialAction('repost', '${r.id}', 'report', this)">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>
                                </button>
                                <button class="social-btn share-btn" onclick="window.app.handleSocialAction('share', '${r.id}', 'report', this)">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                                </button>
                            </div>

                            <div class="comment-section-mini" id="comments-${r.id}">
                                <div class="comment-list-mini" id="commentList-${r.id}"></div>
                                <div class="comment-input-area">
                                    <input type="text" id="commentInput-${r.id}" placeholder="Post a reply..." onkeydown="if(event.key==='Enter') window.app.postComment('${r.id}', 'report', this.value, this)">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('')
            : `<p class="text-center">No reports yet.</p>`;
    }

    /* ---------- SOCIAL ACTIONS ---------- */
    async handleSocialAction(action, itemId, itemType, btn) {
        if (!this.auth.isAuthenticated()) {
            this.showToast('Please login to interact!', 'error');
            return;
        }

        if (action === 'like') {
            try {
                const res = await this.auth.apiFetch('/api/social/like', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ item_id: itemId, item_type: itemType })
                });
                const data = await res.json();
                if (data.success) {
                    const countSpan = btn.querySelector('.count');
                    if (countSpan) countSpan.innerText = data.likes_count;
                    btn.classList.toggle('liked', data.action === 'liked');
                    
                    if (data.action === 'liked') {
                        this.showToast('Impact liked! ❤️', 'success');
                    }
                }
            } catch (err) { console.error('Like error:', err); }
        }

        if (action === 'share') {
            if (navigator.share) {
                navigator.share({
                    title: 'Goa Eco-Guard Report',
                    text: 'Check out this environmental report on Goa Eco-Guard!',
                    url: window.location.href + '?report=' + itemId
                }).catch(console.error);
            } else {
                navigator.clipboard.writeText(window.location.href + '?report=' + itemId);
                this.showToast('Link copied to clipboard!', 'success');
            }
        }

        if (action === 'repost') {
            const commentary = prompt('Add your thoughts (optional):');
            if (commentary === null) return;

            try {
                const res = await this.auth.apiFetch('/api/social/repost', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ original_item_id: itemId, item_type: itemType, commentary })
                });
                const data = await res.json();
                if (data.success) {
                    this.showToast('Successfully reposted to your Eco-Feed! 🌿', 'success');
                    btn.classList.add('reposted');
                }
            } catch (err) { this.showToast('Failed to repost', 'error'); }
        }
    }

    async toggleComments(itemId, itemType, btn) {
        const section = document.getElementById(`comments-${itemId}`);
        if (!section) return;

        section.classList.toggle('active');
        if (section.classList.contains('active')) {
            const input = section.querySelector('input');
            if (input) setTimeout(() => input.focus(), 100);

            const list = document.getElementById(`commentList-${itemId}`);
            list.innerHTML = '<p style="font-size:0.7rem; padding:0.5rem;">Loading replies...</p>';
            
            try {
                const res = await fetch(`${API_BASE}/api/social/comments/${itemType}/${itemId}`);
                const comments = await res.json();
                list.innerHTML = comments.length ? comments.map(c => `
                    <div class="comment-item">
                        <div class="comment-main">
                            <span class="comment-user">${this.escapeHtml(c.users?.name || 'User')}</span>
                            <span class="comment-text">${this.escapeHtml(c.text)}</span>
                            <div class="comment-footer-actions">
                                <span class="comment-time">${new Date(c.created_at).toLocaleDateString()}</span>
                                <button class="comment-reply-mini-btn" onclick="window.app.replyToComment('${this.escapeHtml(c.users?.name || 'User')}', '${itemId}')">Reply</button>
                            </div>
                        </div>
                    </div>
                `).join('') : '<p class="empty-msg" style="padding:0.5rem;">No comments yet.</p>';
            } catch (err) { list.innerHTML = 'Error loading replies.'; }
        }
    }

    replyToComment(username, itemId) {
        const input = document.getElementById(`commentInput-${itemId}`);
        if (input) {
            input.value = `@${username} `;
            input.focus();
        }
    }

    async postComment(itemId, itemType, text, input) {
        if (!text.trim()) return;
        if (!this.auth.isAuthenticated()) { this.showToast('Please login to reply', 'error'); return; }

        try {
            const res = await this.auth.apiFetch('/api/social/comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_id: itemId, item_type: itemType, text })
            });
            const data = await res.json();
                if (data.success) {
                    input.value = '';
                    const list = document.getElementById(`commentList-${itemId}`);
                    const noComments = list.querySelector('.empty-msg');
                    if (noComments) list.innerHTML = '';
                    
                    const newComment = document.createElement('div');
                    newComment.className = 'comment-item';
                    newComment.innerHTML = `
                        <div class="comment-main">
                            <span class="comment-user">${this.escapeHtml(this.auth.user.name)}</span>
                            <span class="comment-text">${this.escapeHtml(text)}</span>
                            <div class="comment-footer-actions">
                                <span class="comment-time">Just now</span>
                                <button class="comment-reply-mini-btn" onclick="window.app.replyToComment('${this.escapeHtml(this.auth.user.name)}', '${itemId}')">Reply</button>
                            </div>
                        </div>
                    `;
                    list.appendChild(newComment);
                    list.scrollTop = list.scrollHeight;
                }
        } catch (err) { this.showToast('Failed to post reply', 'error'); }
    }

    /* ---------- SETTINGS & PROFILE ---------- */
    initSettingsHandlers() {
        const modal = document.getElementById('settingsModal');
        const openBtn = document.getElementById('openSettingsBtn');
        const desktopOpenBtn = document.getElementById('desktopSettingsBtn');
        const closeBtn = modal?.querySelector('.close-modal');
        const logoutBtn = document.getElementById('dashboardLogoutBtn');

        const openHandler = (e) => {
            e.preventDefault();
            this.openProfileModal();
        };

        openBtn?.addEventListener('click', openHandler);
        desktopOpenBtn?.addEventListener('click', openHandler);

        closeBtn?.addEventListener('click', () => modal.classList.remove('active'));
        
        logoutBtn?.addEventListener('click', () => this.auth.logout());

        if (this.auth.isAuthenticated()) {
            this.checkNotifications();
            setInterval(() => this.checkNotifications(), 60000);
        }

        document.querySelectorAll('.feed-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const feedType = tab.dataset.feed;
                this.switchFeed(feedType);
            });
        });

        document.querySelectorAll('.bottom-nav-item[data-tab]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = item.dataset.tab;
                this.switchTab(tab);
            });
        });
    }

    switchDashboardTab(tabId) {
        console.log('🔄 Switching dashboard tab to:', tabId);
        
        document.querySelectorAll('.profile-tab-dash').forEach(btn => {
            const isActive = btn.id === `tab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`;
            btn.classList.toggle('active', isActive);
            btn.classList.toggle('bg-white', isActive);
            btn.classList.toggle('dark:bg-primary', isActive);
            btn.classList.toggle('shadow-sm', isActive);
            btn.classList.toggle('text-slate-900', isActive);
            btn.classList.toggle('dark:text-white', isActive);
            btn.classList.toggle('font-semibold', isActive);
            
            btn.classList.toggle('text-slate-500', !isActive);
            btn.classList.toggle('dark:text-emerald-600/60', !isActive);
            btn.classList.toggle('font-medium', !isActive);
        });

        document.querySelectorAll('.dashboard-section').forEach(section => {
            section.classList.toggle('hidden', section.id !== `dashboardSection-${tabId}`);
        });

        if (tabId === 'alerts') {
            this.fetchNotifications();
        }
    }

    scrollToDashboardSection(sectionId) {
        const el = document.getElementById(`dashListSection-${sectionId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    async openProfileModal() {
        const modal = document.getElementById('settingsModal');
        if (!modal) {
            console.error('❌ Settings modal not found');
            return;
        }

        if (!this.auth.isAuthenticated()) {
            window.location.href = 'login/login.html';
            return;
        }

        try {
            const user = this.auth.user;
            const initial = user.name.charAt(0).toUpperCase();
            
            const dashInitial = document.getElementById('dashboardInitial');
            const dashName = document.getElementById('dashboardName');
            const dashEmail = document.getElementById('dashboardEmail');
            const accName = document.getElementById('accountName');
            const accEmail = document.getElementById('accountEmail');
            const accPhone = document.getElementById('accountPhone');
            
            if (dashInitial) dashInitial.innerText = initial;
            if (dashName) dashName.innerText = user.name;
            if (dashEmail) dashEmail.innerText = user.email;
            if (accName) accName.innerText = user.name;
            if (accEmail) accEmail.innerText = user.email;
            if (accPhone) accPhone.innerText = user.phone || 'Not provided';

            modal.classList.remove('closing', 'hidden');
            modal.style.display = '';
            
            this.switchDashboardTab('impact');
            
            modal.classList.add('active');
            
            // Attach click listeners now that modal is visible
            setTimeout(() => {
                const attached = this.attachProfileClickListeners();
                if (!attached) {
                    setTimeout(() => this.attachProfileClickListeners(), 100);
                }
            }, 100);
            
            await this.fetchProfileStats();
            
            console.log('✅ Profile modal opened successfully');
        } catch (err) {
            console.error('❌ Error opening profile modal:', err);
            this.showToast('Could not open profile', 'error');
        }
    }

    async fetchProfileStats() {
        try {
            console.log('📊 Fetching detailed dashboard stats...');
            const res = await this.auth.apiFetch(`/api/profile/stats/${this.auth.user.id}`);
            const data = await res.json();
            
            if (res.ok) {
                console.log('✅ Profile stats received:', data);
                
                const statMappings = [
                    { id: 'dashStatReports', value: data.counts?.reports || 0 },
                    { id: 'dashStatSightings', value: data.counts?.sightings || 0 },
                    { id: 'dashStatStories', value: data.counts?.stories || 0 },
                    { id: 'dashStatMissions', value: data.counts?.missions || 0 }
                ];
                
                statMappings.forEach(({ id, value }) => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.innerText = value;
                        console.log(`✅ Updated ${id}: ${value}`);
                    }
                });

                this.renderDashboardList(
                    'reports', 
                    data.details?.reports || [], 
                    'dashboardReportsList', 
                    'assignment', 
                    'No reports filed yet.', 
                    'START A REPORT', 
                    'eco-reporting'
                );
                
                this.renderDashboardList(
                    'sightings', 
                    data.details?.sightings || [], 
                    'dashboardSightingsList', 
                    'visibility', 
                    'No sightings logged.', 
                    'Log a Sighting', 
                    'eco-reporting'
                );
                
                this.renderDashboardList(
                    'stories', 
                    data.details?.stories || [], 
                    'dashboardStoriesList', 
                    'auto_stories', 
                    'No stories shared.', 
                    'Tell a Story', 
                    'eco-reporting'
                );
                
                this.renderDashboardList(
                    'missions', 
                    data.details?.missions || [], 
                    'dashboardMissionsList', 
                    'groups', 
                    'No missions joined.', 
                    'Browse Missions', 
                    'volunteer'
                );

                this.fetchDashboardComments();
            }
        } catch (err) { 
            console.error('❌ Stats fetch error:', err); 
        }
    }

// In script.js - update fetchDashboardComments method

    async fetchDashboardComments() {
        try {
            const listEl = document.getElementById('dashboardCommentsList');
            const countEl = document.getElementById('dashStatComments');
            if (!listEl) return;
            
            const response = await fetch(`${API_BASE}/api/social/user-comments/${this.auth.user.id}`, {
                headers: this.auth.getAuthHeader()
            });
            const data = await response.json();
            
            if (response.ok) {
                if (countEl) countEl.innerText = data.length || 0;
                if (!data || data.length === 0) {
                    listEl.innerHTML = `
                        <div class="bg-card-light dark:bg-card-dark border border-dashed border-slate-300 dark:border-emerald-900/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                            <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-emerald-950/50 flex items-center justify-center mb-3">
                                <span class="material-icons-round text-slate-400 dark:text-emerald-800">forum</span>
                            </div>
                            <p class="text-sm font-medium text-slate-500 dark:text-emerald-700/70">No interactions yet.</p>
                        </div>
                    `;
                } else {
                    listEl.innerHTML = data.slice(0, 5).map(item => {
                        const isOwn = item.user_id === this.auth.user.id;
                        const icon = isOwn ? 'chat_bubble_outline' : 'reply';
                        const label = isOwn ? 'You commented' : `${item.users?.name || 'Someone'} replied`;
                        
                        const targetId = item.item_id || item.id;
                        const targetType = item.item_type || 'post';
                        const commentId = item.id;
                        
                        const dataAttributes = `data-profile-item="comments" data-item-id="${targetId}" data-parent-type="${targetType}" data-comment-id="${commentId}"`;
                        
                        return `
                            <div class="bg-card-light dark:bg-card-dark p-4 rounded-2xl border border-slate-100 dark:border-emerald-900/30 shadow-sm mb-3 profile-comment-item" data-comment-id="${commentId}">
                                <div class="flex items-start gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-emerald-900/20 transition-all p-2 rounded-xl profile-clickable-item" ${dataAttributes}>
                                    <div class="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center flex-shrink-0">
                                        <span class="material-icons-round text-primary text-sm">${icon}</span>
                                    </div>
                                    <div class="flex-1">
                                        <p class="text-xs font-bold text-slate-400 dark:text-emerald-700/80 uppercase tracking-wider">${label}</p>
                                        <p class="text-sm text-slate-700 dark:text-slate-200 mt-1">${this.escapeHtml(item.text || '')}</p>
                                        <p class="text-[10px] text-slate-400 mt-1">${new Date(item.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                
                                <!-- Reply section for comments -->
                                <div class="mt-3 pl-12 pr-2 reply-section-${commentId}" style="display: none;">
                                    <div class="flex gap-2">
                                        <input type="text" 
                                            class="reply-input-${commentId} flex-1 bg-slate-100 dark:bg-emerald-950/30 border border-slate-200 dark:border-emerald-900/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" 
                                            placeholder="Write a reply..." 
                                            data-comment-id="${commentId}"
                                            data-target-id="${targetId}"
                                            data-target-type="${targetType}">
                                        <button class="send-reply-btn bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors" 
                                                data-comment-id="${commentId}"
                                                data-target-id="${targetId}"
                                                data-target-type="${targetType}">
                                            Send
                                        </button>
                                        <button class="cancel-reply-btn bg-slate-200 dark:bg-emerald-900/30 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-lg text-sm hover:bg-slate-300 dark:hover:bg-emerald-900/50 transition-colors"
                                                data-comment-id="${commentId}">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                                
                                <!-- Reply button -->
                                <div class="mt-2 pl-12">
                                    <button class="text-xs text-primary font-semibold hover:underline reply-toggle-btn" data-comment-id="${commentId}">
                                        💬 Reply to this comment
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('');
                    
                    // Add event listeners for reply functionality
                    this.attachCommentReplyListeners();
                }
            }
        } catch (err) { 
            console.error('Comments fetch error:', err); 
        }
    }
    renderDashboardList(type, items, containerId, icon, emptyMsg, ctaText, scrollTarget) {
        const container = document.getElementById(containerId);
        if (!container) return;

        console.log(`📊 Rendering ${type} list:`, items);

        if (!items || items.length === 0) {
            container.innerHTML = `
                <div class="bg-card-light dark:bg-card-dark border border-dashed border-slate-300 dark:border-emerald-900/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                    <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-emerald-950/50 flex items-center justify-center mb-3">
                        <span class="material-icons-round text-slate-400 dark:text-emerald-800">${icon}</span>
                    </div>
                    <p class="text-sm font-medium text-slate-500 dark:text-emerald-700/70">${emptyMsg}</p>
                    <button class="mt-3 text-xs font-bold text-primary px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-950/40" onclick="window.app.scrollToSection('${scrollTarget}'); window.app.closeModal();">${ctaText}</button>
                </div>
            `;
            return;
        }

        container.innerHTML = items.slice(0, 3).map(item => {
            let title = '';
            let subtitle = '';
            let status = 'Active';
            let itemId = item.id || item.mission_id;
            
            if (type === 'missions') {
                if (item.missions) {
                    title = item.missions.title || 'Mission';
                    const missionDate = item.missions.date 
                        ? new Date(item.missions.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                        })
                        : '';
                    subtitle = item.missions.location 
                        ? `${item.missions.location}${missionDate ? ' • ' + missionDate : ''}`
                        : missionDate || new Date(item.created_at).toLocaleDateString();
                    status = 'Joined';
                } else {
                    title = item.title || 'Mission';
                    subtitle = item.location || new Date(item.created_at).toLocaleDateString();
                    status = 'Joined';
                }
            } else if (type === 'reports') {
                title = item.location || 'Report';
                subtitle = item.description ? item.description.substring(0, 30) + '...' : new Date(item.created_at).toLocaleDateString();
                status = item.status || 'Pending';
            } else if (type === 'sightings') {
                title = item.species_name || 'Sighting';
                subtitle = item.location || new Date(item.created_at).toLocaleDateString();
                status = 'Reported';
            } else if (type === 'stories') {
                title = item.title || 'Untitled Story';
                const storyDate = item.created_at 
                    ? new Date(item.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })
                    : 'Recently';
                
                const hasImages = [];
                if (item.before_image) hasImages.push('📷 Before');
                if (item.after_image) hasImages.push('📷 After');
                
                subtitle = hasImages.length > 0 
                    ? `${storyDate} • ${hasImages.join(' • ')}`
                    : storyDate;
                
                status = 'Published';
            } else if (type === 'comments') {
                const isOwn = item.user_id === this.auth?.user?.id;
                const commentText = item.text || '';
                const itemType = item.item_type || 'post';
                
                title = isOwn ? 'Your Comment' : `Reply from ${item.users?.name || 'Someone'}`;
                subtitle = commentText.length > 40 
                    ? commentText.substring(0, 40) + '...' 
                    : commentText || `On ${itemType}`;
                status = 'Interaction';
                itemId = item.item_id || item.id;
            }

            const statusColor = status === 'Joined' || status === 'Reported' || status === 'Published' || status === 'Interaction'
                ? 'bg-emerald-100 text-emerald-600' 
                : 'bg-slate-100 text-slate-500';

            const dataAttributes = `data-profile-item="${type}" data-item-id="${itemId || ''}" data-parent-type="${item.item_type || ''}"`;

            return `
                <div class="bg-card-light dark:bg-card-dark p-4 rounded-2xl border border-slate-100 dark:border-emerald-900/30 shadow-sm flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-emerald-900/20 transition-all profile-clickable-item" ${dataAttributes}>
                    <div class="flex items-center gap-3 overflow-hidden flex-1">
                        <div class="w-10 h-10 rounded-xl bg-slate-50 dark:bg-emerald-950/30 flex items-center justify-center flex-shrink-0">
                            <span class="material-icons-round text-slate-400 dark:text-emerald-800 text-xl">${icon}</span>
                        </div>
                        <div class="overflow-hidden flex-1">
                            <h4 class="text-sm font-bold text-slate-900 dark:text-white truncate">${this.escapeHtml(title)}</h4>
                            <p class="text-xs text-slate-500 dark:text-emerald-700/70 truncate">${this.escapeHtml(subtitle)}</p>
                        </div>
                    </div>
                    <span class="text-[10px] font-bold px-2 py-1 rounded-md ${statusColor} uppercase tracking-wider ml-2">${status}</span>
                </div>
            `;
        }).join('');
    }

    async fetchNotifications() {
        try {
            const listEl = document.getElementById('dashboardAlertsList');
            const res = await this.auth.apiFetch('/api/notifications');
            const data = await res.json();
            
            if (res.ok) {
                if (listEl) {
                    if (data.length === 0) {
                        listEl.innerHTML = '<p class="text-center text-slate-500 py-10">No new alerts.</p>';
                    } else {
                        listEl.innerHTML = data.map(notif => `
                            <div class="notif-item-dash p-4 bg-white dark:bg-emerald-950/20 rounded-2xl border ${notif.is_read ? 'border-slate-100' : 'border-primary/30 bg-emerald-50/30'}">
                                <p class="text-sm text-slate-900 dark:text-slate-100"><b>${notif.actor?.name || 'Someone'}</b> ${notif.text || (notif.action_type === 'like' ? 'liked your item' : 'commented on your item')}</p>
                                <p class="text-[10px] text-slate-400 mt-1">${new Date(notif.created_at).toLocaleString()}</p>
                            </div>
                        `).join('');
                    }
                }
                
                const notificationList = document.getElementById('notificationList');
                if (notificationList) {
                    if (data.length > 0) {
                        notificationList.innerHTML = data.map(n => `
                            <div class="notif-item ${n.is_read ? '' : 'unread'}">
                                ${n.is_read ? '' : '<div class="notif-dot"></div>'}
                                <div class="notif-content">
                                    <b>${n.actor?.name || 'Someone'}</b> ${n.action_type === 'like' ? 'liked' : 'commented on'} your ${n.item_type || 'post'}.
                                    <br><small>${new Date(n.created_at).toLocaleString()}</small>
                                </div>
                            </div>
                        `).join('');
                    } else {
                        notificationList.innerHTML = '<p class="empty-msg">No alerts yet</p>';
                    }
                }
            }
        } catch (err) { console.error('Alerts fetch error:', err); }
    }

    async checkNotifications() {
        try {
            const res = await this.auth.apiFetch('/api/notifications');
            const data = await res.json();
            if (res.ok) {
                const unread = data.filter(n => !n.is_read);
                const badge = document.getElementById('profileNotifBadge');
                const tabBadge = document.getElementById('unreadCount');
                
                if (unread.length > 0) {
                    if (badge) badge.style.display = 'block';
                    if (tabBadge) {
                        tabBadge.style.display = 'inline-block';
                        tabBadge.innerText = unread.length;
                    }
                } else {
                    if (badge) badge.style.display = 'none';
                    if (tabBadge) tabBadge.style.display = 'none';
                }
            }
        } catch (err) { console.error('Notif check error:', err); }
    }

    async markNotificationsRead() {
        try {
            const res = await this.auth.apiFetch('/api/notifications/read', {
                method: 'POST'
            });
            if (res.ok) {
                this.fetchNotifications();
                this.checkNotifications();
                this.showToast('All notifications marked as read', 'success');
            }
        } catch (err) { console.error('Mark read error:', err); }
    }

    async handleProfileUpdate(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const name = formData.get('name');
        const phone = formData.get('phone');

        try {
            const res = await fetch(`${API_BASE}/api/profile/update`, {
                method: 'PUT',
                headers: {
                    ...this.auth.getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, phone })
            });

            const data = await res.json();
            if (res.ok) {
                this.auth.updateUser(data.user);
                this.showToast('Profile updated successfully!', 'success');
                const dashName = document.getElementById('dashboardName');
                if (dashName) dashName.innerText = data.user.name;
                const accName = document.getElementById('accountName');
                if (accName) accName.innerText = data.user.name;
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    switchTab(tabId) {
        document.querySelectorAll('.bottom-nav-item').forEach(i => i.classList.remove('active'));
        const activeItem = document.querySelector(`.bottom-nav-item[data-tab="${tabId}"]`);
        if (activeItem) activeItem.classList.add('active');

        const sections = {
            'home': 'home',
            'reports': 'eco-reporting',
            'heatmap': 'heatmap',
            'missions': 'volunteer',
            'sightings': 'eco-reporting',
            'stories': 'eco-reporting'
        };

        if (tabId === 'settings') {
            this.openProfileModal();
            return;
        }

        if (tabId === 'sightings' || tabId === 'reports' || tabId === 'stories') {
            this.switchFeed(tabId);
            this.scrollToSection('reportsFeed');
            return;
        }

        const target = sections[tabId];
        if (target) {
            this.scrollToSection(target);
        }
    }

    switchFeed(feedType) {
        document.querySelectorAll('.feed-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.feed === feedType);
        });

        document.querySelectorAll('.feed-content').forEach(content => {
            content.classList.toggle('active', content.id === `${feedType}Feed`);
        });

        if (feedType === 'stories' && window.loadStories) {
            window.loadStories('feed');
        }
        
        if (feedType === 'sightings' && window.loadSightings) {
            window.loadSightings('feed');
        }
    }

    async openUserProfile(userId) {
        if (!userId) return;
        
        try {
            const res = await fetch(`${API_BASE}/api/social/profile/${userId}`);
            const data = await res.json();
            
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.innerHTML = `
                <div class="modal-content glass-panel" style="max-width:600px;">
                    <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
                    <div class="profile-banner">
                        <div class="profile-pic">${data.user.name.charAt(0).toUpperCase()}</div>
                        <h2>${this.escapeHtml(data.user.name)} ${data.user.is_verified ? '<span class="verified-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg></span>' : ''}</h2>
                        <div class="profile-stats">
                            <div class="profile-stat-item"><span class="profile-stat-val">${data.stats.followers}</span><span class="profile-stat-label">Followers</span></div>
                            <div class="profile-stat-item"><span class="profile-stat-val">${data.stats.following}</span><span class="profile-stat-label">Following</span></div>
                            <div class="profile-stat-item"><span class="profile-stat-val">${data.feed.length}</span><span class="profile-stat-label">Impacts</span></div>
                        </div>
                    </div>
                    <div class="profile-feed" style="max-height:400px; overflow-y:auto; margin-top:1rem;">
                        <h3 style="margin-bottom:1rem; border-bottom:1px solid var(--border); padding-bottom:0.5rem;">Eco-Feed</h3>
                        ${data.feed.length ? data.feed.map(item => `
                            <div class="feed-item" style="padding:0.75rem; border-bottom:1px solid rgba(255,255,255,0.05);">
                                <div style="color:var(--primary); font-size:0.8rem; margin-bottom:0.25rem;">${item.latitude ? 'Report' : 'Sighting'}</div>
                                <div>${this.escapeHtml(item.description || item.species_name)}</div>
                                <div style="font-size:0.75rem; color:var(--muted-foreground); margin-top:0.25rem;">📍 ${this.escapeHtml(item.location)}</div>
                            </div>
                        `).join('') : '<p class="text-center">No impact reports yet.</p>'}
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        } catch (err) { this.showToast('Could not load profile', 'error'); }
    }

    openImagePopup(url) {
        if (!url) return;
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.zIndex = '10001';
        modal.innerHTML = `
            <div class="modal-content" style="background:none; border:none; box-shadow:none; padding:0; display:flex; align-items:center; justify-content:center;">
                <button class="close-modal" onclick="this.closest('.modal').remove()" style="top:-30px; right:-30px; color:white; font-size:2.5rem;">&times;</button>
                <img src="${url}" style="max-width:95vw; max-height:90vh; border-radius:12px; box-shadow:0 0 50px rgba(0,0,0,0.8);">
            </div>
        `;
        document.body.appendChild(modal);
    }

    /* ---------- HEATMAP ---------- */
    async loadHotspots() {
        try {
            const loadingEl = document.querySelector('.map-loading');
            if (loadingEl) loadingEl.classList.remove('hidden');

            const reports = await this.fetchJSON('/api/reports');

            this.allHotspots = (reports || []).map(r => ({
                id: r.id,
                location: r.location || 'Unknown Location',
                lat: parseFloat(r.latitude),
                lng: parseFloat(r.longitude),
                description: r.description,
                severity: this.getReportSeverity(r.severity),
                status: r.status || 'pending',
                created_at: r.created_at,
                image: r.image
            })).filter(h => !isNaN(h.lat) && !isNaN(h.lng));

            this.hotspotsGrouped = this.groupHotspotsByLocation(this.allHotspots);

            this.initMap();
            this.renderHotspotCards();

            if (loadingEl) loadingEl.classList.add('hidden');
        } catch (err) {
            console.error('Error loading hotspots:', err);
            const loadingEl = document.querySelector('.map-loading');
            if (loadingEl) loadingEl.classList.add('hidden');
            this.initMap();
        }

        setInterval(() => {
            if (this.map) {
                this.refreshMap();
            }
        }, 60000);
    }

    groupHotspotsByLocation(hotspots) {
        const grouped = {};
        hotspots.forEach(h => {
            const key = `${h.lat},${h.lng}`;
            if (!grouped[key]) {
                grouped[key] = {
                    location: h.location,
                    lat: h.lat,
                    lng: h.lng,
                    severity: h.severity,
                    reports: [],
                    count: 0
                };
            }
            grouped[key].reports.push(h);
            grouped[key].count = grouped[key].reports.length;
            if (this.getSeverityLevel(h.severity) > this.getSeverityLevel(grouped[key].severity)) {
                grouped[key].severity = h.severity;
            }
        });
        return grouped;
    }

    getSeverityLevel(severity) {
        const levels = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        return levels[severity?.toLowerCase()] || 0;
    }

    getReportSeverity(severity) {
        if (!severity) return 'low';
        const s = severity.toLowerCase();
        if (s.includes('critical') || s.includes('emergency')) return 'critical';
        if (s.includes('high') || s.includes('severe')) return 'high';
        if (s.includes('medium') || s.includes('moderate')) return 'medium';
        return 'low';
    }

    initMap() {
        if (this.map) {
            this.renderMarkers();
            return;
        }

        const mapElement = document.getElementById('goaMap');
        if (!mapElement) return;

        this.map = L.map('goaMap', {
            scrollWheelZoom: true,
            zoomAnimation: true
        }).setView([15.5, 73.8], 9);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        this.markerLayers = {
            all: L.layerGroup().addTo(this.map),
            high: L.layerGroup(),
            medium: L.layerGroup(),
            low: L.layerGroup()
        };

        this.userMarker = null;

        this.map.on('click', (e) => {
            const { lat, lng } = e.latlng;
            this.updateLocalReportMarker(lat, lng);
            this.reverseGeocode(lat, lng);
            
            this.showToast('Location selected on map ✔', 'success');
            document.getElementById('locationStatus').style.display = 'block';
        });

        this.markersByLocation = {};

        this.renderMarkers();

        if (this.allHotspots && this.allHotspots.length > 0) {
            setTimeout(() => this.fitMapBounds(), 500);
        }
    }

    fitMapBounds() {
        if (!this.map || !this.allHotspots || this.allHotspots.length === 0) return;

        const bounds = L.latLngBounds();
        this.allHotspots.forEach(h => {
            bounds.extend([h.lat, h.lng]);
        });

        this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }

    async refreshMap() {
        console.log('🔄 Refreshing map data...');
        try {
            const reports = await this.fetchJSON('/api/reports');

            this.allHotspots = (reports || []).map(r => ({
                id: r.id,
                location: r.location || 'Unknown Location',
                lat: parseFloat(r.latitude),
                lng: parseFloat(r.longitude),
                description: r.description,
                severity: this.getReportSeverity(r.severity),
                status: r.status || 'pending',
                created_at: r.created_at,
                image: r.image
            })).filter(h => !isNaN(h.lat) && !isNaN(h.lng));

            this.hotspotsGrouped = this.groupHotspotsByLocation(this.allHotspots);

            const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';

            this.renderMarkers();
            this.renderHotspotCards();

            console.log('✅ Map refreshed with', this.allHotspots.length, 'reports');
        } catch (err) {
            console.error('Error refreshing map:', err);
        }
    }

    getMarkerIcon(severity) {
        const colors = {
            'critical': '#ef4444',
            'high': '#f97316',
            'medium': '#eab308',
            'low': '#22c55e'
        };

        return L.divIcon({
            html: `<div class="custom-marker ${severity}">●</div>`,
            className: '',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16]
        });
    }

    renderMarkers() {
        if (!this.map) this.initMap();
        if (!this.hotspotsGrouped || Object.keys(this.hotspotsGrouped).length === 0) {
            console.log('⚠️ No hotspots to render');
            return;
        }

        Object.values(this.markerLayers).forEach(layer => layer.clearLayers());
        this.markersByLocation = {};

        const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';

        Object.entries(this.hotspotsGrouped).forEach(([key, hotspot]) => {
            if (activeFilter !== 'all' && hotspot.severity !== activeFilter) {
                return;
            }

            const marker = L.marker([hotspot.lat, hotspot.lng], {
                icon: this.getMarkerIcon(hotspot.severity)
            });

            this.markersByLocation[key] = { marker, hotspot };

            const lastUpdated = new Date(hotspot.reports[0]?.created_at).toLocaleDateString();
            const popupContent = `
                <div class="pollution-popup">
                    <div class="popup-header">
                        <div class="popup-dot ${hotspot.severity}"></div>
                        <div>
                            <p class="popup-title">${this.escapeHtml(hotspot.location)}</p>
                        </div>
                    </div>
                    <div class="popup-details">
                        <div class="popup-detail">
                            <span class="popup-label">Severity:</span>
                            <span class="popup-value">${hotspot.severity.charAt(0).toUpperCase() + hotspot.severity.slice(1)}</span>
                        </div>
                        <div class="popup-detail">
                            <span class="popup-label">Reports:</span>
                            <span class="popup-value">${hotspot.count}</span>
                        </div>
                        <div class="popup-detail">
                            <span class="popup-label">Coordinates:</span>
                            <span class="popup-value">${hotspot.lat.toFixed(4)}, ${hotspot.lng.toFixed(4)}</span>
                        </div>
                        <div class="popup-detail">
                            <span class="popup-label">Last Updated:</span>
                            <span class="popup-value">${lastUpdated}</span>
                        </div>
                    </div>
                </div>
            `;

            marker.bindPopup(popupContent);

            this.markerLayers.all.addLayer(marker);
            if (this.markerLayers[hotspot.severity]) {
                this.markerLayers[hotspot.severity].addLayer(marker);
            }
        });

        console.log('📌 Rendered markers for', Object.keys(this.markersByLocation).length, 'locations');
    }

    renderHotspotCards() {
        const container = document.getElementById('hotspotsGrid');
        if (!container || !this.hotspotsGrouped) return;

        const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';

        const filteredHotspots = Object.values(this.hotspotsGrouped).filter(h =>
            activeFilter === 'all' || h.severity === activeFilter
        );

        filteredHotspots.sort((a, b) => b.count - a.count);

        container.innerHTML = filteredHotspots.length
            ? filteredHotspots.map(h => {
                const latLng = `${h.lat},${h.lng}`;
                const lastReport = h.reports[0];
                const lastUpdated = new Date(lastReport?.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });

                return `
                    <div class="hotspot-card" data-location="${this.escapeHtml(h.location)}" data-latlng="${latLng}">
                        <div class="hotspot-card-header">
                            <div class="hotspot-title-section">
                                <h3 class="hotspot-location">${this.escapeHtml(h.location)}</h3>
                                <span class="hotspot-severity-badge ${h.severity}">${h.severity.toUpperCase()}</span>
                            </div>
                        </div>
                        <div class="hotspot-card-content">
                            <div class="hotspot-stat">
                                <span class="hotspot-stat-label">Reports:</span>
                                <span class="hotspot-stat-value">${h.count}</span>
                            </div>
                            <div class="hotspot-stat">
                                <span class="hotspot-stat-label">Coordinates:</span>
                                <span class="hotspot-stat-value">${h.lat.toFixed(4)}, ${h.lng.toFixed(4)}</span>
                            </div>
                            <div class="hotspot-stat">
                                <span class="hotspot-stat-label">Last Updated:</span>
                                <span class="hotspot-stat-value">${lastUpdated}</span>
                            </div>
                            ${lastReport?.description ? `
                            <div class="hotspot-stat">
                                <span class="hotspot-stat-label">Latest Report:</span>
                                <p class="hotspot-description">${this.escapeHtml(lastReport.description.substring(0, 80))}...</p>
                            </div>
                            ` : ''}
                        </div>
                        <button class="btn btn-primary view-on-map-btn" data-latlng="${latLng}">
                            View on Map
                        </button>
                    </div>
                `;
            }).join('')
            : `<div class="text-center" style="padding: 2rem; color: var(--muted-foreground);">
                <p>No hotspots found for the selected filter.</p>
            </div>`;
    }

    viewOnMap(latLng) {
        const [lat, lng] = latLng.split(',').map(Number);

        if (!this.map) return;

        const mapElement = document.getElementById('goaMap');
        if (mapElement) {
            mapElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        setTimeout(() => {
            this.map.setView([lat, lng], 15, { animate: true });

            const key = `${lat},${lng}`;
            if (this.markersByLocation[key]) {
                const marker = this.markersByLocation[key].marker;
                marker.openPopup();
            }
        }, 500);
    }

    /* ---------- HELPER METHODS ---------- */
    async reverseGeocode(lat, lng) {
        const locationInput = document.getElementById('location');
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
            );
            const data = await response.json();
            
            const addr = data.address || {};
            const parts = [];
            
            if (addr.house_number) parts.push(addr.house_number);
            if (addr.road) parts.push(addr.road);
            if (addr.neighbourhood || addr.suburb) parts.push(addr.neighbourhood || addr.suburb);
            if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
            
            const locationName = parts.length > 0 
                ? parts.join(', ') 
                : (data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);

            if (locationInput) locationInput.value = locationName;
            return locationName;
        } catch (error) {
            console.warn('Could not get location name:', error);
            if (locationInput) locationInput.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            return null;
        }
    }

    async searchLocation(query) {
        if (!query || query.length < 3) return;
        const locationStatus = document.getElementById('locationStatus');
        
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Goa')}&limit=1`
            );
            const data = await response.json();
            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                const latitude = parseFloat(lat);
                const longitude = parseFloat(lon);
                
                document.getElementById('latitude').value = latitude;
                document.getElementById('longitude').value = longitude;
                
                this.updateLocalReportMarker(latitude, longitude);

                if (locationStatus) {
                    locationStatus.textContent = '📍 Location verified via search';
                    locationStatus.style.display = 'block';
                    locationStatus.style.color = '#22c55e';
                }
            } else {
                if (locationStatus) {
                    locationStatus.textContent = 'Searching for coordinates...';
                    locationStatus.style.display = 'block';
                    locationStatus.style.color = 'var(--muted-foreground)';
                }
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    }

    updateLocalReportMarker(lat, lng) {
        if (!this.map) return;
        
        document.getElementById('latitude').value = lat;
        document.getElementById('longitude').value = lng;

        if (this.userMarker) {
            this.userMarker.setLatLng([lat, lng]);
        } else {
            this.userMarker = L.marker([lat, lng], {
                icon: L.divIcon({
                    html: `<div style="background:#22c55e;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">📍</div>`,
                    className: '',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                }),
                zIndexOffset: 1000
            }).addTo(this.map);
        }

        this.map.setView([lat, lng], 18, { animate: true });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatReportTime(ts) {
        if (!ts) return 'Unknown time';
        const d = new Date(ts);
        if (isNaN(d.getTime())) return ts;
        return d.toLocaleString();
    }

    /* ---------- MISSIONS ---------- */
    async loadMissions() {
        this.missions = await this.fetchJSON('/api/missions');
        this.renderMissions();
    }

    renderMissions() {
        const container = document.getElementById('missionsGrid');
        if (!container || !this.missions) return;

        const TRUNCATE = 120;
        const joinedMissions = getJoinedMissions();

        container.innerHTML = this.missions.length
            ? this.missions.map(m => {
                const joined = joinedMissions.includes(String(m.id));

                const joinBtn = joined
                    ? `<button class="btn btn-joined" disabled>✅ Joined</button>`
                    : `<button class="btn btn-primary join-mission-btn" data-mission-id="${m.id}">Join Mission</button>`;

                const desc = m.description || '';
                const long = desc.length > TRUNCATE;
                const short = long ? desc.slice(0, TRUNCATE).trimEnd() + '…' : desc;

                const descBlock = long
                    ? `<div class="mission-desc">
                        <p class="mission-desc-short">${short}</p>
                        <p class="mission-desc-full" style="display:none;margin:0">${desc}</p>
                        <button class="read-more-btn" onclick="(function(b){
                        var w=b.closest('.mission-desc');
                        var s=w.querySelector('.mission-desc-short');
                        var f=w.querySelector('.mission-desc-full');
                        var o=f.style.display!='none';
                        s.style.display=o?'':'none';
                        f.style.display=o?'none':'';
                        b.textContent=o?'Read more':'Show less';
                        })(this)">Read more</button>
                    </div>`
                    : `<div class="mission-desc"><p class="mission-desc-short">${desc}</p></div>`;

                return `
                    <div class="mission-card">
                        <div class="mission-img-wrap">
                            ${m.image
                                ? `<img src="${resolveImageUrl(m.image)}" alt="${m.title}" class="mission-image">`
                                : `<div class="mission-img-placeholder">🌿</div>`}
                        </div>
                        <div class="mission-content">
                            <h3 class="mission-title">${m.title}</h3>
                            ${descBlock}
                            <div class="mission-meta">
                                <span>&#128197; ${new Date(m.date).toLocaleDateString()}</span>
                                <span>&#128205; ${m.location}</span>
                                <span>&#128101; ${m.participant_count || 0} Joined</span>
                            </div>
                            <div class="mission-action">${joinBtn}</div>
                        </div>
                    </div>`;
            }).join('')
            : `<p class="text-center">No missions available yet.</p>`;
    }

    openMissionModal(missionId) {
        const mission = this.missions?.find(m => m.id == missionId);
        if (!mission) return;

        if (!this.auth.isAuthenticated()) {
            window.location.href = 'login/login.html';
            return;
        }

        const joinedMissions = getJoinedMissions();
        if (joinedMissions.includes(String(missionId))) {
            this.showToast('You have already joined this mission! ✅', 'info');
            
            const modal = document.getElementById('missionModal');
            if (modal) {
                modal.classList.remove('active');
                modal.classList.add('closing');
                setTimeout(() => {
                    modal.classList.remove('closing');
                    modal.style.display = 'none';
                }, 250);
            }
            return;
        }

        document.getElementById('modalTitle').textContent = 'Join Mission';
        document.getElementById('modalMissionTitle').textContent = mission.title;
        document.getElementById('modalMissionDesc').textContent = mission.description;
        document.getElementById('modalDateTime').textContent = new Date(mission.date).toLocaleString();
        document.getElementById('modalLocation').textContent = mission.location;
        document.getElementById('modalDifficulty').textContent = mission.difficulty || 'Moderate';
        if (mission.image) {
            document.getElementById('modalImage').src = resolveImageUrl(mission.image);
        }
        document.getElementById('confirmJoinBtn').dataset.missionId = missionId;
        document.getElementById('missionModal').classList.add('active');
    }

    showJoinForm(missionId) {
        const joinedMissions = getJoinedMissions();
        if (joinedMissions.includes(String(missionId))) {
            this.showToast('You have already joined this mission! ✅', 'info');
            
            document.getElementById('missionModal')?.classList.remove('active');
            return;
        }

        document.getElementById('missionModal').classList.remove('active');
        const joinModal = document.getElementById('joinModal');
        joinModal.classList.remove('hidden');
        joinModal.classList.add('active');
        document.getElementById('joinForm').dataset.missionId = missionId;
    }

    async handleJoinMission(e) {
        e.preventDefault();
        const form = e.target.closest('form');
        const missionId = form.dataset.missionId;
        const name = document.getElementById('joinName').value.trim();
        const email = document.getElementById('joinEmail').value.trim().toLowerCase();
        const phone = document.getElementById('joinPhone').value.trim();

        if (!missionId) {
            this.showToast('Mission ID is missing', 'error');
            return;
        }

        const joinedMissions = getJoinedMissions();
        if (joinedMissions.includes(String(missionId))) {
            this.showToast('You have already joined this mission! ✅', 'info');
            
            const joinModal = document.getElementById('joinModal');
            if (joinModal) {
                joinModal.classList.remove('active');
                joinModal.classList.add('hidden');
            }
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    mission_id: missionId,
                    name,
                    email,
                    phone: phone || null
                })
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.code === '23505' || data.error?.includes('duplicate')) {
                    console.log('User already registered for this mission');
                    markMissionJoined(missionId);
                    this.showToast('You have already joined this mission! ✅', 'info');
                    
                    const joinModal = document.getElementById('joinModal');
                    if (joinModal) {
                        joinModal.classList.remove('active');
                        joinModal.classList.add('hidden');
                    }
                    
                    this.loadMissions();
                    
                    const settingsModal = document.getElementById('settingsModal');
                    if (settingsModal && settingsModal.classList.contains('active')) {
                        setTimeout(() => this.fetchProfileStats(), 500);
                    }
                    return;
                }
                throw new Error(data.error || `Failed to join mission (${res.status})`);
            }

            console.log('Join mission success:', data);

            markMissionJoined(missionId);

            this.showToast('Successfully joined the mission! A confirmation email has been sent to you. 🌿', 'success');

            const joinModal = document.getElementById('joinModal');
            if (joinModal) {
                joinModal.classList.remove('active');
                joinModal.classList.add('hidden');
            }

            if (form) form.reset();

            this.loadMissions();
            
            const settingsModal = document.getElementById('settingsModal');
            if (settingsModal && settingsModal.classList.contains('active')) {
                setTimeout(() => this.fetchProfileStats(), 500);
            }

        } catch (err) {
            console.error('Join mission error:', err);
            this.showToast(err.message || 'Failed to join mission', 'error');
        }
    }

    /* ---------- LEADERBOARD ---------- */
    async loadLeaderboard() {
        this.leaderboard = await this.fetchJSON('/api/leaderboard');
        this.renderLeaderboard();
    }

    renderLeaderboard() {
        if (!this.leaderboard) return;

        document.getElementById('totalReports')?.setAttribute('data-count', this.leaderboard.totalReports || 0);
        document.getElementById('totalMissions')?.setAttribute('data-count', this.leaderboard.totalMissions || 0);
        document.getElementById('totalTrees')?.setAttribute('data-count', this.leaderboard.totalTrees || 0);

        this.animateCounter('totalReports', this.leaderboard.totalReports || 0);
        this.animateCounter('totalMissions', this.leaderboard.totalMissions || 0);
        this.animateCounter('totalTrees', this.leaderboard.totalTrees || 0);

        const podiumGrid = document.getElementById('podiumGrid');
        if (podiumGrid && this.leaderboard.top3) {
            podiumGrid.innerHTML = this.leaderboard.top3.map((user, idx) => `
                <div class="podium-item ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : 'bronze'}">
                    <div class="podium-rank">${idx + 1}</div>
                    <div class="podium-name">${user.name}</div>
                    <div class="podium-score">${user.score} pts</div>
                </div>
            `).join('');
        }

        const leaderboardList = document.getElementById('leaderboardList');
        if (leaderboardList && this.leaderboard.list) {
            leaderboardList.innerHTML = this.leaderboard.list.map((user, idx) => `
                <div class="leaderboard-item">
                    <span class="rank">${idx + 4}</span>
                    <span class="name">${user.name}</span>
                    <span class="score">${user.score} pts</span>
                </div>
            `).join('');
        }
    }

    animateCounter(id, target) {
        const element = document.getElementById(id);
        if (!element) return;
        let current = 0;
        const increment = target / 50;
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                element.textContent = target;
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current);
            }
        }, 30);
    }

    /* ---------- POLICIES ---------- */
    async loadPolicies() {
        this.policies = await this.fetchJSON('/api/policies');
        this.reportStats = await this.fetchJSON('/api/report-stats');
        this.renderPolicies();
    }

    renderPolicies() {
        if (this.reportStats) {
            const stats = this.reportStats;
            const implementedEl = document.getElementById('implementedCount');
            const inProgressEl = document.getElementById('inProgressCount');
            const pendingEl = document.getElementById('pendingCount');
            const planningEl = document.getElementById('planningCount');

            if (implementedEl) implementedEl.textContent = stats.approved || 0;
            if (inProgressEl) inProgressEl.textContent = stats.pending || 0;
            if (pendingEl) pendingEl.textContent = stats.total || 0;
            if (planningEl) planningEl.textContent = stats.rejected || 0;
        }

        const policiesList = document.getElementById('policiesList');
        if (policiesList && this.policies && this.policies.length > 0) {
            policiesList.innerHTML = this.policies.map(p => `
                <div class="policy-card">
                    <div class="policy-status ${p.status}">
                        <span>${(p.status || 'pending').replace('_', ' ').toUpperCase()}</span>
                    </div>
                    <h3>${p.title}</h3>
                    <p>${p.description}</p>
                    <div class="policy-meta">
                        <span>📅 ${new Date(p.created_at).toLocaleDateString()}</span>
                        ${p.deadline ? `<span>⏰ Deadline: ${new Date(p.deadline).toLocaleDateString()}</span>` : ''}
                    </div>
                </div>
            `).join('');
        }
    }

    /* ---------- EXPERIENCES ---------- */
    async loadExperiences() {
        this.experiences = await this.fetchJSON('/api/experiences');
        this.renderExperiences();
    }

    renderExperiences() {
        const container = document.getElementById('experiencesGrid');
        if (!container || !this.experiences) return;

        container.innerHTML = this.experiences.length
            ? this.experiences.map(e => `
                <div class="experience-card">
                    ${e.image ? `<img src="${resolveImageUrl(e.image)}" alt="${e.name}">` : ''}
                    <div class="experience-content">
                        <span class="experience-category">${e.category}</span>
                        <h3>${e.name}</h3>
                        <p>${e.description}</p>
                        ${e.location ? `<div class="experience-location">📍 ${e.location}</div>` : ''}
                    </div>
                </div>
            `).join('')
            : '';
    }

    /* ---------- ECO SPOTS ---------- */
    async loadEcoSpots() {
        this.ecoSpots = await this.fetchJSON('/api/eco-spots');
        this.renderEcoSpots();
    }

    renderEcoSpots() {
        const container = document.getElementById('experiencesGrid');
        if (!container) return;

        const TRUNCATE = 120;

        function descBlock(text) {
            const desc = text || '';
            const long = desc.length > TRUNCATE;
            const short = long ? desc.slice(0, TRUNCATE).trimEnd() + '…' : desc;
            if (!long) return `<div class="eco-spot-desc-wrap"><p class="eco-spot-desc">${desc}</p></div>`;
            return `<div class="eco-spot-desc-wrap">
                        <p class="eco-spot-desc eco-spot-desc-short">${short}</p>
                        <p class="eco-spot-desc eco-spot-desc-full" style="display:none;margin:0">${desc}</p>
                        <button class="read-more-btn" onclick="(function(b){
                          var w=b.closest('.eco-spot-desc-wrap');
                          var s=w.querySelector('.eco-spot-desc-short');
                          var f=w.querySelector('.eco-spot-desc-full');
                          var o=f.style.display!='none';
                          s.style.display=o?'':'none';
                          f.style.display=o?'none':'';
                          b.textContent=o?'Read more':'Show less';
                        })(this)">Read more</button>
                    </div>`;
        }

        let html = '';

        if (this.experiences && this.experiences.length > 0) {
            html += this.experiences.map(e => `
                <div class="eco-spot-card">
                    <div class="eco-spot-img-wrap">
                        ${e.image
                            ? `<img src="${resolveImageUrl(e.image)}" alt="${e.name}" class="eco-spot-img">`
                            : `<div class="eco-spot-img-placeholder">🌴</div>`}
                    </div>
                    <div class="eco-spot-body">
                        ${e.category ? `<span class="eco-spot-category">${e.category}</span>` : ''}
                        <h3 class="eco-spot-name">${e.name}</h3>
                        ${descBlock(e.description)}
                        ${e.location ? `<div class="eco-spot-location">📍 ${e.location}</div>` : ''}
                    </div>
                </div>
            `).join('');
        }

        if (this.ecoSpots && this.ecoSpots.length > 0) {
            html += this.ecoSpots.map(spot => `
                <div class="eco-spot-card">
                    <div class="eco-spot-img-wrap">
                        ${spot.image
                            ? `<img src="${resolveImageUrl(spot.image)}" alt="${spot.name}" class="eco-spot-img">`
                            : `<div class="eco-spot-img-placeholder">🌿</div>`}
                    </div>
                    <div class="eco-spot-body">
                        <div class="eco-spot-header">
                            <h3 class="eco-spot-name">${spot.name}</h3>
                            <div class="eco-spot-rating">⭐ ${spot.rating}</div>
                        </div>
                        <div class="eco-spot-location">📍 ${spot.location}</div>
                        ${descBlock(spot.description)}
                        ${spot.features ? `
                            <div class="eco-spot-features">
                                ${spot.features.split(',').map(f => `<span class="feature-tag">${f.trim()}</span>`).join('')}
                            </div>
                        ` : ''}
                        ${spot.price ? `<div class="eco-spot-price">${spot.price}</div>` : ''}
                        <div class="eco-spot-action">
                            <button class="btn btn-primary know-more-btn" data-spot-id="${spot.id}">
                                Know More
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        container.innerHTML = html || '<p class="text-center">No eco spots or experiences available yet.</p>';
    }

    async openEcoSpotModal(spotId) {
        try {
            const spot = await this.fetchJSON(`/api/eco-spots/${spotId}`);
            if (!spot) {
                this.showToast('Eco spot not found', 'error');
                return;
            }

            let modal = document.getElementById('ecoSpotDetailModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'ecoSpotDetailModal';
                modal.className = 'modal';
                modal.innerHTML = `
                    <div class="modal-content eco-spot-modal-content">
                        <span class="close-modal">&times;</span>
                        <div id="ecoSpotDetailContent"></div>
                    </div>
                `;
                document.body.appendChild(modal);

                modal.querySelector('.close-modal').onclick = () => {
                    modal.style.display = 'none';
                };
                modal.onclick = (e) => {
                    if (e.target === modal) modal.style.display = 'none';
                };
            }

            const content = document.getElementById('ecoSpotDetailContent');
            content.innerHTML = `
                ${spot.image ? `<img src="${resolveImageUrl(spot.image)}" alt="${spot.name}" class="eco-spot-modal-image">` : ''}
                <div class="eco-spot-modal-body">
                    <div class="eco-spot-modal-header">
                        <h2>${spot.name}</h2>
                        <div class="eco-spot-modal-rating">⭐ ${spot.rating}</div>
                    </div>
                    <div class="eco-spot-modal-location">📍 ${spot.location}</div>
                    <p class="eco-spot-modal-description">${spot.description}</p>
                    
                    ${spot.features ? `
                        <div class="eco-spot-modal-section">
                            <h4>Sustainability Features:</h4>
                            <div class="eco-spot-features-list">
                                ${spot.features.split(',').map(f => `<div class="feature-item">✓ ${f.trim()}</div>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${spot.details ? `
                        <div class="eco-spot-modal-section">
                            <h4>Additional Details:</h4>
                            <p>${spot.details}</p>
                        </div>
                    ` : ''}
                    
                    ${spot.price ? `
                        <div class="eco-spot-modal-price">
                            <strong>${spot.price}</strong>
                        </div>
                    ` : ''}
                    
                    ${spot.category ? `
                        <div class="eco-spot-modal-category">
                            <span class="category-badge">${spot.category}</span>
                        </div>
                    ` : ''}
                </div>
            `;

            modal.style.display = '';
            modal.classList.remove('hidden', 'closing');
            modal.classList.add('active');
        } catch (err) {
            this.showToast('Failed to load eco spot details', 'error');
        }
    }

    /* ---------- SENSITIVE CONTENT ALERT ---------- */
    showSensitiveContentAlert() {
        console.log('⚠️ showSensitiveContentAlert TRIGGERED');

        const existing = document.getElementById('sensitiveContentModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'sensitiveContentModal';

        modal.className = 'modal active';
        Object.assign(modal.style, {
            position: 'fixed',
            zIndex: '999999',
            left: '0',
            top: '0',
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.85)',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(5px)'
        });

        modal.innerHTML = `
            <div style="
                background: white;
                padding: 2rem;
                border-radius: 12px;
                max-width: 400px;
                width: 90%;
                text-align: center;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                border: 2px solid #ef4444;
                animation: slideDown 0.3s ease-out;
            ">
                <div style="
                    font-size: 3rem; 
                    margin-bottom: 1rem;
                    animation: pulse 2s infinite;
                ">⚠️</div>
                
                <h2 style="
                    color: #dc2626; 
                    margin-bottom: 0.5rem; 
                    font-size: 1.5rem; 
                    font-weight: 800;
                    font-family: inherit;
                ">Content Warning</h2>
                
                <p style="
                    color: #4b5563; 
                    margin-bottom: 1.5rem; 
                    line-height: 1.6;
                    font-size: 1rem;
                ">
                    Our AI has detected potential <strong>sensitive content</strong> (people, faces, or restricted items).
                    <br><br>
                    Please upload only environmental pictures (garbage, nature, pollution) to protect privacy.
                </p>
                
                <button id="closeSensitiveModalBtn" style="
                    background-color: #dc2626;
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 1rem;
                    cursor: pointer;
                    width: 100%;
                    transition: all 0.2s;
                    box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.4);
                ">
                    Start Over
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        const btn = document.getElementById('closeSensitiveModalBtn');
        if (btn) {
            btn.onclick = () => {
                modal.classList.add('closing');
                setTimeout(() => modal.remove(), 250);
            };
            btn.focus();
        }

        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.add('closing');
                setTimeout(() => modal.remove(), 250);
            }
        };
    }

    /* ---------- MAP FILTERING ---------- */
    filterMapMarkers(filter) {
        if (!this.map || !this.markerLayers) return;

        console.log('🎯 Filtering markers by:', filter);

        Object.values(this.markerLayers).forEach(layer => {
            this.map.removeLayer(layer);
        });

        if (filter === 'all') {
            this.markerLayers.all.addTo(this.map);
        } else if (this.markerLayers[filter]) {
            this.markerLayers[filter].addTo(this.map);
        }

        console.log(`✅ Map filtered to: ${filter} `);
    }

    /* ---------- UI HELPERS ---------- */
    showToast(msg, type) {
        const toast = document.getElementById('toast');
        if (!toast) {
            console.warn('Toast element not found in DOM');
            return;
        }
        toast.className = `toast ${type} active`;
        const msgEl = toast.querySelector('#toastMessage');
        if (msgEl) msgEl.textContent = msg;
        setTimeout(() => toast.classList.remove('active'), 8000);
    }

    previewImage(input) {
        const preview = document.getElementById('imagePreview');
        const uploadArea = document.getElementById('uploadArea');
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `
                    <img src="${e.target.result}" alt="Preview">
                    <button type="button" onclick="removeImage()" class="remove-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                `;
                uploadArea.style.display = 'none';
                preview.style.display = 'block';
            }
            reader.readAsDataURL(input.files[0]);
        }
    }

    removeImage() {
        const input = document.getElementById('image');
        const preview = document.getElementById('imagePreview');
        const uploadArea = document.getElementById('uploadArea');
        if (input) input.value = '';
        if (preview) {
            preview.innerHTML = '';
            preview.style.display = 'none';
        }
        if (uploadArea) uploadArea.style.display = 'block';
    }

    showLoginModal() {
        window.location.href = 'login/login.html';
    }

    showSignupModal() {
        window.location.href = 'login/signup.html';
    }

    initViewOnMapButtons() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('view-on-map-btn')) {
                const latLng = e.target.dataset.latlng;
                if (latLng) {
                    this.viewOnMap(latLng);
                }
            }
        });
    }

    closeModal() {
        document.querySelectorAll('.modal').forEach(m => {
            if (m.classList.contains('closing') || m.classList.contains('hidden')) return;
            
            m.classList.remove('active');
            m.classList.add('closing');
            setTimeout(() => {
                m.classList.remove('closing');
                m.style.display = 'none';
            }, 250);
        });
    }

    initIntersectionObserver() {
        const sections = document.querySelectorAll('section[id]');

        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -50% 0px',
            threshold: 0
        };

        const observerCallback = (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const sectionId = entry.target.id;

                    document.querySelectorAll('.nav-link').forEach(link => {
                        link.classList.remove('active');
                    });

                    const activeLink = document.querySelector(`.nav-link[data-section="${sectionId}"]`);
                    if (activeLink) {
                        activeLink.classList.add('active');
                    }
                }
            });
        };

        const observer = new IntersectionObserver(observerCallback, observerOptions);
        sections.forEach(section => observer.observe(section));
    }

    previewImageFromCamera(file) {
        const preview = document.getElementById('imagePreview');
        const uploadArea = document.getElementById('uploadArea');
        
        if (file) {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                preview.innerHTML = `
                    <img src="${e.target.result}" alt="Preview">
                    <button type="button" onclick="removeImage()" class="remove-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                `;
                uploadArea.style.display = 'none';
                preview.style.display = 'block';
            }
            
            reader.readAsDataURL(file);
        }
    }

    initLeafParticles() {
        const lc = document.getElementById('leafContainer');
        if (!lc) return;

        lc.innerHTML = '';

        const count = 10;
        for (let i = 0; i < count; i++) {
            const l = document.createElement('div');
            l.className = 'leaf-particle';
            
            const left = Math.random() * 100;
            const duration = 10 + Math.random() * 16;
            const delay = Math.random() * 16;
            const opacity = 0.12 + Math.random() * 0.25;
            const scale = 0.6 + Math.random() * 0.9;
            
            l.style.cssText = `
                left: ${left}%;
                animation-duration: ${duration}s;
                animation-delay: -${delay}s;
                opacity: ${opacity};
                transform: scale(${scale});
            `;
            
            lc.appendChild(l);
        }
    }
}

/* ---------- START ---------- */
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new GoaEcoGuard();
    window.app = app;

    window.previewImage = (input) => app.previewImage(input);
    window.removeImage = () => app.removeImage();

    console.log('🌱 Goa Eco-Guard ready (fully dynamic)');
});