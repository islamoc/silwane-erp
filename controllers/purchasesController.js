/**
 * Purchases Controller
 * Handles MC03 - Purchase Management Module
 * Features: G11 (Purchase Management Base)
 * 
 * @author Mennouchi Islam Azeddine
 * @company Dalil Technology
 * @project Silwane ERP - FP26002386
 */

const db = require('../config/database');
const { validationResult } = require('express-validator');

/**
 * G11: Get all purchase orders with pagination and filters
 * GET /api/purchases/orders
 */
exports.getAllPurchaseOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, supplier_id, date_from, date_to } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT po.*, s.name as supplier_name, s.email as supplier_email,
             s.phone as supplier_phone, s.company as supplier_company,
             COUNT(*) OVER() as total_count
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND po.status = $${paramIndex++}`;
      params.push(status);
    }

    if (supplier_id) {
      query += ` AND po.supplier_id = $${paramIndex++}`;
      params.push(supplier_id);
    }

    if (date_from) {
      query += ` AND po.order_date >= $${paramIndex++}`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND po.order_date <= $${paramIndex++}`;
      params.push(date_to);
    }

    query += ` ORDER BY po.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
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
    console.error('Get purchase orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving purchase orders',
      error: error.message
    });
  }
};

/**
 * G11: Get single purchase order by ID
 * GET /api/purchases/orders/:id
 */
exports.getPurchaseOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const orderQuery = `
      SELECT po.*, s.name as supplier_name, s.email as supplier_email,
             s.phone as supplier_phone, s.company as supplier_company,
             s.address as supplier_address, s.tax_id as supplier_tax_id
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.id = $1
    `;

    const orderResult = await db.query(orderQuery, [id]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    const order = orderResult.rows[0];

    // Get order items with product details
    const itemsQuery = `
      SELECT poi.*, p.name as product_name, p.sku, p.unit,
             p.current_stock, p.reorder_point
      FROM purchase_order_items poi
      LEFT JOIN products p ON poi.product_id = p.id
      WHERE poi.order_id = $1
      ORDER BY poi.line_number
    `;

    const itemsResult = await db.query(itemsQuery, [id]);
    order.items = itemsResult.rows;

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Get purchase order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving purchase order',
      error: error.message
    });
  }
};

/**
 * G11: Create new purchase order
 * POST /api/purchases/orders
 */
exports.createPurchaseOrder = async (req, res) => {
  const client = await db.pool.connect();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    await client.query('BEGIN');

    const {
      supplier_id,
      order_number,
      order_date,
      expected_delivery_date,
      status = 'draft',
      items,
      notes,
      payment_terms,
      discount_percentage = 0,
      tax_percentage = 0
    } = req.body;

    // Calculate totals
    let subtotal = 0;
    items.forEach(item => {
      subtotal += item.quantity * item.unit_price;
    });

    const discount_amount = (subtotal * discount_percentage) / 100;
    const taxable_amount = subtotal - discount_amount;
    const tax_amount = (taxable_amount * tax_percentage) / 100;
    const total_amount = taxable_amount + tax_amount;

    // Insert purchase order
    const orderQuery = `
      INSERT INTO purchase_orders (
        supplier_id, order_number, order_date, expected_delivery_date,
        status, subtotal, discount_percentage, discount_amount,
        tax_percentage, tax_amount, total_amount,
        notes, payment_terms, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const orderResult = await client.query(orderQuery, [
      supplier_id, order_number, order_date, expected_delivery_date,
      status, subtotal, discount_percentage, discount_amount,
      tax_percentage, tax_amount, total_amount,
      notes, payment_terms, req.user.id
    ]);

    const order = orderResult.rows[0];

    // Insert order items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemQuery = `
        INSERT INTO purchase_order_items (
          order_id, product_id, line_number, quantity,
          unit_price, discount_percentage, tax_percentage,
          line_total, description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;

      const line_total = item.quantity * item.unit_price * (1 - (item.discount_percentage || 0) / 100);

      await client.query(itemQuery, [
        order.id, item.product_id, i + 1, item.quantity,
        item.unit_price, item.discount_percentage || 0,
        item.tax_percentage || 0, line_total, item.description
      ]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Purchase order created successfully',
      data: order
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create purchase order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating purchase order',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * G11: Update purchase order
 * PUT /api/purchases/orders/:id
 */
exports.updatePurchaseOrder = async (req, res) => {
  const client = await db.pool.connect();

  try {
    const { id } = req.params;
    const { status, notes, expected_delivery_date, received_date, payment_terms } = req.body;

    await client.query('BEGIN');

    const query = `
      UPDATE purchase_orders
      SET status = COALESCE($1, status),
          notes = COALESCE($2, notes),
          expected_delivery_date = COALESCE($3, expected_delivery_date),
          received_date = COALESCE($4, received_date),
          payment_terms = COALESCE($5, payment_terms),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `;

    const result = await client.query(query, [
      status, notes, expected_delivery_date, received_date, payment_terms, id
    ]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // If status is 'received' or 'completed', update stock
    if (status === 'received' || status === 'completed') {
      const itemsQuery = 'SELECT * FROM purchase_order_items WHERE order_id = $1';
      const itemsResult = await client.query(itemsQuery, [id]);

      for (const item of itemsResult.rows) {
        // Increase stock
        await client.query(
          'UPDATE products SET current_stock = current_stock + $1 WHERE id = $2',
          [item.quantity, item.product_id]
        );

        // Record stock movement
        await client.query(
          `INSERT INTO stock_movements (
            product_id, movement_type, quantity, reference_type,
            reference_id, notes, created_by
          ) VALUES ($1, 'in', $2, 'purchase_order', $3, $4, $5)`,
          [
            item.product_id,
            item.quantity,
            id,
            `Purchase Order ${result.rows[0].order_number}`,
            req.user.id
          ]
        );
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Purchase order updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update purchase order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating purchase order',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * G11: Cancel purchase order
 * DELETE /api/purchases/orders/:id
 */
exports.cancelPurchaseOrder = async (req, res) => {
  const client = await db.pool.connect();

  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Check if order exists and can be cancelled
    const checkQuery = 'SELECT * FROM purchase_orders WHERE id = $1';
    const checkResult = await client.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    const order = checkResult.rows[0];

    if (order.status === 'received' || order.status === 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel received or completed orders'
      });
    }

    // Update status to cancelled
    const updateQuery = `
      UPDATE purchase_orders
      SET status = 'cancelled',
          cancelled_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await client.query(updateQuery, [id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Purchase order cancelled successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cancel purchase order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling purchase order',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * G11: Get purchase statistics
 * GET /api/purchases/statistics
 */
exports.getPurchaseStatistics = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    const statsQuery = `
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_purchases,
        AVG(total_amount) as average_order_value,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END) as received_orders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
      FROM purchase_orders
      WHERE ($1::date IS NULL OR order_date >= $1)
        AND ($2::date IS NULL OR order_date <= $2)
    `;

    const result = await db.query(statsQuery, [date_from || null, date_to || null]);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get purchase statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving purchase statistics',
      error: error.message
    });
  }
};

/**
 * G11: Get supplier performance metrics
 * GET /api/purchases/suppliers/:id/performance
 */
exports.getSupplierPerformance = async (req, res) => {
  try {
    const { id } = req.params;
    const { date_from, date_to } = req.query;

    const performanceQuery = `
      SELECT 
        s.id,
        s.name as supplier_name,
        COUNT(po.id) as total_orders,
        SUM(po.total_amount) as total_spent,
        AVG(po.total_amount) as average_order_value,
        AVG(EXTRACT(EPOCH FROM (po.received_date - po.order_date))/86400) as avg_delivery_days,
        SUM(CASE WHEN po.status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN po.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
        ROUND(
          (SUM(CASE WHEN po.status = 'completed' THEN 1 ELSE 0 END)::numeric / 
          NULLIF(COUNT(po.id), 0) * 100), 2
        ) as completion_rate
      FROM suppliers s
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id
      WHERE s.id = $1
        AND ($2::date IS NULL OR po.order_date >= $2)
        AND ($3::date IS NULL OR po.order_date <= $3)
      GROUP BY s.id, s.name
    `;

    const result = await db.query(performanceQuery, [id, date_from || null, date_to || null]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get supplier performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving supplier performance',
      error: error.message
    });
  }
};

/**
 * G11: Get reorder suggestions based on stock levels
 * GET /api/purchases/reorder-suggestions
 */
exports.getReorderSuggestions = async (req, res) => {
  try {
    const query = `
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.current_stock,
        p.reorder_point,
        p.reorder_quantity,
        p.unit,
        s.id as supplier_id,
        s.name as supplier_name,
        s.email as supplier_email,
        s.phone as supplier_phone,
        (p.reorder_point - p.current_stock) as quantity_needed,
        COALESCE(p.reorder_quantity, (p.reorder_point - p.current_stock)) as suggested_order_quantity
      FROM products p
      LEFT JOIN suppliers s ON p.default_supplier_id = s.id
      WHERE p.current_stock <= p.reorder_point
        AND p.is_active = true
      ORDER BY (p.reorder_point - p.current_stock) DESC
    `;

    const result = await db.query(query);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Get reorder suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving reorder suggestions',
      error: error.message
    });
  }
};

/**
 * G11: Generate automatic purchase order from reorder suggestions
 * POST /api/purchases/auto-order
 */
exports.createAutoOrder = async (req, res) => {
  const client = await db.pool.connect();

  try {
    const { supplier_id, product_ids } = req.body;

    if (!supplier_id || !product_ids || product_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Supplier ID and product IDs are required'
      });
    }

    await client.query('BEGIN');

    // Get products that need reordering for this supplier
    const productsQuery = `
      SELECT id, name, sku, current_stock, reorder_point, reorder_quantity,
             COALESCE(reorder_quantity, (reorder_point - current_stock + 10)) as suggested_quantity
      FROM products
      WHERE id = ANY($1::int[])
        AND default_supplier_id = $2
        AND current_stock <= reorder_point
    `;

    const productsResult = await client.query(productsQuery, [product_ids, supplier_id]);

    if (productsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'No products found that need reordering for this supplier'
      });
    }

    // Generate order number
    const orderNumber = `PO-${Date.now()}`;

    // Calculate total
    let subtotal = 0;
    productsResult.rows.forEach(product => {
      subtotal += product.suggested_quantity * (product.last_purchase_price || 0);
    });

    // Create purchase order
    const orderQuery = `
      INSERT INTO purchase_orders (
        supplier_id, order_number, order_date, status,
        subtotal, total_amount, notes, created_by
      ) VALUES ($1, $2, CURRENT_DATE, 'draft', $3, $3, $4, $5)
      RETURNING *
    `;

    const orderResult = await client.query(orderQuery, [
      supplier_id,
      orderNumber,
      subtotal,
      'Auto-generated based on reorder points',
      req.user.id
    ]);

    const order = orderResult.rows[0];

    // Add order items
    for (let i = 0; i < productsResult.rows.length; i++) {
      const product = productsResult.rows[i];
      const itemQuery = `
        INSERT INTO purchase_order_items (
          order_id, product_id, line_number, quantity,
          unit_price, line_total, description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      const unitPrice = product.last_purchase_price || 0;
      const lineTotal = product.suggested_quantity * unitPrice;

      await client.query(itemQuery, [
        order.id,
        product.id,
        i + 1,
        product.suggested_quantity,
        unitPrice,
        lineTotal,
        `Reorder: ${product.name} (${product.sku})`
      ]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Auto purchase order created successfully',
      data: order
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create auto order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating auto purchase order',
      error: error.message
    });
  } finally {
    client.release();
  }
};

module.exports = exports;