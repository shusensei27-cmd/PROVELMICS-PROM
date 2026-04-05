// api/novels/[id].js - Get single novel + admin approve/reject
const { requireAuth, requireAdmin } = require('../auth/verify');
const { query } = require('../_d1');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, action } = req.query;

  // GET - single novel
  if (req.method === 'GET') {
    try {
      const result = await query(
        `SELECT n.*, u.display_name as author_name, u.pen_name, u.photo_url as author_photo, u.bio as author_bio
         FROM novels n
         LEFT JOIN users u ON n.author_id = u.id
         WHERE n.id = ?`,
        [id]
      );

      const novel = result.results[0];
      if (!novel) return res.status(404).json({ error: 'Novel not found' });

      novel.genre = safeParseJSON(novel.genre, []);
      novel.content = safeParseJSON(novel.content, novel.content);

      return res.status(200).json({ novel });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch novel' });
    }
  }

  // PATCH - approve/reject (admin) or update
  if (req.method === 'PATCH') {
    if (action === 'approve' || action === 'reject') {
      const admin = requireAdmin(req, res);
      if (!admin) return;

      try {
        const status = action === 'approve' ? 'approved' : 'rejected';
        await query(
          `UPDATE novels SET status = ?, updated_at = datetime('now') WHERE id = ?`,
          [status, id]
        );
        return res.status(200).json({ message: `Novel ${status}`, id, status });
      } catch (err) {
        return res.status(500).json({ error: 'Failed to update novel status' });
      }
    }

    return res.status(400).json({ error: 'Invalid action' });
  }

  // DELETE - admin only
  if (req.method === 'DELETE') {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    try {
      await query('DELETE FROM novels WHERE id = ?', [id]);
      return res.status(200).json({ message: 'Novel deleted' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete novel' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}
