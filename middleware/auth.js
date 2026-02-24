const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../config/logger');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Access denied.'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const result = await query(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, 
              u.is_active, r.name as role_name, r.permissions
       FROM users u
       LEFT JOIN user_roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [decoded.userId]
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
        message: 'User account is inactive. Access denied.'
      });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role_name,
      permissions: user.permissions || {}
    };

    logger.debug('User authenticated', { userId: user.id, username: user.username });
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Access denied.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }
    logger.error('Authentication error', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

/**
 * Authorization middleware
 * Checks if user has required permission
 * @param {string} permission - Required permission
 */
const authorize = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Super admin has all permissions
    if (req.user.permissions.all) {
      return next();
    }

    // Check if user has specific permission
    if (!req.user.permissions[permission]) {
      logger.warn('Authorization failed', {
        userId: req.user.id,
        requiredPermission: permission
      });
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
    }

    next();
  };
};

/**
 * Role-based authorization middleware
 * @param {Array} roles - Array of allowed roles
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Role authorization failed', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles
      });
      return res.status(403).json({
        success: false,
        message: 'Your role does not have permission to access this resource'
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize,
  authorizeRoles
};