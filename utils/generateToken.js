const jwt = require('jsonwebtoken');

/**
 * Generate JWT access token
 * Payload: { id, email, role }
 * @param {object} user - User object with id, email, role
 * @returns {string} JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role || 'viewer'
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || '24h'
    }
  );
};

/**
 * Generate JWT refresh token
 * @param {object} user - User object with id
 * @returns {string} Refresh JWT token
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
    }
  );
};

/**
 * Verify token and return decoded payload
 * @param {string} token - JWT token
 * @returns {object} Decoded token payload
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
