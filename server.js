require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const app = express();
const { query, initDB } = require('./database');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB for videos
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|webm|avi|mkv/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase());
    if (ok) cb(null, true);
    else cb(new Error('Only image and video files are allowed'));
  }
});

function getMediaType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return /mp4|mov|webm|avi|mkv/.test(ext) ? 'video' : 'image';
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// JWT auth middleware
function authenticateToken(req, res, next) {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
}

// ─── AUTH ────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

    const result = await query('SELECT * FROM admins WHERE username = $1', [username]);
    const admin = result.rows[0];
    if (!admin || !bcrypt.compareSync(password, admin.password_hash))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: admin.id, username: admin.username }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, username: admin.username });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await query('SELECT * FROM admins WHERE id = $1', [req.user.id]);
    const admin = result.rows[0];
    if (!bcrypt.compareSync(currentPassword, admin.password_hash))
      return res.status(401).json({ error: 'Current password incorrect' });

    const hash = bcrypt.hashSync(newPassword, 10);
    await query('UPDATE admins SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Password updated' });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ─── EVENTS (Public) ─────────────────────────────────────────────────────────

app.get('/api/events', async (req, res) => {
  try {
    const { type, limit, featured } = req.query;
    let sql = 'SELECT * FROM events';
    const params = [];
    const conditions = [];

    if (type) { conditions.push(`event_type = $${params.length + 1}`); params.push(type); }
    if (featured === 'true') { conditions.push('is_featured = true'); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY event_date DESC NULLS LAST';
    if (limit) { sql += ` LIMIT $${params.length + 1}`; params.push(parseInt(limit)); }

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/events/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Event not found' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ─── EVENTS (Admin) ──────────────────────────────────────────────────────────

app.post('/api/admin/events', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { title, description, event_date, location, event_type, is_featured } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const { video_url } = req.body;
    let image_url = null, media_type = 'image';

    if (req.file) {
      image_url = `/uploads/${req.file.filename}`;
      media_type = getMediaType(req.file.filename);
    } else if (video_url && video_url.trim()) {
      media_type = 'embed';
    }

    const result = await query(
      'INSERT INTO events (title, description, event_date, location, event_type, image_url, media_type, video_url, is_featured) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      [title, description || null, event_date || null, location || null, event_type || 'event', image_url, media_type, video_url || null, is_featured === 'true']
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Event created' });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/admin/events/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = (await query('SELECT * FROM events WHERE id = $1', [id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Event not found' });

    const { title, description, event_date, location, event_type, is_featured, remove_image, video_url } = req.body;
    let image_url = existing.image_url;
    let media_type = existing.media_type || 'image';

    if (remove_image === 'true' && existing.image_url) {
      const oldPath = path.join(__dirname, 'public', existing.image_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      image_url = null;
      media_type = video_url && video_url.trim() ? 'embed' : 'image';
    }

    if (req.file) {
      if (existing.image_url) {
        const oldPath = path.join(__dirname, 'public', existing.image_url);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      image_url = `/uploads/${req.file.filename}`;
      media_type = getMediaType(req.file.filename);
    } else if (video_url !== undefined) {
      media_type = video_url && video_url.trim() ? 'embed' : (image_url ? media_type : 'image');
    }

    await query(
      `UPDATE events SET title=$1, description=$2, event_date=$3, location=$4, event_type=$5,
       image_url=$6, media_type=$7, video_url=$8, is_featured=$9, updated_at=NOW() WHERE id=$10`,
      [title || existing.title, description ?? existing.description, event_date ?? existing.event_date,
       location ?? existing.location, event_type || existing.event_type, image_url, media_type,
       video_url !== undefined ? (video_url || null) : existing.video_url,
       is_featured === 'true' ? true : (is_featured === 'false' ? false : existing.is_featured), id]
    );
    res.json({ message: 'Event updated' });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/admin/events/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = (await query('SELECT * FROM events WHERE id = $1', [id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Event not found' });

    if (existing.image_url) {
      const imgPath = path.join(__dirname, 'public', existing.image_url);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
    await query('DELETE FROM events WHERE id = $1', [id]);
    res.json({ message: 'Event deleted' });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ─── TESTIMONIALS (Public) ───────────────────────────────────────────────────

app.get('/api/testimonials', async (req, res) => {
  try {
    const result = await query('SELECT * FROM testimonials WHERE is_visible = true ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ─── TESTIMONIALS (Admin) ────────────────────────────────────────────────────

app.get('/api/admin/testimonials', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM testimonials ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/testimonials', authenticateToken, async (req, res) => {
  try {
    const { author_name, author_title, content, rating, is_visible } = req.body;
    if (!author_name || !content) return res.status(400).json({ error: 'Name and content required' });
    const result = await query(
      'INSERT INTO testimonials (author_name, author_title, content, rating, is_visible) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [author_name, author_title || null, content, parseInt(rating) || 5, is_visible !== 'false' && is_visible !== false]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/admin/testimonials/:id', authenticateToken, async (req, res) => {
  try {
    const { author_name, author_title, content, rating, is_visible } = req.body;
    await query(
      'UPDATE testimonials SET author_name=$1, author_title=$2, content=$3, rating=$4, is_visible=$5 WHERE id=$6',
      [author_name, author_title || null, content, parseInt(rating) || 5, is_visible === true || is_visible === 'true', parseInt(req.params.id)]
    );
    res.json({ message: 'Updated' });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/admin/testimonials/:id', authenticateToken, async (req, res) => {
  try {
    await query('DELETE FROM testimonials WHERE id = $1', [parseInt(req.params.id)]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ─── CONTACT ─────────────────────────────────────────────────────────────────

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: 'Name, email and message required' });
    await query(
      'INSERT INTO contact_messages (name, email, subject, message) VALUES ($1,$2,$3,$4)',
      [name, email, subject || 'General Inquiry', message]
    );
    res.json({ message: 'Message received. Thank you!' });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/admin/messages', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM contact_messages ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.patch('/api/admin/messages/:id/read', authenticateToken, async (req, res) => {
  try {
    await query('UPDATE contact_messages SET is_read = true WHERE id = $1', [parseInt(req.params.id)]);
    res.json({ message: 'Marked as read' });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/admin/messages/:id', authenticateToken, async (req, res) => {
  try {
    await query('DELETE FROM contact_messages WHERE id = $1', [parseInt(req.params.id)]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ─── STATS ───────────────────────────────────────────────────────────────────

app.get('/api/admin/stats', authenticateToken, async (req, res) => {
  try {
    const [events, messages, unread, testimonials] = await Promise.all([
      query('SELECT COUNT(*) FROM events'),
      query('SELECT COUNT(*) FROM contact_messages'),
      query('SELECT COUNT(*) FROM contact_messages WHERE is_read = false'),
      query('SELECT COUNT(*) FROM testimonials')
    ]);
    res.json({
      events: parseInt(events.rows[0].count),
      messages: parseInt(messages.rows[0].count),
      unread: parseInt(unread.rows[0].count),
      testimonials: parseInt(testimonials.rows[0].count)
    });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ─── ADMIN SPA ────────────────────────────────────────────────────────────────

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));
app.get('/admin/*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));

// ─── START ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Website → http://localhost:${PORT}`);
    console.log(`📋 Admin   → http://localhost:${PORT}/admin\n`);
  });
}).catch(err => {
  console.error('❌ Database connection failed:', err.message);
  console.error('Full error:', err);
  process.exit(1);
});
