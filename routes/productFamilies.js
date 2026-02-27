const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const logger = require('../config/logger');

/**
 * MC01 - MODULE STOCK
 * G02 - Product Families (Hierarchical)
 */

/**
 * @route GET /api/product-families
 * @desc Get all product families (hierarchical)
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { flat = false } = req.query;
    const result = await query(
      `SELECT pf.*, 
              parent.name as parent_name,
              COUNT(DISTINCT p.id) as product_count
       FROM product_families pf
       LEFT JOIN product_families parent ON pf.parent_id = parent.id
       LEFT JOIN products p ON pf.id = p.family_id
       WHERE pf.is_active = true
       GROUP BY pf.id, parent.name
       ORDER BY pf.path`
    );

    if (flat === 'true') {
      return res.json({
        success: true,
        families: result.rows
      });
    }

    // Build hierarchical structure
    const buildTree = (items, parentId = null) => {
      return items
        .filter(item => item.parent_id === parentId)
        .map(item => ({
          ...item,
          children: buildTree(items, item.id)
        }));
    };

    const tree = buildTree(result.rows);
    res.json({
      success: true,
      families: tree
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/product-families/:id
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT pf.*, 
              parent.name as parent_name,
              u.username as created_by_username,
              COUNT(DISTINCT p.id) as product_count
       FROM product_families pf
       LEFT JOIN product_families parent ON pf.parent_id = parent.id
       LEFT JOIN users u ON pf.created_by = u.id
       LEFT JOIN products p ON pf.id = p.family_id
       WHERE pf.id = $1
       GROUP BY pf.id, parent.name, u.username`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product family not found'
      });
    }

    res.json({
      success: true,
      family: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/product-families
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { code, name, parentId, description } = req.body;
    if (!code || !name) {
      return res.status(400).json({
        success: false,
        message: 'Code and name are required'
      });
    }

    let level = 1;
    let path = `/${code}`;
    if (parentId) {
      const parentResult = await query(
        'SELECT level, path FROM product_families WHERE id = $1',
        [parentId]
      );
      if (parentResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Parent family not found'
        });
      }
      const parent = parentResult.rows[0];
      level = parent.level + 1;
      path = `${parent.path}/${code}`;
    }

    const result = await query(
      `INSERT INTO product_families (code, name, parent_id, description, level, path, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [code, name, parentId || null, description, level, path, req.user.id]
    );

    logger.info('Product family created', { familyId: result.rows[0].id, createdBy: req.user.id });

    res.status(201).json({
      success: true,
      message: 'Product family created successfully',
      family: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/product-families/:id
 */
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { code, name, description, isActive } = req.body;
    const result = await query(
      `UPDATE product_families SET
        code = COALESCE($1, code),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        is_active = COALESCE($4, is_active)
      WHERE id = $5
      RETURNING *`,
      [code, name, description, isActive, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product family not found'
      });
    }

    logger.info('Product family updated', { familyId: req.params.id, updatedBy: req.user.id });

    res.json({
      success: true,
      message: 'Product family updated successfully',
      family: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/product-families/:id
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const productCheck = await query(
      'SELECT COUNT(*) FROM products WHERE family_id = $1',
      [req.params.id]
    );
    if (parseInt(productCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete family with associated products.'
      });
    }

    const childCheck = await query(
      'SELECT COUNT(*) FROM product_families WHERE parent_id = $1',
      [req.params.id]
    );
    if (parseInt(childCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete family with child families.'
      });
    }

    const result = await query(
      'DELETE FROM product_families WHERE id = $1 RETURNING id, name',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product family not found'
      });
    }

    logger.info('Product family deleted', { familyId: req.params.id, deletedBy: req.user.id });

    res.json({
      success: true,
      message: 'Product family deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
