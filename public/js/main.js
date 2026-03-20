/* ═══════════════════════════════════════════════
   KARINE YENGO — Main Frontend JS
═══════════════════════════════════════════════ */

const API = '';

// ── Navbar ────────────────────────────────────────────────────────────────
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navLinks.classList.toggle('open');
  document.body.style.overflow = navLinks.classList.contains('open') ? 'hidden' : '';
});

navLinks.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
    document.body.style.overflow = '';
  });
});

// Close nav when clicking outside
document.addEventListener('click', e => {
  if (navLinks.classList.contains('open') && !navLinks.contains(e.target) && !hamburger.contains(e.target)) {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// Active nav link on scroll
const sections = document.querySelectorAll('section[id]');
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      const active = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
      if (active) active.classList.add('active');
    }
  });
}, { threshold: 0.4 });
sections.forEach(s => observer.observe(s));

// ── Footer year ────────────────────────────────────────────────────────────
document.getElementById('year').textContent = new Date().getFullYear();

// ── Fade-in animation ──────────────────────────────────────────────────────
const fadeElements = document.querySelectorAll('.service-card, .pillar, .about-content-col, .book-grid, .contact-grid');
const fadeObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });
fadeElements.forEach(el => { el.classList.add('fade-in'); fadeObserver.observe(el); });

// ── Events ─────────────────────────────────────────────────────────────────
let allEvents = [];
let visibleCount = 6;
let currentFilter = 'all';

async function loadEvents() {
  const grid = document.getElementById('eventsGrid');
  try {
    const res = await fetch(`${API}/api/events`);
    allEvents = await res.json();
    renderEvents();
  } catch (err) {
    grid.innerHTML = `<div class="no-events"><i class="fas fa-exclamation-circle" style="font-size:32px;color:#C4974F;margin-bottom:12px;display:block;"></i><p>Could not load events. Please try again later.</p></div>`;
  }
}

function getYouTubeId(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
  return m ? m[1] : null;
}

function getEmbedThumbStyle(url) {
  const ytId = getYouTubeId(url);
  if (ytId) {
    const thumb = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    return `background-image:url('${thumb}');background-size:cover;background-position:center;`;
  }
  return '';
}

function getEmbedLabel(url) {
  if (!url) return 'Video';
  if (url.includes('youtube') || url.includes('youtu.be')) return 'Watch on YouTube';
  if (url.includes('vimeo')) return 'Watch on Vimeo';
  if (url.includes('spotify')) return 'Listen on Spotify';
  if (url.includes('apple') || url.includes('podcast')) return 'Listen to Podcast';
  return 'Watch / Listen';
}

function getEmbedIframe(url) {
  if (!url) return '';
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (yt) return `<iframe src="https://www.youtube.com/embed/${yt[1]}" style="width:100%;height:280px;border-radius:12px;border:none;" allowfullscreen></iframe>`;
  if (vimeo) return `<iframe src="https://player.vimeo.com/video/${vimeo[1]}" style="width:100%;height:280px;border-radius:12px;border:none;" allowfullscreen></iframe>`;
  return `<a href="${url}" target="_blank" rel="noopener" class="btn btn-primary" style="display:inline-flex;margin-bottom:12px;"><i class="fas fa-external-link-alt" style="margin-right:8px;"></i>${getEmbedLabel(url)}</a>`;
}

function getEventIcon(type) {
  const icons = { conference: 'fa-microphone', podcast: 'fa-podcast', seminar: 'fa-chalkboard-teacher', event: 'fa-calendar-star' };
  return icons[type] || 'fa-calendar';
}

function getBadgeClass(type) {
  const classes = { conference: 'badge-conference', podcast: 'badge-podcast', seminar: 'badge-seminar', event: 'badge-event' };
  return classes[type] || 'badge-event';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric' });
}

function renderEvents() {
  const grid = document.getElementById('eventsGrid');
  const filtered = currentFilter === 'all' ? allEvents : allEvents.filter(e => e.event_type === currentFilter);

  if (!filtered.length) {
    grid.innerHTML = `<div class="no-events"><i class="fas fa-calendar-times" style="font-size:32px;color:#C4974F;margin-bottom:12px;display:block;"></i><p>No events found for this category.</p></div>`;
    document.getElementById('loadMoreEvents').style.display = 'none';
    return;
  }

  const toShow = filtered.slice(0, visibleCount);
  grid.innerHTML = toShow.map(event => `
    <div class="event-card" onclick="openEventModal(${event.id})">
      <div class="event-card-image">
        ${event.media_type === 'video' && event.image_url
          ? `<video src="${event.image_url}" muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:inherit;"></video><div class="play-overlay"><i class="fas fa-play-circle"></i></div>`
          : event.media_type === 'embed' && event.video_url
          ? `<div class="embed-thumb" style="${getEmbedThumbStyle(event.video_url)}"><div class="embed-thumb-overlay"><i class="fas fa-play-circle"></i><span>${getEmbedLabel(event.video_url)}</span></div></div>`
          : event.image_url
          ? `<img src="${event.image_url}" alt="${escHtml(event.title)}" loading="lazy" />`
          : `<i class="fas ${getEventIcon(event.event_type)}"></i>`
        }
      </div>
      <div class="event-card-body">
        <div class="event-type-badge ${getBadgeClass(event.event_type)}">
          <i class="fas ${getEventIcon(event.event_type)}"></i>
          ${capitalize(event.event_type)}
        </div>
        <h3 class="event-card-title">${escHtml(event.title)}</h3>
        <div class="event-card-meta">
          ${event.event_date ? `<div class="event-meta-item"><i class="fas fa-calendar"></i>${formatDate(event.event_date)}</div>` : ''}
          ${event.location ? `<div class="event-meta-item"><i class="fas fa-map-marker-alt"></i>${escHtml(event.location)}</div>` : ''}
        </div>
        ${event.description ? `<p class="event-card-desc">${escHtml(event.description)}</p>` : ''}
      </div>
    </div>
  `).join('');

  const loadMoreBtn = document.getElementById('loadMoreEvents');
  loadMoreBtn.style.display = filtered.length > visibleCount ? 'inline-flex' : 'none';
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    visibleCount = 6;
    renderEvents();
  });
});

document.getElementById('loadMoreEvents').addEventListener('click', () => {
  visibleCount += 6;
  renderEvents();
});

// ── Event Modal ────────────────────────────────────────────────────────────
const modal = document.getElementById('eventModal');
const modalClose = document.getElementById('modalClose');
const modalImageWrap = document.getElementById('modalImageWrap');
const modalContent = document.getElementById('modalContent');

function openEventModal(id) {
  const event = allEvents.find(e => e.id === id);
  if (!event) return;

  if (event.media_type === 'embed' && event.video_url) {
    modalImageWrap.innerHTML = getEmbedIframe(event.video_url);
  } else if (event.media_type === 'video' && event.image_url) {
    modalImageWrap.innerHTML = `<video src="${event.image_url}" controls style="width:100%;border-radius:12px;max-height:320px;"></video>`;
  } else if (event.image_url) {
    modalImageWrap.innerHTML = `<img src="${event.image_url}" alt="${escHtml(event.title)}" />`;
  } else {
    modalImageWrap.innerHTML = '';
  }

  modalContent.innerHTML = `
    <div class="event-type-badge ${getBadgeClass(event.event_type)}">
      <i class="fas ${getEventIcon(event.event_type)}"></i>
      ${capitalize(event.event_type)}
    </div>
    <h3>${escHtml(event.title)}</h3>
    <div class="event-card-meta" style="margin-bottom:16px;">
      ${event.event_date ? `<div class="event-meta-item"><i class="fas fa-calendar"></i>${formatDate(event.event_date)}</div>` : ''}
      ${event.location ? `<div class="event-meta-item"><i class="fas fa-map-marker-alt"></i>${escHtml(event.location)}</div>` : ''}
    </div>
    ${event.description ? `<p>${escHtml(event.description)}</p>` : ''}
  `;

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Testimonials ───────────────────────────────────────────────────────────
async function loadTestimonials() {
  const grid = document.getElementById('testimonialsGrid');
  try {
    const res = await fetch(`${API}/api/testimonials`);
    const data = await res.json();

    if (!data.length) {
      grid.innerHTML = `<p style="text-align:center;color:var(--gray);">No testimonials yet.</p>`;
      return;
    }

    grid.innerHTML = data.map(t => `
      <div class="testimonial-card">
        <div class="testimonial-stars">${'<i class="fas fa-star"></i>'.repeat(Math.min(t.rating || 5, 5))}</div>
        <p class="testimonial-text">${escHtml(t.content)}</p>
        <div class="testimonial-author">
          <div class="author-avatar">${t.author_name.charAt(0)}</div>
          <div>
            <div class="author-name">${escHtml(t.author_name)}</div>
            ${t.author_title ? `<div class="author-title">${escHtml(t.author_title)}</div>` : ''}
          </div>
        </div>
      </div>
    `).join('');
  } catch {
    grid.innerHTML = '';
  }
}

// ── Contact Form ───────────────────────────────────────────────────────────
const contactForm = document.getElementById('contactForm');
const submitBtn = document.getElementById('submitBtn');
const formMessage = document.getElementById('formMessage');

contactForm.addEventListener('submit', async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(contactForm));

  submitBtn.disabled = true;
  submitBtn.querySelector('span').textContent = 'Sending...';
  formMessage.className = 'form-message';
  formMessage.textContent = '';

  try {
    const res = await fetch(`${API}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();

    if (res.ok) {
      formMessage.className = 'form-message success';
      formMessage.textContent = '✓ Thank you! Your message has been sent. Karine will get back to you soon.';
      contactForm.reset();
    } else {
      throw new Error(result.error || 'Something went wrong');
    }
  } catch (err) {
    formMessage.className = 'form-message error';
    formMessage.textContent = err.message || 'Failed to send message. Please try again.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector('span').textContent = 'Send Message';
  }
});

// ── Utilities ──────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

// ── Init ───────────────────────────────────────────────────────────────────
loadEvents();
loadTestimonials();
