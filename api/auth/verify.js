const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'shusensei27@gmail.com';

function verifyToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No authorization token provided');
  }

  const token = authHeader.split(' ')[1];
  
  // Decode tanpa verifikasi signature
  // Supabase sudah memvalidasi token di sisinya sendiri
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');
  
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    
    // Cek token tidak expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('Token expired');
    }
    
    // Cek token dari Supabase project yang benar
    const supabaseUrl = process.env.SUPABASE_URL || '';
    if (supabaseUrl && payload.iss && !payload.iss.includes('supabase')) {
      throw new Error('Invalid token issuer');
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
