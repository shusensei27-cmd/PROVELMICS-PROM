const jwt = require('jsonwebtoken');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'shusensei27@gmail.com';

function verifyToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No authorization token provided');
  }

  const token = authHeader.split(' ')[1];
  
  // Coba decode dulu tanpa verifikasi untuk debug
  const decoded = jwt.decode(token);
  if (!decoded) throw new Error('Token tidak bisa di-decode');

  // Ambil secret — coba kedua format
  let secret = process.env.SUPABASE_JWT_SECRET || '';
  
  // Kalau secret berformat base64, decode dulu
  try {
    const buf = Buffer.from(secret, 'base64');
    // Verifikasi dengan plain secret dulu
    try {
      return jwt.verify(token, secret, { algorithms: ['HS256'] });
    } catch(e1) {
      // Kalau gagal, coba dengan decoded base64
      return jwt.verify(token, buf, { algorithms: ['HS256'] });
    }
  } catch(e) {
    throw new Error('Invalid or expired token: ' + e.message);
  }
}

function requireAuth(req, res) {
  try {
    const user = verifyToken(req);
    return user;
  } catch (err) {
    res.status(401).json({ error: err.message });
    return null;
  }
}

function isAdmin(user) {
  return user?.email === ADMIN_EMAIL;
}

function requireAdmin(req, res) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (!isAdmin(user)) {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return user;
}

module.exports = { verifyToken, requireAuth, requireAdmin, isAdmin, ADMIN_EMAIL };
