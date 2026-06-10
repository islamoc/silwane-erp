const jwt = require('jsonwebtoken');

/**
 * Generate JWT access token.
 * Env vars: JWT_SECRET, JWT_EXPIRES_IN (default "24h")
 * @param {{ id: number, email: string, role: string }} user
 * @returns {string} signed JWT
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role || 'viewer' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

/**
 * Generate JWT refresh token.
 * Env vars: JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES_IN (default "7d")
 * A dedicated secret is used so access tokens cannot be replayed as refresh tokens.
 * @param {{ id: number }} user
 * @returns {string} signed JWT
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

/**
 * Verify an access token.
 * @param {string} token
 * @returns {object} decoded payload
 * @throws {Error} if invalid or expired
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

module.exports = { generateToken, generateRefreshToken, verifyToken };
