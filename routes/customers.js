// Customers Management for MC04 Sales Module

const express = require('express');
const router = express.Router();
const { query: dbQuery } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET /api/customers - list all customers
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;
    let sql = `SELECT *, COUNT(*) OVER() as total_count FROM customers WHERE 1=1`;
    const params = [];
    let idx = 1;
    if (search) {
      sql += ` AND (name ILIKE $${idx} OR email ILIKE $${idx} OR company ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }
    sql += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);
    const result = await dbQuery(sql, params);
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
    res.json({ success: true, data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error retrieving customers', error: err.message });
  }
});

// GET /api/customers/:id - get single customer
router.get('/:id', async (req, res) => {
  try {
    const result = await dbQuery('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error retrieving customer', error: err.message });
  }
});

// POST /api/customers - create customer
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, company, address, tax_id, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    const result = await dbQuery(
      `INSERT INTO customers (name, email, phone, company, address, tax_id, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, email, phone, company, address, tax_id, notes, req.user.id]
    );
    res.status(201).json({ success: true, message: 'Customer created successfully', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error creating customer', error: err.message });
  }
});

// PUT /api/customers/:id - update customer
router.put('/:id', async (req, res) => {
  try {
    const { name, email, phone, company, address, tax_id, notes, is_active } = req.body;
    const result = await dbQuery(
      `UPDATE customers SET
         name = COALESCE($1, name), email = COALESCE($2, email),
         phone = COALESCE($3, phone), company = COALESCE($4, company),
         address = COALESCE($5, address), tax_id = COALESCE($6, tax_id),
         notes = COALESCE($7, notes), is_active = COALESCE($8, is_active),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 RETURNING *`,
      [name, email, phone, company, address, tax_id, notes, is_active, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, message: 'Customer updated successfully', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating customer', error: err.message });
  }
});

// DELETE /api/customers/:id - soft-delete customer
router.delete('/:id', authorize('admin', 'manager'), async (req, res) => {
  try {
    const result = await dbQuery(
      `UPDATE customers SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, message: 'Customer deactivated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error deleting customer', error: err.message });
  }
});

module.exports = router;
