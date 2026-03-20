const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function initDB() {
  await query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      event_date TEXT,
      location TEXT,
      event_type TEXT DEFAULT 'event',
      image_url TEXT,
      media_type TEXT DEFAULT 'image',
      video_url TEXT,
      is_featured BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE events ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image';
    ALTER TABLE events ADD COLUMN IF NOT EXISTS video_url TEXT;

    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS testimonials (
      id SERIAL PRIMARY KEY,
      author_name TEXT NOT NULL,
      author_title TEXT,
      content TEXT NOT NULL,
      rating INTEGER DEFAULT 5,
      is_visible BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Seed admin
  const bcrypt = require('bcryptjs');
  const adminExists = await query('SELECT id FROM admins WHERE username = $1', [process.env.ADMIN_USERNAME || 'admin']);
  if (adminExists.rows.length === 0) {
    const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Karine@Admin2024', 10);
    await query('INSERT INTO admins (username, password_hash) VALUES ($1, $2)', [
      process.env.ADMIN_USERNAME || 'admin', hash
    ]);
    console.log('✅ Admin account created');
  }

  // Seed events
  const evCount = await query('SELECT COUNT(*) FROM events');
  if (parseInt(evCount.rows[0].count) === 0) {
    const events = [
      ['Leadership Summit Dubai 2024', 'Karine delivered a keynote on navigating career transitions in the modern workplace, inspiring over 500 professionals to embrace change with clarity and courage.', '2024-11-15', 'Jumeirah Emirates Towers, Dubai, UAE', 'conference', true],
      ['The Career Compass Podcast', 'Featured guest on The Career Compass Podcast where Karine discussed how her book "CrossRoads" came to life and her journey from corporate professional to transformational coach.', '2024-10-08', 'Virtual / Dubai, UAE', 'podcast', true],
      ['Women in Business Forum', 'Panelist at the prestigious Women in Business Forum, sharing insights on breaking barriers in male-dominated industries and building resilient leadership styles.', '2024-09-20', 'DIFC, Dubai, UAE', 'seminar', false],
      ['Public Policy & Leadership Masterclass', 'Conducted a half-day masterclass on the intersection of public policy and organizational leadership for senior government officials and C-suite executives.', '2024-08-05', 'Abu Dhabi, UAE', 'seminar', false]
    ];
    for (const e of events) {
      await query(
        'INSERT INTO events (title, description, event_date, location, event_type, is_featured) VALUES ($1,$2,$3,$4,$5,$6)',
        e
      );
    }
    console.log('✅ Sample events seeded');
  }

  // Seed testimonials
  const tCount = await query('SELECT COUNT(*) FROM testimonials');
  if (parseInt(tCount.rows[0].count) === 0) {
    const testimonials = [
      ['Sarah Al-Mansouri', 'VP of Operations, Tech Startup Dubai', 'Working with Karine was a turning point in my career. Her ability to cut through the noise and help me find clarity is unmatched. I went from feeling stuck to landing my dream role within 3 months.', 5],
      ['James Okonkwo', 'Senior Policy Advisor, Government of UAE', 'Karine\'s coaching helped me navigate one of the most complex career transitions of my life. Her book "CrossRoads" is something I recommend to every professional at a crossroads.', 5],
      ['Fatima Khalid', 'Entrepreneur & Founder', 'The clarity and confidence Karine helped me build has been invaluable to my entrepreneurial journey. She doesn\'t just coach — she transforms.', 5]
    ];
    for (const t of testimonials) {
      await query(
        'INSERT INTO testimonials (author_name, author_title, content, rating) VALUES ($1,$2,$3,$4)',
        t
      );
    }
    console.log('✅ Testimonials seeded');
  }

  console.log('✅ Database ready');
}

module.exports = { query, initDB };
