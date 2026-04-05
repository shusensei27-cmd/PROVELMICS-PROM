// api/progress.js
const { requireAuth } = require('./auth/verify');
const { query } = require('./_d1');
const { v4: uuidv4 } = require('uuid');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    try {
      const result = await query(
        `SELECT rp.*, n.title, n.cover_url
         FROM reading_progress rp
         LEFT JOIN novels n ON rp.novel_id = n.id
         WHERE rp.user_id = ?
         ORDER BY rp.updated_at DESC
         LIMIT 10`,
        [user.sub]
      );
      return res.status(200).json({ progress: result.results });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch progress' });
    }
  }

  if (req.method === 'POST') {
    const { novel_id, chapter_index, scroll_position = 0 } = req.body;
    if (!novel_id) return res.status(400).json({ error: 'novel_id required' });

    try {
      const id = uuidv4();
      await query(
        `INSERT INTO reading_progress (id, user_id, novel_id, chapter_index, scroll_position)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, novel_id) DO UPDATE SET
           chapter_index = excluded.chapter_index,
           scroll_position = excluded.scroll_position,
           updated_at = datetime('now')`,
        [id, user.sub, novel_id, chapter_index || 0, scroll_position]
      );
      return res.status(200).json({ message: 'Progress saved' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to save progress' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
