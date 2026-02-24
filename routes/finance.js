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
      category_id,
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
        c.name as category_name,
        c.type as category_type,
        u.username as created_by_username,
        COUNT(*) OVER() as total_count
      FROM financial_transactions t
      LEFT JOIN financial_categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (type) {
      query += ` AND t.type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    if (category_id) {
      query += ` AND t.category_id = $${paramCount}`;
      params.push(category_id);
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
      query += ` AND (t.description ILIKE $${paramCount} OR t.reference_number ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY t.${sort_by} ${sort_order}`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await pool.query(query, params);

    // Calculate balance
    const balanceResult = await pool.query(`
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense,
        SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as balance
      FROM financial_transactions
    `);

    res.json({
      transactions: result.rows,
      balance: balanceResult.rows[0],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows[0]?.total_count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get transaction by ID
router.get('/transactions/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        t.*,
        c.name as category_name,
        u.username as created_by_username
      FROM financial_transactions t
      LEFT JOIN financial_categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create transaction
router.post('/transactions', authenticate, authorize(['admin', 'manager', 'finance']), async (req, res) => {
  try {
    const {
      type,
      amount,
      category_id,
      transaction_date,
      payment_method,
      reference_number,
      description,
      notes
    } = req.body;

    // Validation
    if (!type || !amount || !transaction_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: 'Invalid transaction type' });
    }

    const result = await pool.query(`
      INSERT INTO financial_transactions (
        type, amount, category_id, transaction_date,
        payment_method, reference_number, description, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      type, amount, category_id, transaction_date,
      payment_method, reference_number, description, notes, req.user.userId
    ]);

    res.status(201).json({
      message: 'Transaction created successfully',
      transaction: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update transaction
router.put('/transactions/:id', authenticate, authorize(['admin', 'manager', 'finance']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      type,
      amount,
      category_id,
      transaction_date,
      payment_method,
      reference_number,
      description,
      notes
    } = req.body;

    const result = await pool.query(`
      UPDATE financial_transactions SET
        type = COALESCE($1, type),
        amount = COALESCE($2, amount),
        category_id = COALESCE($3, category_id),
        transaction_date = COALESCE($4, transaction_date),
        payment_method = COALESCE($5, payment_method),
        reference_number = COALESCE($6, reference_number),
        description = COALESCE($7, description),
        notes = COALESCE($8, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [type, amount, category_id, transaction_date, payment_method, reference_number, description, notes, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      message: 'Transaction updated successfully',
      transaction: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete transaction
router.delete('/transactions/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM financial_transactions WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ FINANCIAL CATEGORIES (G30) ============

// Get all categories
router.get('/categories', authenticate, async (req, res) => {
  try {
    const { type } = req.query;

    let query = 'SELECT * FROM financial_categories WHERE 1=1';
    const params = [];

    if (type) {
      query += ' AND type = $1';
      params.push(type);
    }

    query += ' ORDER BY name ASC';

    const result = await pool.query(query, params);

    res.json({ categories: result.rows });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create category
router.post('/categories', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { name, type, description } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: 'Invalid category type' });
    }

    const result = await pool.query(`
      INSERT INTO financial_categories (name, type, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [name, type, description]);

    res.status(201).json({
      message: 'Category created successfully',
      category: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update category
router.put('/categories/:id', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, description } = req.body;

    const result = await pool.query(`
      UPDATE financial_categories SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        description = COALESCE($3, description),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [name, type, description, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({
      message: 'Category updated successfully',
      category: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete category
router.delete('/categories/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category is used
    const usageCheck = await pool.query(
      'SELECT COUNT(*) as count FROM financial_transactions WHERE category_id = $1',
      [id]
    );

    if (parseInt(usageCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category with existing transactions' 
      });
    }

    const result = await pool.query(
      'DELETE FROM financial_categories WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Internal server error' });
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
      FROM payment_vouchers v
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create voucher
router.post('/vouchers', authenticate, authorize(['admin', 'manager', 'finance']), async (req, res) => {
  try {
    const {
      voucher_number,
      amount,
      payment_date,
      beneficiary,
      description,
      notes
    } = req.body;

    if (!amount || !payment_date || !beneficiary) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(`
      INSERT INTO payment_vouchers (
        voucher_number, amount, payment_date, beneficiary,
        description, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [voucher_number, amount, payment_date, beneficiary, description, notes, req.user.userId]);

    res.status(201).json({
      message: 'Voucher created successfully',
      voucher: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating voucher:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve voucher
router.post('/vouchers/:id/approve', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE payment_vouchers
      SET status = 'approved', approved_at = CURRENT_TIMESTAMP, approved_by = $1
      WHERE id = $2 AND status = 'pending'
      RETURNING *
    `, [req.user.userId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Voucher not found or already processed' });
    }

    res.json({
      message: 'Voucher approved successfully',
      voucher: result.rows[0]
    });
  } catch (error) {
    console.error('Error approving voucher:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Pay voucher
router.post('/vouchers/:id/pay', authenticate, authorize(['admin', 'manager', 'finance']), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE payment_vouchers
      SET status = 'paid', paid_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'approved'
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Voucher not found or not approved' });
    }

    res.json({
      message: 'Voucher marked as paid successfully',
      voucher: result.rows[0]
    });
  } catch (error) {
    console.error('Error paying voucher:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ PAYMENT TERMS MODELS (N75) ============

// Get all payment terms
router.get('/payment-terms', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payment_terms ORDER BY name ASC'
    );

    res.json({ payment_terms: result.rows });
  } catch (error) {
    console.error('Error fetching payment terms:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create payment term
router.post('/payment-terms', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { name, days, description } = req.body;

    if (!name || days === undefined) {
      return res.status(400).json({ error: 'Name and days are required' });
    }

    const result = await pool.query(`
      INSERT INTO payment_terms (name, days, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [name, days, description]);

    res.status(201).json({
      message: 'Payment term created successfully',
      payment_term: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating payment term:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update payment term
router.put('/payment-terms/:id', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, days, description } = req.body;

    const result = await pool.query(`
      UPDATE payment_terms SET
        name = COALESCE($1, name),
        days = COALESCE($2, days),
        description = COALESCE($3, description),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [name, days, description, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment term not found' });
    }

    res.json({
      message: 'Payment term updated successfully',
      payment_term: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating payment term:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete payment term
router.delete('/payment-terms/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM payment_terms WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment term not found' });
    }

    res.json({ message: 'Payment term deleted successfully' });
  } catch (error) {
    console.error('Error deleting payment term:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;