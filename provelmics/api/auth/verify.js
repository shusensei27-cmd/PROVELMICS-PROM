// api/auth/verify.js - Supabase JWT verification middleware
const jwt = require('jsonwebtoken');

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'shusensei27@gmail.com';

/**
 * Verify Supabase JWT from Authorization header
 * Returns decoded user payload or throws error
 */
function verifyToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No authorization token provided');
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET, {
      algorithms: ['HS256'],
    });
    return decoded;
  } catch (err) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Middleware helper - returns user or sends 401
 */
function requireAuth(req, res) {
  try {
    const user = verifyToken(req);
    return user;
  } catch (err) {
    res.status(401).json({ error: err.message });
    return null;
  }
}

/**
 * Check if user is admin
 */
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
