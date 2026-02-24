const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const logger = require('../config/logger');

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Private (Admin only)
 */
router.get('/', authenticate, authorizeRoles('Super Admin', 'Admin'), async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '', role = '', isActive } = req.query;
    const offset = (page - 1) * limit;

    let queryText = `
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, 
             u.is_active, u.last_login, u.created_at, r.name as role_name
      FROM users u
      LEFT JOIN user_roles r ON u.role_id = r.id
      WHERE 1=1
    `;

    const queryParams = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      queryText += ` AND (u.username ILIKE $${paramCount} OR u.email ILIKE $${paramCount} OR u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    if (role) {
      paramCount++;
      queryText += ` AND r.name = $${paramCount}`;
      queryParams.push(role);
    }

    if (isActive !== undefined) {
      paramCount++;
      queryText += ` AND u.is_active = $${paramCount}`;
      queryParams.push(isActive === 'true');
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM (${queryText}) as count_query`,
      queryParams
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Get paginated results
    queryText += ` ORDER BY u.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(limit, offset);

    const result = await query(queryText, queryParams);

    res.json({
      success: true,
      data: result.rows.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role_name,
        isActive: user.is_active,
        lastLogin: user.last_login,
        createdAt: user.created_at
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/users/:id
 * @desc    Get single user by ID
 * @access  Private (Admin only)
 */
router.get('/:id', authenticate, authorizeRoles('Super Admin', 'Admin'), async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, 
              u.address, u.avatar_url, u.is_active, u.last_login, u.created_at,
              r.id as role_id, r.name as role_name, r.permissions
       FROM users u
       LEFT JOIN user_roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
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
        roleId: user.role_id,
        role: user.role_name,
        permissions: user.permissions,
        isActive: user.is_active,
        lastLogin: user.last_login,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/users
 * @desc    Create new user
 * @access  Private (Admin only)
 */
router.post('/', authenticate, authorizeRoles('Super Admin', 'Admin'), async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName, roleId, phone, address } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username, email and password'
      });
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this username or email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const result = await query(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, role_id, phone, address, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, username, email, first_name, last_name, phone, address, is_active, created_at`,
      [username, email, passwordHash, firstName, lastName, roleId, phone, address, req.user.id]
    );

    const user = result.rows[0];

    logger.info('User created', { userId: user.id, createdBy: req.user.id });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        address: user.address,
        isActive: user.is_active,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private (Admin only)
 */
router.put('/:id', authenticate, authorizeRoles('Super Admin', 'Admin'), async (req, res, next) => {
  try {
    const { username, email, firstName, lastName, roleId, phone, address, isActive } = req.body;

    const result = await query(
      `UPDATE users 
       SET username = COALESCE($1, username),
           email = COALESCE($2, email),
           first_name = COALESCE($3, first_name),
           last_name = COALESCE($4, last_name),
           role_id = COALESCE($5, role_id),
           phone = COALESCE($6, phone),
           address = COALESCE($7, address),
           is_active = COALESCE($8, is_active)
       WHERE id = $9
       RETURNING id, username, email, first_name, last_name, phone, address, is_active`,
      [username, email, firstName, lastName, roleId, phone, address, isActive, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    logger.info('User updated', { userId: user.id, updatedBy: req.user.id });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        address: user.address,
        isActive: user.is_active
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Private (Super Admin only)
 */
router.delete('/:id', authenticate, authorizeRoles('Super Admin'), async (req, res, next) => {
  try {
    // Prevent deletion of own account
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    const result = await query(
      'DELETE FROM users WHERE id = $1 RETURNING id, username',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.info('User deleted', { userId: req.params.id, deletedBy: req.user.id });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;