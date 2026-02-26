const API_BASE =
    window.__API_BASE__ ||
    document.querySelector('meta[name="api-base"]')?.content ||
    ((location.hostname === 'localhost' || location.hostname === '127.0.0.1')
        ? 'http://localhost:3000'
        : location.origin);

function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    const secure = location.protocol === 'https:' ? '; secure' : '';
    document.cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; samesite=lax' + secure;
}

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    
    // Handle Login Form
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            // Simple validation
            if (!email || !password) {
                showToast('Please fill in all fields', 'error');
                return;
            }
            
            await handleLogin(email, password);
        });
    }
    
    // Handle Signup Form
    if (signupForm) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const name = document.getElementById('signupName').value;
            const email = document.getElementById('signupEmail').value;
            const phone = document.getElementById('signupPhone')?.value || '';
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            // Validation
            if (!name || !email || !password || !confirmPassword) {
                showToast('Please fill in all required fields', 'error');
                return;
            }
            
            if (password !== confirmPassword) {
                showToast('Passwords do not match', 'error');
                return;
            }
            
            if (password.length < 6) {
                showToast('Password must be at least 6 characters', 'error');
                return;
            }
            
            await handleSignup(name, email, phone, password);
        });
    }

    // Load dynamic counts
    loadPublicStats();
    
    // Switch to signup
    const switchToSignup = document.getElementById('switchToSignup');
    if (switchToSignup) {
        switchToSignup.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'signup.html';
        });
    }
    
    // Switch to login
    const switchToLogin = document.getElementById('switchToLogin');
    if (switchToLogin) {
        switchToLogin.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'login.html';
        });
    }
});

async function loadPublicStats() {
    try {
        const res = await fetch(`${API_BASE}/api/public-stats`);
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = await res.json();
        
        // Update elements if they exist
        const warriorEl = document.getElementById('warriorCount');
        const reportEl = document.getElementById('reportCount');
        const missionEl = document.getElementById('missionCount');
        const heroWarriorEl = document.getElementById('heroWarriorCount');

        if (warriorEl) warriorEl.textContent = formatStatNumber(data.warriors, true);
        if (reportEl) reportEl.textContent = formatStatNumber(data.reports, true);
        if (missionEl) missionEl.textContent = formatStatNumber(data.missions, false);
        if (heroWarriorEl) heroWarriorEl.textContent = data.warriors.toLocaleString();

    } catch (err) {
        console.warn('Could not load dynamic stats:', err);
    }
}

function formatStatNumber(num, addPlus = false) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M' + (addPlus ? '+' : '');
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K' + (addPlus ? '+' : '');
    }
    return num.toString();
}

async function handleLogin(email, password) {
    const submitBtn = document.querySelector('#loginForm button[type="submit"]');
    if (submitBtn) {
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Logging in...';
        submitBtn.disabled = true;
        
        try {
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Store auth data
            localStorage.setItem('ecoToken', data.token);
            localStorage.setItem('ecoUser', JSON.stringify(data.user));
            setCookie('ecoToken', data.token, 30);
            setCookie('ecoUser', JSON.stringify(data.user), 30);
            
            showToast('Login successful! Redirecting...', 'success');
            
            // Redirect based on role
            setTimeout(() => {
                if (data.user.role === 'admin') {
                    window.location.href = '../admin/admin.html';
                } else {
                    window.location.href = '../index.html';
                }
            }, 1500);
            
        } catch (err) {
            showToast(err.message || 'Login failed. Please try again.', 'error');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }
}

async function handleSignup(name, email, phone, password) {
    const submitBtn = document.querySelector('#signupForm button[type="submit"]');
    if (submitBtn) {
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Creating account...';
        submitBtn.disabled = true;
        
        try {
            const res = await fetch(`${API_BASE}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, phone, password })
            });

            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            // Store auth data
            localStorage.setItem('ecoToken', data.token);
            localStorage.setItem('ecoUser', JSON.stringify(data.user));
            setCookie('ecoToken', data.token, 30);
            setCookie('ecoUser', JSON.stringify(data.user), 30);
            
            showToast('Account created successfully! Redirecting...', 'success');
            
            // Redirect to main page
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 1500);
            
        } catch (err) {
            showToast(err.message || 'Registration failed. Please try again.', 'error');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }
}

function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    // Map type to class for styles.css consistency
    const toastClass = type === 'info' ? '' : type;
    toast.className = `toast ${toastClass}`;
    toast.innerHTML = `
        <div class="toast-content">
            <span id="toastMessage">${message}</span>
        </div>
    `;
    
    // Add to body
    document.body.appendChild(toast);
    
    // Trigger entrance transition
    requestAnimationFrame(() => {
        toast.classList.add('active');
    });
    
    // Log to console for debugging
    if (type === 'error') {
        console.error(`Toast Error: ${message}`);
    }

    // Remove after 8 seconds
    setTimeout(() => {
        toast.classList.remove('active');
        // Wait for slide-out transition before removing from DOM
        setTimeout(() => toast.remove(), 350);
    }, 8000);
}

// Add theme toggle logic for auth pages (replaces script.js dependency)
(function() {
    const themeToggle = document.getElementById('themeToggle');
    
    // Initial check
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark');
        if (themeToggle) themeToggle.innerText = '☀️ Light';
    }
    
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            if (document.body.classList.contains('dark')) {
                localStorage.setItem('theme', 'dark');
                themeToggle.innerText = '☀️ Light';
            } else {
                localStorage.setItem('theme', 'light');
                themeToggle.innerText = '🌙 Dark';
            }
        });
    }
})();
