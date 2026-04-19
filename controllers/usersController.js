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

    const limitIndex = paramIndex++;
    const offsetIndex = paramIndex++;
    query += ` ORDER BY created_at DESC LIMIT $${limitIndex} OFFSET $${offsetIndex}`;
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
