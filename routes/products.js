const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
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

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM (${queryText}) as count_query`,
      queryParams
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Add sorting and pagination
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
      `SELECT p.*, pf.name as family_name, pf.code as family_code,
              u.username as created_by_username
       FROM products p
       LEFT JOIN product_families pf ON p.family_id = pf.id
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
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
    const product = req.body;

    const result = await query(
      `INSERT INTO products (
        sku, barcode, name, description, family_id,
        weight, weight_unit, volume, volume_unit,
        length, width, height, dimension_unit,
        unit_of_measure, quantity_in_stock, min_stock_level, max_stock_level,
        reorder_point, reorder_quantity, cost_price, selling_price, currency,
        tax_rate, warehouse_location, shelf_location, is_active, is_featured,
        image_url, additional_images, manufacturer, brand, model, color, size,
        tags, custom_fields, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37
      ) RETURNING *`,
      [
        product.sku, product.barcode, product.name, product.description, product.familyId,
        product.weight, product.weightUnit, product.volume, product.volumeUnit,
        product.length, product.width, product.height, product.dimensionUnit,
        product.unitOfMeasure, product.quantityInStock || 0, product.minStockLevel || 0,
        product.maxStockLevel, product.reorderPoint, product.reorderQuantity,
        product.costPrice, product.sellingPrice, product.currency || 'DZD',
        product.taxRate || 19, product.warehouseLocation, product.shelfLocation,
        product.isActive !== false, product.isFeatured || false,
        product.imageUrl, JSON.stringify(product.additionalImages || []),
        product.manufacturer, product.brand, product.model, product.color, product.size,
        JSON.stringify(product.tags || []), JSON.stringify(product.customFields || {}),
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
    const product = req.body;
    const { id } = req.params;

    const result = await query(
      `UPDATE products SET
        sku = COALESCE($1, sku),
        barcode = COALESCE($2, barcode),
        name = COALESCE($3, name),
        description = COALESCE($4, description),
        family_id = COALESCE($5, family_id),
        weight = COALESCE($6, weight),
        weight_unit = COALESCE($7, weight_unit),
        volume = COALESCE($8, volume),
        volume_unit = COALESCE($9, volume_unit),
        length = COALESCE($10, length),
        width = COALESCE($11, width),
        height = COALESCE($12, height),
        dimension_unit = COALESCE($13, dimension_unit),
        unit_of_measure = COALESCE($14, unit_of_measure),
        quantity_in_stock = COALESCE($15, quantity_in_stock),
        min_stock_level = COALESCE($16, min_stock_level),
        max_stock_level = COALESCE($17, max_stock_level),
        reorder_point = COALESCE($18, reorder_point),
        reorder_quantity = COALESCE($19, reorder_quantity),
        cost_price = COALESCE($20, cost_price),
        selling_price = COALESCE($21, selling_price),
        currency = COALESCE($22, currency),
        tax_rate = COALESCE($23, tax_rate),
        warehouse_location = COALESCE($24, warehouse_location),
        shelf_location = COALESCE($25, shelf_location),
        is_active = COALESCE($26, is_active),
        is_featured = COALESCE($27, is_featured),
        image_url = COALESCE($28, image_url),
        manufacturer = COALESCE($29, manufacturer),
        brand = COALESCE($30, brand),
        model = COALESCE($31, model),
        color = COALESCE($32, color),
        size = COALESCE($33, size)
       WHERE id = $34
       RETURNING *`,
      [
        product.sku, product.barcode, product.name, product.description, product.familyId,
        product.weight, product.weightUnit, product.volume, product.volumeUnit,
        product.length, product.width, product.height, product.dimensionUnit,
        product.unitOfMeasure, product.quantityInStock, product.minStockLevel,
        product.maxStockLevel, product.reorderPoint, product.reorderQuantity,
        product.costPrice, product.sellingPrice, product.currency, product.taxRate,
        product.warehouseLocation, product.shelfLocation, product.isActive,
        product.isFeatured, product.imageUrl, product.manufacturer, product.brand,
        product.model, product.color, product.size, id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
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
 * @access  Private (Admin)
 */
router.delete('/:id', authenticate, authorize('manage_products'), async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM products WHERE id = $1 RETURNING id, name',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    logger.info('Product deleted', { productId: req.params.id, deletedBy: req.user.id });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/products/low-stock
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

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;