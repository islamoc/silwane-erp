const logger = require('../config/logger');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error('Error occurred', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    user: req.user ? req.user.id : 'unauthenticated'
  });

  // Default error
  let error = { ...err };
  error.message = err.message;

  // PostgreSQL errors
  if (err.code) {
    switch (err.code) {
      case '23505': // Unique violation
        error.message = 'Duplicate entry. This record already exists.';
        error.statusCode = 400;
        break;
      case '23503': // Foreign key violation
        error.message = 'Referenced record not found or cannot be deleted due to dependencies.';
        error.statusCode = 400;
        break;
      case '23502': // Not null violation
        error.message = 'Required field is missing.';
        error.statusCode = 400;
        break;
      case '22P02': // Invalid text representation
        error.message = 'Invalid data format.';
        error.statusCode = 400;
        break;
      default:
        error.message = 'Database error occurred.';
        error.statusCode = 500;
    }
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    error.message = Object.values(err.errors).map(e => e.message).join(', ');
    error.statusCode = 400;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error.message = 'Invalid token';
    error.statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    error.message = 'Token expired';
    error.statusCode = 401;
  }

  // Multer errors (file upload)
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      error.message = 'File size too large';
    } else {
      error.message = 'File upload error';
    }
    error.statusCode = 400;
  }

  // Send error response
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;