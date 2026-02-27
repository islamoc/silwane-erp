// MC05 - Module Trésorerie et Finances (Treasury and Finance Module)
// G26 - Gestion de trésorerie - Base (Treasury Management)
// G30 - Catégorisation et remarques (Categorization and Notes)
// G08 - Règlement des bons (Payment/Settlement of Vouchers)
// N75 - Modèles d'échéances (Payment Terms Models)

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// ============ TREASURY MANAGEMENT (G26) ============

// Get all transactions
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const { 
      type, 
      category, 
      start_date, 
      end_date, 
      search,
      page = 1, 
      limit = 20,
      sort_by = 'transaction_date',
      sort_order = 'DESC'
    } = req.query;

    let query = `
      SELECT 
        t.*,
        t.category as category_name,
        u.username as created_by_username,
        COUNT(*) OVER() as total_count
      FROM financial_transactions t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (type) {
      query += ` AND t.transaction_type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    if (category) {
      query += ` AND t.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    if (start_date) {
      query += ` AND t.transaction_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND t.transaction_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    if (search) {
      query += ` AND (t.transaction_number ILIKE $${paramCount} OR t.description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY t.${sort_by} ${sort_order}`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await pool.query(query, params);

    res.json({
      transactions: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows[0]?.total_count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Create new transaction
router.post('/transactions', authenticate, authorize(['admin', 'manager', 'finance']), async (req, res) => {
  try {
    const {
      transaction_number,
      transaction_type,
      amount,
      category,
      subcategory,
      transaction_date,
      payment_method,
      reference_number,
      description,
      notes
    } = req.body;

    if (!transaction_type || !amount || !transaction_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(`
      INSERT INTO financial_transactions (
        transaction_number, transaction_type, amount, category, subcategory,
        transaction_date, payment_method, reference_number, description, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      transaction_number || `TRX-${Date.now()}`,
      transaction_type.toUpperCase(),
      amount, category, subcategory,
      transaction_date, payment_method, reference_number, description, notes, req.user.id
    ]);

    res.status(201).json({
      message: 'Transaction created successfully',
      transaction: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ============ PAYMENT VOUCHERS (G08) ============

// Get all vouchers
router.get('/vouchers', authenticate, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let query = `
      SELECT 
        v.*,
        u.username as created_by_username,
        COUNT(*) OVER() as total_count
      FROM vouchers v
      LEFT JOIN users u ON v.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND v.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ' ORDER BY v.created_at DESC';
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await pool.query(query, params);

    res.json({
      vouchers: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows[0]?.total_count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching vouchers:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Create new voucher
router.post('/vouchers', authenticate, authorize(['admin', 'manager', 'finance']), async (req, res) => {
  try {
    const {
      voucher_number,
      voucher_type,
      amount,
      voucher_date,
      party_type,
      party_id,
      party_name,
      payment_method,
      description,
      notes
    } = req.body;

    if (!voucher_type || !amount || !voucher_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(`
      INSERT INTO vouchers (
        voucher_number, voucher_type, amount, voucher_date,
        party_type, party_id, party_name, payment_method,
        description, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      voucher_number || `VOU-${Date.now()}`,
      voucher_type.toUpperCase(),
      amount, voucher_date,
      party_type, party_id, party_name, payment_method,
      description, notes, req.user.id
    ]);

    res.status(201).json({
      message: 'Voucher created successfully',
      voucher: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating voucher:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router;
