const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticate, authorize, authorizeRoles } = require('../middleware/auth');
const logger = require('../config/logger');

/**
 * MC01 - MODULE STOCK
 * G01 - Stock Management Base
 * G05 - Weight, Volume and Dimensions
 */

/**
 * @route   GET /api/products
 * @desc    Get all products with filters
 * @access  Private
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      familyId = '',
      isActive = '',
      lowStock = false,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;

    let queryText = `
      SELECT p.*, pf.name as family_name, pf.code as family_code
      FROM products p
      LEFT JOIN product_families pf ON p.family_id = pf.id
      WHERE 1=1
    `;

    const queryParams = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      queryText += ` AND (p.name ILIKE $${paramCount} OR p.sku ILIKE $${paramCount} OR p.barcode ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    if (familyId) {
      paramCount++;
      queryText += ` AND p.family_id = $${paramCount}`;
      queryParams.push(familyId);
    }

    if (isActive !== '') {
      paramCount++;
      queryText += ` AND p.is_active = $${paramCount}`;
      queryParams.push(isActive === 'true');
    }

    if (lowStock === 'true') {
      queryText += ` AND p.quantity_in_stock <= p.min_stock_level`;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM (${queryText}) as count_query`,
      queryParams
    );
    const totalCount = parseInt(countResult.rows[0].count);

    const validSortFields = ['name', 'sku', 'quantity_in_stock', 'cost_price', 'selling_price', 'created_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    queryText += ` ORDER BY p.${sortField} ${order} LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(limit, offset);

    const result = await query(queryText, queryParams);

    res.json({
      success: true,
      data: result.rows,
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
 * @route   GET /api/products/:id
 * @desc    Get single product by ID
 * @access  Private
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT p.*, pf.name as family_name, pf.code as family_code
       FROM products p
       LEFT JOIN product_families pf ON p.family_id = pf.id
       WHERE p.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/products
 * @desc    Create new product
 * @access  Private
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const {
      name, sku, barcode, description, familyId,
      costPrice, sellingPrice, taxRate,
      quantityInStock, minStockLevel, maxStockLevel, unit,
      weight, volume, dimensions
    } = req.body;

    if (!name || !sku) {
      return res.status(400).json({ success: false, message: 'Name and SKU are required' });
    }

    const existing = await query('SELECT id FROM products WHERE sku = $1', [sku]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Product with this SKU already exists' });
    }

    const result = await query(
      `INSERT INTO products (
         name, sku, barcode, description, family_id,
         cost_price, selling_price, tax_rate,
         quantity_in_stock, min_stock_level, max_stock_level, unit,
         weight, volume, dimensions, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        name, sku, barcode, description, familyId,
        costPrice, sellingPrice, taxRate,
        quantityInStock || 0, minStockLevel || 0, maxStockLevel || 0, unit,
        weight, volume, dimensions ? JSON.stringify(dimensions) : null,
        req.user.id
      ]
    );

    logger.info('Product created', { productId: result.rows[0].id, createdBy: req.user.id });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/products/:id
 * @desc    Update product
 * @access  Private
 */
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const id = req.params.id;
    const product = req.body;

    const result = await query(
      `UPDATE products SET
         name              = COALESCE($1,  name),
         sku               = COALESCE($2,  sku),
         barcode           = COALESCE($3,  barcode),
         description       = COALESCE($4,  description),
         family_id         = COALESCE($5,  family_id),
         cost_price        = COALESCE($6,  cost_price),
         selling_price     = COALESCE($7,  selling_price),
         tax_rate          = COALESCE($8,  tax_rate),
         quantity_in_stock = COALESCE($9,  quantity_in_stock),
         min_stock_level   = COALESCE($10, min_stock_level),
         max_stock_level   = COALESCE($11, max_stock_level),
         unit              = COALESCE($12, unit),
         weight            = COALESCE($13, weight),
         volume            = COALESCE($14, volume),
         is_active         = COALESCE($15, is_active),
         updated_at        = CURRENT_TIMESTAMP
       WHERE id = $16
       RETURNING *`,
      [
        product.name, product.sku, product.barcode, product.description, product.familyId,
        product.costPrice, product.sellingPrice, product.taxRate,
        product.quantityInStock, product.minStockLevel, product.maxStockLevel, product.unit,
        product.weight, product.volume, product.isActive,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    logger.info('Product updated', { productId: id, updatedBy: req.user.id });

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete product
 * @access  Private — requires 'products' permission (warehouse, admin, super_admin)
 *
 * Root-cause fix: was authorize('manage_products') but seed.sql uses key 'products'
 * for the warehouse role. Changed to authorize('products').
 */
router.delete('/:id', authenticate, authorize('products'), async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM products WHERE id = $1 RETURNING id, name',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    logger.info('Product deleted', { productId: req.params.id, deletedBy: req.user.id });

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/products/alerts/low-stock
 * @desc    Get products with low stock
 * @access  Private
 */
router.get('/alerts/low-stock', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT p.*, pf.name as family_name
       FROM products p
       LEFT JOIN product_families pf ON p.family_id = pf.id
       WHERE p.quantity_in_stock <= p.min_stock_level
       AND p.is_active = true
       ORDER BY (p.min_stock_level - p.quantity_in_stock) DESC`
    );

    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
