const API_BASE =
    window.__API_BASE__ ||
    document.querySelector('meta[name="api-base"]')?.content ||
    ((location.hostname === 'localhost' || location.hostname === '127.0.0.1')
        ? 'http://localhost:3000'
        : location.origin);

function eraseCookie(name) {
    const secure = location.protocol === 'https:' ? '; secure' : '';
    document.cookie = encodeURIComponent(name) + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; samesite=lax' + secure;
}

const token = localStorage.getItem('ecoToken');
const user = JSON.parse(localStorage.getItem('ecoUser') || '{}');

if (!token || user.role !== 'admin') {
    alert('Unauthorized access. Redirecting...');
    window.location.href = '../index.html';
}

const authHeader = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
};

// ===============================
// INITIALIZATION
// ===============================
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    loadReports();
    loadUsers();
    loadMissions();
    loadEcoSpots();
    loadStories();
    loadSightings();
});

function initEventListeners() {
    // Logout
    document.getElementById('logoutBtn').onclick = () => {
        localStorage.removeItem('ecoToken');
        localStorage.removeItem('ecoUser');
        eraseCookie('ecoToken');
        eraseCookie('ecoUser');
        window.location.href = '../index.html';
    };

    // Tab navigation
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.onclick = () => {
            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-nav button').forEach(b => b.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            btn.classList.add('active');
        };
    });

    // Mission modal
    document.getElementById('addMissionBtn')?.addEventListener('click', () => {
        document.getElementById('missionModal').style.display = 'flex';
        document.getElementById('missionModalTitle').textContent = 'Add Mission';
        document.getElementById('missionForm').reset();
    });

    // Eco Spot modal
    document.getElementById('addEcoSpotBtn')?.addEventListener('click', () => {
        document.getElementById('ecoSpotModal').style.display = 'flex';
        document.getElementById('ecoSpotModalTitle').textContent = 'Add Eco Spot';
        document.getElementById('ecoSpotForm').reset();
    });

    // Close modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        };
    });

    // Mission form submit
    document.getElementById('missionForm')?.addEventListener('submit', saveMission);

    // Eco Spot form submit
    document.getElementById('ecoSpotForm')?.addEventListener('submit', saveEcoSpot);
}

// ===============================
// REPORTS MANAGEMENT
// ===============================
async function loadReports() {
    try {
        const showDeleted = document.getElementById('showDeleted')?.checked || false;
        const url = showDeleted
            ? `${API_BASE}/api/admin/reports?include_deleted=true`
            : `${API_BASE}/api/admin/reports`;

        console.log('Fetching reports from:', url);
        const res = await fetch(url, { headers: authHeader });

        console.log('Reports API Status:', res.status);
        if (!res.ok) {
            const text = await res.text();
            console.error('Failed to fetch reports:', text);
            if (res.status === 401 || res.status === 403) {
                alert('Session expired or unauthorized. Please login again.');
                window.location.href = '../login/login.html';
                return;
            }
            throw new Error(`Server returned ${res.status}: ${text}`);
        }

        const reports = await res.json();
        console.log('Reports Fetched Data:', reports);

        if (!Array.isArray(reports)) {
            console.error('Expected array but got:', reports);
            throw new Error('Invalid data format received from server');
        }

        const tbody = document.getElementById('reportsTable');

        console.log('Reports fetched:', reports); // DEBUG LOG

        if (!reports || reports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No reports found</td></tr>';
            return;
        }

        const rows = reports.map(r => {
            try {
                const userId = r.id;
                const location = r.location || 'Unknown';
                const desc = r.description ? (r.description.length > 50 ? r.description.substring(0, 50) + '...' : r.description) : '';
                const userName = r.users?.name || 'N/A';
                const userEmail = r.users?.email || '';
                const created = r.created_at ? new Date(r.created_at).toLocaleDateString() : 'N/A';
                const isDeleted = !!r.deleted_at;

                // Image Handling
                let imgHtml = 'No image';
                if (r.image) {
                    const img = String(r.image).trim();
                    const src = img.startsWith('http') ? img : API_BASE + '/uploads/' + img;
                    imgHtml = `<img src="${src}" class="thumb-img">`;
                }

                return `
                <tr ${isDeleted ? 'style="opacity: 0.6; background: #fee;"' : ''}>
                    <td>${userId}</td>
                    <td>${location}</td>
                    <td>${desc}</td>
                    <td>${userName}<br><small>${userEmail}</small></td>
                    <td>
                        <span class="status-badge ${r.status}">${r.status || 'pending'}</span>
                        ${r.severity ? `<br><span class="severity-badge ${r.severity}">${r.severity}</span>` : ''}
                    </td>
                    <td>${imgHtml}</td>
                    <td>${created}</td>
                    <td class="actions-cell">
                        <select onchange="updateReportStatus('${userId}', this.value)" ${isDeleted ? 'disabled' : ''}>
                            <option value="pending" ${r.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="approved" ${r.status === 'approved' ? 'selected' : ''}>Approved (Feature)</option>
                            <option value="rejected" ${r.status === 'rejected' ? 'selected' : ''}>Rejected (Delete)</option>
                        </select>
                        <select onchange="updateReportSeverity('${userId}', this.value)" ${isDeleted ? 'disabled' : ''}>
                            <option value="" ${!r.severity ? 'selected' : ''}>Set Severity</option>
                            <option value="critical" ${r.severity === 'critical' ? 'selected' : ''}>🔴 Critical</option>
                            <option value="high" ${r.severity === 'high' ? 'selected' : ''}>🟠 High</option>
                            <option value="medium" ${r.severity === 'medium' ? 'selected' : ''}>🟡 Medium</option>
                            <option value="low" ${r.severity === 'low' ? 'selected' : ''}>🟢 Low</option>
                        </select>
                        ${isDeleted
                        ? `<button class="btn btn-success btn-sm" onclick="restoreReport('${userId}')">Restore</button>`
                        : ''
                    }
                        <button class="btn btn-danger btn-sm" onclick="permanentDeleteReport('${userId}')">Delete</button>
                    </td>
                </tr>`;
            } catch (innerErr) {
                console.error('Error rendering report row:', r, innerErr);
                return `<tr><td colspan="8" style="color:red;">Error rendering report ${r.id}</td></tr>`;
            }
        }).join('');

        tbody.innerHTML = rows;
    } catch (err) {
        console.error('Error loading reports:', err);
        showToast('Failed to load reports', 'error');
    }
}

async function updateReportStatus(id, status) {
    try {
        // If rejected, also soft delete the report
        const bodyData = { status };
        if (status === 'rejected') {
            bodyData.deleted_at = new Date().toISOString();
        }
        // If approved, clear deleted_at (restore if was deleted)
        if (status === 'approved') {
            bodyData.deleted_at = null;
            bodyData.featured = true;
        }

        const res = await fetch(`${API_BASE}/api/admin/reports/${id}`, {
            method: 'PUT',
            headers: authHeader,
            body: JSON.stringify(bodyData)
        });
        if (res.ok) {
            const statusMsg = status === 'approved' ? '✅ Report re-approved!' :
                status === 'rejected' ? '❌ Report rejected by admin' :
                    '✅ Status updated successfully';
            showToast(statusMsg, 'success');
            loadReports();
        }
    } catch (err) {
        showToast('Failed to update status', 'error');
    }
}

async function updateReportSeverity(id, severity) {
    try {
        const res = await fetch(`${API_BASE}/api/admin/reports/${id}`, {
            method: 'PUT',
            headers: authHeader,
            body: JSON.stringify({ severity })
        });
        if (res.ok) {
            showToast(`Severity set to ${severity || 'none'}`, 'success');
            loadReports();
        }
    } catch (err) {
        showToast('Failed to update severity', 'error');
    }
}

async function softDeleteReport(id) {
    if (!confirm('Are you sure you want to soft delete this report?')) return;

    try {
        const res = await fetch(`${API_BASE}/api/admin/reports/${id}/soft-delete`, {
            method: 'PUT',
            headers: authHeader
        });
        if (res.ok) {
            showToast('Report soft deleted', 'success');
            loadReports();
        }
    } catch (err) {
        showToast('Failed to soft delete', 'error');
    }
}

async function restoreReport(id) {
    try {
        const res = await fetch(`${API_BASE}/api/admin/reports/${id}/restore`, {
            method: 'PUT',
            headers: authHeader
        });
        if (res.ok) {
            showToast('Report restored', 'success');
            loadReports();
        }
    } catch (err) {
        showToast('Failed to restore', 'error');
    }
}

async function permanentDeleteReport(id) {
    if (!confirm('⚠️ WARNING: This will permanently delete the report from the database. This action cannot be undone. Are you sure?')) return;

    try {
        const res = await fetch(`${API_BASE}/api/admin/reports/${id}`, {
            method: 'DELETE',
            headers: authHeader
        });
        if (res.ok) {
            showToast('Report permanently deleted', 'success');
            loadReports();
        }
    } catch (err) {
        showToast('Failed to delete', 'error');
    }
}

// ===============================
// USERS MANAGEMENT
// ===============================
async function loadUsers() {
    try {
        const res = await fetch(`${API_BASE}/api/admin/users`, { headers: authHeader });
        const users = await res.json();

        const tbody = document.getElementById('usersTable');
        tbody.innerHTML = users.length
            ? users.map(u => `
                <tr>
                    <td>${u.id}</td>
                    <td>${u.name}</td>
                    <td>${u.email}</td>
                    <td>${u.phone || 'N/A'}</td>
                    <td><code style="font-size: 0.8rem;">${u.password?.substring(0, 30)}...</code><br><small>(Hashed/Encrypted)</small></td>
                    <td><span class="role-badge ${u.role}">${u.role || 'user'}</span></td>
                    <td>${new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="7" class="text-center">No users found</td></tr>';
    } catch (err) {
        console.error('Error loading users:', err);
        showToast('Failed to load users', 'error');
    }
}

// ===============================
// MISSIONS MANAGEMENT
// ===============================
async function loadMissions() {
    try {
        const res = await fetch(`${API_BASE}/api/missions`);
        const missions = await res.json();

        const container = document.getElementById('missionsList');
        container.innerHTML = missions.length
            ? missions.map(m => `
                <div class="mission-card-admin">
                    <div class="mission-header">
                        <h4>${m.title}</h4>
                        <div class="mission-actions">
                            <button class="btn btn-primary btn-sm" onclick="viewParticipants('${m.id}')">
                                View Participants (${m.participant_count || 0})
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="deleteMission('${m.id}')">Delete</button>
                        </div>
                    </div>
                    <p>${m.description}</p>
                    <div class="mission-meta">
                        <span>📅 ${new Date(m.date).toLocaleDateString()}</span>
                        <span>📍 ${m.location}</span>
                    </div>
                    ${(() => {
                    if (!m.image) return '';
                    const img = m.image.trim();
                    // console.log('Mission Image:', img);
                    return `<img src="${img.startsWith('http') ? img : API_BASE + '/uploads/' + img}" class="mission-thumb">`;
                })()}
                </div>
            `).join('')
            : '<p class="text-center">No missions available</p>';
    } catch (err) {
        console.error('Error loading missions:', err);
        showToast('Failed to load missions', 'error');
    }
}

async function saveMission(e) {
    e.preventDefault();

    const formData = new FormData();
    formData.append('title', document.getElementById('missionTitle').value);
    formData.append('description', document.getElementById('missionDesc').value);
    formData.append('date', document.getElementById('missionDate').value);
    formData.append('location', document.getElementById('missionLocation').value);

    const imageFile = document.getElementById('missionImage').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }

    try {
        const res = await fetch(`${API_BASE}/api/admin/missions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (res.ok) {
            showToast('Mission created successfully', 'success');
            document.getElementById('missionModal').style.display = 'none';
            loadMissions();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to create mission', 'error');
        }
    } catch (err) {
        showToast('Failed to create mission', 'error');
    }
}

async function viewParticipants(missionId) {
    console.log('viewParticipants called for mission:', missionId);
    try {
        const res = await fetch(`${API_BASE}/api/admin/missions/${missionId}/participants`, {
            headers: authHeader
        });

        console.log('viewParticipants response status:', res.status);

        if (!res.ok) {
            const errText = await res.text();
            console.error('viewParticipants invalid response:', errText);
            throw new Error(`Server returned ${res.status}: ${errText}`);
        }

        const participants = await res.json();
        console.log('viewParticipants data:', participants);

        const container = document.getElementById('participantsList');
        if (!participants) {
            console.error('Participants data is null/undefined');
            container.innerHTML = '<p class="error">Failed to load participant data</p>';
            return;
        }

        container.innerHTML = participants.length
            ? `
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone Number</th>
                            <th>Joined At</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${participants.map(p => `
                            <tr>
                                <td>${p.name}</td>
                                <td>${p.email}</td>
                                <td>${p.phone || 'N/A'}</td>
                                <td>${new Date(p.created_at || p.registered_at).toLocaleString()}</td>
                                <td>
                                    <button class="btn btn-danger btn-sm" onclick="deleteParticipant('${p.id}', '${missionId}')">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `
            : '<p>No participants yet</p>';

        const modal = document.getElementById('participantsModal');
        if (modal) {
            modal.style.display = 'flex';
            console.log('Modal display set to flex');
        } else {
            console.error('participantsModal element not found!');
        }
    } catch (err) {
        console.error('Error loading participants:', err);
        showToast(`Failed to load participants: ${err.message}`, 'error');
    }
}

async function deleteParticipant(id, missionId) {
    if (!confirm('Are you sure you want to remove this participant?')) return;

    try {
        const res = await fetch(`${API_BASE}/api/admin/missions/participants/${id}`, {
            method: 'DELETE',
            headers: authHeader
        });
        if (res.ok) {
            showToast('Participant removed', 'success');
            // Refresh list
            viewParticipants(missionId);
            // Update mission count in background
            loadMissions();
        } else {
            showToast('Failed to remove participant', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Failed to remove participant', 'error');
    }
}

async function deleteMission(id) {
    if (!confirm('Are you sure you want to delete this mission?')) return;

    try {
        const res = await fetch(`${API_BASE}/api/admin/missions/${id}`, {
            method: 'DELETE',
            headers: authHeader
        });
        if (res.ok) {
            showToast('Mission deleted', 'success');
            loadMissions();
        }
    } catch (err) {
        showToast('Failed to delete mission', 'error');
    }
}

// ===============================
// ECO SPOTS MANAGEMENT
// ===============================
async function loadEcoSpots() {
    try {
        const res = await fetch(`${API_BASE}/api/eco-spots`);
        const spots = await res.json();

        const container = document.getElementById('ecoSpotsList');
        container.innerHTML = spots.length
            ? `
                <div class="eco-spots-grid">
                    ${spots.map(spot => `
                        <div class="eco-spot-card-admin">
                            ${(() => {
                    if (!spot.image) return '';
                    const img = spot.image.trim();
                    // console.log('EcoSpot Image:', img);
                    return `<img src="${img.startsWith('http') ? img : API_BASE + '/uploads/' + img}" alt="${spot.name}">`;
                })()}
                            <div class="eco-spot-content">
                                <h4>${spot.name}</h4>
                                <div class="rating">⭐ ${spot.rating}</div>
                                <p><strong>Location:</strong> ${spot.location}</p>
                                <p><strong>Category:</strong> ${spot.category}</p>
                                ${spot.price ? `<p><strong>Price:</strong> ${spot.price}</p>` : ''}
                                <div class="eco-spot-actions">
                                    <button class="btn btn-primary btn-sm" onclick="editEcoSpot(${spot.id})">Edit</button>
                                    <button class="btn btn-danger btn-sm" onclick="deleteEcoSpot(${spot.id})">Delete</button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `
            : '<p class="text-center">No eco spots available</p>';
    } catch (err) {
        console.error('Error loading eco spots:', err);
        showToast('Failed to load eco spots', 'error');
    }
}

async function saveEcoSpot(e) {
    e.preventDefault();

    const form = e.target;
    const editId = form.dataset.editId;
    const isEdit = !!editId;

    const formData = new FormData();
    formData.append('name', document.getElementById('ecoSpotName').value);
    formData.append('rating', document.getElementById('ecoSpotRating').value);
    formData.append('location', document.getElementById('ecoSpotLocation').value);
    formData.append('description', document.getElementById('ecoSpotDescription').value);
    formData.append('category', document.getElementById('ecoSpotCategory').value);
    formData.append('price', document.getElementById('ecoSpotPrice').value || '');
    formData.append('features', document.getElementById('ecoSpotFeatures').value);
    formData.append('details', document.getElementById('ecoSpotDetails').value);

    const imageFile = document.getElementById('ecoSpotImage').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }

    try {
        const url = isEdit
            ? `${API_BASE}/api/admin/eco-spots/${editId}`
            : `${API_BASE}/api/admin/eco-spots`;
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (res.ok) {
            showToast(`Eco spot ${isEdit ? 'updated' : 'created'} successfully`, 'success');
            document.getElementById('ecoSpotModal').style.display = 'none';
            delete form.dataset.editId;
            loadEcoSpots();
        } else {
            const data = await res.json();
            showToast(data.error || `Failed to ${isEdit ? 'update' : 'create'} eco spot`, 'error');
        }
    } catch (err) {
        showToast(`Failed to ${isEdit ? 'update' : 'create'} eco spot`, 'error');
    }
}

async function editEcoSpot(id) {
    // Load spot data and populate form
    try {
        const res = await fetch(`${API_BASE}/api/eco-spots/${id}`);
        const spot = await res.json();

        document.getElementById('ecoSpotName').value = spot.name || '';
        document.getElementById('ecoSpotRating').value = spot.rating || '';
        document.getElementById('ecoSpotLocation').value = spot.location || '';
        document.getElementById('ecoSpotDescription').value = spot.description || '';
        document.getElementById('ecoSpotCategory').value = spot.category || '';
        document.getElementById('ecoSpotPrice').value = spot.price || '';
        document.getElementById('ecoSpotFeatures').value = spot.features || '';
        document.getElementById('ecoSpotDetails').value = spot.details || '';

        document.getElementById('ecoSpotModalTitle').textContent = 'Edit Eco Spot';
        document.getElementById('ecoSpotForm').dataset.editId = id;
        document.getElementById('ecoSpotModal').style.display = 'flex';
    } catch (err) {
        showToast('Failed to load eco spot', 'error');
    }
}

async function deleteEcoSpot(id) {
    if (!confirm('Are you sure you want to delete this eco spot?')) return;

    try {
        const res = await fetch(`${API_BASE}/api/admin/eco-spots/${id}`, {
            method: 'DELETE',
            headers: authHeader
        });
        if (res.ok) {
            showToast('Eco spot deleted', 'success');
            loadEcoSpots();
        }
    } catch (err) {
        showToast('Failed to delete eco spot', 'error');
    }
}

// ===============================
// STORIES MANAGEMENT (NewFeatures)
// ===============================
async function loadStories() {
    try {
        const res = await fetch(`${API_BASE}/api/admin/stories`, { headers: authHeader });
        if (!res.ok) return;
        const stories = await res.json();

        const tbody = document.getElementById('storiesTable');
        if (!tbody) return;

        tbody.innerHTML = stories.length
            ? stories.map(s => {
                const userName = s.users?.name || 'N/A';
                const userEmail = s.users?.email || '';
                const created = s.created_at ? new Date(s.created_at).toLocaleDateString() : 'N/A';
                const beforeImg = s.before_image ? `<img src="${s.before_image}" class="thumb-img">` : 'None';
                const afterImg = s.after_image ? `<img src="${s.after_image}" class="thumb-img">` : 'None';

                return `
                <tr>
                    <td>${s.id}</td>
                    <td>${s.title || ''}</td>
                    <td>${userName}<br><small>${userEmail}</small></td>
                    <td>❤️ ${s.likes_count || 0}</td>
                    <td>${beforeImg}</td>
                    <td>${afterImg}</td>
                    <td>${created}</td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="deleteStory('${s.id}')">Delete</button>
                    </td>
                </tr>`;
            }).join('')
            : '<tr><td colspan="8" class="text-center">No stories found</td></tr>';
    } catch (err) {
        console.error('Error loading stories:', err);
    }
}

async function deleteStory(id) {
    if (!confirm('Are you sure you want to delete this story?')) return;
    try {
        const res = await fetch(`${API_BASE}/api/admin/stories/${id}`, {
            method: 'DELETE',
            headers: authHeader
        });
        if (res.ok) {
            showToast('Story deleted', 'success');
            loadStories();
        } else {
            showToast('Failed to delete story', 'error');
        }
    } catch (err) {
        showToast('Failed to delete story', 'error');
    }
}

// ===============================
// SIGHTINGS MANAGEMENT (NewFeatures)
// ===============================
async function loadSightings() {
    try {
        const res = await fetch(`${API_BASE}/api/admin/sightings`, { headers: authHeader });
        if (!res.ok) return;
        const sightings = await res.json();

        const tbody = document.getElementById('sightingsTable');
        if (!tbody) return;

        tbody.innerHTML = sightings.length
            ? sightings.map(s => {
                const userName = s.users?.name || 'N/A';
                const userEmail = s.users?.email || '';
                const created = s.created_at ? new Date(s.created_at).toLocaleDateString() : 'N/A';
                const img = s.image_url ? `<img src="${s.image_url}" class="thumb-img">` : 'None';

                return `
                <tr>
                    <td>${s.id}</td>
                    <td>${s.species_name || ''}</td>
                    <td>${userName}<br><small>${userEmail}</small></td>
                    <td>📍 ${s.location || 'Unknown'}</td>
                    <td>${img}</td>
                    <td>${created}</td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="deleteSighting('${s.id}')">Delete</button>
                    </td>
                </tr>`;
            }).join('')
            : '<tr><td colspan="7" class="text-center">No sightings found</td></tr>';
    } catch (err) {
        console.error('Error loading sightings:', err);
    }
}

async function deleteSighting(id) {
    if (!confirm('Are you sure you want to delete this sighting?')) return;
    try {
        const res = await fetch(`${API_BASE}/api/admin/sightings/${id}`, {
            method: 'DELETE',
            headers: authHeader
        });
        if (res.ok) {
            showToast('Sighting deleted', 'success');
            loadSightings();
        } else {
            showToast('Failed to delete sighting', 'error');
        }
    } catch (err) {
        showToast('Failed to delete sighting', 'error');
    }
}

// ===============================
// UTILITIES
// ===============================
function showToast(message, type = 'info') {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 4px;
        z-index: 10000;
        animation: slideIn 0.3s;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}
