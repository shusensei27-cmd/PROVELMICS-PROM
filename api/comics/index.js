// api/comics/index.js
const { requireAuth } = require('../auth/verify');
const { query } = require('../_d1');
const { v4: uuidv4 } = require('uuid');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const { sort = 'newest', genre, limit = 20, offset = 0 } = req.query;
      let orderBy = 'c.created_at DESC';
      if (sort === 'rating') orderBy = 'c.rating_avg DESC';
      if (sort === 'az') orderBy = 'c.title ASC';

      let genreFilter = '';
      let params = [];
      if (genre) { genreFilter = `AND c.genre LIKE ?`; params.push(`%${genre}%`); }
      params.push(parseInt(limit), parseInt(offset));

      const result = await query(
        `SELECT c.*, u.display_name as author_name, u.pen_name, u.photo_url as author_photo
         FROM comics c
         LEFT JOIN users u ON c.author_id = u.id
         WHERE c.status = 'approved' ${genreFilter}
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
      return res.status(500).json({ error: 'Failed to fetch comics' });
    }
  }

  if (req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
      const { title, synopsis, genre, image_urls, cover_url } = req.body;
      if (!title) return res.status(400).json({ error: 'Title is required' });

      const id = uuidv4();
      const genreStr = JSON.stringify(Array.isArray(genre) ? genre : []);
      const imagesStr = JSON.stringify(Array.isArray(image_urls) ? image_urls : []);

      await query(
        `INSERT INTO comics (id, title, synopsis, genre, image_urls, author_id, cover_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [id, title, synopsis || '', genreStr, imagesStr, user.sub, cover_url || null]
      );

      return res.status(201).json({ message: 'Comic submitted for review', id, status: 'pending' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to submit comic' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}
