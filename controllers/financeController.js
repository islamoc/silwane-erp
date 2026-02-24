const db = require('../database/connection');

// G26 - Treasury Management Base
exports.getTransactions = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      type, 
      category, 
      start_date, 
      end_date,
      status 
    } = req.query;
    
    const offset = (page - 1) * limit;

    let query = `
      SELECT ft.*, 
        c.name as customer_name,
        s.name as supplier_name,
        u.username as created_by_username
      FROM financial_transactions ft
      LEFT JOIN customers c ON ft.customer_id = c.id
      LEFT JOIN suppliers s ON ft.supplier_id = s.id
      LEFT JOIN users u ON ft.created_by = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND ft.transaction_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (category) {
      query += ` AND ft.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (start_date) {
      query += ` AND ft.transaction_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND ft.transaction_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    if (status) {
      query += ` AND ft.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY ft.transaction_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// G30 - Categorization and Remarks
exports.updateTransactionCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, subcategory, remarks, tags } = req.body;

    const query = `
      UPDATE financial_transactions SET
        category = $1,
        subcategory = $2,
        remarks = $3,
        tags = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `;

    const result = await db.query(query, [
      category, subcategory, remarks, tags, id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating transaction category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// G08 - Voucher Settlement
exports.getVouchers = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT v.*, 
        c.name as customer_name,
        s.name as supplier_name,
        u.username as created_by_username
      FROM vouchers v
      LEFT JOIN customers c ON v.customer_id = c.id
      LEFT JOIN suppliers s ON v.supplier_id = s.id
      LEFT JOIN users u ON v.created_by = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND v.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (type) {
      query += ` AND v.voucher_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    query += ` ORDER BY v.voucher_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching vouchers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.settleVoucher = async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { settlement_amount, settlement_date, payment_method, notes } = req.body;

    // Update voucher status
    const voucherQuery = `
      UPDATE vouchers SET
        status = 'settled',
        settlement_date = $1,
        settlement_amount = $2,
        payment_method = $3,
        notes = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `;

    const voucherResult = await client.query(voucherQuery, [
      settlement_date || new Date(),
      settlement_amount,
      payment_method,
      notes,
      id
    ]);

    if (voucherResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Voucher not found' });
    }

    // Create financial transaction
    const transactionQuery = `
      INSERT INTO financial_transactions (
        voucher_id, amount, transaction_type, transaction_date,
        payment_method, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    await client.query(transactionQuery, [
      id,
      settlement_amount,
      voucherResult.rows[0].voucher_type === 'payment' ? 'expense' : 'income',
      settlement_date || new Date(),
      payment_method,
      notes,
      req.user.id
    ]);

    await client.query('COMMIT');
    res.json({ success: true, data: voucherResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error settling voucher:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// N75 - Payment Schedule Models
exports.getPaymentScheduleModels = async (req, res) => {
  try {
    const query = `
      SELECT * FROM payment_schedule_models
      ORDER BY name
    `;

    const result = await db.query(query);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching payment schedule models:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createPaymentScheduleModel = async (req, res) => {
  try {
    const { name, description, terms, is_default } = req.body;

    const query = `
      INSERT INTO payment_schedule_models (
        name, description, terms, is_default, created_by
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await db.query(query, [
      name, description, JSON.stringify(terms), is_default || false, req.user.id
    ]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating payment schedule model:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.applyPaymentSchedule = async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    const { order_id, model_id, start_date, total_amount } = req.body;

    // Get the payment schedule model
    const modelQuery = 'SELECT * FROM payment_schedule_models WHERE id = $1';
    const modelResult = await client.query(modelQuery, [model_id]);

    if (modelResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Payment schedule model not found' });
    }

    const model = modelResult.rows[0];
    const terms = JSON.parse(model.terms);

    // Create payment schedules based on the model
    const schedules = [];
    let startDate = new Date(start_date);

    for (const term of terms) {
      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + term.days_offset);

      const amount = (total_amount * term.percentage) / 100;

      const scheduleQuery = `
        INSERT INTO payment_schedules (
          order_id, due_date, amount, percentage, description, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const scheduleResult = await client.query(scheduleQuery, [
        order_id,
        dueDate,
        amount,
        term.percentage,
        term.description,
        'pending'
      ]);

      schedules.push(scheduleResult.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: schedules });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error applying payment schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// Cash Flow Report
exports.getCashFlowReport = async (req, res) => {
  try {
    const { start_date, end_date, group_by = 'day' } = req.query;

    const query = `
      WITH cash_flow AS (
        SELECT 
          DATE_TRUNC($1, transaction_date) as period,
          SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END) as income,
          SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END) as expense,
          SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE -amount END) as net_flow
        FROM financial_transactions
        WHERE transaction_date >= $2 AND transaction_date <= $3
        GROUP BY period
        ORDER BY period
      )
      SELECT 
        period,
        income,
        expense,
        net_flow,
        SUM(net_flow) OVER (ORDER BY period) as cumulative_balance
      FROM cash_flow
    `;

    const result = await db.query(query, [
      group_by,
      start_date || new Date(new Date().getFullYear(), 0, 1),
      end_date || new Date()
    ]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error generating cash flow report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = exports;