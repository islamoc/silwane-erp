const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../config/logger');

/**
 * Authentication middleware
 * Verifies JWT token (payload: { id, email, role }) and attaches user to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Access denied.'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify and decode the token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please login again.'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Access denied.'
      });
    }

    // Token payload uses { id, email, role }
    const userId = decoded.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload. Access denied.'
      });
    }

    // Get fresh user data from database
    const result = await db.query(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.is_active,
              r.name AS role, r.permissions
       FROM users u
       LEFT JOIN user_roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Access denied.'
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'User account is inactive. Contact administrator.'
      });
    }

    // Normalise role to lowercase for consistent RBAC comparisons
    const normalisedRole = (user.role || 'viewer').toLowerCase();

    // Attach clean user object to request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: normalisedRole,
      permissions: user.permissions || {}
    };

    logger.debug('User authenticated', { userId: user.id, role: normalisedRole });
    next();
  } catch (error) {
    logger.error('Authentication middleware error', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed. Please try again.'
    });
  }
};

/**
 * Permission-based authorization middleware
 * @param {string} permission - Required permission key
 */
const authorize = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated.'
      });
    }

    // Super admin bypasses all permission checks
    if (req.user.permissions && req.user.permissions.all) {
      return next();
    }

    if (!req.user.permissions || !req.user.permissions[permission]) {
      logger.warn('Authorization failed', {
        userId: req.user.id,
        requiredPermission: permission,
        userRole: req.user.role
      });
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.'
      });
    }

    next();
  };
};

/**
 * Role-based authorization middleware
 * Roles passed in MUST be lowercase (matching the DB seed convention).
 * The middleware normalises req.user.role to lowercase (done in authenticate),
 * so comparison is always case-insensitive.
 * @param {...string} roles - Allowed roles (lowercase)
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated.'
      });
    }

    // req.user.role is already lowercased by authenticate()
    // Normalise the caller-supplied role list to lowercase for safety
    const normalisedRoles = roles.map(r => r.toLowerCase());

    if (!normalisedRoles.includes(req.user.role)) {
      logger.warn('Role authorization failed', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: normalisedRoles
      });
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${normalisedRoles.join(', ')}.`
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize, authorizeRoles };
