/**
 * Finance Controller — MC05
 * Implements the routes that frontend/src/services/api.js expects:
 *   GET  /finance/transactions
 *   GET  /finance/transactions/:id
 *   POST /finance/transactions
 *   PUT  /finance/transactions/:id
 *   DELETE /finance/transactions/:id
 *   POST /finance/transactions/:id/reconcile
 *   GET  /finance/cashflow
 *   GET  /finance/accounts
 *   POST /finance/accounts
 *   PUT  /finance/accounts/:id
 *   GET  /finance/summary
 *
 * NOTE: SQL uses table names financial_transactions and accounts.
 * Assumed columns — verify against database/schema.sql:
 *   financial_transactions: id, type, amount, description, account_id,
 *     transaction_date, is_reconciled, reconciled_at, created_by, created_at
 *   accounts: id, name, type, balance, currency, is_active, created_at
 */

const { query } = require('../config/database');
const logger = require('../config/logger');

// ─── Transactions ────────────────────────────────────────────────────────────

exports.getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, account_id, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;
    let sql = `SELECT ft.*, a.name AS account_name, COUNT(*) OVER() AS total_count
               FROM financial_transactions ft
               LEFT JOIN accounts a ON ft.account_id = a.id
               WHERE 1=1`;
    const params = [];
    let idx = 1;
    if (type)       { sql += ` AND ft.type = $${idx++}`;           params.push(type); }
    if (account_id) { sql += ` AND ft.account_id = $${idx++}`;     params.push(account_id); }
    if (start_date) { sql += ` AND ft.transaction_date >= $${idx++}`; params.push(start_date); }
    if (end_date)   { sql += ` AND ft.transaction_date <= $${idx++}`; params.push(end_date); }
    sql += ` ORDER BY ft.transaction_date DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);
    const result = await query(sql, params);
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
    res.json({
      success: true, data: result.rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (err) { next(err); }
};

exports.getTransactionById = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT ft.*, a.name AS account_name
       FROM financial_transactions ft LEFT JOIN accounts a ON ft.account_id = a.id
       WHERE ft.id = $1`, [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Transaction not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.createTransaction = async (req, res, next) => {
  try {
    const { type, amount, description, account_id, transaction_date } = req.body;
    if (!type || !amount || !account_id) {
      return res.status(400).json({ success: false, message: 'type, amount and account_id are required' });
    }
    const result = await query(
      `INSERT INTO financial_transactions
         (type, amount, description, account_id, transaction_date, created_by)
       VALUES ($1,$2,$3,$4,COALESCE($5,CURRENT_DATE),$6) RETURNING *`,
      [type, amount, description, account_id, transaction_date, req.user.id]
    );
    logger.info('Transaction created', { id: result.rows[0].id, by: req.user.id });
    res.status(201).json({ success: true, message: 'Transaction created', data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.updateTransaction = async (req, res, next) => {
  try {
    const { type, amount, description, account_id, transaction_date } = req.body;
    const result = await query(
      `UPDATE financial_transactions SET
         type             = COALESCE($1, type),
         amount           = COALESCE($2, amount),
         description      = COALESCE($3, description),
         account_id       = COALESCE($4, account_id),
         transaction_date = COALESCE($5, transaction_date)
       WHERE id = $6 RETURNING *`,
      [type, amount, description, account_id, transaction_date, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Transaction not found' });
    res.json({ success: true, message: 'Transaction updated', data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.deleteTransaction = async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM financial_transactions WHERE id = $1 RETURNING id', [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Transaction not found' });
    logger.info('Transaction deleted', { id: req.params.id, by: req.user.id });
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (err) { next(err); }
};

exports.reconcileTransaction = async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE financial_transactions
       SET is_reconciled = true, reconciled_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Transaction not found' });
    logger.info('Transaction reconciled', { id: req.params.id, by: req.user.id });
    res.json({ success: true, message: 'Transaction reconciled', data: result.rows[0] });
  } catch (err) { next(err); }
};

// ─── Cash Flow ───────────────────────────────────────────────────────────────

exports.getCashFlow = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const result = await query(
      `SELECT
         DATE_TRUNC('month', transaction_date) AS month,
         SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS income,
         SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense,
         SUM(CASE WHEN type = 'income'  THEN amount ELSE -amount END) AS net
       FROM financial_transactions
       WHERE ($1::date IS NULL OR transaction_date >= $1)
         AND ($2::date IS NULL OR transaction_date <= $2)
       GROUP BY month
       ORDER BY month DESC`,
      [start_date || null, end_date || null]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// ─── Accounts ────────────────────────────────────────────────────────────────

exports.getAccounts = async (req, res, next) => {
  try {
    const { type, is_active } = req.query;
    let sql = 'SELECT * FROM accounts WHERE 1=1';
    const params = [];
    let idx = 1;
    if (type)      { sql += ` AND type = $${idx++}`;      params.push(type); }
    if (is_active) { sql += ` AND is_active = $${idx++}`; params.push(is_active === 'true'); }
    sql += ' ORDER BY name ASC';
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

exports.createAccount = async (req, res, next) => {
  try {
    const { name, type, balance = 0, currency = 'DZD' } = req.body;
    if (!name || !type) {
      return res.status(400).json({ success: false, message: 'name and type are required' });
    }
    const result = await query(
      `INSERT INTO accounts (name, type, balance, currency) VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, type, balance, currency]
    );
    logger.info('Account created', { id: result.rows[0].id, by: req.user.id });
    res.status(201).json({ success: true, message: 'Account created', data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.updateAccount = async (req, res, next) => {
  try {
    const { name, type, balance, currency, is_active } = req.body;
    const result = await query(
      `UPDATE accounts SET
         name      = COALESCE($1, name),
         type      = COALESCE($2, type),
         balance   = COALESCE($3, balance),
         currency  = COALESCE($4, currency),
         is_active = COALESCE($5, is_active)
       WHERE id = $6 RETURNING *`,
      [name, type, balance, currency, is_active, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Account not found' });
    res.json({ success: true, message: 'Account updated', data: result.rows[0] });
  } catch (err) { next(err); }
};

// ─── Summary ─────────────────────────────────────────────────────────────────

exports.getFinancialSummary = async (req, res, next) => {
  try {
    const [income, expenses, accounts] = await Promise.all([
      query(`SELECT COALESCE(SUM(amount),0) AS total FROM financial_transactions WHERE type='income'`),
      query(`SELECT COALESCE(SUM(amount),0) AS total FROM financial_transactions WHERE type='expense'`),
      query(`SELECT COALESCE(SUM(balance),0) AS total FROM accounts WHERE is_active = true`),
    ]);
    res.json({
      success: true,
      data: {
        total_income:   parseFloat(income.rows[0].total),
        total_expenses: parseFloat(expenses.rows[0].total),
        net_position:   parseFloat(income.rows[0].total) - parseFloat(expenses.rows[0].total),
        account_balance: parseFloat(accounts.rows[0].total),
      }
    });
  } catch (err) { next(err); }
};

// ─── Legacy health-check (kept for backward compat) ──────────────────────────
exports.getStatus = (req, res) => {
  res.json({ success: true, message: 'Finance module operational', module: 'MC05' });
};
