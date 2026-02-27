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
      query += \` AND t.transaction_type = $\${paramCount}\`;
      params.push(type.toUpperCase());
      paramCount++;
    }

    if (category) {
      query += \` AND (t.category = $\${paramCount} OR t.subcategory = $\${paramCount})\`;
      params.push(category);
      paramCount++;
    }

    if (start_date) {
      query += \` AND t.transaction_date >= $\${paramCount}\`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += \` AND t.transaction_date <= $\${paramCount}\`;
      params.push(end_date);
      paramCount++;
    }

    if (search) {
      query += \` AND (t.description ILIKE $\${paramCount} OR t.reference_number ILIKE $\${paramCount} OR t.transaction_number ILIKE $\${paramCount})\`;
      params.push(\`%\${search}%\`);
      paramCount++;
    }

    const allowedSortFields = ['transaction_date', 'amount', 'transaction_number', 'created_at'];
    const finalSortBy = allowedSortFields.includes(sort_by) ? sort_by : 'transaction_date';
    const finalSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += \` ORDER BY t.\${finalSortBy} \${finalSortOrder}\`;
    query += \` LIMIT $\${paramCount} OFFSET $\${paramCount + 1}\`;
    params.push(limit, (page - 1) * limit);

    const result = await pool.query(query, params);

    const balanceResult = await pool.query(\`
      SELECT 
        SUM(CASE WHEN transaction_type = 'INCOME' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN transaction_type = 'EXPENSE' THEN amount ELSE 0 END) as total_expense,
        SUM(CASE WHEN transaction_type = 'INCOME' THEN amount ELSE -amount END) as balance
      FROM financial_transactions
    \`);

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
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get transaction by ID
router.get('/transactions/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(\`
      SELECT 
        t.*,
        u.username as created_by_username
      FROM financial_transactions t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = $1
    \`, [id]);
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

    const result = await pool.query(\`
      INSERT INTO financial_transactions (
        transaction_number, transaction_type, amount, category, subcategory, 
        transaction_date, payment_method, reference_number, description, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    \`, [
      transaction_number || \`TRX-\${Date.now()}\`, 
      transaction_type.toUpperCase(), 
      amount, category, subcategory, 
      transaction_date, payment_method, reference_number, description, notes, req.user.userId
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
    let query = \`
      SELECT 
        v.*,
        u.username as created_by_username,
        COUNT(*) OVER() as total_count
      FROM vouchers v
      LEFT JOIN users u ON v.created_by = u.id
      WHERE 1=1
    \`;
    const params = [];
    let paramCount = 1;

    if (status) {
      query += \` AND v.status = $\${paramCount}\`;
      params.push(status);
      paramCount++;
    }

    query += ' ORDER BY v.created_at DESC';
    query += \` LIMIT $\${paramCount} OFFSET $\${paramCount + 1}\`;
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
      voucher_type,
      amount,
      voucher_date,
      party_name,
      description,
      notes
    } = req.body;

    if (!amount || !voucher_date || !party_name || !voucher_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(\`
      INSERT INTO vouchers (
        voucher_number, voucher_type, amount, voucher_date, party_name,
        description, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    \`, [
      voucher_number || \`VCH-\${Date.now()}\`, 
      voucher_type.toUpperCase(), 
      amount, voucher_date, party_name, 
      description, notes, req.user.userId
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

// ============ PAYMENT TERMS MODELS (N75) ============

router.get('/payment-terms', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payment_schedules WHERE is_template = true ORDER BY template_name ASC'
    );
    res.json({ payment_terms: result.rows });
  } catch (error) {
    console.error('Error fetching payment terms:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
