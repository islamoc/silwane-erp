const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { generateToken, generateRefreshToken } = require('../utils/generateToken');
const logger = require('../config/logger');
const { authenticate } = require('../middleware/auth');

// ─── Helpers ────────────────────────────────────────────────────────────────
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;

/**
 * @route  POST /api/auth/login
 * @desc   Login with email (or username) + password
 * @access Public
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, username, password } = req.body;
    const identifier = email || username;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email/username and password.'
      });
    }

    const result = await db.query(
      `SELECT u.id, u.username, u.email, u.password_hash,
              u.first_name, u.last_name, u.is_active,
              r.name AS role, r.permissions
       FROM users u
       LEFT JOIN user_roles r ON u.role_id = r.id
       WHERE u.email = $1 OR u.username = $1`,
      [identifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Contact administrator.'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      logger.warn('Failed login attempt', { identifier });
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    await db.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    const userPayload = { id: user.id, email: user.email, role: user.role || 'viewer' };
    const token = generateToken(userPayload);
    const refreshToken = generateRefreshToken(userPayload);

    logger.info('User logged in', { userId: user.id, email: user.email });

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role || 'viewer',
          permissions: user.permissions || {}
        },
        token,
        refreshToken
      }
    });
  } catch (error) {
    logger.error('Login error', error);
    next(error);
  }
});

/**
 * @route  POST /api/auth/register
 * @desc   Register a new user
 * @access Public
 */
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName, roleId } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username, email and password.'
      });
    }

    const existing = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A user with that username or email already exists.'
      });
    }

    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const passwordHash = await bcrypt.hash(password, salt);

    let resolvedRoleId = roleId;
    if (!resolvedRoleId) {
      const roleResult = await db.query(
        'SELECT id FROM user_roles WHERE name = $1',
        ['viewer']
      );
      resolvedRoleId = roleResult.rows[0]?.id || 7;
    }

    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, role_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, first_name, last_name, is_active, created_at`,
      [username, email, passwordHash, firstName || '', lastName || '', resolvedRoleId]
    );

    const newUser = result.rows[0];
    const roleRow = await db.query('SELECT name FROM user_roles WHERE id = $1', [resolvedRoleId]);
    const roleName = roleRow.rows[0]?.name || 'viewer';

    const userPayload = { id: newUser.id, email: newUser.email, role: roleName };
    const token = generateToken(userPayload);

    logger.info('User registered', { userId: newUser.id, email: newUser.email });

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          firstName: newUser.first_name,
          lastName: newUser.last_name,
          role: roleName,
          isActive: newUser.is_active
        },
        token
      }
    });
  } catch (error) {
    logger.error('Registration error', error);
    next(error);
  }
});

/**
 * @route  POST /api/auth/refresh
 * @desc   Exchange a valid refresh token for a new access token
 * @access Public
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
    }

    const result = await db.query(
      `SELECT u.id, u.email, u.is_active, r.name AS role
       FROM users u
       LEFT JOIN user_roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (!result.rows.length || !result.rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'User not found or inactive.' });
    }

    const user = result.rows[0];
    const newToken = generateToken({ id: user.id, email: user.email, role: user.role || 'viewer' });

    logger.info('Token refreshed', { userId: user.id });
    res.json({ success: true, data: { token: newToken } });
  } catch (err) {
    next(err);
  }
});

/**
 * @route  GET /api/auth/profile
 * @desc   Get current authenticated user profile
 * @access Private
 */
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone,
              u.address, u.avatar_url, u.preferences, u.last_login, u.created_at,
              r.name AS role, r.permissions
       FROM users u
       LEFT JOIN user_roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        address: user.address,
        avatarUrl: user.avatar_url,
        preferences: user.preferences,
        role: user.role,
        permissions: user.permissions || {},
        lastLogin: user.last_login,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route  PUT /api/auth/profile
 * @desc   Update authenticated user profile
 * @access Private
 */
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { firstName, lastName, phone, address } = req.body;

    const result = await db.query(
      `UPDATE users
       SET first_name = COALESCE($1, first_name),
           last_name  = COALESCE($2, last_name),
           phone      = COALESCE($3, phone),
           address    = COALESCE($4, address),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, username, email, first_name, last_name, phone, address`,
      [firstName, lastName, phone, address, req.user.id]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        email: result.rows[0].email,
        firstName: result.rows[0].first_name,
        lastName: result.rows[0].last_name,
        phone: result.rows[0].phone,
        address: result.rows[0].address
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route  POST /api/auth/change-password
 * @desc   Change authenticated user password
 * @access Private
 */
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters.'
      });
    }

    const result = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const newHash = await bcrypt.hash(newPassword, salt);

    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newHash, req.user.id]
    );

    logger.info('Password changed', { userId: req.user.id });
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    next(error);
  }
});

/**
 * @route  POST /api/auth/logout
 * @desc   Logout user (stateless — client removes token)
 * @access Private
 */
router.post('/logout', authenticate, (req, res) => {
  logger.info('User logged out', { userId: req.user.id });
  res.json({ success: true, message: 'Logged out successfully.' });
});

/**
 * @route  GET /api/auth/verify
 * @desc   Verify JWT token validity
 * @access Private
 */
router.get('/verify', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid.',
    data: { id: req.user.id, email: req.user.email, role: req.user.role }
  });
});

module.exports = router;
