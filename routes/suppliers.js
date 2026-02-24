// Suppliers Management for MC03 Module

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// Get all suppliers
router.get('/', authenticate, async (req, res) => {
  try {
    const { 
      search, 
      status,
      page = 1, 
      limit = 20,
      sort_by = 'name',
      sort_order = 'ASC'
    } = req.query;

    let query = `
      SELECT 
        s.*,
        COUNT(*) OVER() as total_count
      FROM suppliers s
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (search) {
      query += ` AND (s.name ILIKE $${paramCount} OR s.email ILIKE $${paramCount} OR s.phone ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    if (status) {
      query += ` AND s.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ` ORDER BY s.${sort_by} ${sort_order}`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await pool.query(query, params);

    res.json({
      suppliers: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows[0]?.total_count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get supplier by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM suppliers WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Get supplier statistics
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_purchases,
        SUM(total_amount) as total_amount,
        AVG(total_amount) as average_order
      FROM purchases
      WHERE supplier_id = $1 AND status != 'cancelled'
    `, [id]);

    res.json({
      ...result.rows[0],
      statistics: statsResult.rows[0]
    });
  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create supplier
router.post('/', authenticate, authorize(['admin', 'manager', 'purchasing']), async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      address,
      city,
      country,
      tax_id,
      payment_terms,
      credit_limit,
      notes
    } = req.body;

    // Validation
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Check if email already exists
    const checkResult = await pool.query(
      'SELECT id FROM suppliers WHERE email = $1',
      [email]
    );

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ error: 'Supplier with this email already exists' });
    }

    const result = await pool.query(`
      INSERT INTO suppliers (
        name, email, phone, address, city, country,
        tax_id, payment_terms, credit_limit, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      name, email, phone, address, city, country,
      tax_id, payment_terms, credit_limit || 0, notes
    ]);

    res.status(201).json({
      message: 'Supplier created successfully',
      supplier: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update supplier
router.put('/:id', authenticate, authorize(['admin', 'manager', 'purchasing']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      phone,
      address,
      city,
      country,
      tax_id,
      payment_terms,
      credit_limit,
      notes,
      status
    } = req.body;

    // Check if supplier exists
    const checkResult = await pool.query(
      'SELECT id FROM suppliers WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Check if email is already used by another supplier
    if (email) {
      const emailCheck = await pool.query(
        'SELECT id FROM suppliers WHERE email = $1 AND id != $2',
        [email, id]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email already in use' });
      }
    }

    const result = await pool.query(`
      UPDATE suppliers SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        address = COALESCE($4, address),
        city = COALESCE($5, city),
        country = COALESCE($6, country),
        tax_id = COALESCE($7, tax_id),
        payment_terms = COALESCE($8, payment_terms),
        credit_limit = COALESCE($9, credit_limit),
        notes = COALESCE($10, notes),
        status = COALESCE($11, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING *
    `, [
      name, email, phone, address, city, country,
      tax_id, payment_terms, credit_limit, notes, status, id
    ]);

    res.json({
      message: 'Supplier updated successfully',
      supplier: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete supplier
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if supplier has purchases
    const purchasesCheck = await pool.query(
      'SELECT COUNT(*) as count FROM purchases WHERE supplier_id = $1',
      [id]
    );

    if (parseInt(purchasesCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete supplier with existing purchases. Set status to inactive instead.' 
      });
    }

    const result = await pool.query(
      'DELETE FROM suppliers WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get supplier purchase history
router.get('/:id/purchases', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await pool.query(`
      SELECT 
        p.*,
        COUNT(*) OVER() as total_count
      FROM purchases p
      WHERE p.supplier_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `, [id, limit, (page - 1) * limit]);

    res.json({
      purchases: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows[0]?.total_count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching supplier purchases:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;