import jwt from 'jsonwebtoken';

// Verifies `Authorization: Bearer <jwt>` and sets req.user = { id, role, email }.
// The token is MINTED elsewhere: requirement 1 (login) belongs to team A1, and
// until it lands the temporary dev shim at /api/dev/token signs tokens with the
// same secret and payload shape.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, role: payload.role, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden: this action requires one of the roles: ${roles.join(', ')}`
      });
    }
    next();
  };
}
