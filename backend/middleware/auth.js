const jwt = require('jsonwebtoken');

// Verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[AUTH] No Bearer token provided.');
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    console.log(`[AUTH] Token verified for user: ${decoded.email || decoded.studentId} (Role: ${decoded.role})`);
    next();
  } catch (error) {
    console.log('[AUTH] Token verification failed:', error.message);
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

// Role-based access control
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      console.log(`[AUTH] Role check failed. Required: ${roles}, User: ${req.user?.role}`);
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
    console.log(`[AUTH] Access granted for roles: ${roles}`);
    next();
  };
};

const requireAdmin = requireRole('admin');
const requireStudent = requireRole('student');

module.exports = { verifyToken, requireRole, requireAdmin, requireStudent };
