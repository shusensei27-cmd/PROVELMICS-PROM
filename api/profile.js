// api/profile.js
const { requireAuth } = require('./auth/verify');
const { query } = require('./_d1');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  // GET profile
  if (req.method === 'GET') {
    try {
      const result = await query('SELECT * FROM users WHERE id = ?', [user.sub]);
      const profile = result.results[0];
      if (!profile) return res.status(404).json({ error: 'Profile not found' });
      return res.status(200).json({ profile });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }
  }

  // PATCH - update profile
  if (req.method === 'PATCH') {
    try {
      const { bio, pen_name, display_name, photo_url } = req.body;

      const updates = [];
      const params = [];

      if (bio !== undefined) { updates.push('bio = ?'); params.push(bio); }
      if (pen_name !== undefined) { updates.push('pen_name = ?'); params.push(pen_name); }
      if (display_name !== undefined) { updates.push('display_name = ?'); params.push(display_name); }
      if (photo_url !== undefined) { updates.push('photo_url = ?'); params.push(photo_url); }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push("updated_at = datetime('now')");
      params.push(user.sub);

      await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      const result = await query('SELECT * FROM users WHERE id = ?', [user.sub]);
      return res.status(200).json({ profile: result.results[0] });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
