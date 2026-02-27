// MC03 - Module Achats (Purchasing Module)
// G11 - Gestion des achats - Base (Purchase Management - Base)

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorize, authorizeRoles } = require('../middleware/auth');

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

    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const offset = (parsedPage - 1) * parsedLimit;

    let query = `
      SELECT 
        p.*,
        s.name as supplier_name,
        s.email as supplier_email,
        s.phone as supplier_phone,
        u.username as created_by_username,
        COUNT(*) OVER() as total_count
      FROM purchase_orders p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;

    if (status) {
      query += \` AND p.status = $\\${paramCount}\`;
      params.push(status.toUpperCase());
      paramCount++;
    }

    if (supplier_id) {
      query += \` AND p.supplier_id = $\\${paramCount}\`;
      params.push(supplier_id);
      paramCount++;
    }

    if (start_date) {
      query += \` AND p.order_date >= $\\${paramCount}\`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += \` AND p.order_date <= $\\${paramCount}\`;
      params.push(end_date);
      paramCount++;
    }

    if (search) {
      query += \` AND (p.po_number ILIKE $\\${paramCount} OR s.name ILIKE $\\${paramCount})\`;
      params.push(\\`%\\${search}%\\`);
      paramCount++;
    }

    const allowedSortFields = ['created_at', 'order_date', 'total_amount', 'po_number'];
    const finalSortBy = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const finalSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += \` ORDER BY p.\\${finalSortBy} \\${finalSortOrder}\`;
    query += \` LIMIT $\\${paramCount} OFFSET $\\${paramCount + 1}\`;
    params.push(parsedLimit, offset);

    const result = await pool.query(query, params);

    res.json({
      purchases: result.rows,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get purchase by ID with items
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const purchaseResult = await pool.query(\`
      SELECT 
        p.*,
        s.name as supplier_name,
        s.email as supplier_email,
        s.phone as supplier_phone,
        s.address_line1 as supplier_address,
        u.username as created_by_username
      FROM purchase_orders p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = $1
    \`, [id]);

    if (purchaseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const itemsResult = await pool.query(\`
      SELECT 
        pi.*,
        pr.name as product_name,
        pr.sku as product_sku,
        pr.unit_of_measure as product_unit
      FROM purchase_order_items pi
      LEFT JOIN products pr ON pi.product_id = pr.id
      WHERE pi.purchase_order_id = $1
      ORDER BY pi.id
    \`, [id]);

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
router.post('/', authenticate, authorizeRoles('admin', 'manager', 'purchasing'), async (req, res) => {
  const client = await pool.getClient();
  try {
    const {
      supplier_id,
      order_date,
      expected_delivery_date,
      payment_terms,
      delivery_address,
      notes,
      items
    } = req.body;

    if (!supplier_id || !order_date || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await client.query('BEGIN');

    const numberResult = await client.query(\`
      SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 4) AS INTEGER)), 0) + 1 as next_number
      FROM purchase_orders
      WHERE po_number LIKE 'PO-%'
    \`);
    const nextNum = numberResult.rows[0].next_number;
    const purchaseNumber = \`PO-\\${String(nextNum).padStart(6, '0')}\`;

    let subtotal = 0;
    items.forEach(item => {
      subtotal += parseFloat(item.quantity) * parseFloat(item.unit_price);
    });
    const tax_amount = subtotal * 0.19;
    const total_amount = subtotal + tax_amount;

    const purchaseResult = await client.query(\`
      INSERT INTO purchase_orders (
        po_number, supplier_id, order_date, expected_delivery_date,
        status, subtotal, tax_amount, total_amount,
        payment_terms, delivery_address, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    \`, [
      purchaseNumber, supplier_id, order_date, expected_delivery_date,
      'DRAFT', subtotal, tax_amount, total_amount,
      payment_terms, delivery_address, notes, req.user.id
    ]);

    const purchaseId = purchaseResult.rows[0].id;

    for (const item of items) {
      await client.query(\`
        INSERT INTO purchase_order_items (
          purchase_order_id, product_id, quantity,
          unit_price, tax_rate, line_total
        ) VALUES ($1, $2, $3, $4, $5, $6)
      \`, [
        purchaseId, item.product_id, item.quantity,
        item.unit_price, item.tax_rate || 19,
        item.quantity * item.unit_price * (1 + (item.tax_rate || 19) / 100)
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
    res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    client.release();
  }
});

// Cancel purchase
router.post('/:id/cancel', authenticate, authorizeRoles('admin', 'manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(\`
      UPDATE purchase_orders
      SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status NOT IN ('RECEIVED', 'CANCELLED')
      RETURNING *
    \`, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase not found or cannot be cancelled' });
    }
    res.json({ message: 'Purchase cancelled successfully', purchase: result.rows[0] });
  } catch (error) {
    console.error('Error cancelling purchase:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
