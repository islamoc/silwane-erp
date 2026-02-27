// MC04 - Module Ventes (Sales Module)
// G16 - Gestion des ventes - Base (Sales Management)
// G17 - Demandes d'offre et proforma (Quotes and Proforma)
// G18 - Commandes client (Customer Orders)

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// Get all sales orders with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { 
      status, 
      customer_id, 
      start_date, 
      end_date, 
      search,
      page = 1, 
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    let query = `
      SELECT 
        s.*,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        u.username as created_by_username,
        COUNT(*) OVER() as total_count
      FROM sales_orders s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND s.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (customer_id) {
      query += ` AND s.customer_id = $${paramCount}`;
      params.push(customer_id);
      paramCount++;
    }

    if (start_date) {
      query += ` AND s.order_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND s.order_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    if (search) {
      query += ` AND (s.order_number ILIKE $${paramCount} OR c.name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY s.${sort_by} ${sort_order}`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await pool.query(query, params);

    res.json({
      sales_orders: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows[0]?.total_count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching sales orders:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get sales order by ID with items
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Get order header
    const orderResult = await pool.query(`
      SELECT 
        s.*,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.billing_address_line1 as customer_address,
        u.username as created_by_username
      FROM sales_orders s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = $1
    `, [id]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    // Get order items
    const itemsResult = await pool.query(`
      SELECT 
        si.*,
        p.name as product_name,
        p.sku as product_sku,
        p.unit_of_measure as product_unit
      FROM sales_order_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sales_order_id = $1
      ORDER BY si.id
    `, [id]);

    res.json({
      ...orderResult.rows[0],
      items: itemsResult.rows
    });
  } catch (error) {
    console.error('Error fetching sales order:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Create new sales order
router.post('/', authenticate, authorize(['admin', 'manager', 'sales']), async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      customer_id,
      order_date,
      expected_delivery_date,
      payment_terms,
      shipping_address,
      notes,
      items
    } = req.body;

    // Validation
    if (!customer_id || !order_date || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await client.query('BEGIN');

    // Generate order number
    const numberResult = await client.query(`
      SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 4) AS INTEGER)), 0) + 1 as next_number
      FROM sales_orders
      WHERE order_number LIKE 'SO-%'
    `);
    const orderNumber = `SO-${String(numberResult.rows[0].next_number).padStart(6, '0')}`;

    // Calculate totals
    let subtotal = 0;
    items.forEach(item => {
      const itemTotal = parseFloat(item.quantity) * parseFloat(item.unit_price);
      const discount = itemTotal * (parseFloat(item.discount_percentage || 0) / 100);
      subtotal += itemTotal - discount;
    });

    const tax_amount = subtotal * 0.19; // 19% VAT
    const total_amount = subtotal + tax_amount;

    // Insert sales order header
    const orderResult = await client.query(`
      INSERT INTO sales_orders (
        order_number, customer_id, order_date, expected_delivery_date,
        status, subtotal, tax_amount, total_amount,
        payment_terms, shipping_address, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      orderNumber, customer_id, order_date, expected_delivery_date,
      'PENDING', subtotal, tax_amount, total_amount,
      payment_terms, shipping_address, notes, req.user.id
    ]);

    const orderId = orderResult.rows[0].id;

    // Insert order items
    for (const item of items) {
      const itemTotal = item.quantity * item.unit_price;
      const discount = itemTotal * ((item.discount_percentage || 0) / 100);
      const line_total = (itemTotal - discount) * (1 + (item.tax_rate || 19) / 100);

      await client.query(`
        INSERT INTO sales_order_items (
          sales_order_id, product_id, quantity,
          unit_price, discount_percentage, tax_rate, line_total
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        orderId, item.product_id, item.quantity,
        item.unit_price, item.discount_percentage || 0, item.tax_rate || 19,
        line_total
      ]);
    }

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Sales order created successfully',
      sales_order: orderResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating sales order:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    client.release();
  }
});

// Confirm sales order
router.post('/:id/confirm', authenticate, authorize(['admin', 'manager', 'sales']), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    // Check stock availability
    const itemsResult = await client.query(`
      SELECT si.product_id, si.quantity, p.quantity_in_stock, p.name
      FROM sales_order_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sales_order_id = $1
    `, [id]);

    const insufficientStock = [];
    for (const item of itemsResult.rows) {
      if (parseFloat(item.quantity_in_stock) < parseFloat(item.quantity)) {
        insufficientStock.push({
          product: item.name,
          required: item.quantity,
          available: item.quantity_in_stock
        });
      }
    }

    if (insufficientStock.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Insufficient stock',
        details: insufficientStock
      });
    }

    // Update order status
    const result = await client.query(`
      UPDATE sales_orders 
      SET status = 'CONFIRMED', confirmed_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'PENDING'
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found or already confirmed' });
    }

    await client.query('COMMIT');
    res.json({
      message: 'Sales order confirmed successfully',
      sales_order: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error confirming sales order:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    client.release();
  }
});

// Ship sales order
router.post('/:id/ship', authenticate, authorize(['admin', 'manager', 'warehouse']), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { shipping_date, tracking_number } = req.body;

    await client.query('BEGIN');

    // Get order items
    const itemsResult = await client.query(
      'SELECT * FROM sales_order_items WHERE sales_order_id = $1',
      [id]
    );

    for (const item of itemsResult.rows) {
      // Check stock
      const stockCheck = await client.query(
        'SELECT quantity_in_stock FROM products WHERE id = $1',
        [item.product_id]
      );

      if (parseFloat(stockCheck.rows[0].quantity_in_stock) < parseFloat(item.quantity)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient stock for shipping' });
      }

      // Create stock movement
      const movementRef = `SHIP-${id}-${item.product_id}`;
      await client.query(`
        INSERT INTO stock_movements (
          movement_type, reference_number, product_id, quantity, 
          unit_price, related_document_type, related_document_id, 
          movement_date, notes, created_by, is_approved, approved_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      `, [
        'OUT', movementRef, item.product_id, -item.quantity,
        item.unit_price, 'SALES_ORDER', id,
        shipping_date || new Date(), `Shipped for order ${id}`,
        req.user.id, true
      ]);

      // Update product stock
      await client.query(`
        UPDATE products 
        SET quantity_in_stock = quantity_in_stock - $1
        WHERE id = $2
      `, [item.quantity, item.product_id]);

      // Update item shipped quantity
      await client.query(`
        UPDATE sales_order_items
        SET shipped_quantity = COALESCE(shipped_quantity, 0) + $1
        WHERE id = $2
      `, [item.quantity, item.id]);
    }

    // Update order status
    await client.query(`
      UPDATE sales_orders
      SET status = 'SHIPPED', 
          shipped_at = CURRENT_TIMESTAMP,
          tracking_number = $1
      WHERE id = $2
    `, [tracking_number, id]);

    await client.query('COMMIT');
    res.json({ message: 'Sales order shipped successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error shipping sales order:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
