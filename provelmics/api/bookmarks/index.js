// api/bookmarks/index.js
const { requireAuth } = require('../auth/verify');
const { query } = require('../_d1');
const { v4: uuidv4 } = require('uuid');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  // GET - user's bookmarks
  if (req.method === 'GET') {
    try {
      const result = await query(
        `SELECT b.*,
           CASE WHEN b.content_type = 'novel' THEN n.title ELSE c.title END as title,
           CASE WHEN b.content_type = 'novel' THEN n.cover_url ELSE c.cover_url END as cover_url
         FROM bookmarks b
         LEFT JOIN novels n ON b.content_id = n.id AND b.content_type = 'novel'
         LEFT JOIN comics c ON b.content_id = c.id AND b.content_type = 'comic'
         WHERE b.user_id = ?
         ORDER BY b.created_at DESC`,
        [user.sub]
      );
      return res.status(200).json({ bookmarks: result.results });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch bookmarks' });
    }
  }

  // POST - add/update bookmark
  if (req.method === 'POST') {
    const { content_id, content_type, chapter = 0, progress_percent = 0 } = req.body;

    if (!content_id || !content_type) {
      return res.status(400).json({ error: 'content_id and content_type required' });
    }

    try {
      const id = uuidv4();
      await query(
        `INSERT INTO bookmarks (id, user_id, content_id, content_type, chapter, progress_percent)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, content_id, content_type) DO UPDATE SET
           chapter = excluded.chapter,
           progress_percent = excluded.progress_percent`,
        [id, user.sub, content_id, content_type, chapter, progress_percent]
      );
      return res.status(200).json({ message: 'Bookmark saved' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to save bookmark' });
    }
  }

  // DELETE - remove bookmark
  if (req.method === 'DELETE') {
    const { content_id, content_type } = req.query;
    try {
      await query(
        'DELETE FROM bookmarks WHERE user_id = ? AND content_id = ? AND content_type = ?',
        [user.sub, content_id, content_type]
      );
      return res.status(200).json({ message: 'Bookmark removed' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to remove bookmark' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
