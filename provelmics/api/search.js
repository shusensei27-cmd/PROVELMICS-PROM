// api/search.js
const { query } = require('./_d1');

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  const searchTerm = q.trim().toLowerCase();
  const cacheKey = `search:${searchTerm}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.status(200).json(cached.data);
  }

  try {
    const likeParam = `%${searchTerm}%`;

    const [novelsResult, comicsResult] = await Promise.all([
      query(
        `SELECT n.id, n.title, n.genre, n.rating_avg, n.cover_url, 'novel' as type,
                u.display_name as author_name
         FROM novels n
         LEFT JOIN users u ON n.author_id = u.id
         WHERE n.status = 'approved'
           AND (LOWER(n.title) LIKE ? OR LOWER(n.genre) LIKE ? OR LOWER(u.display_name) LIKE ?)
         LIMIT 8`,
        [likeParam, likeParam, likeParam]
      ),
      query(
        `SELECT c.id, c.title, c.genre, c.rating_avg, c.cover_url, 'comic' as type,
                u.display_name as author_name
         FROM comics c
         LEFT JOIN users u ON c.author_id = u.id
         WHERE c.status = 'approved'
           AND (LOWER(c.title) LIKE ? OR LOWER(c.genre) LIKE ? OR LOWER(u.display_name) LIKE ?)
         LIMIT 7`,
        [likeParam, likeParam, likeParam]
      )
    ]);

    const results = [
      ...novelsResult.results.map(n => ({ ...n, genre: safeParseJSON(n.genre, []) })),
      ...comicsResult.results.map(c => ({ ...c, genre: safeParseJSON(c.genre, []) }))
    ].slice(0, 15);

    const data = { results, query: q };

    // Cache result
    cache.set(cacheKey, { data, timestamp: Date.now() });

    // Cleanup old cache entries
    if (cache.size > 100) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ error: 'Search failed' });
  }
};

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}
