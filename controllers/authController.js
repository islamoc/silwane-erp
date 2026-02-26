/**
 * Authentication Controller
 * Handles user authentication, registration, and session management
 * 
 * @author Mennouchi Islam Azeddine
 * @company Dalil Technology
 * @project Silwane ERP - FP26002386
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db = require('../config/database');

/**
 * Generate JWT token
 */
const generateToken = (userId, email, role) => {
  return jwt.sign(
    { id: userId, email, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '24h' }
  );
};

/**
 * Register new user
 * POST /api/auth/register
 */
exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password, first_name, last_name, username, role = 'viewer' } = req.body;

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username || email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }

    // Get role_id
    const roleQuery = 'SELECT id FROM user_roles WHERE name = $1';
    const roleResult = await db.query(roleQuery, [role]);
    
    if (roleResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }
    
    const roleId = roleResult.rows[0].id;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const query = `
      INSERT INTO users (username, email, password_hash, first_name, last_name, role_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id, username, email, first_name, last_name, role_id, is_active, created_at
    `;

    const result = await db.query(query, [
      username || email.split('@')[0],
      email,
      hashedPassword,
      first_name,
      last_name,
      roleId
    ]);

    const user = result.rows[0];

    // Generate token
    const token = generateToken(user.id, user.email, role);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: role,
          is_active: user.is_active
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
};

/**
 * User login
 * POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Get user by email with role information
    const query = `
      SELECT u.id, u.username, u.email, u.password_hash, u.first_name, u.last_name, 
             u.is_active, u.last_login, u.role_id, r.name as role
      FROM users u
      LEFT JOIN user_roles r ON u.role_id = r.id
      WHERE u.email = $1
    `;

    const result = await db.query(query, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact administrator.'
      });
    }

    // Verify password
    console.log('Attempting login for:', email);
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      console.log('Password validation failed for:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    console.log('Login successful for:', email);

    // Update last login
    await db.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate token
    const token = generateToken(user.id, user.email, user.role || 'viewer');

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role || 'viewer',
          is_active: user.is_active,
          last_login: user.last_login
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: error.message
    });
  }
};

/**
 * Get current user profile
 * GET /api/auth/profile
 */
exports.getProfile = async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.is_active,
             u.created_at, u.last_login, r.name as role
      FROM users u
      LEFT JOIN user_roles r ON u.role_id = r.id
      WHERE u.id = $1
    `;

    const result = await db.query(query, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving profile',
      error: error.message
    });
  }
};

/**
 * Update user profile
 * PUT /api/auth/profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const { first_name, last_name, phone } = req.body;

    const query = `
      UPDATE users
      SET first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          phone = COALESCE($3, phone),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, username, email, first_name, last_name, phone, is_active
    `;

    const result = await db.query(query, [
      first_name,
      last_name,
      phone,
      req.user.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
};

/**
 * Change password
 * POST /api/auth/change-password
 */
exports.changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { current_password, new_password } = req.body;

    // Get current user's password hash
    const userQuery = 'SELECT password_hash FROM users WHERE id = $1';
    const userResult = await db.query(userQuery, [req.user.id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      current_password,
      userResult.rows[0].password_hash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, req.user.id]
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error.message
    });
  }
};

/**
 * Logout user
 * POST /api/auth/logout
 */
exports.logout = async (req, res) => {
  try {
    // In a stateless JWT implementation, logout is handled client-side
    // by removing the token. We can log the event here.
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during logout',
      error: error.message
    });
  }
};

/**
 * Verify token
 * GET /api/auth/verify
 */
exports.verifyToken = async (req, res) => {
  try {
    // If middleware passed, token is valid
    res.json({
      success: true,
      message: 'Token is valid',
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      }
    });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying token',
      error: error.message
    });
  }
};

module.exports = exports;