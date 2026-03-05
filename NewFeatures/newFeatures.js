// ============================================
// Goa Eco-Guard: NewFeatures Frontend
// ============================================

(function () {
  'use strict';

  const API = window.__API_BASE__ ||
    document.querySelector('meta[name="api-base"]')?.content ||
    ((location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? 'http://localhost:3000'
      : location.origin);

  // ---------- Auth helpers ----------
  function getToken() {
    return localStorage.getItem('ecoToken') || null;
  }
  function getAuthHeader() {
    const t = getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  }
  function isLoggedIn() { return !!getToken(); }

  // ==============================================
  // 1. INJECT SECTIONS INTO <main> (ONCE)
  // ==============================================
  function injectSections() {
    // Check if sections already exist
    if (document.getElementById('nf-stories')) return;
    
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
                <input type="file" id="nfSightImage" accept="image/*">
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

    // Insert after the tourist-guide section
    const touristGuide = document.getElementById('tourist-guide');
    if (touristGuide) {
      touristGuide.insertAdjacentHTML('afterend', storiesHTML + sightingsHTML);
    } else {
      const aboutSection = document.getElementById('about');
      if (aboutSection) {
        aboutSection.insertAdjacentHTML('beforebegin', storiesHTML + sightingsHTML);
      } else {
        main.insertAdjacentHTML('beforeend', storiesHTML + sightingsHTML);
      }
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
  // 2. STORIES DATA - LOAD FOR BOTH PLACES
  // ==============================================
  let storiesPage = 1;
  let allStoriesLoaded = false;

  // Load stories for both dedicated section AND feed tabs
// In newFeatures.js - replace the loadStories function

async function loadStories(target = 'both') {
  try {
    console.log('📖 Loading stories...');
    
    // Use the main stories endpoint, not simple-stories
    const res = await fetch(`${API}/api/stories?page=${storiesPage}&limit=10`);
    
    if (!res.ok) {
      console.error('❌ Stories API returned error:', res.status);
      return;
    }
    
    const data = await res.json();
    const stories = data.stories || [];
    console.log('📊 Stories loaded:', stories.length);

    // Load into dedicated stories grid
    if (target === 'both' || target === 'dedicated') {
      const dedicatedGrid = document.getElementById('nfStoriesGrid');
      if (dedicatedGrid) {
        if (!stories || stories.length === 0) {
          dedicatedGrid.innerHTML = `
            <div class="nf-empty-state" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
              <div class="nf-empty-icon" style="font-size: 48px; margin-bottom: 16px;">📖</div>
              <h3 style="margin-bottom: 8px;">No stories yet</h3>
              <p style="color: var(--muted-foreground); margin-bottom: 20px;">Be the first to share your eco-impact story!</p>
              <button class="nf-btn nf-btn-primary" onclick="document.getElementById('nfCreateStoryBtn')?.click()">
                Share Your Story
              </button>
            </div>`;
        } else {
          dedicatedGrid.innerHTML = stories.map((story, index) => 
            buildStoryCard(story, index)
          ).join('');
        }
      }
    }

    // Load into feed tabs
    if (target === 'both' || target === 'feed') {
      const feedGrid = document.getElementById('nfStoriesGridMain');
      if (feedGrid) {
        if (!stories || stories.length === 0) {
          feedGrid.innerHTML = `
            <div class="nf-empty-state" style="text-align: center; padding: 40px 20px;">
              <div class="nf-empty-icon" style="font-size: 48px; margin-bottom: 16px;">📖</div>
              <h4 style="margin-bottom: 8px;">No stories yet</h4>
              <p style="color: var(--muted-foreground);">Be the first to share your eco-impact story!</p>
            </div>`;
        } else {
          feedGrid.innerHTML = stories.slice(0, 3).map((story, index) => 
            buildStoryCard(story, index)
          ).join('');
        }
      }
    }

    // Initialize compare sliders for before/after images
    setTimeout(initCompareSliders, 500);
    
    console.log(`✅ Loaded ${stories.length} stories`);
  } catch (err) {
    console.error('❌ Failed to load stories:', err);
  }
}
// In newFeatures.js - add this function if missing

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
            <span class="nf-story-username">${escapeHTML(userName)}</span>
            ${story.users?.is_verified ? `<span class="verified-icon">✓</span>` : ''}
            <span class="nf-story-time">${timeAgo}</span>
          </div>
        </div>
        <div class="nf-story-title">${escapeHTML(story.title)}</div>
        ${story.description ? `<div class="nf-story-desc">${escapeHTML(story.description)}</div>` : ''}
        
        <div class="social-actions" style="margin-top:12px; padding-top:8px;">
            <button class="social-btn like-btn ${isStoryLiked(story.id) ? 'liked' : ''}" onclick="if(window.app) window.app.handleSocialAction('like', '${story.id}', 'story', this)">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <span class="count">${story.likes_count || 0}</span>
            </button>
            <button class="social-btn comment-btn" onclick="if(window.app) window.app.toggleComments('${story.id}', 'story', this)">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                <span class="count">${story.comments_count || 0}</span>
            </button>
            <button class="social-btn share-btn" onclick="if(window.app) window.app.handleSocialAction('share', '${story.id}', 'story', this)">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
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
// Simplified story card builder without joins
// In newFeatures.js - update buildSimpleStoryCard function

function buildSimpleStoryCard(story, index) {
    const userName = 'Eco-Warrior';
    const initial = 'U';
    const timeAgo = getTimeAgo(story.created_at);
    
    // Check if story is liked (from localStorage)
    const likedStories = getLikedStories(); // Your existing function
    const isLiked = likedStories.includes(String(story.id));

    let imageSection = '';
    if (story.before_image && story.after_image) {
        imageSection = `<div class="nf-image-compare" data-compare>...</div>`;
    } else if (story.after_image) {
        imageSection = `<img src="${story.after_image}" alt="Story" class="nf-story-single-image">`;
    } else if (story.before_image) {
        imageSection = `<img src="${story.before_image}" alt="Story" class="nf-story-single-image">`;
    }

    return `
        <div class="nf-story-card" data-story-id="${story.id}">
            ${imageSection}
            <div class="nf-story-body">
                <div class="nf-story-meta">
                    <div class="nf-story-avatar">${initial}</div>
                    <div class="nf-story-user-info">
                        <span class="nf-story-username">${userName}</span>
                        <span class="nf-story-time">${timeAgo}</span>
                    </div>
                </div>
                <div class="nf-story-title">${escapeHTML(story.title)}</div>
                ${story.description ? `<div class="nf-story-desc">${escapeHTML(story.description)}</div>` : ''}        
                <div class="social-actions" style="margin-top:12px; padding-top:8px;">
                    <button class="social-btn like-btn ${isLiked ? 'liked' : ''}" onclick="window.app.handleSocialAction('like', '${story.id}', 'story', this)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        <span class="count">${story.likes_count || 0}</span>
                    </button>
                    <button class="social-btn comment-btn" onclick="window.app.toggleComments('${story.id}', 'story', this)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                        <span class="count">${story.comments_count || 0}</span>
                    </button>
                    <button class="social-btn share-btn" onclick="window.app.handleSocialAction('share', '${story.id}', 'story', this)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
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

  // Liked stories helper
  function getLikedStories() {
    try {
      const ls = localStorage.getItem('nf_liked_stories');
      return ls ? JSON.parse(ls) : [];
    } catch { return []; }
  }
  
  function isStoryLiked(storyId) {
    return getLikedStories().includes(String(storyId));
  }

  // ==============================================
  // 3. SIGHTINGS DATA - LOAD FOR BOTH PLACES
  // ==============================================
  async function loadSightings(target = 'both') {
    try {
      console.log('🦎 Loading sightings...');
      
      const res = await fetch(`${API}/api/sightings`);
      
      if (!res.ok) {
        console.error('❌ Sightings API returned error:', res.status);
        return;
      }
      
      const sightings = await res.json();
      console.log('📊 Sightings response:', sightings);

      // Load into dedicated sightings list if requested
      if (target === 'both' || target === 'dedicated') {
        const dedicatedList = document.getElementById('nfSightingsList');
        if (dedicatedList) {
          if (!sightings || sightings.length === 0) {
            dedicatedList.innerHTML = `
              <div class="nf-empty-state" style="text-align: center; padding: 40px 20px;">
                <div class="nf-empty-icon" style="font-size: 48px; margin-bottom: 16px;">🦋</div>
                <h4 style="margin-bottom: 8px;">No sightings yet</h4>
                <p style="color: var(--muted-foreground);">Be the first to report a wildlife sighting!</p>
              </div>`;
          } else {
            dedicatedList.innerHTML = sightings.map(s => {
              const icon = getSpeciesIcon(s.species_name);
              const userName = s.users?.name || 'Anonymous';
              const isVerified = s.users?.is_verified;
              const timeAgo = getTimeAgo(s.created_at);
              const thumbHtml = s.image_url
                ? `<img src="${s.image_url}" alt="${escapeHTML(s.species_name)}" class="nf-sighting-thumb" onclick="if(window.app) window.app.openImagePopup('${s.image_url}')" style="max-width: 200px; border-radius: 8px; margin-top: 8px; cursor: pointer;">`
                : '';
              
              return `
                <div class="nf-sighting-item" data-sighting-id="${s.id}" style="padding: 16px; border-bottom: 1px solid var(--border);">
                  <div style="display: flex; gap: 14px;">
                    <div class="nf-sighting-icon" style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #dcfce7, #bbf7d0); display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">
                      ${icon}
                    </div>
                    <div class="nf-sighting-info" style="flex: 1;">
                      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span style="font-weight: 600; cursor: pointer;" onclick="if(window.app) window.app.openUserProfile('${s.user_id}')">${escapeHTML(userName)}</span>
                        ${isVerified ? '<span class="verified-icon" style="color: #1d9bf0;">✓</span>' : ''}
                        <span style="font-size: 0.75rem; color: var(--muted-foreground);">${timeAgo}</span>
                      </div>
                      <h4 style="margin: 4px 0; font-size: 1.1rem;">${escapeHTML(s.species_name)}</h4>
                      ${s.description ? `<p style="margin: 4px 0; color: var(--muted-foreground);">${escapeHTML(s.description)}</p>` : ''}
                      ${thumbHtml}
                      <div style="margin-top: 6px; font-size: 0.8rem; color: var(--muted-foreground);">📍 ${escapeHTML(s.location || 'Unknown')}</div>
                    </div>
                  </div>
                </div>`;
            }).join('');
          }
        }
      }

      // Load into feed tabs if requested
      if (target === 'both' || target === 'feed') {
        const feedList = document.getElementById('nfSightingsListMain');
        if (feedList) {
          if (!sightings || sightings.length === 0) {
            feedList.innerHTML = `
              <div class="nf-empty-state" style="text-align: center; padding: 40px 20px;">
                <div class="nf-empty-icon" style="font-size: 48px; margin-bottom: 16px;">🦋</div>
                <h4 style="margin-bottom: 8px;">No sightings yet</h4>
                <p style="color: var(--muted-foreground);">Be the first to report a wildlife sighting!</p>
              </div>`;
          } else {
            feedList.innerHTML = sightings.slice(0, 5).map(s => {
              const icon = getSpeciesIcon(s.species_name);
              const userName = s.users?.name || 'Anonymous';
              const isVerified = s.users?.is_verified;
              const timeAgo = getTimeAgo(s.created_at);
              
              return `
                <div class="nf-sighting-item" style="padding: 12px; border-bottom: 1px solid var(--border);">
                  <div style="display: flex; gap: 10px;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #dcfce7, #bbf7d0); display: flex; align-items: center; justify-content: center; font-size: 16px;">
                      ${icon}
                    </div>
                    <div>
                      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                        <span style="font-weight: 600; font-size: 0.85rem;">${escapeHTML(userName)}</span>
                        ${isVerified ? '<span class="verified-icon" style="color: #1d9bf0; font-size: 0.7rem;">✓</span>' : ''}
                        <span style="font-size: 0.65rem; color: var(--muted-foreground);">${timeAgo}</span>
                      </div>
                      <h5 style="margin: 0 0 2px 0; font-size: 0.9rem;">${escapeHTML(s.species_name)}</h5>
                      <div style="font-size: 0.75rem; color: var(--muted-foreground);">📍 ${escapeHTML(s.location || 'Unknown')}</div>
                    </div>
                  </div>
                </div>`;
            }).join('');
          }
        }
      }

      console.log(`✅ Loaded ${sightings?.length || 0} sightings`);
      
      // Add sighting markers to the map
      addSightingsToMap(sightings);
    } catch (err) {
      console.error('❌ Failed to load sightings:', err);
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

  // Add sighting markers to the map
  function addSightingsToMap(sightings) {
    const checkMap = setInterval(() => {
      if (window.app?.map) {
        clearInterval(checkMap);
        const map = window.app.map;

        sightings.forEach(s => {
          if (!s.latitude || !s.longitude) return;

          const icon = L.divIcon({
            className: '',
            html: `<div style="width:20px;height:20px;background:#16a34a;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(22,163,74,0.5);display:flex;align-items:center;justify-content:center;font-size:10px;">🦎</div>`,
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

    setTimeout(() => clearInterval(checkMap), 15000);
  }

  // ==============================================
  // 4. CREATE STORY MODAL
  // ==============================================
  function openCreateStoryModal() {
    if (!isLoggedIn()) {
      window.location.href = 'login/login.html';
      return;
    }

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

    document.getElementById('nfCloseStoryModal').addEventListener('click', () => closeStoryModal());
    modal.addEventListener('click', (e) => { if (e.target === modal) closeStoryModal(); });

    document.getElementById('nfBeforeUploadArea').addEventListener('click', () => document.getElementById('nfBeforeImage').click());
    document.getElementById('nfAfterUploadArea').addEventListener('click', () => document.getElementById('nfAfterImage').click());

    document.getElementById('nfBeforeImage').addEventListener('change', (e) => previewFile(e.target, 'nfBeforePreview', 'nfBeforeUploadArea'));
    document.getElementById('nfAfterImage').addEventListener('change', (e) => previewFile(e.target, 'nfAfterPreview', 'nfAfterUploadArea'));

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
      showSimpleToast('Please enter a title', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    if (description) formData.append('description', description);
    if (beforeFile) formData.append('before_image', beforeFile);
    if (afterFile) formData.append('after_image', afterFile);

    try {
      const token = getToken();
      const res = await fetch(`${API}/api/stories`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create story');

      showSimpleToast('Story published! 🎉', 'success');
      closeStoryModal();
      storiesPage = 1;
      
      // Reload both places
      loadStories('both');
      
      // Also update main feed if it's showing stories
      if (document.getElementById('storiesFeed')?.classList.contains('active')) {
        setTimeout(() => loadStories('feed'), 500);
      }
    } catch (err) {
      showSimpleToast(err.message, 'error');
    }
  }

  // ==============================================
  // 5. SIGHTING FORM HANDLERS
  // ==============================================
  function initSightingForm() {
    const form = document.getElementById('nfSightingForm');
    const locBtn = document.getElementById('nfGetSightLocation');
    const sightLocInput = document.getElementById('nfSightLocation');
    const statusMsg = document.getElementById('nfSightLocStatus');

    if (locBtn) {
      locBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
          showSimpleToast('Geolocation not supported', 'error');
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
            showSimpleToast('Location captured! ✔', 'success');
          },
          (err) => {
            showSimpleToast('Location access denied', 'error');
            locBtn.textContent = 'Use Current Location';
          },
          { enableHighAccuracy: true }
        );
      });
    }

    if (sightLocInput) {
      let debounce;
      sightLocInput.addEventListener('input', () => {
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
          showSimpleToast('Please wait for location to be identified', 'error');
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
          const token = getToken();
          const res = await fetch(`${API}/api/sightings`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to submit sighting');

          showSimpleToast('Sighting reported! 🦎', 'success');
          form.reset();
          if (statusMsg) statusMsg.style.display = 'none';
          if (locBtn) locBtn.style.display = 'block';
          
          // Reload both places
          loadSightings('both');
          
          // Also update main feed if it's showing sightings
          if (document.getElementById('sightingsFeed')?.classList.contains('active')) {
            setTimeout(() => loadSightings('feed'), 500);
          }
        } catch (err) {
          showSimpleToast(err.message, 'error');
        }
      });
    }
  }

  // ==============================================
  // 6. PROXIMITY ALERTS
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

    setTimeout(() => {
      if (banner.parentNode) {
        banner.classList.remove('visible');
        setTimeout(() => banner.remove(), 400);
      }
    }, 15000);
  }

  // ==============================================
  // 7. UTILITIES
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

  function showSimpleToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      padding:12px 24px;border-radius:10px;z-index:99999;
      font-size:0.9rem;font-weight:600;color:#fff;
      box-shadow:0 8px 24px rgba(0,0,0,0.2);
      animation:slideUp 0.3s ease;
      background:${type === 'error' ? '#dc2626' : '#16a34a'};`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 2500);
    setTimeout(() => toast.remove(), 3000);
  }

  // ==============================================
  // 8. GLOBAL EVENT DELEGATION
  // ==============================================
  document.addEventListener('click', (e) => {
    if (e.target.id === 'nfCreateStoryBtn' || e.target.closest('#nfCreateStoryBtn')) {
      openCreateStoryModal();
      return;
    }

    if (e.target.id === 'nfLoadMoreBtn') {
      if (!allStoriesLoaded) {
        storiesPage++;
        loadStories('dedicated');
      }
      return;
    }
  });

  // ==============================================
  // 9. INITIALIZATION
  // ==============================================
  function init() {
    // Only inject sections if they don't exist
    if (!document.getElementById('nf-stories')) {
      injectSections();
    }
    
    // Load data for both places
    setTimeout(() => {
      loadStories('both');
      loadSightings('both');
      initSightingForm();
    }, 500);

    // Delay proximity alerts
    setTimeout(() => initProximityAlerts(), 3000);

    console.log('✅ [NewFeatures] Loaded');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose functions to window for tab switching
  window.loadStories = loadStories;
  window.loadSightings = loadSightings;
  window.openCreateStoryModal = openCreateStoryModal;

})();