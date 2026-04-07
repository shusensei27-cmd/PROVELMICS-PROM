// api/novels/chapters.js - Manage novel chapters
const { requireAuth } = require('../auth/verify');
const { query } = require('../_d1');
const { v4: uuidv4 } = require('uuid');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { novel_id } = req.query;
    if (!novel_id) return res.status(400).json({ error: 'novel_id required' });
    try {
      const result = await query(
        `SELECT id, novel_id, chapter_number, title, created_at FROM novel_chapters WHERE novel_id = ? ORDER BY chapter_number ASC`,
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
      const novelResult = await query('SELECT id, author_id, status FROM novels WHERE id = ?', [novel_id]);
      const novel = novelResult.results[0];
      if (!novel) return res.status(404).json({ error: 'Novel tidak ditemukan' });
      const userId = user.sub || user.id;
      if (novel.author_id !== userId) return res.status(403).json({ error: 'Bukan novel milikmu' });

      const lastChapterResult = await query('SELECT MAX(chapter_number) as last_num FROM novel_chapters WHERE novel_id = ?', [novel_id]);
      const lastNum = lastChapterResult.results[0]?.last_num || 0;
      const chapterNumber = lastNum + 1;
      const id = uuidv4();
      await query(
        `INSERT INTO novel_chapters (id, novel_id, chapter_number, title, content, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [id, novel_id, chapterNumber, title || `Chapter ${chapterNumber}`, content]
      );
      return res.status(201).json({ message: 'Chapter berhasil diupload', id, chapter_number: chapterNumber });
    } catch(err) {
      return res.status(500).json({ error: err.message });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
};
