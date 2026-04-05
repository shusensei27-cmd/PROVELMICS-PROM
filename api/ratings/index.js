// api/ratings/index.js
const { requireAuth } = require('../auth/verify');
const { query, batch } = require('../_d1');
const { v4: uuidv4 } = require('uuid');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET - get user's rating for a specific content
  if (req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return;

    const { content_id, content_type } = req.query;
    if (!content_id || !content_type) {
      return res.status(400).json({ error: 'content_id and content_type required' });
    }

    try {
      const result = await query(
        'SELECT rating FROM ratings WHERE user_id = ? AND content_id = ? AND content_type = ?',
        [user.sub, content_id, content_type]
      );
      return res.status(200).json({ rating: result.results[0]?.rating || null });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch rating' });
    }
  }

  // POST - submit or update rating
  if (req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;

    const { content_id, content_type, rating } = req.body;

    if (!content_id || !content_type || !rating) {
      return res.status(400).json({ error: 'content_id, content_type, and rating required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    if (!['novel', 'comic'].includes(content_type)) {
      return res.status(400).json({ error: 'Invalid content_type' });
    }

    try {
      const id = uuidv4();
      // Upsert rating
      await query(
        `INSERT INTO ratings (id, user_id, content_id, content_type, rating)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, content_id, content_type) DO UPDATE SET
           rating = excluded.rating`,
        [id, user.sub, content_id, content_type, rating]
      );

      // Recalculate average
      const avgResult = await query(
        'SELECT AVG(rating) as avg, COUNT(*) as count FROM ratings WHERE content_id = ? AND content_type = ?',
        [content_id, content_type]
      );

      const { avg, count } = avgResult.results[0];
      const table = content_type === 'novel' ? 'novels' : 'comics';

      await query(
        `UPDATE ${table} SET rating_avg = ?, rating_count = ?, updated_at = datetime('now') WHERE id = ?`,
        [Math.round(avg * 10) / 10, count, content_id]
      );

      return res.status(200).json({
        message: 'Rating submitted',
        rating_avg: Math.round(avg * 10) / 10,
        rating_count: count
      });
    } catch (err) {
      console.error('Rating error:', err);
      return res.status(500).json({ error: 'Failed to submit rating' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
