/**
 * Users Controller
 * Handles user management operations (admin functions)
 * 
 * @author Mennouchi Islam Azeddine
 * @company Dalil Technology
 * @project Silwane ERP - FP26002386
 */

const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const db = require('../config/database');

/**
 * Get all users with pagination
 * GET /api/users
 */
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, is_active, search } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, email, first_name, last_name, role, phone,
             is_active, created_at, last_login,
             COUNT(*) OVER() as total_count
      FROM users
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (role) {
      query += ` AND role = $${paramIndex++}`;
      params.push(role);
    }

    if (is_active !== undefined) {
      query += ` AND is_active = $${paramIndex++}`;
      params.push(is_active === 'true');
    }

    if (search) {
      query += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving users',
      error: error.message
    });
  }
};

/**
 * Get single user by ID
 * GET /api/users/:id
 */
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT id, email, first_name, last_name, role, phone,
             is_active, created_at, last_login, updated_at
      FROM users
      WHERE id = $1
    `;

    const result = await db.query(query, [id]);

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
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user',
      error: error.message
    });
  }
};

/**
 * Create new user (admin only)
 * POST /api/users
 */
exports.createUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password, first_name, last_name, role, phone, is_active = true } = req.body;

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const query = `
      INSERT INTO users (email, password_hash, first_name, last_name, role, phone, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, first_name, last_name, role, phone, is_active, created_at
    `;

    const result = await db.query(query, [
      email,
      hashedPassword,
      first_name,
      last_name,
      role,
      phone,
      is_active
    ]);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message
    });
  }
};

/**
 * Update user (admin only)
 * PUT /api/users/:id
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, role, phone, is_active } = req.body;

    const query = `
      UPDATE users
      SET first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          role = COALESCE($3, role),
          phone = COALESCE($4, phone),
          is_active = COALESCE($5, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING id, email, first_name, last_name, role, phone, is_active, updated_at
    `;

    const result = await db.query(query, [
      first_name,
      last_name,
      role,
      phone,
      is_active,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
};

/**
 * Delete user (soft delete - deactivate)
 * DELETE /api/users/:id
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting self
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const query = `
      UPDATE users
      SET is_active = false,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email, first_name, last_name, is_active
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deactivated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

/**
 * Reset user password (admin only)
 * POST /api/users/:id/reset-password
 */
exports.resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password) {
      return res.status(400).json({
        success: false,
        message: 'New password is required'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    const query = `
      UPDATE users
      SET password_hash = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, first_name, last_name
    `;

    const result = await db.query(query, [hashedPassword, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Password reset successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  }
};

/**
 * Get user statistics
 * GET /api/users/statistics
 */
exports.getUserStatistics = async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN is_active = false THEN 1 ELSE 0 END) as inactive_users,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_users,
        SUM(CASE WHEN role = 'manager' THEN 1 ELSE 0 END) as manager_users,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as regular_users
      FROM users
    `;

    const result = await db.query(query);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get user statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user statistics',
      error: error.message
    });
  }
};

module.exports = exports;