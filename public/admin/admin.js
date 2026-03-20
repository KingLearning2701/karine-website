/* ═══════════════════════════════════════════════
   KARINE YENGO — Admin Panel JS
═══════════════════════════════════════════════ */

const API = '';
let token = localStorage.getItem('admin_token');
let currentUser = localStorage.getItem('admin_user');
let editingEventId = null;
let editingTestiId = null;
let removeImage = false;
let confirmCallback = null;

// ── Auth Check ─────────────────────────────────────────────────────────────
function checkAuth() {
  if (token) {
    showDashboard();
  }
}

function showDashboard() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('dashboard').style.display = 'flex';
  document.getElementById('adminUser').textContent = currentUser || 'Admin';
  loadStats();
  loadRecentEvents();
}

// ── Login ──────────────────────────────────────────────────────────────────
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');

  btn.disabled = true;
  btn.textContent = 'Signing in...';
  errEl.style.display = 'none';

  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok) {
      token = data.token;
      currentUser = data.username;
      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_user', currentUser);
      showDashboard();
    } else {
      errEl.textContent = data.error || 'Login failed';
      errEl.style.display = 'block';
    }
  } catch {
    errEl.textContent = 'Network error. Please try again.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  token = null;
  currentUser = null;
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('loginPage').style.display = 'flex';
});

// ── Sidebar Navigation ─────────────────────────────────────────────────────
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

menuToggle.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  sidebarOverlay.classList.toggle('open');
});
sidebarOverlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('open');
});

const tabTitles = { overview: 'Overview', events: 'Events', testimonials: 'Testimonials', messages: 'Messages', settings: 'Settings' };

document.querySelectorAll('.sidebar-link[data-tab]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const tab = link.dataset.tab;

    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.getElementById('pageTitle').textContent = tabTitles[tab] || tab;

    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('open');

    if (tab === 'events') loadEvents();
    if (tab === 'testimonials') loadTestimonials();
    if (tab === 'messages') loadMessages();
  });
});

// ── Stats ──────────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const res = await fetch(`${API}/api/admin/stats`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('statEvents').textContent = data.events;
    document.getElementById('statMessages').textContent = data.messages;
    document.getElementById('statUnread').textContent = data.unread;
    document.getElementById('statTestimonials').textContent = data.testimonials;

    const badge = document.getElementById('unreadBadge');
    if (data.unread > 0) {
      badge.textContent = data.unread;
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }
  } catch {}
}

async function loadRecentEvents() {
  try {
    const res = await fetch(`${API}/api/events?limit=5`);
    const events = await res.json();
    const el = document.getElementById('recentEventsTable');
    if (!events.length) { el.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-times"></i><p>No events yet.</p></div>'; return; }

    el.innerHTML = `
      <table>
        <thead><tr><th>Event</th><th>Type</th><th>Date</th><th>Featured</th></tr></thead>
        <tbody>
          ${events.map(e => `
            <tr>
              <td class="td-title">${esc(e.title)}<small>${esc(e.location || '')}</small></td>
              <td><span class="badge badge-${e.event_type}">${cap(e.event_type)}</span></td>
              <td>${e.event_date ? formatDate(e.event_date) : '—'}</td>
              <td>${e.is_featured ? '<span class="badge badge-featured">⭐ Featured</span>' : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch {}
}

// ── Events ─────────────────────────────────────────────────────────────────
let allEvents = [];

async function loadEvents() {
  const el = document.getElementById('eventsTable');
  el.innerHTML = '<div class="empty-state"><div style="width:32px;height:32px;border:3px solid #F0F0F5;border-top-color:var(--gold);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px;"></div><p>Loading...</p></div>';

  try {
    const res = await fetch(`${API}/api/events`, { headers: authHeaders() });
    allEvents = await res.json();
    renderEventsTable(allEvents);
  } catch {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load events.</p></div>';
  }
}

function renderEventsTable(events) {
  const el = document.getElementById('eventsTable');
  if (!events.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-times"></i><p>No events found. Add your first event!</p></div>';
    return;
  }

  el.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Photo</th>
          <th>Event</th>
          <th>Type</th>
          <th>Date</th>
          <th>Featured</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${events.map(e => `
          <tr>
            <td>
              ${e.image_url
                ? `<img src="${e.image_url}" alt="${esc(e.title)}" class="event-thumb" />`
                : `<div class="event-thumb-placeholder"><i class="fas fa-image"></i></div>`
              }
            </td>
            <td class="td-title">${esc(e.title)}<small>${esc(e.location || '')}</small></td>
            <td><span class="badge badge-${e.event_type}">${cap(e.event_type)}</span></td>
            <td style="font-size:13px;color:var(--gray);">${e.event_date ? formatDate(e.event_date) : '—'}</td>
            <td>${e.is_featured ? '<span class="badge badge-featured">⭐ Yes</span>' : '<span style="color:var(--gray-lt);font-size:13px;">No</span>'}</td>
            <td>
              <div class="td-actions">
                <button class="btn btn-sm btn-edit" onclick="openEventModal(${e.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteEvent(${e.id}, '${esc(e.title)}')"><i class="fas fa-trash"></i></button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Search & filter events
document.getElementById('eventSearch').addEventListener('input', filterEvents);
document.getElementById('eventTypeFilter').addEventListener('change', filterEvents);

function filterEvents() {
  const q = document.getElementById('eventSearch').value.toLowerCase();
  const type = document.getElementById('eventTypeFilter').value;
  const filtered = allEvents.filter(e => {
    const matchQ = !q || e.title.toLowerCase().includes(q) || (e.location || '').toLowerCase().includes(q);
    const matchT = !type || e.event_type === type;
    return matchQ && matchT;
  });
  renderEventsTable(filtered);
}

// ── Media Tab Switching ─────────────────────────────────────────────────────
function switchMediaTab(tab) {
  const isUpload = tab === 'upload';
  document.getElementById('tabUpload').classList.toggle('active', isUpload);
  document.getElementById('tabEmbed').classList.toggle('active', !isUpload);
  document.getElementById('mediaUploadPanel').style.display = isUpload ? '' : 'none';
  document.getElementById('mediaEmbedPanel').style.display = isUpload ? 'none' : '';
}

function getEmbedHtml(url) {
  if (!url) return '';
  let src = '';
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (yt) src = `https://www.youtube.com/embed/${yt[1]}`;
  else if (vimeo) src = `https://player.vimeo.com/video/${vimeo[1]}`;
  if (src) return `<iframe src="${src}" style="width:100%;height:180px;border-radius:8px;border:none;" allowfullscreen></iframe>`;
  return `<a href="${url}" target="_blank" style="display:block;padding:12px;background:#f4f6fb;border-radius:8px;font-size:13px;color:var(--navy);word-break:break-all;"><i class="fas fa-link" style="margin-right:6px;color:var(--gold);"></i>${url}</a>`;
}

// ── Event Modal ────────────────────────────────────────────────────────────
function openEventModal(id = null) {
  editingEventId = id;
  removeImage = false;
  document.getElementById('eventModalTitle').textContent = id ? 'Edit Event' : 'Add Event';
  document.getElementById('eventFormAlert').className = 'alert';
  document.getElementById('eventFormAlert').textContent = '';

  const form = document.getElementById('eventForm');
  form.reset();
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('videoPreview').style.display = 'none';
  document.getElementById('currentImageWrap').style.display = 'none';
  document.getElementById('embedPreviewWrap').style.display = 'none';
  document.getElementById('evVideoUrl').value = '';
  switchMediaTab('upload');

  if (id) {
    const event = allEvents.find(e => e.id === id);
    if (event) {
      document.getElementById('evTitle').value = event.title || '';
      document.getElementById('evDate').value = event.event_date || '';
      document.getElementById('evType').value = event.event_type || 'event';
      document.getElementById('evLocation').value = event.location || '';
      document.getElementById('evDesc').value = event.description || '';
      document.getElementById('evFeatured').checked = !!event.is_featured;

      if (event.media_type === 'embed' && event.video_url) {
        switchMediaTab('embed');
        document.getElementById('evVideoUrl').value = event.video_url;
        const preview = document.getElementById('embedPreviewWrap');
        preview.innerHTML = getEmbedHtml(event.video_url);
        preview.style.display = 'block';
      } else if (event.image_url) {
        const wrap = document.getElementById('currentImageWrap');
        wrap.style.display = 'flex';
        if (event.media_type === 'video') {
          document.getElementById('currentImageThumb').style.display = 'none';
          document.getElementById('currentImageName').textContent = 'Current video (uploaded)';
        } else {
          document.getElementById('currentImageThumb').style.display = '';
          document.getElementById('currentImageThumb').src = event.image_url;
          document.getElementById('currentImageName').textContent = 'Current photo';
        }
      }
    }
  }

  document.getElementById('eventModalOverlay').classList.add('open');
}

function closeEventModal() {
  document.getElementById('eventModalOverlay').classList.remove('open');
  editingEventId = null;
}

function removeCurrentMedia() {
  removeImage = true;
  document.getElementById('currentImageWrap').style.display = 'none';
}

// keep old name working
function removeCurrentImage() { removeCurrentMedia(); }

document.getElementById('evImage').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const isVideo = file.type.startsWith('video/');
  const imgPrev = document.getElementById('imagePreview');
  const vidPrev = document.getElementById('videoPreview');
  if (isVideo) {
    imgPrev.style.display = 'none';
    vidPrev.src = URL.createObjectURL(file);
    vidPrev.style.display = 'block';
  } else {
    vidPrev.style.display = 'none';
    const reader = new FileReader();
    reader.onload = ev => { imgPrev.src = ev.target.result; imgPrev.style.display = 'block'; };
    reader.readAsDataURL(file);
  }
});

document.getElementById('evVideoUrl').addEventListener('input', e => {
  const url = e.target.value.trim();
  const preview = document.getElementById('embedPreviewWrap');
  if (url) { preview.innerHTML = getEmbedHtml(url); preview.style.display = 'block'; }
  else { preview.style.display = 'none'; }
});

document.getElementById('eventForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('eventSubmitBtn');
  const alertEl = document.getElementById('eventFormAlert');
  alertEl.className = 'alert';

  btn.disabled = true;
  btn.querySelector('span').textContent = 'Saving...';

  const isEmbedTab = document.getElementById('tabEmbed').classList.contains('active');
  const formData = new FormData();
  formData.append('title', document.getElementById('evTitle').value);
  formData.append('event_date', document.getElementById('evDate').value);
  formData.append('event_type', document.getElementById('evType').value);
  formData.append('location', document.getElementById('evLocation').value);
  formData.append('description', document.getElementById('evDesc').value);
  formData.append('is_featured', document.getElementById('evFeatured').checked ? 'true' : 'false');

  if (isEmbedTab) {
    formData.append('video_url', document.getElementById('evVideoUrl').value.trim());
  } else {
    const imageFile = document.getElementById('evImage').files[0];
    if (imageFile) formData.append('image', imageFile);
    if (removeImage) formData.append('remove_image', 'true');
    formData.append('video_url', '');
  }

  try {
    const url = editingEventId ? `${API}/api/admin/events/${editingEventId}` : `${API}/api/admin/events`;
    const method = editingEventId ? 'PUT' : 'POST';

    const res = await fetch(url, { method, headers: { 'Authorization': `Bearer ${token}` }, body: formData });
    const data = await res.json();

    if (res.ok) {
      closeEventModal();
      toast('success', editingEventId ? 'Event updated!' : 'Event created!');
      loadEvents();
      loadStats();
      if (document.getElementById('tab-overview').classList.contains('active')) loadRecentEvents();
    } else {
      throw new Error(data.error || 'Failed to save event');
    }
  } catch (err) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Save Event';
  }
});

async function deleteEvent(id, title) {
  confirm(`Delete "${title}"?`, 'This will permanently remove the event and its image.', async () => {
    try {
      const res = await fetch(`${API}/api/admin/events/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (res.ok) {
        toast('success', 'Event deleted.');
        loadEvents();
        loadStats();
      } else throw new Error();
    } catch { toast('error', 'Failed to delete event.'); }
  });
}

// ── Testimonials ───────────────────────────────────────────────────────────
let allTestis = [];

async function loadTestimonials() {
  const el = document.getElementById('testimonialsContainer');
  el.innerHTML = '<div class="empty-state"><div style="width:32px;height:32px;border:3px solid #F0F0F5;border-top-color:var(--gold);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto;"></div></div>';

  try {
    const res = await fetch(`${API}/api/admin/testimonials`, { headers: authHeaders() });
    allTestis = await res.json();
    renderTestimonials();
  } catch {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load.</p></div>';
  }
}

function renderTestimonials() {
  const el = document.getElementById('testimonialsContainer');
  if (!allTestis.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-star"></i><p>No testimonials yet. Add one!</p></div>';
    return;
  }
  el.innerHTML = allTestis.map(t => `
    <div class="testi-card">
      <div class="testi-avatar">${t.author_name.charAt(0)}</div>
      <div class="testi-body">
        <div class="testi-name">${esc(t.author_name)}</div>
        <div class="testi-title-role">${esc(t.author_title || '')}</div>
        <div class="testi-text">"${esc(t.content)}"</div>
        <div class="testi-footer">
          <div class="testi-stars">${'★'.repeat(Math.min(t.rating || 5, 5))}</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span class="badge ${t.is_visible ? 'badge-seminar' : 'badge-unread'}">${t.is_visible ? 'Visible' : 'Hidden'}</span>
            <div class="testi-actions">
              <button class="btn btn-sm btn-edit" onclick="openTestiModal(${t.id})"><i class="fas fa-edit"></i></button>
              <button class="btn btn-sm btn-danger" onclick="deleteTestimonial(${t.id})"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function openTestiModal(id = null) {
  editingTestiId = id;
  document.getElementById('testiModalTitle').textContent = id ? 'Edit Testimonial' : 'Add Testimonial';
  document.getElementById('testiFormAlert').className = 'alert';

  document.getElementById('testiForm').reset();
  document.getElementById('tVisible').checked = true;

  if (id) {
    const t = allTestis.find(x => x.id === id);
    if (t) {
      document.getElementById('tName').value = t.author_name || '';
      document.getElementById('tTitle').value = t.author_title || '';
      document.getElementById('tContent').value = t.content || '';
      document.getElementById('tRating').value = t.rating || 5;
      document.getElementById('tVisible').checked = !!t.is_visible;
    }
  }

  document.getElementById('testiModalOverlay').classList.add('open');
}

function closeTestiModal() {
  document.getElementById('testiModalOverlay').classList.remove('open');
  editingTestiId = null;
}

document.getElementById('testiForm').addEventListener('submit', async e => {
  e.preventDefault();
  const alertEl = document.getElementById('testiFormAlert');
  alertEl.className = 'alert';

  const body = {
    author_name: document.getElementById('tName').value,
    author_title: document.getElementById('tTitle').value,
    content: document.getElementById('tContent').value,
    rating: parseInt(document.getElementById('tRating').value),
    is_visible: document.getElementById('tVisible').checked
  };

  try {
    const url = editingTestiId ? `${API}/api/admin/testimonials/${editingTestiId}` : `${API}/api/admin/testimonials`;
    const method = editingTestiId ? 'PUT' : 'POST';

    const res = await fetch(url, { method, headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      closeTestiModal();
      toast('success', editingTestiId ? 'Testimonial updated!' : 'Testimonial added!');
      loadTestimonials();
      loadStats();
    } else {
      const d = await res.json();
      throw new Error(d.error || 'Failed');
    }
  } catch (err) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = err.message;
  }
});

async function deleteTestimonial(id) {
  confirm('Delete testimonial?', 'This will permanently remove this testimonial.', async () => {
    try {
      const res = await fetch(`${API}/api/admin/testimonials/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (res.ok) { toast('success', 'Testimonial deleted.'); loadTestimonials(); loadStats(); }
      else throw new Error();
    } catch { toast('error', 'Failed to delete.'); }
  });
}

// ── Messages ───────────────────────────────────────────────────────────────
async function loadMessages() {
  const el = document.getElementById('messagesContainer');
  el.innerHTML = '<div class="empty-state"><div style="width:32px;height:32px;border:3px solid #F0F0F5;border-top-color:var(--gold);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto;"></div></div>';

  try {
    const res = await fetch(`${API}/api/admin/messages`, { headers: authHeaders() });
    const msgs = await res.json();

    if (!msgs.length) {
      el.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No messages yet.</p></div>';
      return;
    }

    el.innerHTML = msgs.map(m => `
      <div class="message-card ${m.is_read ? '' : 'unread'}" id="msg-${m.id}">
        <div class="message-header">
          <div>
            <div class="message-from">${esc(m.name)} <span>${esc(m.email)}</span></div>
          </div>
          <div class="message-meta">
            <span class="badge ${m.is_read ? 'badge-read' : 'badge-unread'}">${m.is_read ? 'Read' : 'New'}</span><br>
            <span style="display:block;margin-top:4px;">${formatDateTime(m.created_at)}</span>
          </div>
        </div>
        <div class="message-subject">${esc(m.subject || 'No Subject')}</div>
        <div class="message-body">${esc(m.message)}</div>
        <div class="message-actions">
          <a href="mailto:${esc(m.email)}?subject=Re: ${esc(m.subject || '')}" class="btn btn-sm btn-edit"><i class="fas fa-reply"></i> Reply</a>
          ${!m.is_read ? `<button class="btn btn-sm btn-secondary" onclick="markRead(${m.id})"><i class="fas fa-check"></i> Mark Read</button>` : ''}
          <button class="btn btn-sm btn-danger" onclick="deleteMessage(${m.id})"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  } catch {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load messages.</p></div>';
  }
}

async function markRead(id) {
  try {
    await fetch(`${API}/api/admin/messages/${id}/read`, { method: 'PATCH', headers: authHeaders() });
    loadMessages();
    loadStats();
  } catch {}
}

async function deleteMessage(id) {
  confirm('Delete message?', 'This will permanently delete this message.', async () => {
    try {
      const res = await fetch(`${API}/api/admin/messages/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (res.ok) { toast('success', 'Message deleted.'); loadMessages(); loadStats(); }
      else throw new Error();
    } catch { toast('error', 'Failed to delete.'); }
  });
}

// ── Password Change ────────────────────────────────────────────────────────
document.getElementById('pwForm').addEventListener('submit', async e => {
  e.preventDefault();
  const alertEl = document.getElementById('pwAlert');
  const np = document.getElementById('newPw').value;
  const cp = document.getElementById('confirmPw').value;

  if (np !== cp) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = 'New passwords do not match.';
    return;
  }

  try {
    const res = await fetch(`${API}/api/auth/change-password`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: document.getElementById('currentPw').value, newPassword: np })
    });
    const data = await res.json();
    if (res.ok) {
      alertEl.className = 'alert alert-success';
      alertEl.textContent = '✓ Password updated successfully.';
      document.getElementById('pwForm').reset();
    } else {
      throw new Error(data.error || 'Failed');
    }
  } catch (err) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = err.message;
  }
});

// ── Confirm Dialog ─────────────────────────────────────────────────────────
function confirm(title, msg, callback) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = msg;
  confirmCallback = callback;
  document.getElementById('confirmOverlay').classList.add('open');
}

function cancelConfirm() {
  document.getElementById('confirmOverlay').classList.remove('open');
  confirmCallback = null;
}

document.getElementById('confirmOkBtn').addEventListener('click', () => {
  document.getElementById('confirmOverlay').classList.remove('open');
  if (confirmCallback) confirmCallback();
  confirmCallback = null;
});

// ── Toast ──────────────────────────────────────────────────────────────────
function toast(type, message) {
  const el = document.getElementById('toast');
  const icon = document.getElementById('toastIcon');
  document.getElementById('toastMsg').textContent = message;
  el.className = `toast ${type}`;
  icon.className = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3500);
}

// ── Utilities ──────────────────────────────────────────────────────────────
function authHeaders() {
  return { 'Authorization': `Bearer ${token}` };
}

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function cap(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(dtStr) {
  if (!dtStr) return '';
  const d = new Date(dtStr);
  return d.toLocaleDateString('en-AE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Spin animation
const style = document.createElement('style');
style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(style);

// ── Init ───────────────────────────────────────────────────────────────────
checkAuth();
