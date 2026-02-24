const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const logger = require('../config/logger');

/**
 * MC01 - MODULE STOCK
 * G09 - Stock Movement Journal
 */

/**
 * @route   GET /api/stock-movements
 * @desc    Get all stock movements with filters
 * @access  Private
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      productId = '',
      movementType = '',
      startDate = '',
      endDate = '',
      warehouse = ''
    } = req.query;
    
    const offset = (page - 1) * limit;

    let queryText = `
      SELECT sm.*, 
             p.name as product_name, p.sku as product_sku,
             u.username as created_by_username,
             approver.username as approved_by_username
      FROM stock_movements sm
      INNER JOIN products p ON sm.product_id = p.id
      LEFT JOIN users u ON sm.created_by = u.id
      LEFT JOIN users approver ON sm.approved_by = approver.id
      WHERE 1=1
    `;

    const queryParams = [];
    let paramCount = 0;

    if (productId) {
      paramCount++;
      queryText += ` AND sm.product_id = $${paramCount}`;
      queryParams.push(productId);
    }

    if (movementType) {
      paramCount++;
      queryText += ` AND sm.movement_type = $${paramCount}`;
      queryParams.push(movementType);
    }

    if (startDate) {
      paramCount++;
      queryText += ` AND sm.movement_date >= $${paramCount}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      paramCount++;
      queryText += ` AND sm.movement_date <= $${paramCount}`;
      queryParams.push(endDate);
    }

    if (warehouse) {
      paramCount++;
      queryText += ` AND sm.warehouse = $${paramCount}`;
      queryParams.push(warehouse);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM (${queryText}) as count_query`,
      queryParams
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Add pagination
    queryText += ` ORDER BY sm.movement_date DESC, sm.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
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
 * @route   GET /api/stock-movements/:id
 * @desc    Get single stock movement
 * @access  Private
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT sm.*, 
              p.name as product_name, p.sku as product_sku,
              u.username as created_by_username,
              approver.username as approved_by_username
       FROM stock_movements sm
       INNER JOIN products p ON sm.product_id = p.id
       LEFT JOIN users u ON sm.created_by = u.id
       LEFT JOIN users approver ON sm.approved_by = approver.id
       WHERE sm.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Stock movement not found'
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
 * @route   POST /api/stock-movements
 * @desc    Create new stock movement (with automatic stock update)
 * @access  Private
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const movement = req.body;

    // Use transaction to ensure data consistency
    const result = await transaction(async (client) => {
      // Get current stock
      const productResult = await client.query(
        'SELECT quantity_in_stock, name FROM products WHERE id = $1 FOR UPDATE',
        [movement.productId]
      );

      if (productResult.rows.length === 0) {
        throw new Error('Product not found');
      }

      const currentStock = parseFloat(productResult.rows[0].quantity_in_stock);
      const quantity = parseFloat(movement.quantity);
      
      let newStock;
      if (movement.movementType === 'IN' || movement.movementType === 'RETURN') {
        newStock = currentStock + quantity;
      } else if (movement.movementType === 'OUT' || movement.movementType === 'TRANSFER') {
        if (currentStock < quantity) {
          throw new Error('Insufficient stock for this movement');
        }
        newStock = currentStock - quantity;
      } else if (movement.movementType === 'ADJUSTMENT') {
        newStock = currentStock + quantity; // Quantity can be negative for adjustments
      } else {
        throw new Error('Invalid movement type');
      }

      // Generate reference number
      const refNumber = `SM-${movement.movementType}-${new Date().getFullYear()}-${Date.now()}`;

      // Insert stock movement
      const movementResult = await client.query(
        `INSERT INTO stock_movements (
          movement_type, reference_number, product_id, quantity, unit_price, total_value,
          quantity_before, quantity_after, from_location, to_location, warehouse,
          related_document_type, related_document_id, reason, notes, batch_number,
          expiry_date, movement_date, created_by, approved_by, is_approved
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING *`,
        [
          movement.movementType, refNumber, movement.productId, quantity,
          movement.unitPrice, movement.totalValue || (quantity * (movement.unitPrice || 0)),
          currentStock, newStock, movement.fromLocation, movement.toLocation,
          movement.warehouse, movement.relatedDocumentType, movement.relatedDocumentId,
          movement.reason, movement.notes, movement.batchNumber, movement.expiryDate,
          movement.movementDate || new Date(), req.user.id,
          movement.autoApprove ? req.user.id : null,
          movement.autoApprove || false
        ]
      );

      // Update product stock if approved
      if (movement.autoApprove) {
        await client.query(
          'UPDATE products SET quantity_in_stock = $1, last_stock_check = CURRENT_TIMESTAMP WHERE id = $2',
          [newStock, movement.productId]
        );
      }

      return movementResult.rows[0];
    });

    logger.info('Stock movement created', { movementId: result.id, createdBy: req.user.id });

    res.status(201).json({
      success: true,
      message: 'Stock movement created successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/stock-movements/:id/approve
 * @desc    Approve stock movement and update stock
 * @access  Private (Manager/Admin)
 */
router.put('/:id/approve', authenticate, async (req, res, next) => {
  try {
    const result = await transaction(async (client) => {
      // Get movement details
      const movementResult = await client.query(
        'SELECT * FROM stock_movements WHERE id = $1 FOR UPDATE',
        [req.params.id]
      );

      if (movementResult.rows.length === 0) {
        throw new Error('Stock movement not found');
      }

      const movement = movementResult.rows[0];

      if (movement.is_approved) {
        throw new Error('Stock movement already approved');
      }

      // Update product stock
      await client.query(
        'UPDATE products SET quantity_in_stock = $1, last_stock_check = CURRENT_TIMESTAMP WHERE id = $2',
        [movement.quantity_after, movement.product_id]
      );

      // Update movement status
      const updateResult = await client.query(
        `UPDATE stock_movements 
         SET is_approved = true, approved_by = $1, approved_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [req.user.id, req.params.id]
      );

      return updateResult.rows[0];
    });

    logger.info('Stock movement approved', { movementId: req.params.id, approvedBy: req.user.id });

    res.json({
      success: true,
      message: 'Stock movement approved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/stock-movements/product/:productId/history
 * @desc    Get stock movement history for a product
 * @access  Private
 */
router.get('/product/:productId/history', authenticate, async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;

    const result = await query(
      `SELECT sm.*, 
              u.username as created_by_username,
              approver.username as approved_by_username
       FROM stock_movements sm
       LEFT JOIN users u ON sm.created_by = u.id
       LEFT JOIN users approver ON sm.approved_by = approver.id
       WHERE sm.product_id = $1
       ORDER BY sm.movement_date DESC, sm.created_at DESC
       LIMIT $2`,
      [req.params.productId, limit]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;