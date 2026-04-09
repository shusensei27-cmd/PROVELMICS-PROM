// api/novels/index.js
const { requireAuth, requireAdmin } = require('../auth/verify');
const { query } = require('../_d1');
const { v4: uuidv4 } = require('uuid');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Logging untuk debug
  console.log('[novels] Method:', req.method, 'URL:', req.url);

  function getIdFromRequest(req) {
    if (req.query.id && req.query.id !== 'chapters') return req.query.id;
    const url = req.url.split('?')[0];
    const parts = url.split('/').filter(Boolean);
    const possibleId = parts[2];
    if (possibleId && possibleId !== 'chapters') return possibleId;
    return null;
  }

  const id = getIdFromRequest(req);
  const isChapters = req.url.includes('/chapters') || req.query.id === 'chapters';
  const action = req.query.action;

  // ── ROUTE: /api/novels/chapters ──────────────────────────────
  if (isChapters) {
    if (req.method === 'GET') {
      const { novel_id } = req.query;
      if (!novel_id) return res.status(400).json({ error: 'novel_id required' });
      try {
        const result = await query(
          `SELECT id, novel_id, chapter_number, title, created_at
           FROM novel_chapters WHERE novel_id = ? ORDER BY chapter_number ASC`,
          [novel_id]
        );
        return res.status(200).json({ chapters: result.results || [] });
      } catch(err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (req.method === 'POST') {
      const user = requireAuth(req, res);
      if (!user) return;
      const { novel_id, title, content } = req.body;
      if (!novel_id || !content) return res.status(400).json({ error: 'novel_id dan content wajib diisi' });
      try {
        const novelResult = await query('SELECT id, author_id FROM novels WHERE id = ?', [novel_id]);
        const novel = novelResult.results[0];
        if (!novel) return res.status(404).json({ error: 'Novel tidak ditemukan' });
        const userId = user.sub || user.id;
        if (novel.author_id !== userId) return res.status(403).json({ error: 'Bukan novel milikmu' });

        const lastResult = await query('SELECT MAX(chapter_number) as last_num FROM novel_chapters WHERE novel_id = ?', [novel_id]);
        const lastNum = lastResult.results[0]?.last_num || 0;
        const chapterNumber = lastNum + 1;
        const chapId = uuidv4();
        await query(
          `INSERT INTO novel_chapters (id, novel_id, chapter_number, title, content, created_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          [chapId, novel_id, chapterNumber, title || `Chapter ${chapterNumber}`, content]
        );
        return res.status(201).json({ message: 'Chapter berhasil diupload', id: chapId, chapter_number: chapterNumber });
      } catch(err) {
        console.error('Upload chapter error:', err);
        return res.status(500).json({ error: err.message });
      }
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── ROUTE: /api/novels/:id ────────────────────────────────────
  if (id) {
    if (req.method === 'GET') {
      try {
        const result = await query(
          `SELECT n.*, u.display_name as author_name, u.pen_name,
                  u.photo_url as author_photo, u.bio as author_bio
           FROM novels n LEFT JOIN users u ON n.author_id = u.id WHERE n.id = ?`,
          [id]
        );
        const novel = result.results[0];
        if (!novel) {
          console.log('[novels] Novel not found:', id);
          return res.status(404).json({ error: 'Novel not found' });
        }

        // Cek apakah user bisa melihat (admin boleh lihat semua, user biasa hanya approved)
        let isAdmin = false;
        try {
          const authHeader = req.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            if (payload.email === process.env.ADMIN_EMAIL) isAdmin = true;
          }
        } catch(e) {}

        if (novel.status !== 'approved' && !isAdmin) {
          return res.status(403).json({ error: 'Content not found or still pending approval' });
        }

        novel.genre = safeParseJSON(novel.genre, []);
        novel.content = safeParseJSON(novel.content, novel.content);

        let chapters = [];
        try {
          const chapResult = await query(
            `SELECT id, novel_id, chapter_number, title, content, created_at
             FROM novel_chapters WHERE novel_id = ? ORDER BY chapter_number ASC`,
            [id]
          );
          chapters = chapResult.results || [];
        } catch(e) {
          chapters = [];
        }

        return res.status(200).json({ novel, chapters });
      } catch (err) {
        console.error('Get novel error:', err);
        return res.status(500).json({ error: 'Failed to fetch novel', detail: err.message });
      }
    }

    if (req.method === 'PATCH') {
      if (action === 'approve' || action === 'reject') {
        const admin = requireAdmin(req, res);
        if (!admin) return;
        const status = action === 'approve' ? 'approved' : 'rejected';
        await query(`UPDATE novels SET status = ?, updated_at = datetime('now') WHERE id = ?`, [status, id]);
        return res.status(200).json({ message: `Novel ${status}`, id, status });
      }
      return res.status(400).json({ error: 'Invalid action' });
    }

    if (req.method === 'DELETE') {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      await query('DELETE FROM novel_chapters WHERE novel_id = ?', [id]);
      await query('DELETE FROM novels WHERE id = ?', [id]);
      return res.status(200).json({ message: 'Novel deleted' });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── ROUTE: /api/novels ────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { sort = 'newest', genre, limit = 20, offset = 0, author_id } = req.query;
      let orderBy = 'n.created_at DESC';
      if (sort === 'rating') orderBy = 'n.rating_avg DESC';
      if (sort === 'az') orderBy = 'n.title ASC';

      let filters = `WHERE n.status = 'approved'`;
      let params = [];
      if (genre) { filters += ` AND n.genre LIKE ?`; params.push(`%${genre}%`); }
      if (author_id) {
        filters = `WHERE n.author_id = ?`;
        params = [author_id];
      }
      params.push(parseInt(limit), parseInt(offset));

      const result = await query(
        `SELECT n.id, n.title, n.synopsis, n.genre, n.rating_avg, n.rating_count,
                n.cover_url, n.status, n.created_at,
                u.display_name as author_name, u.pen_name, u.photo_url as author_photo
         FROM novels n LEFT JOIN users u ON n.author_id = u.id
         ${filters}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
        params
      );
      const novels = result.results.map(n => ({ ...n, genre: safeParseJSON(n.genre, []) }));
      return res.status(200).json({ novels });
    } catch (err) {
      console.error('Get novels error:', err);
      return res.status(500).json({ error: 'Failed to fetch novels' });
    }
  }

  // POST submit novel baru + buat chapter pertama
  if (req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const { title, synopsis, genre, content, cover_url } = req.body;
      if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });

      const id = uuidv4();
      const genreStr = JSON.stringify(Array.isArray(genre) ? genre : [genre].filter(Boolean));
      const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
      const userId = user.sub || user.id;

      await query(
        `INSERT INTO novels (id, title, synopsis, genre, content, author_id, cover_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [id, title, synopsis || '', genreStr, contentStr, userId, cover_url || null]
      );

      // Buat chapter pertama
      const chapId = uuidv4();
      await query(
        `INSERT INTO novel_chapters (id, novel_id, chapter_number, title, content, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [chapId, id, 1, 'Chapter 1', contentStr, null]
      );

      return res.status(201).json({ message: 'Novel submitted for review', id, status: 'pending' });
    } catch (err) {
      console.error('Create novel error:', err);
      return res.status(500).json({ error: 'Failed to submit novel' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}
