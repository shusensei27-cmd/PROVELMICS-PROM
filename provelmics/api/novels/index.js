// api/novels/index.js - List and create novels
const { requireAuth } = require('../auth/verify');
const { query } = require('../_d1');
const { v4: uuidv4 } = require('uuid');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET - list approved novels
  if (req.method === 'GET') {
    try {
      const { sort = 'newest', genre, limit = 20, offset = 0 } = req.query;

      let orderBy = 'n.created_at DESC';
      if (sort === 'rating') orderBy = 'n.rating_avg DESC';
      if (sort === 'az') orderBy = 'n.title ASC';

      let genreFilter = '';
      let params = [];

      if (genre) {
        genreFilter = `AND n.genre LIKE ?`;
        params.push(`%${genre}%`);
      }

      params.push(parseInt(limit), parseInt(offset));

      const result = await query(
        `SELECT n.*, u.display_name as author_name, u.pen_name, u.photo_url as author_photo
         FROM novels n
         LEFT JOIN users u ON n.author_id = u.id
         WHERE n.status = 'approved' ${genreFilter}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
        params
      );

      const novels = result.results.map(n => ({
        ...n,
        genre: safeParseJSON(n.genre, []),
        content: undefined // Don't send content in list view
      }));

      return res.status(200).json({ novels });
    } catch (err) {
      console.error('Get novels error:', err);
      return res.status(500).json({ error: 'Failed to fetch novels' });
    }
  }

  // POST - submit novel (requires auth)
  if (req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
      const { title, synopsis, genre, content, cover_url } = req.body;

      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
      }

      const id = uuidv4();
      const genreStr = JSON.stringify(Array.isArray(genre) ? genre : [genre].filter(Boolean));
      const contentStr = typeof content === 'string' ? content : JSON.stringify(content);

      await query(
        `INSERT INTO novels (id, title, synopsis, genre, content, author_id, cover_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [id, title, synopsis || '', genreStr, contentStr, user.sub, cover_url || null]
      );

      return res.status(201).json({
        message: 'Novel submitted for review',
        id,
        status: 'pending'
      });
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
