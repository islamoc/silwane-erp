/**
 * Authentication Controller
 * Handles user auth, profile, and password management.
 * NOTE: All route logic lives in routes/auth.js.
 *       This controller is kept for compatibility if other routes import from it.
 *
 * @author Mennouchi Islam Azeddine
 * @company Dalil Technology
 * @project Silwane ERP - FP26002386
 */
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { generateToken, generateRefreshToken } = require('../utils/generateToken');

/**
 * Login
 * POST /api/auth/login
 * Accepts { email, password } or { username, password }
 */
exports.login = async (req, res) => {
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
        message: 'Your account is deactivated. Contact administrator.'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    const userPayload = { id: user.id, email: user.email, role: user.role || 'viewer' };
    const token = generateToken(userPayload);
    const refreshToken = generateRefreshToken(userPayload);

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
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
};

/**
 * Register
 * POST /api/auth/register
 */
exports.register = async (req, res) => {
  try {
    const { email, password, first_name, last_name, username, role = 'viewer' } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username || email.split('@')[0]]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'User already exists.' });
    }

    const roleResult = await db.query('SELECT id FROM user_roles WHERE name = $1', [role]);
    if (roleResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid role specified.' });
    }
    const roleId = roleResult.rows[0].id;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, role_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, username, email, first_name, last_name, is_active, created_at`,
      [username || email.split('@')[0], email, hashedPassword, first_name || '', last_name || '', roleId]
    );

    const newUser = result.rows[0];
    const userPayload = { id: newUser.id, email: newUser.email, role };
    const token = generateToken(userPayload);

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
          role,
          isActive: newUser.is_active
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Registration failed.' });
  }
};

/**
 * Get profile
 * GET /api/auth/profile
 */
exports.getProfile = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone,
              u.is_active, u.created_at, u.last_login, r.name AS role
       FROM users u
       LEFT JOIN user_roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Error retrieving profile.' });
  }
};

/**
 * Update profile
 * PUT /api/auth/profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const { first_name, last_name, phone } = req.body;
    const result = await db.query(
      `UPDATE users
       SET first_name = COALESCE($1, first_name),
           last_name  = COALESCE($2, last_name),
           phone      = COALESCE($3, phone),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, username, email, first_name, last_name, phone`,
      [first_name, last_name, phone, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, message: 'Profile updated.', data: result.rows[0] });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Error updating profile.' });
  }
};

/**
 * Change password
 * POST /api/auth/change-password
 */
exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password, currentPassword, newPassword } = req.body;
    const currentPwd = current_password || currentPassword;
    const newPwd = new_password || newPassword;

    if (!currentPwd || !newPwd) {
      return res.status(400).json({ success: false, message: 'Provide current and new password.' });
    }

    const userResult = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isValid = await bcrypt.compare(currentPwd, userResult.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPwd, salt);

    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, req.user.id]
    );

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Error changing password.' });
  }
};

/**
 * Logout
 * POST /api/auth/logout
 */
exports.logout = async (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
};

/**
 * Verify token
 * GET /api/auth/verify
 */
exports.verifyToken = async (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid.',
    user: { id: req.user.id, email: req.user.email, role: req.user.role }
  });
};

module.exports = exports;
