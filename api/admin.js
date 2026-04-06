const { requireAdmin } = require('./auth/verify');
const { query } = require('./_d1');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const admin = requireAdmin(req, res);
  if (!admin) return;
  
  console.log('Admin payload:', JSON.stringify(admin));
  
  // ... kode selanjutnya
  console.log('[DEBUG] Data fetched:', JSON.stringify(data));

  if (req.method === 'GET') {
    try {
      const { type = 'pending' } = req.query;

      // Query novels - tanpa JOIN dulu untuk debug
      const novelsResult = await query(
        `SELECT n.id, n.title, n.genre, n.status, n.cover_url,
                n.author_id, n.created_at,
                u.display_name as author_name,
                u.email as author_email
         FROM novels n
         LEFT JOIN users u ON n.author_id = u.id
         WHERE n.status = ?
         ORDER BY n.created_at DESC`,
        [type]
      );

      // Query comics
      const comicsResult = await query(
        `SELECT c.id, c.title, c.genre, c.status, c.cover_url,
                c.author_id, c.created_at,
                u.display_name as author_name,
                u.email as author_email
         FROM comics c
         LEFT JOIN users u ON c.author_id = u.id
         WHERE c.status = ?
         ORDER BY c.created_at DESC`,
        [type]
      );

      // Query stats
      const statsResult = await query(
        `SELECT
           (SELECT COUNT(*) FROM users) as total_users,
           (SELECT COUNT(*) FROM novels WHERE status = 'approved') as approved_novels,
           (SELECT COUNT(*) FROM novels WHERE status = 'pending') as pending_novels,
           (SELECT COUNT(*) FROM comics WHERE status = 'approved') as approved_comics,
           (SELECT COUNT(*) FROM comics WHERE status = 'pending') as pending_comics,
           (SELECT COUNT(*) FROM ratings) as total_ratings`,
        []
      );

      const novels = (novelsResult.results || []).map(n => ({
        ...n,
        genre: safeParseJSON(n.genre, [])
      }));

      const comics = (comicsResult.results || []).map(c => ({
        ...c,
        genre: safeParseJSON(c.genre, [])
      }));

      return res.status(200).json({
        novels,
        comics,
        stats: statsResult.results?.[0] || {}
      });

    } catch (err) {
      console.error('Admin error:', err);
      return res.status(500).json({ 
        error: 'Failed to fetch admin data',
        detail: err.message 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}
