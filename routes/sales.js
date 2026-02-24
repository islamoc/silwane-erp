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
    res.status(500).json({ error: 'Internal server error' });
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
        c.address as customer_address,
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
        p.unit as product_unit
      FROM sales_order_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sales_order_id = $1
      ORDER BY si.line_number
    `, [id]);

    res.json({
      ...orderResult.rows[0],
      items: itemsResult.rows
    });
  } catch (error) {
    console.error('Error fetching sales order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new sales order
router.post('/', authenticate, authorize(['admin', 'manager', 'sales']), async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      customer_id,
      order_date,
      delivery_date,
      payment_terms,
      shipping_address,
      billing_address,
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
      const discount = itemTotal * (parseFloat(item.discount_percent || 0) / 100);
      subtotal += itemTotal - discount;
    });
    const tax_amount = subtotal * 0.19; // 19% VAT
    const total_amount = subtotal + tax_amount;

    // Insert sales order header
    const orderResult = await client.query(`
      INSERT INTO sales_orders (
        order_number, customer_id, order_date, delivery_date,
        status, subtotal, tax_amount, total_amount,
        payment_terms, shipping_address, billing_address, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      orderNumber, customer_id, order_date, delivery_date,
      'draft', subtotal, tax_amount, total_amount,
      payment_terms, shipping_address, billing_address, notes, req.user.userId
    ]);

    const orderId = orderResult.rows[0].id;

    // Insert order items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemTotal = item.quantity * item.unit_price;
      const discount = itemTotal * ((item.discount_percent || 0) / 100);
      const taxableAmount = itemTotal - discount;
      const tax = taxableAmount * ((item.tax_percent || 19) / 100);
      const totalPrice = taxableAmount + tax;

      await client.query(`
        INSERT INTO sales_order_items (
          sales_order_id, product_id, line_number, quantity,
          unit_price, discount_percent, tax_percent, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        orderId, item.product_id, i + 1, item.quantity,
        item.unit_price, item.discount_percent || 0, item.tax_percent || 19,
        totalPrice
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
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Update sales order
router.put('/:id', authenticate, authorize(['admin', 'manager', 'sales']), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const {
      customer_id,
      order_date,
      delivery_date,
      payment_terms,
      shipping_address,
      billing_address,
      notes,
      items
    } = req.body;

    // Check if order exists and is editable
    const checkResult = await client.query(
      'SELECT status FROM sales_orders WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    if (['confirmed', 'shipped', 'delivered', 'cancelled'].includes(checkResult.rows[0].status)) {
      return res.status(400).json({ error: 'Cannot edit order in current status' });
    }

    await client.query('BEGIN');

    // Calculate new totals
    let subtotal = 0;
    items.forEach(item => {
      const itemTotal = parseFloat(item.quantity) * parseFloat(item.unit_price);
      const discount = itemTotal * (parseFloat(item.discount_percent || 0) / 100);
      subtotal += itemTotal - discount;
    });
    const tax_amount = subtotal * 0.19;
    const total_amount = subtotal + tax_amount;

    // Update order header
    const updateResult = await client.query(`
      UPDATE sales_orders SET
        customer_id = $1,
        order_date = $2,
        delivery_date = $3,
        subtotal = $4,
        tax_amount = $5,
        total_amount = $6,
        payment_terms = $7,
        shipping_address = $8,
        billing_address = $9,
        notes = $10,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING *
    `, [
      customer_id, order_date, delivery_date,
      subtotal, tax_amount, total_amount,
      payment_terms, shipping_address, billing_address, notes, id
    ]);

    // Delete existing items
    await client.query('DELETE FROM sales_order_items WHERE sales_order_id = $1', [id]);

    // Insert new items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemTotal = item.quantity * item.unit_price;
      const discount = itemTotal * ((item.discount_percent || 0) / 100);
      const taxableAmount = itemTotal - discount;
      const tax = taxableAmount * ((item.tax_percent || 19) / 100);
      const totalPrice = taxableAmount + tax;

      await client.query(`
        INSERT INTO sales_order_items (
          sales_order_id, product_id, line_number, quantity,
          unit_price, discount_percent, tax_percent, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        id, item.product_id, i + 1, item.quantity,
        item.unit_price, item.discount_percent || 0, item.tax_percent || 19,
        totalPrice
      ]);
    }

    await client.query('COMMIT');

    res.json({
      message: 'Sales order updated successfully',
      sales_order: updateResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating sales order:', error);
    res.status(500).json({ error: 'Internal server error' });
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
      SELECT si.product_id, si.quantity, p.stock_quantity, p.name
      FROM sales_order_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sales_order_id = $1
    `, [id]);

    const insufficientStock = [];
    for (const item of itemsResult.rows) {
      if (item.stock_quantity < item.quantity) {
        insufficientStock.push({
          product: item.name,
          required: item.quantity,
          available: item.stock_quantity
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
      SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'draft'
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
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Ship sales order (create stock movements)
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

    // Create stock movements and update stock
    for (const item of itemsResult.rows) {
      // Check stock availability
      const stockCheck = await client.query(
        'SELECT stock_quantity FROM products WHERE id = $1',
        [item.product_id]
      );

      if (stockCheck.rows[0].stock_quantity < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient stock for shipping' });
      }

      // Create stock movement
      await client.query(`
        INSERT INTO stock_movements (
          product_id, movement_type, quantity, unit_price,
          reference_type, reference_id, movement_date,
          notes, created_by, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        item.product_id,
        'sales_shipment',
        -item.quantity, // Negative for outgoing
        item.unit_price,
        'sales_order',
        id,
        shipping_date,
        `Shipped for order ${id}`,
        req.user.userId,
        'approved'
      ]);

      // Update product stock
      await client.query(`
        UPDATE products 
        SET stock_quantity = stock_quantity - $1
        WHERE id = $2
      `, [item.quantity, item.product_id]);

      // Update item shipped quantity
      await client.query(`
        UPDATE sales_order_items
        SET shipped_quantity = shipped_quantity + $1
        WHERE id = $2
      `, [item.quantity, item.id]);
    }

    // Update order status
    await client.query(`
      UPDATE sales_orders
      SET status = 'shipped', 
          shipped_at = CURRENT_TIMESTAMP,
          tracking_number = $1
      WHERE id = $2
    `, [tracking_number, id]);

    await client.query('COMMIT');

    res.json({ message: 'Sales order shipped successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error shipping sales order:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Cancel sales order
router.post('/:id/cancel', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await pool.query(`
      UPDATE sales_orders
      SET status = 'cancelled', notes = COALESCE(notes || ' | ', '') || 'Cancelled: ' || $1
      WHERE id = $2 AND status NOT IN ('shipped', 'delivered', 'cancelled')
      RETURNING *
    `, [reason || 'No reason provided', id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found or cannot be cancelled' });
    }

    res.json({
      message: 'Sales order cancelled successfully',
      sales_order: result.rows[0]
    });
  } catch (error) {
    console.error('Error cancelling sales order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete sales order (only drafts)
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM sales_orders WHERE id = $1 AND status = \'draft\' RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found or cannot be deleted' });
    }

    res.json({ message: 'Sales order deleted successfully' });
  } catch (error) {
    console.error('Error deleting sales order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;