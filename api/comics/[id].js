// api/comics/[id].js - Get single comic + admin approve/reject
const { requireAuth, requireAdmin } = require('../auth/verify');
const { query } = require('../_d1');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, action } = req.query;

  if (req.method === 'GET') {
    try {
      const result = await query(
        `SELECT c.*, u.display_name as author_name, u.pen_name, u.photo_url as author_photo, u.bio as author_bio
         FROM comics c
         LEFT JOIN users u ON c.author_id = u.id
         WHERE c.id = ?`,
        [id]
      );
      const comic = result.results[0];
      if (!comic) return res.status(404).json({ error: 'Comic not found' });

      comic.genre = safeParseJSON(comic.genre, []);
      comic.image_urls = safeParseJSON(comic.image_urls, []);

      // Ambil chapters jika ada
      let chapters = [];
      try {
        const chaptersResult = await query(
          `SELECT * FROM comic_chapters WHERE comic_id = ? ORDER BY chapter_number ASC`,
          [id]
        );
        chapters = chaptersResult.results || [];
        chapters = chapters.map(ch => ({
          ...ch,
          image_urls: safeParseJSON(ch.image_urls, [])
        }));
      } catch(e) { chapters = []; }

      return res.status(200).json({ comic, chapters });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch comic', detail: err.message });
    }
  }

  // PATCH untuk approve/reject (admin)
  if (req.method === 'PATCH') {
    if (action === 'approve' || action === 'reject') {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const status = action === 'approve' ? 'approved' : 'rejected';
      await query(`UPDATE comics SET status = ?, updated_at = datetime('now') WHERE id = ?`, [status, id]);
      return res.status(200).json({ message: `Comic ${status}`, id, status });
    }
    return res.status(400).json({ error: 'Invalid action' });
  }

  if (req.method === 'DELETE') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    await query('DELETE FROM comics WHERE id = ?', [id]);
    return res.status(200).json({ message: 'Comic deleted' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}
