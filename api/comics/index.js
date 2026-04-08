// api/comics/index.js
// Menangani semua route comics dalam satu file:
// GET    /api/comics              → list comics
// POST   /api/comics              → submit komik baru
// GET    /api/comics/:id          → detail komik + chapters
// PATCH  /api/comics/:id          → approve/reject
// DELETE /api/comics/:id          → hapus komik
// GET    /api/comics/chapters     → list chapters komik
// POST   /api/comics/chapters     → upload chapter baru

const { requireAuth, requireAdmin } = require('../auth/verify');
const { query } = require('../_d1');
const { v4: uuidv4 } = require('uuid');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Ambil ID dari URL
  const urlParts = req.url.split('?')[0].split('/').filter(Boolean);
  const id = urlParts[2] || req.query.id || null;
  const isChapters = id === 'chapters';
  const action = req.query.action;

  // ── ROUTE: /api/comics/chapters ───────────────────────────────
  if (isChapters) {
    // GET chapters suatu komik
    if (req.method === 'GET') {
      const { comic_id } = req.query;
      if (!comic_id) return res.status(400).json({ error: 'comic_id required' });

      try {
        const result = await query(
          `SELECT id, comic_id, chapter_number, title, image_urls, created_at
           FROM comic_chapters
           WHERE comic_id = ?
           ORDER BY chapter_number ASC`,
          [comic_id]
        );
        const chapters = (result.results || []).map(ch => ({
          ...ch,
          image_urls: safeParseJSON(ch.image_urls, [])
        }));
        return res.status(200).json({ chapters });
      } catch(err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // POST chapter baru
    if (req.method === 'POST') {
      const user = requireAuth(req, res);
      if (!user) return;

      const { comic_id, title, image_urls } = req.body;
      if (!comic_id || !image_urls?.length) {
        return res.status(400).json({ error: 'comic_id dan image_urls wajib diisi' });
      }

      try {
        // Cek komik milik user ini
        const comicResult = await query(
          'SELECT id, author_id FROM comics WHERE id = ?',
          [comic_id]
        );
        const comic = comicResult.results[0];
        if (!comic) return res.status(404).json({ error: 'Komik tidak ditemukan' });

        const userId = user.sub || user.id;
        if (comic.author_id !== userId) {
          return res.status(403).json({ error: 'Bukan komik milikmu' });
        }

        // Auto-numbering
        const lastResult = await query(
          'SELECT MAX(chapter_number) as last_num FROM comic_chapters WHERE comic_id = ?',
          [comic_id]
        );
        const lastNum = lastResult.results[0]?.last_num || 0;
        const chapterNumber = lastNum + 1;

        const chapId = uuidv4();
        const imagesStr = JSON.stringify(Array.isArray(image_urls) ? image_urls : []);

        await query(
          `INSERT INTO comic_chapters (id, comic_id, chapter_number, title, image_urls, created_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          [chapId, comic_id, chapterNumber, title || `Chapter ${chapterNumber}`, imagesStr]
        );

        return res.status(201).json({
          message: 'Chapter berhasil diupload',
          id: chapId,
          chapter_number: chapterNumber
        });
      } catch(err) {
        console.error('Upload comic chapter error:', err);
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── ROUTE: /api/comics/:id ────────────────────────────────────
  if (id) {
    // GET detail komik
    if (req.method === 'GET') {
      try {
        const result = await query(
          `SELECT c.*, u.display_name as author_name, u.pen_name,
                  u.photo_url as author_photo, u.bio as author_bio
           FROM comics c
           LEFT JOIN users u ON c.author_id = u.id
           WHERE c.id = ?`,
          [id]
        );

        const comic = result.results[0];
        if (!comic) return res.status(404).json({ error: 'Comic not found' });

        comic.genre = safeParseJSON(comic.genre, []);
        comic.image_urls = safeParseJSON(comic.image_urls, []);

        // Ambil chapters dari tabel comic_chapters
        let chapters = [];
        try {
          const chapResult = await query(
            `SELECT id, comic_id, chapter_number, title, image_urls, created_at
             FROM comic_chapters
             WHERE comic_id = ?
             ORDER BY chapter_number ASC`,
            [id]
          );
          chapters = (chapResult.results || []).map(ch => ({
            ...ch,
            image_urls: safeParseJSON(ch.image_urls, [])
          }));
        } catch(e) {
          chapters = [];
        }

        return res.status(200).json({ comic, chapters });
      } catch (err) {
        console.error('Get comic error:', err);
        return res.status(500).json({ error: 'Failed to fetch comic', detail: err.message });
      }
    }

    // PATCH approve/reject (admin)
    if (req.method === 'PATCH') {
      if (action === 'approve' || action === 'reject') {
        const admin = requireAdmin(req, res);
        if (!admin) return;

        try {
          const status = action === 'approve' ? 'approved' : 'rejected';
          await query(
            `UPDATE comics SET status = ?, updated_at = datetime('now') WHERE id = ?`,
            [status, id]
          );
          return res.status(200).json({ message: `Comic ${status}`, id, status });
        } catch (err) {
          return res.status(500).json({ error: 'Failed to update comic status' });
        }
      }
      return res.status(400).json({ error: 'Invalid action' });
    }

    // DELETE (admin)
    if (req.method === 'DELETE') {
      const admin = requireAdmin(req, res);
      if (!admin) return;

      try {
        await query('DELETE FROM comic_chapters WHERE comic_id = ?', [id]);
        await query('DELETE FROM comics WHERE id = ?', [id]);
        return res.status(200).json({ message: 'Comic deleted' });
      } catch (err) {
        return res.status(500).json({ error: 'Failed to delete comic' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── ROUTE: /api/comics ────────────────────────────────────────
  // GET list comics
  if (req.method === 'GET') {
    try {
      const { sort = 'newest', genre, limit = 20, offset = 0, author_id } = req.query;

      let orderBy = 'c.created_at DESC';
      if (sort === 'rating') orderBy = 'c.rating_avg DESC';
      if (sort === 'az') orderBy = 'c.title ASC';

      let filters = `WHERE c.status = 'approved'`;
      let params = [];

      if (genre) {
        filters += ` AND c.genre LIKE ?`;
        params.push(`%${genre}%`);
      }

      if (author_id) {
        filters = `WHERE c.author_id = ?`;
        params = [author_id];
      }

      params.push(parseInt(limit), parseInt(offset));

      const result = await query(
        `SELECT c.id, c.title, c.synopsis, c.genre, c.rating_avg, c.rating_count,
                c.cover_url, c.status, c.created_at,
                u.display_name as author_name, u.pen_name, u.photo_url as author_photo
         FROM comics c
         LEFT JOIN users u ON c.author_id = u.id
         ${filters}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
        params
      );

      const comics = result.results.map(c => ({
        ...c,
        genre: safeParseJSON(c.genre, []),
        image_urls: safeParseJSON(c.image_urls, [])
      }));

      return res.status(200).json({ comics });
    } catch (err) {
      console.error('Get comics error:', err);
      return res.status(500).json({ error: 'Failed to fetch comics' });
    }
  }

  // POST submit komik baru
  if (req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
      const { title, synopsis, genre, image_urls, cover_url } = req.body;
      if (!title) return res.status(400).json({ error: 'Title is required' });

      const id = uuidv4();
      const genreStr = JSON.stringify(Array.isArray(genre) ? genre : []);
      const imagesStr = JSON.stringify(Array.isArray(image_urls) ? image_urls : []);
      const userId = user.sub || user.id;

      await query(
        `INSERT INTO comics (id, title, synopsis, genre, image_urls, author_id, cover_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [id, title, synopsis || '', genreStr, imagesStr, userId, cover_url || null]
      );

      return res.status(201).json({ message: 'Comic submitted for review', id, status: 'pending' });
    } catch (err) {
      console.error('Create comic error:', err);
      return res.status(500).json({ error: 'Failed to submit comic' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}
