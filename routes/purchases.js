// MC03 - Module Achats (Purchasing Module)
// G11 - Gestion des achats - Base (Purchase Management - Base)

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// Get all purchases with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { 
      status, 
      supplier_id, 
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
        p.*,
        s.name as supplier_name,
        s.email as supplier_email,
        s.phone as supplier_phone,
        u.username as created_by_username,
        COUNT(*) OVER() as total_count
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND p.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (supplier_id) {
      query += ` AND p.supplier_id = $${paramCount}`;
      params.push(supplier_id);
      paramCount++;
    }

    if (start_date) {
      query += ` AND p.order_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND p.order_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    if (search) {
      query += ` AND (p.purchase_number ILIKE $${paramCount} OR s.name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY p.${sort_by} ${sort_order}`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await pool.query(query, params);

    res.json({
      purchases: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows[0]?.total_count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get purchase by ID with items
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Get purchase header
    const purchaseResult = await pool.query(`
      SELECT 
        p.*,
        s.name as supplier_name,
        s.email as supplier_email,
        s.phone as supplier_phone,
        s.address as supplier_address,
        u.username as created_by_username
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = $1
    `, [id]);

    if (purchaseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    // Get purchase items
    const itemsResult = await pool.query(`
      SELECT 
        pi.*,
        pr.name as product_name,
        pr.sku as product_sku,
        pr.unit as product_unit
      FROM purchase_items pi
      LEFT JOIN products pr ON pi.product_id = pr.id
      WHERE pi.purchase_id = $1
      ORDER BY pi.line_number
    `, [id]);

    res.json({
      ...purchaseResult.rows[0],
      items: itemsResult.rows
    });
  } catch (error) {
    console.error('Error fetching purchase:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new purchase
router.post('/', authenticate, authorize(['admin', 'manager', 'purchasing']), async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      supplier_id,
      order_date,
      expected_date,
      payment_terms,
      shipping_address,
      notes,
      items
    } = req.body;

    // Validation
    if (!supplier_id || !order_date || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await client.query('BEGIN');

    // Generate purchase number
    const numberResult = await client.query(`
      SELECT COALESCE(MAX(CAST(SUBSTRING(purchase_number FROM 4) AS INTEGER)), 0) + 1 as next_number
      FROM purchases
      WHERE purchase_number LIKE 'PO-%'
    `);
    const purchaseNumber = `PO-${String(numberResult.rows[0].next_number).padStart(6, '0')}`;

    // Calculate totals
    let subtotal = 0;
    items.forEach(item => {
      subtotal += parseFloat(item.quantity) * parseFloat(item.unit_price);
    });
    const tax_amount = subtotal * 0.19; // 19% VAT
    const total_amount = subtotal + tax_amount;

    // Insert purchase header
    const purchaseResult = await client.query(`
      INSERT INTO purchases (
        purchase_number, supplier_id, order_date, expected_date,
        status, subtotal, tax_amount, total_amount,
        payment_terms, shipping_address, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      purchaseNumber, supplier_id, order_date, expected_date,
      'draft', subtotal, tax_amount, total_amount,
      payment_terms, shipping_address, notes, req.user.userId
    ]);

    const purchaseId = purchaseResult.rows[0].id;

    // Insert purchase items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await client.query(`
        INSERT INTO purchase_items (
          purchase_id, product_id, line_number, quantity,
          unit_price, discount_percent, tax_percent, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        purchaseId, item.product_id, i + 1, item.quantity,
        item.unit_price, item.discount_percent || 0, item.tax_percent || 19,
        item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100) * (1 + (item.tax_percent || 19) / 100)
      ]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Purchase created successfully',
      purchase: purchaseResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating purchase:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Update purchase
router.put('/:id', authenticate, authorize(['admin', 'manager', 'purchasing']), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const {
      supplier_id,
      order_date,
      expected_date,
      payment_terms,
      shipping_address,
      notes,
      items
    } = req.body;

    // Check if purchase exists and is editable
    const checkResult = await client.query(
      'SELECT status FROM purchases WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    if (['confirmed', 'received', 'cancelled'].includes(checkResult.rows[0].status)) {
      return res.status(400).json({ error: 'Cannot edit purchase in current status' });
    }

    await client.query('BEGIN');

    // Calculate new totals
    let subtotal = 0;
    items.forEach(item => {
      subtotal += parseFloat(item.quantity) * parseFloat(item.unit_price);
    });
    const tax_amount = subtotal * 0.19;
    const total_amount = subtotal + tax_amount;

    // Update purchase header
    const updateResult = await client.query(`
      UPDATE purchases SET
        supplier_id = $1,
        order_date = $2,
        expected_date = $3,
        subtotal = $4,
        tax_amount = $5,
        total_amount = $6,
        payment_terms = $7,
        shipping_address = $8,
        notes = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `, [
      supplier_id, order_date, expected_date,
      subtotal, tax_amount, total_amount,
      payment_terms, shipping_address, notes, id
    ]);

    // Delete existing items
    await client.query('DELETE FROM purchase_items WHERE purchase_id = $1', [id]);

    // Insert new items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await client.query(`
        INSERT INTO purchase_items (
          purchase_id, product_id, line_number, quantity,
          unit_price, discount_percent, tax_percent, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        id, item.product_id, i + 1, item.quantity,
        item.unit_price, item.discount_percent || 0, item.tax_percent || 19,
        item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100) * (1 + (item.tax_percent || 19) / 100)
      ]);
    }

    await client.query('COMMIT');

    res.json({
      message: 'Purchase updated successfully',
      purchase: updateResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating purchase:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Confirm purchase (change status)
router.post('/:id/confirm', authenticate, authorize(['admin', 'manager', 'purchasing']), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE purchases 
      SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'draft'
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase not found or already confirmed' });
    }

    res.json({
      message: 'Purchase confirmed successfully',
      purchase: result.rows[0]
    });
  } catch (error) {
    console.error('Error confirming purchase:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Receive purchase (create stock movements)
router.post('/:id/receive', authenticate, authorize(['admin', 'manager', 'warehouse']), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { received_date, items } = req.body;

    await client.query('BEGIN');

    // Get purchase items
    const purchaseItems = await client.query(
      'SELECT * FROM purchase_items WHERE purchase_id = $1',
      [id]
    );

    // Create stock movements for received items
    for (const receivedItem of items) {
      const purchaseItem = purchaseItems.rows.find(pi => pi.id === receivedItem.purchase_item_id);
      if (!purchaseItem) continue;

      // Insert stock movement
      await client.query(`
        INSERT INTO stock_movements (
          product_id, movement_type, quantity, unit_price,
          reference_type, reference_id, movement_date,
          notes, created_by, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        purchaseItem.product_id,
        'purchase_receipt',
        receivedItem.received_quantity,
        purchaseItem.unit_price,
        'purchase',
        id,
        received_date,
        `Received from purchase ${id}`,
        req.user.userId,
        'approved'
      ]);

      // Update product stock
      await client.query(`
        UPDATE products 
        SET stock_quantity = stock_quantity + $1
        WHERE id = $2
      `, [receivedItem.received_quantity, purchaseItem.product_id]);

      // Update purchase item received quantity
      await client.query(`
        UPDATE purchase_items
        SET received_quantity = received_quantity + $1
        WHERE id = $2
      `, [receivedItem.received_quantity, receivedItem.purchase_item_id]);
    }

    // Check if all items are fully received
    const checkComplete = await client.query(`
      SELECT COUNT(*) as incomplete
      FROM purchase_items
      WHERE purchase_id = $1 AND received_quantity < quantity
    `, [id]);

    const newStatus = checkComplete.rows[0].incomplete === '0' ? 'received' : 'partial';

    // Update purchase status
    await client.query(`
      UPDATE purchases
      SET status = $1, received_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [newStatus, id]);

    await client.query('COMMIT');

    res.json({ message: 'Purchase received successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error receiving purchase:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Cancel purchase
router.post('/:id/cancel', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await pool.query(`
      UPDATE purchases
      SET status = 'cancelled', notes = COALESCE(notes || ' | ', '') || 'Cancelled: ' || $1
      WHERE id = $2 AND status NOT IN ('received', 'cancelled')
      RETURNING *
    `, [reason || 'No reason provided', id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase not found or cannot be cancelled' });
    }

    res.json({
      message: 'Purchase cancelled successfully',
      purchase: result.rows[0]
    });
  } catch (error) {
    console.error('Error cancelling purchase:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete purchase (only drafts)
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM purchases WHERE id = $1 AND status = \'draft\' RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase not found or cannot be deleted' });
    }

    res.json({ message: 'Purchase deleted successfully' });
  } catch (error) {
    console.error('Error deleting purchase:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;