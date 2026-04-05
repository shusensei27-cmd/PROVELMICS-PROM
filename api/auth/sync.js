// api/auth/sync.js - Sync Supabase Auth user to Cloudflare D1
const { requireAuth, ADMIN_EMAIL } = require('./verify');
const { query } = require('../_d1');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const { sub: id, email, name: display_name, picture: photo_url } = user;
    const role = email === ADMIN_EMAIL ? 'admin' : 'user';

    // Upsert user into D1
    await query(
      `INSERT INTO users (id, email, display_name, photo_url, role)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         display_name = COALESCE(users.display_name, excluded.display_name),
         photo_url = COALESCE(users.photo_url, excluded.photo_url),
         role = CASE WHEN excluded.email = ? THEN 'admin' ELSE users.role END,
         updated_at = datetime('now')`,
      [id, email, display_name || email.split('@')[0], photo_url || null, role, ADMIN_EMAIL]
    );

    // Fetch updated user
    const result = await query('SELECT * FROM users WHERE id = ?', [id]);
    const dbUser = result.results[0];

    return res.status(200).json({ user: dbUser });
  } catch (err) {
    console.error('Sync error:', err);
    return res.status(500).json({ error: 'Failed to sync user' });
  }
};
