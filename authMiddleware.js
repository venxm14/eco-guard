const jwt = require('jsonwebtoken');

/**
 * Shared Authentication Middleware
 * Verifies JWT token and attaches user payload to req.user
 */
// In authMiddleware.js - verify this file

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('❌ Token verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    // Make sure user object has userId
    console.log('✅ Token verified for user:', user);
    req.user = user; // This should contain { userId: ..., role: ... }
    next();
  });
}
/**
 * Admin Authorization Middleware
 * Must be used AFTER authenticateToken
 */
const isAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    console.warn('🚫 [Auth] Forbidden: Admin access required for:', req.originalUrl);
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = {
  authenticateToken,
  isAdmin
};
