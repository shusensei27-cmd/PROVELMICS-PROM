const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'shusensei27@gmail.com';

function verifyToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No authorization token provided');
  }

  const token = authHeader.split(' ')[1];
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');
  
  try {
    // Tambah padding base64 jika perlu
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '=='.slice(0, (4 - base64.length % 4) % 4);
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    
    // Cek expired — dengan toleransi 5 menit untuk clock skew
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now - 300) {
      throw new Error('Token expired');
    }
    
    return payload;
  } catch(e) {
    throw new Error('Invalid token: ' + e.message);
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

/**
 * Middleware helper - returns user or sends 403 if not admin
 */
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

