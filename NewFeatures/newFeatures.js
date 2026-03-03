// ============================================
// Goa Eco-Guard: NewFeatures Frontend
// Injects sections into <main> and adds logic
// for Stories, Sightings, and Proximity Alerts.
//
// Usage (in index.html before </body>):
//   <link rel="stylesheet" href="NewFeatures/newFeatures.css">
//   <script src="NewFeatures/newFeatures.js"></script>
// ============================================

(function () {
  'use strict';

  const API = window.__API_BASE__ ||
    document.querySelector('meta[name="api-base"]')?.content ||
    ((location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? 'http://localhost:3000'
      : location.origin);

  // ---------- Auth helpers (reuse from main app) ----------
  function getToken() {
    return localStorage.getItem('ecoToken') || null;
  }
  function getAuthHeader() {
    const t = getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  }
  function isLoggedIn() { return !!getToken(); }

  // ==============================================
  // 1. INJECT HTML SECTIONS INTO <main>
  // ==============================================
  function injectSections() {
    const main = document.querySelector('main');
    if (!main) return;

    // --- Eco Stories Section ---
    const storiesHTML = `
    <section id="nf-stories" class="nf-section section">
      <div class="nf-container container">
        <div class="nf-section-header section-header">
          <h2 class="nf-section-title section-title"><span class="gradient-text">Eco-Stories</span></h2>
          <p class="nf-section-subtitle section-subtitle">
            Share your impact! Post your cleanup experiences with Before & After photos and inspire the community.
          </p>
        </div>
        <div class="nf-story-controls">
          <button class="nf-btn nf-btn-primary" id="nfCreateStoryBtn">📸 Share Your Story</button>
        </div>
        <div class="nf-stories-grid" id="nfStoriesGrid"></div>
        <div class="nf-load-more" id="nfLoadMore" style="display:none;">
          <button class="nf-btn" id="nfLoadMoreBtn">Load More Stories</button>
        </div>
      </div>
    </section>`;

    // --- Sighting Reports Section ---
    const sightingsHTML = `
    <section id="nf-sightings" class="nf-section section section-alt">
      <div class="nf-container container">
        <div class="nf-section-header section-header">
          <h2 class="nf-section-title section-title"><span class="gradient-text">Biodiversity Tracker</span></h2>
          <p class="nf-section-subtitle section-subtitle">
            Spotted a rare species? Report wildlife sightings to help build Goa's biodiversity map. Green pins appear on the heatmap.
          </p>
        </div>
        <div class="nf-sighting-layout">
          <div class="nf-sighting-form-card">
            <h3 style="font-weight:700;margin-bottom:20px;">🦎 Report a Sighting</h3>
            <form id="nfSightingForm">
              <div class="nf-form-group">
                <label for="nfSpecies">Species Name *</label>
                <input type="text" id="nfSpecies" placeholder="e.g., Olive Ridley Turtle, Kingfisher" required>
              </div>
              <div class="nf-form-group">
                <label for="nfSightDesc">Description</label>
                <textarea id="nfSightDesc" rows="3" placeholder="What did you see? Any notable behavior?"></textarea>
              </div>
              <div class="nf-form-group">
                <label for="nfSightLocation">Location Name</label>
                <input type="text" id="nfSightLocation" placeholder="e.g., Morjim Beach">
              </div>
              <div class="nf-form-group">
                <label>Photo (optional)</label>
                <input type="file" id="nfSightImage" accept="image/*" style="font-size:0.85rem;">
              </div>
              <input type="hidden" id="nfSightLat">
              <input type="hidden" id="nfSightLng">
              <button type="button" id="nfGetSightLocation" class="nf-btn" style="width:100%;margin-bottom:14px;">
                 Use Current Location
              </button>
              <p id="nfSightLocStatus" style="font-size:0.82rem;color:#16a34a;display:none;margin-bottom:10px;">
                ✔ Location captured
              </p>
              <button type="submit" class="nf-btn nf-btn-primary" style="width:100%;">
               Submit Sighting
              </button>
            </form>
          </div>
          <div class="nf-sighting-list-card">
            <h3 style="font-weight:700;margin-bottom:20px;">Recent Sightings</h3>
            <div id="nfSightingsList"></div>
          </div>
        </div>
      </div>
    </section>`;

    // Find the About section and insert BEFORE it (so these appear between Guide and About)
    const aboutSection = document.getElementById('about');
    if (aboutSection) {
      aboutSection.insertAdjacentHTML('beforebegin', storiesHTML + sightingsHTML);
    } else {
      main.insertAdjacentHTML('beforeend', storiesHTML + sightingsHTML);
    }

    // Add nav buttons
    addNavButtons();
  }

  // Add navigation buttons to both desktop and mobile navs
  function addNavButtons() {
    const desktopNav = document.querySelector('.nav-desktop');
    const mobileNav = document.querySelector('.nav-mobile');

    const storiesBtn = `<button class="nav-link" data-section="nf-stories">Stories</button>`;
    const sightingsBtn = `<button class="nav-link" data-section="nf-sightings">Sightings</button>`;

    // Insert before About button in desktop nav
    const aboutBtnDesktop = desktopNav?.querySelector('[data-section="about"]');
    if (aboutBtnDesktop) {
      aboutBtnDesktop.insertAdjacentHTML('beforebegin', storiesBtn + sightingsBtn);
    }

    // Insert before About button in mobile nav
    const aboutBtnMobile = mobileNav?.querySelector('[data-section="about"]');
    if (aboutBtnMobile) {
      aboutBtnMobile.insertAdjacentHTML('beforebegin', storiesBtn + sightingsBtn);
    }
  }

  // ==============================================
  // 2. ECO STORIES LOGIC
  // ==============================================
  let storiesPage = 1;
  let allStoriesLoaded = false;

  async function loadStories(append = false) {
    try {
      const res = await fetch(`${API}/api/stories?page=${storiesPage}&limit=6`);
      const json = await res.json();

      const grid = document.getElementById('nfStoriesGridMain') || document.getElementById('nfStoriesGrid');
      const loadMoreDiv = document.getElementById('nfLoadMore');
      if (!grid) return;

      if (!append) grid.innerHTML = '';

      if (!json.stories || json.stories.length === 0) {
        if (!append) {
          grid.innerHTML = `
            <div class="nf-empty-state" style="grid-column: 1 / -1;">
              <div class="nf-empty-icon">📖</div>
              <h3>No stories yet</h3>
              <p>Be the first to share your eco-impact story!</p>
            </div>`;
        }
        allStoriesLoaded = true;
        if (loadMoreDiv) loadMoreDiv.style.display = 'none';
        return;
      }

      json.stories.forEach((story, i) => {
        const card = buildStoryCard(story, i);
        grid.insertAdjacentHTML('beforeend', card);
      });

      // Init image compare sliders for newly added cards
      initCompareSliders();

      if (storiesPage >= json.totalPages) {
        allStoriesLoaded = true;
        if (loadMoreDiv) loadMoreDiv.style.display = 'none';
      } else {
        if (loadMoreDiv) loadMoreDiv.style.display = 'block';
      }
    } catch (err) {
      console.error('Failed to load stories:', err);
    }
  }

  function buildStoryCard(story, index) {
    const userName = story.users?.name || 'Eco-Warrior';
    const initial = userName.charAt(0).toUpperCase();
    const timeAgo = getTimeAgo(story.created_at);

    let imageSection = '';
    if (story.before_image && story.after_image) {
      imageSection = `
        <div class="nf-image-compare" data-compare>
          <img src="${story.before_image}" alt="Before" class="nf-img-before">
          <img src="${story.after_image}" alt="After" class="nf-img-after">
          <div class="nf-compare-divider"></div>
          <div class="nf-compare-labels">
            <span class="nf-compare-label before">Before</span>
            <span class="nf-compare-label after">After</span>
          </div>
        </div>`;
    } else if (story.after_image) {
      imageSection = `<img src="${story.after_image}" alt="Story" class="nf-story-single-image">`;
    } else if (story.before_image) {
      imageSection = `<img src="${story.before_image}" alt="Story" class="nf-story-single-image">`;
    }

    return `
    <div class="nf-story-card" style="animation-delay:${index * 0.08}s" data-story-id="${story.id}">
      ${imageSection}
      <div class="nf-story-body">
        <div class="nf-story-meta">
          <div class="nf-story-avatar" onclick="if(window.app) window.app.openUserProfile('${story.user_id}')">${initial}</div>
          <div class="nf-story-user-info">
            <span class="nf-story-username">${userName}</span>
            ${story.users?.is_verified ? `<span class="verified-icon"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg></span>` : ''}
            <span class="nf-story-time">${timeAgo}</span>
          </div>
        </div>
        <div class="nf-story-title">${escapeHTML(story.title)}</div>
        ${story.description ? `<div class="nf-story-desc">${escapeHTML(story.description)}</div>` : ''}
        
        <div class="social-actions" style="margin-top:12px; padding-top:8px;">
            <button class="social-btn like-btn ${isStoryLiked(story.id) ? 'liked' : ''}" onclick="if(window.app) window.app.handleSocialAction('like', '${story.id}', 'story', this)">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <span class="count">${story.likes_count || 0}</span>
            </button>
            <button class="social-btn comment-btn" onclick="if(window.app) window.app.toggleComments('${story.id}', 'story', this)">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                <span class="count">${story.comments_count || 0}</span>
            </button>
            <button class="social-btn share-btn" onclick="if(window.app) window.app.handleSocialAction('share', '${story.id}', 'story', this)">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
        </div>
        <div class="comment-section-mini" id="comments-${story.id}">
            <div class="comment-list-mini" id="commentList-${story.id}"></div>
            <div class="comment-input-area">
                <input type="text" id="commentInput-${story.id}" placeholder="Post a reply..." onkeydown="if(event.key==='Enter' && window.app) window.app.postComment('${story.id}', 'story', this.value, this)">
            </div>
        </div>
      </div>
    </div>`;
  }

  // Before/After image comparison slider
  function initCompareSliders() {
    document.querySelectorAll('[data-compare]').forEach(container => {
      if (container._compareInit) return;
      container._compareInit = true;

      const afterImg = container.querySelector('.nf-img-after');
      const divider = container.querySelector('.nf-compare-divider');
      if (!afterImg || !divider) return;

      let isDragging = false;

      function updateSlider(x) {
        const rect = container.getBoundingClientRect();
        let pct = ((x - rect.left) / rect.width) * 100;
        pct = Math.max(5, Math.min(95, pct));
        afterImg.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
        divider.style.left = pct + '%';
      }

      container.addEventListener('mousedown', (e) => { isDragging = true; updateSlider(e.clientX); });
      container.addEventListener('mousemove', (e) => { if (isDragging) updateSlider(e.clientX); });
      document.addEventListener('mouseup', () => { isDragging = false; });
      container.addEventListener('touchstart', (e) => { isDragging = true; updateSlider(e.touches[0].clientX); });
      container.addEventListener('touchmove', (e) => { if (isDragging) { e.preventDefault(); updateSlider(e.touches[0].clientX); } }, { passive: false });
      document.addEventListener('touchend', () => { isDragging = false; });
    });
  }

  // Create Story Modal
  function openCreateStoryModal() {
    if (!isLoggedIn()) {
      window.location.href = 'login/login.html';
      return;
    }

    // Remove existing modal if any
    document.getElementById('nfStoryModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'nfStoryModal';
    modal.className = 'nf-modal-overlay';
    modal.innerHTML = `
      <div class="nf-modal">
        <div class="nf-modal-header">
          <h3>📸 Share Your Eco-Story</h3>
          <button class="nf-modal-close" id="nfCloseStoryModal">✕</button>
        </div>
        <form id="nfStoryForm">
          <div class="nf-form-group">
            <label>Title *</label>
            <input type="text" id="nfStoryTitle" placeholder="e.g., Baga Beach Cleanup Success!" required>
          </div>
          <div class="nf-form-group">
            <label>Description</label>
            <textarea id="nfStoryDesc" rows="3" placeholder="Share what happened, how it felt, and the impact..."></textarea>
          </div>
          <div class="nf-form-group">
            <label>📷 Before Photo</label>
            <div class="nf-upload-area" id="nfBeforeUploadArea">
              <div class="nf-upload-icon">📷</div>
              <p>Click to upload BEFORE image</p>
            </div>
            <input type="file" id="nfBeforeImage" accept="image/*" style="display:none;">
            <img id="nfBeforePreview" class="nf-upload-preview" alt="Before preview">
          </div>
          <div class="nf-form-group">
            <label>✨ After Photo</label>
            <div class="nf-upload-area" id="nfAfterUploadArea">
              <div class="nf-upload-icon">✨</div>
              <p>Click to upload AFTER image</p>
            </div>
            <input type="file" id="nfAfterImage" accept="image/*" style="display:none;">
            <img id="nfAfterPreview" class="nf-upload-preview" alt="After preview">
          </div>
          <button type="submit" class="nf-btn nf-btn-primary" style="width:100%;">🌿 Publish Story</button>
        </form>
      </div>`;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));

    // Close handlers
    document.getElementById('nfCloseStoryModal').addEventListener('click', () => closeStoryModal());
    modal.addEventListener('click', (e) => { if (e.target === modal) closeStoryModal(); });

    // Upload area click handlers
    document.getElementById('nfBeforeUploadArea').addEventListener('click', () => document.getElementById('nfBeforeImage').click());
    document.getElementById('nfAfterUploadArea').addEventListener('click', () => document.getElementById('nfAfterImage').click());

    // Preview handlers
    document.getElementById('nfBeforeImage').addEventListener('change', (e) => previewFile(e.target, 'nfBeforePreview', 'nfBeforeUploadArea'));
    document.getElementById('nfAfterImage').addEventListener('change', (e) => previewFile(e.target, 'nfAfterPreview', 'nfAfterUploadArea'));

    // Form submit
    document.getElementById('nfStoryForm').addEventListener('submit', handleStorySubmit);
  }

  function closeStoryModal() {
    const modal = document.getElementById('nfStoryModal');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 300);
    }
  }

  function previewFile(input, previewId, areaId) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById(previewId);
      const area = document.getElementById(areaId);
      preview.src = e.target.result;
      preview.style.display = 'block';
      area.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  async function handleStorySubmit(e) {
    e.preventDefault();

    const title = document.getElementById('nfStoryTitle').value.trim();
    const description = document.getElementById('nfStoryDesc').value.trim();
    const beforeFile = document.getElementById('nfBeforeImage').files[0];
    const afterFile = document.getElementById('nfAfterImage').files[0];

    if (!title) {
      showToast('Please enter a title', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    if (description) formData.append('description', description);
    if (beforeFile) formData.append('before_image', beforeFile);
    if (afterFile) formData.append('after_image', afterFile);

    try {
      const res = await fetch(`${API}/api/stories`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create story');

      showToast('Story published! 🎉', 'success');
      closeStoryModal();
      storiesPage = 1;
      loadStories();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ---------- Liked stories (localStorage — one like per user) ----------
  function getLikedStories() {
    try {
      const ls = localStorage.getItem('nf_liked_stories');
      return ls ? JSON.parse(ls) : [];
    } catch { return []; }
  }
  function markStoryLiked(storyId) {
    const liked = getLikedStories();
    if (!liked.includes(String(storyId))) {
      liked.push(String(storyId));
      localStorage.setItem('nf_liked_stories', JSON.stringify(liked));
    }
  }
  function isStoryLiked(storyId) {
    return getLikedStories().includes(String(storyId));
  }

  // Like handler — one like per user
  async function handleLike(storyId, btn) {
    if (isStoryLiked(storyId)) {
      showToast('You already liked this story ❤️', 'error');
      return;
    }
    try {
      const res = await fetch(`${API}/api/stories/${storyId}/like`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        const span = btn.querySelector('span');
        span.textContent = data.likes_count;
        btn.classList.add('liked');
        markStoryLiked(storyId);
      }
    } catch (err) {
      console.error('Like error:', err);
    }
  }

  // ==============================================
  // 3. SIGHTING REPORTS LOGIC
  // ==============================================
  async function loadSightings() {
    try {
      const res = await fetch(`${API}/api/sightings`);
      const sightings = await res.json();

      const list = document.getElementById('nfSightingsListMain') || document.getElementById('nfSightingsList');
      if (!list) return;

      if (!sightings || sightings.length === 0) {
        list.innerHTML = `
          <div class="nf-empty-state">
            <div class="nf-empty-icon">🦋</div>
            <h4>No sightings yet</h4>
            <p>Be the first to report a wildlife sighting!</p>
          </div>`;
        return;
      }

      list.innerHTML = sightings.map(s => {
        const icon = getSpeciesIcon(s.species_name);
        const userName = s.users?.name || 'Anonymous';
        const isVerified = s.users?.is_verified;
        const timeAgo = getTimeAgo(s.created_at);
        const likesCount = s.likes_count || 0;
        const thumbHtml = s.image_url
          ? `<img src="${s.image_url}" alt="${escapeHTML(s.species_name)}" class="nf-sighting-thumb" data-nf-popup-img="${s.image_url}" onclick="if(window.app) window.app.openImagePopup('${s.image_url}')">`
          : '';
        return `
          <div class="nf-sighting-item" data-sighting-id="${s.id}">
            <div class="nf-sighting-icon">${icon}</div>
            <div class="nf-sighting-info">
              <div class="nf-sighting-user-line">
                <span class="nf-sighting-user" onclick="if(window.app) window.app.openUserProfile('${s.user_id}')">${escapeHTML(userName)}</span>
                ${isVerified ? `<span class="verified-icon"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg></span>` : ''}
                <span class="nf-sighting-time">• ${timeAgo}</span>
              </div>
              <h4 style="margin: 4px 0;">${escapeHTML(s.species_name)}</h4>
              ${s.description ? `<p>${escapeHTML(s.description)}</p>` : ''}
              ${thumbHtml}
              <div class="nf-sighting-meta">📍 ${escapeHTML(s.location || 'Unknown')}</div>
              
              <div class="social-actions" style="border-top:none; margin-top:5px; padding-top:0;">
                <button class="social-btn like-btn" onclick="if(window.app) window.app.handleSocialAction('like', '${s.id}', 'sighting', this)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    <span class="count">${likesCount}</span>
                </button>
                <button class="social-btn comment-btn" onclick="if(window.app) window.app.toggleComments('${s.id}', 'sighting', this)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                    <span class="count">${s.comments_count || 0}</span>
                </button>
                <button class="social-btn share-btn" onclick="if(window.app) window.app.handleSocialAction('share', '${s.id}', 'sighting', this)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                </button>
              </div>
              <div class="comment-section-mini" id="comments-${s.id}">
                <div class="comment-list-mini" id="commentList-${s.id}"></div>
                <div class="comment-input-area">
                    <input type="text" id="commentInput-${s.id}" placeholder="Post a reply..." onkeydown="if(event.key==='Enter' && window.app) window.app.postComment('${s.id}', 'sighting', this.value, this)">
                </div>
              </div>
            </div>
          </div>`;
      }).join('');

      // Add sighting markers to the map
      addSightingsToMap(sightings);
    } catch (err) {
      console.error('Failed to load sightings:', err);
    }
  }

  function getSpeciesIcon(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('turtle')) return '🐢';
    if (n.includes('bird') || n.includes('kingfisher') || n.includes('eagle')) return '🐦';
    if (n.includes('dolphin')) return '🐬';
    if (n.includes('snake') || n.includes('cobra')) return '🐍';
    if (n.includes('fish')) return '🐟';
    if (n.includes('frog')) return '🐸';
    if (n.includes('deer') || n.includes('gaur')) return '🦌';
    if (n.includes('butterfly')) return '🦋';
    if (n.includes('crab')) return '🦀';
    if (n.includes('monkey') || n.includes('langur')) return '🐒';
    if (n.includes('mangrove') || n.includes('tree') || n.includes('plant')) return '🌿';
    return '🦎';
  }

  // Add green pins on the Leaflet map
  function addSightingsToMap(sightings) {
    // Wait for the main app's map to be ready
    const checkMap = setInterval(() => {
      if (window.app?.map) {
        clearInterval(checkMap);
        const map = window.app.map;

        sightings.forEach(s => {
          if (!s.latitude || !s.longitude) return;

          const icon = L.divIcon({
            className: '',
            html: `<div style="
              width:20px;height:20px;
              background:#16a34a;
              border-radius:50%;
              border:3px solid white;
              box-shadow:0 0 8px rgba(22,163,74,0.5);
              display:flex;align-items:center;justify-content:center;
              font-size:10px;
            ">🦎</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });

          L.marker([s.latitude, s.longitude], { icon })
            .addTo(map)
            .bindPopup(`
              <div style="min-width:180px;">
                <strong style="color:#16a34a;">${getSpeciesIcon(s.species_name)} ${escapeHTML(s.species_name)}</strong>
                ${s.description ? `<p style="margin:6px 0 0;font-size:12px;">${escapeHTML(s.description)}</p>` : ''}
                ${s.image_url ? `<img src="${s.image_url}" style="width:100%;border-radius:6px;margin-top:8px;" alt="Sighting">` : ''}
                <p style="margin-top:6px;font-size:11px;color:#6b7280;">📍 ${escapeHTML(s.location || 'Unknown')}</p>
              </div>
            `);
        });
      }
    }, 500);

    // Stop checking after 15 seconds
    setTimeout(() => clearInterval(checkMap), 15000);
  }

  // Sighting form handlers
  function initSightingForm() {
    const form = document.getElementById('nfSightingForm');
    const locBtn = document.getElementById('nfGetSightLocation');
    const sightLocInput = document.getElementById('nfSightLocation');
    const statusMsg = document.getElementById('nfSightLocStatus');

    if (locBtn) {
      locBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
          showToast('Geolocation not supported', 'error');
          return;
        }
        locBtn.textContent = '🔄 Capturing...';
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            document.getElementById('nfSightLat').value = pos.coords.latitude;
            document.getElementById('nfSightLng').value = pos.coords.longitude;
            statusMsg.textContent = '✔ Location captured via GPS';
            statusMsg.style.display = 'block';
            statusMsg.style.color = '#16a34a';
            locBtn.textContent = 'Use Current Location';
            showToast('Location captured! ✔', 'success');
          },
          (err) => {
            showToast('Location access denied', 'error');
            locBtn.textContent = 'Use Current Location';
          },
          { enableHighAccuracy: true }
        );
      });
    }

    // Manual typing geocoding for sightings
    if (sightLocInput) {
      let debounce;
      sightLocInput.addEventListener('input', () => {
        // Hide GPS button if user types manually
        if (sightLocInput.value.length > 3) {
          if (locBtn) locBtn.style.display = 'none';
        } else if (sightLocInput.value.length === 0) {
          if (locBtn) locBtn.style.display = 'block';
        }

        clearTimeout(debounce);
        debounce = setTimeout(async () => {
          const query = sightLocInput.value;
          if (!query || query.length < 3) return;

          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Goa')}&limit=1`);
            const data = await res.json();
            if (data && data.length > 0) {
              document.getElementById('nfSightLat').value = data[0].lat;
              document.getElementById('nfSightLng').value = data[0].lon;
              statusMsg.textContent = '📍 Coordinates found via search';
              statusMsg.style.display = 'block';
              statusMsg.style.color = '#22c55e';
            } else {
              statusMsg.textContent = 'Searching for location details...';
              statusMsg.style.display = 'block';
              statusMsg.style.color = '#6b7280';
            }
          } catch (e) { console.error('Geocoding error:', e); }
        }, 800);
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!isLoggedIn()) {
          window.location.href = 'login/login.html';
          return;
        }

        const lat = document.getElementById('nfSightLat').value;
        const lng = document.getElementById('nfSightLng').value;
        if (!lat || !lng) {
          showToast('Please wait for location to be identified', 'error');
          return;
        }

        const formData = new FormData();
        formData.append('species_name', document.getElementById('nfSpecies').value);
        formData.append('description', document.getElementById('nfSightDesc').value);
        formData.append('location', sightLocInput.value);
        formData.append('latitude', lat);
        formData.append('longitude', lng);

        const imageFile = document.getElementById('nfSightImage').files[0];
        if (imageFile) formData.append('image', imageFile);

        try {
          const res = await fetch(`${API}/api/sightings`, {
            method: 'POST',
            headers: getAuthHeader(),
            body: formData
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to submit sighting');

          showToast('Sighting reported! 🦎', 'success');
          form.reset();
          if (statusMsg) statusMsg.style.display = 'none';
          if (locBtn) locBtn.style.display = 'block';
          loadSightings();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }
  }

  // ==============================================
  // 4. PROXIMITY ALERTS
  // ==============================================
  function initProximityAlerts() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`${API}/api/alerts/nearby?lat=${latitude}&lng=${longitude}&radius=5`);
          const data = await res.json();

          if (data.alerts && data.alerts.length > 0) {
            const nearest = data.alerts[0];
            showAlertBanner(nearest);
          }
        } catch (err) {
          console.warn('Proximity check failed:', err);
        }
      },
      () => { /* silently fail if denied */ },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  function showAlertBanner(report) {
    // Remove existing banner if any
    document.getElementById('nfAlertBanner')?.remove();

    const distance = report.distance_km.toFixed(1);
    const banner = document.createElement('div');
    banner.id = 'nfAlertBanner';
    banner.className = 'nf-alert-banner';
    banner.innerHTML = `
      <div class="nf-alert-icon">🚨</div>
      <div class="nf-alert-body">
        <div class="nf-alert-title">Environmental Alert Nearby!</div>
        <div class="nf-alert-desc">
          ${escapeHTML(report.description || report.location || 'Issue reported')} — ${distance}km away
        </div>
      </div>
      <button class="nf-alert-close" id="nfCloseAlert">✕</button>`;

    document.body.appendChild(banner);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        banner.classList.add('visible');
      });
    });

    document.getElementById('nfCloseAlert').addEventListener('click', () => {
      banner.classList.remove('visible');
      setTimeout(() => banner.remove(), 400);
    });

    // Auto-dismiss after 15 seconds
    setTimeout(() => {
      if (banner.parentNode) {
        banner.classList.remove('visible');
        setTimeout(() => banner.remove(), 400);
      }
    }, 15000);
  }

  // ==============================================
  // UTILITIES
  // ==============================================
  function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getTimeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  }

  function showToast(message, type = 'success') {
    // Try to use main app's toast
    if (window.app?.showToast) {
      window.app.showToast(message, type);
      return;
    }
    // Fallback simple toast
    const toast = document.createElement('div');
    toast.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      padding:12px 24px;border-radius:10px;z-index:99999;
      font-size:0.9rem;font-weight:600;color:#fff;
      box-shadow:0 8px 24px rgba(0,0,0,0.2);
      animation:nfFadeInUp 0.3s ease;
      background:${type === 'error' ? '#dc2626' : '#16a34a'};`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 2500);
    setTimeout(() => toast.remove(), 3000);
  }

  // ==============================================
  // IMAGE POPUP VIEWER
  // ==============================================
  function openImagePopup(src) {
    document.getElementById('nfImagePopup')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'nfImagePopup';
    overlay.className = 'nf-image-popup-overlay';
    overlay.innerHTML = `
      <div class="nf-image-popup-content">
        <button class="nf-image-popup-close">✕</button>
        <img src="${src}" alt="Sighting photo">
      </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    // Close handlers
    overlay.querySelector('.nf-image-popup-close').addEventListener('click', () => closeImagePopup());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeImagePopup(); });
  }

  function closeImagePopup() {
    const popup = document.getElementById('nfImagePopup');
    if (popup) {
      popup.classList.remove('active');
      setTimeout(() => popup.remove(), 300);
    }
  }

  // ==============================================
  // GLOBAL EVENT DELEGATION
  // ==============================================
  document.addEventListener('click', (e) => {
    // Create Story button
    if (e.target.id === 'nfCreateStoryBtn' || e.target.closest('#nfCreateStoryBtn')) {
      openCreateStoryModal();
      return;
    }

    // Like button
    const likeBtn = e.target.closest('.nf-like-btn');
    if (likeBtn) {
      const storyId = likeBtn.dataset.storyId;
      if (storyId) handleLike(storyId, likeBtn);
      return;
    }

    // Sighting image popup
    const popupImg = e.target.closest('[data-nf-popup-img]');
    if (popupImg) {
      openImagePopup(popupImg.dataset.nfPopupImg);
      return;
    }

    // Load more stories
    if (e.target.id === 'nfLoadMoreBtn') {
      if (!allStoriesLoaded) {
        storiesPage++;
        loadStories(true);
      }
      return;
    }
  });

  // ==============================================
  // INIT ON DOM READY
  // ==============================================
  function init() {
    injectSections();
    loadStories();
    loadSightings();
    initSightingForm();

    // Delay proximity alerts so it doesn't interfere with page load
    setTimeout(() => initProximityAlerts(), 3000);

    console.log('✅ [NewFeatures] Loaded — Stories, Sightings, Proximity Alerts');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose to window for tab switching logic
  window.loadStories = loadStories;
  window.loadSightings = loadSightings;

})();
