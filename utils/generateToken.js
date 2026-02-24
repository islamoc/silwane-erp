const jwt = require('jsonwebtoken');

/**
 * Generate JWT token
 * @param {number} userId - User ID
 * @returns {string} JWT token
 */
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || '24h'
    }
  );
};

/**
 * Generate refresh token
 * @param {number} userId - User ID
 * @returns {string} Refresh token
 */
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
    }
  );
};

/**
 * Verify token
 * @param {string} token - JWT token
 * @returns {object} Decoded token
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken
};