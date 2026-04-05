// api/authors.js
const { query } = require('./_d1');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;

  // GET single author
  if (id) {
    try {
      const [userResult, novelsResult, comicsResult] = await Promise.all([
        query('SELECT id, display_name, pen_name, photo_url, bio FROM users WHERE id = ?', [id]),
        query(
          `SELECT id, title, cover_url, rating_avg, rating_count, genre, created_at
           FROM novels WHERE author_id = ? AND status = 'approved'`,
          [id]
        ),
        query(
          `SELECT id, title, cover_url, rating_avg, rating_count, genre, created_at
           FROM comics WHERE author_id = ? AND status = 'approved'`,
          [id]
        )
      ]);

      const author = userResult.results[0];
      if (!author) return res.status(404).json({ error: 'Author not found' });

      const novels = novelsResult.results.map(n => ({ ...n, genre: safeParseJSON(n.genre, []) }));
      const comics = comicsResult.results.map(c => ({ ...c, genre: safeParseJSON(c.genre, []) }));

      // Calculate overall rating
      const allContent = [...novels, ...comics];
      const totalRating = allContent.reduce((sum, c) => sum + c.rating_avg * c.rating_count, 0);
      const totalCount = allContent.reduce((sum, c) => sum + c.rating_count, 0);
      const avg_rating = totalCount > 0 ? Math.round((totalRating / totalCount) * 10) / 10 : 0;

      return res.status(200).json({ author: { ...author, novels, comics, avg_rating } });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch author' });
    }
  }

  // GET all authors (users with at least one approved work)
  try {
    const result = await query(
      `SELECT DISTINCT u.id, u.display_name, u.pen_name, u.photo_url, u.bio,
              COUNT(DISTINCT n.id) as novel_count,
              COUNT(DISTINCT c.id) as comic_count,
              ROUND(AVG(CASE WHEN n.rating_count > 0 THEN n.rating_avg END), 1) as avg_rating
       FROM users u
       LEFT JOIN novels n ON u.id = n.author_id AND n.status = 'approved'
       LEFT JOIN comics c ON u.id = c.author_id AND c.status = 'approved'
       WHERE n.id IS NOT NULL OR c.id IS NOT NULL
       GROUP BY u.id
       ORDER BY avg_rating DESC NULLS LAST`,
      []
    );

    return res.status(200).json({ authors: result.results });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch authors' });
  }
};

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}
