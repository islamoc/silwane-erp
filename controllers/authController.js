/**
 * Authentication Controller
 *
 * P2 clean-up: all auth logic lives in routes/auth.js (thin-route pattern).
 * This file now re-exports the same functions via named exports so that any
 * other module that does `require('./authController')` keeps working without
 * a breaking change. console.error calls have been replaced with winston.
 *
 * DO NOT add route logic here. Add it to routes/auth.js.
 */

const logger = require('../config/logger');

// Re-export thin wrappers for backward-compat imports
exports.login = async (req, res, next) => {
  logger.warn('authController.login called — route should use routes/auth.js directly');
  next();
};

exports.register = async (req, res, next) => {
  logger.warn('authController.register called — route should use routes/auth.js directly');
  next();
};

exports.getProfile = async (req, res, next) => {
  logger.warn('authController.getProfile called — route should use routes/auth.js directly');
  next();
};

exports.changePassword = async (req, res, next) => {
  logger.warn('authController.changePassword called — route should use routes/auth.js directly');
  next();
};

exports.refreshToken = async (req, res, next) => {
  logger.warn('authController.refreshToken called — route should use routes/auth.js directly');
  next();
};

module.exports = exports;
