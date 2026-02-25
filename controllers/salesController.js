/**
 * Sales Controller
 * Handles MC04 - Sales Management Module
 * Features: G16 (Sales Base), G17 (Quotes & Proforma), G18 (Customer Orders)
 * 
 * @author Mennouchi Islam Azeddine
 * @company Dalil Technology
 * @project Silwane ERP - FP26002386
 */

const db = require('../config/database');
const { validationResult } = require('express-validator');

/**
 * G17: Get all quotes with pagination and filters
 * GET /api/sales/quotes
 */
exports.getAllQuotes = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, customer_id, date_from, date_to } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT sq.*, c.name as customer_name, c.email as customer_email,
             c.phone as customer_phone, c.company as customer_company,
             COUNT(*) OVER() as total_count
      FROM sales_quotes sq
      LEFT JOIN customers c ON sq.customer_id = c.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND sq.status = $${paramIndex++}`;
      params.push(status);
    }

    if (customer_id) {
      query += ` AND sq.customer_id = $${paramIndex++}`;
      params.push(customer_id);
    }

    if (date_from) {
      query += ` AND sq.quote_date >= $${paramIndex++}`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND sq.quote_date <= $${paramIndex++}`;
      params.push(date_to);
    }

    query += ` ORDER BY sq.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
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
    console.error('Get quotes error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving quotes',
      error: error.message
    });
  }
};

/**
 * G17: Get single quote by ID
 * GET /api/sales/quotes/:id
 */
exports.getQuoteById = async (req, res) => {
  try {
    const { id } = req.params;

    const quoteQuery = `
      SELECT sq.*, c.name as customer_name, c.email as customer_email,
             c.phone as customer_phone, c.company as customer_company,
             c.address as customer_address
      FROM sales_quotes sq
      LEFT JOIN customers c ON sq.customer_id = c.id
      WHERE sq.id = $1
    `;

    const quoteResult = await db.query(quoteQuery, [id]);

    if (quoteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    const quote = quoteResult.rows[0];

    // Get quote items
    const itemsQuery = `
      SELECT sqi.*, p.name as product_name, p.sku, p.unit
      FROM sales_quote_items sqi
      LEFT JOIN products p ON sqi.product_id = p.id
      WHERE sqi.quote_id = $1
      ORDER BY sqi.line_number
    `;

    const itemsResult = await db.query(itemsQuery, [id]);
    quote.items = itemsResult.rows;

    res.json({
      success: true,
      data: quote
    });
  } catch (error) {
    console.error('Get quote error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving quote',
      error: error.message
    });
  }
};

/**
 * G17: Create new quote/proforma
 * POST /api/sales/quotes
 */
exports.createQuote = async (req, res) => {
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
      customer_id,
      quote_number,
      quote_date,
      valid_until,
      status = 'draft',
      items,
      notes,
      terms,
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

    // Insert quote
    const quoteQuery = `
      INSERT INTO sales_quotes (
        customer_id, quote_number, quote_date, valid_until, status,
        subtotal, discount_percentage, discount_amount,
        tax_percentage, tax_amount, total_amount,
        notes, terms, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const quoteResult = await client.query(quoteQuery, [
      customer_id, quote_number, quote_date, valid_until, status,
      subtotal, discount_percentage, discount_amount,
      tax_percentage, tax_amount, total_amount,
      notes, terms, req.user.id
    ]);

    const quote = quoteResult.rows[0];

    // Insert quote items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemQuery = `
        INSERT INTO sales_quote_items (
          quote_id, product_id, line_number, quantity,
          unit_price, discount_percentage, tax_percentage,
          line_total, description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;

      const line_total = item.quantity * item.unit_price * (1 - (item.discount_percentage || 0) / 100);

      await client.query(itemQuery, [
        quote.id, item.product_id, i + 1, item.quantity,
        item.unit_price, item.discount_percentage || 0,
        item.tax_percentage || 0, line_total, item.description
      ]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Quote created successfully',
      data: quote
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create quote error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating quote',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * G17: Update quote
 * PUT /api/sales/quotes/:id
 */
exports.updateQuote = async (req, res) => {
  const client = await db.pool.connect();

  try {
    const { id } = req.params;
    const { status, notes, terms, valid_until } = req.body;

    await client.query('BEGIN');

    const query = `
      UPDATE sales_quotes
      SET status = COALESCE($1, status),
          notes = COALESCE($2, notes),
          terms = COALESCE($3, terms),
          valid_until = COALESCE($4, valid_until),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `;

    const result = await client.query(query, [status, notes, terms, valid_until, id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Quote updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update quote error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating quote',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * G17: Convert quote to order
 * POST /api/sales/quotes/:id/convert
 */
exports.convertQuoteToOrder = async (req, res) => {
  const client = await db.pool.connect();

  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Get quote details
    const quoteQuery = 'SELECT * FROM sales_quotes WHERE id = $1';
    const quoteResult = await client.query(quoteQuery, [id]);

    if (quoteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    const quote = quoteResult.rows[0];

    if (quote.status !== 'approved') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Only approved quotes can be converted to orders'
      });
    }

    // Generate order number
    const orderNumber = `SO-${Date.now()}`;

    // Create sales order
    const orderQuery = `
      INSERT INTO sales_orders (
        customer_id, order_number, order_date, status,
        subtotal, discount_percentage, discount_amount,
        tax_percentage, tax_amount, total_amount,
        notes, quote_id, created_by
      ) VALUES ($1, $2, CURRENT_DATE, 'pending', $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const orderResult = await client.query(orderQuery, [
      quote.customer_id, orderNumber, quote.subtotal,
      quote.discount_percentage, quote.discount_amount,
      quote.tax_percentage, quote.tax_amount, quote.total_amount,
      quote.notes, quote.id, req.user.id
    ]);

    const order = orderResult.rows[0];

    // Copy quote items to order items
    const itemsQuery = 'SELECT * FROM sales_quote_items WHERE quote_id = $1';
    const itemsResult = await client.query(itemsQuery, [id]);

    for (const item of itemsResult.rows) {
      const orderItemQuery = `
        INSERT INTO sales_order_items (
          order_id, product_id, line_number, quantity,
          unit_price, discount_percentage, tax_percentage,
          line_total, description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;

      await client.query(orderItemQuery, [
        order.id, item.product_id, item.line_number, item.quantity,
        item.unit_price, item.discount_percentage, item.tax_percentage,
        item.line_total, item.description
      ]);
    }

    // Update quote status
    await client.query(
      'UPDATE sales_quotes SET status = $1, converted_to_order = $2 WHERE id = $3',
      ['converted', order.id, id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Quote converted to order successfully',
      data: order
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Convert quote error:', error);
    res.status(500).json({
      success: false,
      message: 'Error converting quote to order',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * G16, G18: Get all sales orders
 * GET /api/sales/orders
 */
exports.getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, customer_id, date_from, date_to } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT so.*, c.name as customer_name, c.email as customer_email,
             c.phone as customer_phone, c.company as customer_company,
             COUNT(*) OVER() as total_count
      FROM sales_orders so
      LEFT JOIN customers c ON so.customer_id = c.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND so.status = $${paramIndex++}`;
      params.push(status);
    }

    if (customer_id) {
      query += ` AND so.customer_id = $${paramIndex++}`;
      params.push(customer_id);
    }

    if (date_from) {
      query += ` AND so.order_date >= $${paramIndex++}`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND so.order_date <= $${paramIndex++}`;
      params.push(date_to);
    }

    query += ` ORDER BY so.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
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
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving orders',
      error: error.message
    });
  }
};

/**
 * G18: Get single order by ID
 * GET /api/sales/orders/:id
 */
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const orderQuery = `
      SELECT so.*, c.name as customer_name, c.email as customer_email,
             c.phone as customer_phone, c.company as customer_company,
             c.address as customer_address
      FROM sales_orders so
      LEFT JOIN customers c ON so.customer_id = c.id
      WHERE so.id = $1
    `;

    const orderResult = await db.query(orderQuery, [id]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Get order items
    const itemsQuery = `
      SELECT soi.*, p.name as product_name, p.sku, p.unit,
             p.current_stock
      FROM sales_order_items soi
      LEFT JOIN products p ON soi.product_id = p.id
      WHERE soi.order_id = $1
      ORDER BY soi.line_number
    `;

    const itemsResult = await db.query(itemsQuery, [id]);
    order.items = itemsResult.rows;

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving order',
      error: error.message
    });
  }
};

/**
 * G18: Create new sales order
 * POST /api/sales/orders
 */
exports.createOrder = async (req, res) => {
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
      customer_id,
      order_number,
      order_date,
      delivery_date,
      status = 'pending',
      items,
      notes,
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

    // Insert order
    const orderQuery = `
      INSERT INTO sales_orders (
        customer_id, order_number, order_date, delivery_date, status,
        subtotal, discount_percentage, discount_amount,
        tax_percentage, tax_amount, total_amount,
        notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const orderResult = await client.query(orderQuery, [
      customer_id, order_number, order_date, delivery_date, status,
      subtotal, discount_percentage, discount_amount,
      tax_percentage, tax_amount, total_amount,
      notes, req.user.id
    ]);

    const order = orderResult.rows[0];

    // Insert order items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemQuery = `
        INSERT INTO sales_order_items (
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
      message: 'Order created successfully',
      data: order
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * G18: Update order status
 * PUT /api/sales/orders/:id
 */
exports.updateOrder = async (req, res) => {
  const client = await db.pool.connect();

  try {
    const { id } = req.params;
    const { status, notes, delivery_date, shipped_date } = req.body;

    await client.query('BEGIN');

    const query = `
      UPDATE sales_orders
      SET status = COALESCE($1, status),
          notes = COALESCE($2, notes),
          delivery_date = COALESCE($3, delivery_date),
          shipped_date = COALESCE($4, shipped_date),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `;

    const result = await client.query(query, [status, notes, delivery_date, shipped_date, id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // If status is 'shipped' or 'delivered', update stock
    if (status === 'shipped' || status === 'delivered') {
      const itemsQuery = 'SELECT * FROM sales_order_items WHERE order_id = $1';
      const itemsResult = await client.query(itemsQuery, [id]);

      for (const item of itemsResult.rows) {
        // Decrease stock
        await client.query(
          'UPDATE products SET current_stock = current_stock - $1 WHERE id = $2',
          [item.quantity, item.product_id]
        );

        // Record stock movement
        await client.query(
          `INSERT INTO stock_movements (
            product_id, movement_type, quantity, reference_type,
            reference_id, notes, created_by
          ) VALUES ($1, 'out', $2, 'sales_order', $3, $4, $5)`,
          [item.product_id, item.quantity, id, `Sales Order ${result.rows[0].order_number}`, req.user.id]
        );
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Order updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * G16: Get sales statistics
 * GET /api/sales/statistics
 */
exports.getSalesStatistics = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    const statsQuery = `
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as average_order_value,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
      FROM sales_orders
      WHERE ($1::date IS NULL OR order_date >= $1)
        AND ($2::date IS NULL OR order_date <= $2)
    `;

    const result = await db.query(statsQuery, [date_from || null, date_to || null]);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get sales statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving sales statistics',
      error: error.message
    });
  }
};

module.exports = exports;