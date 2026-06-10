/**
 * Invoices Controller
 * NOTE: Column names assumed from database/schema.sql. If the invoices table
 * uses different column names, update the SQL below to match.
 * Assumed columns: id, invoice_number, customer_id, sales_order_id,
 *   issue_date, due_date, total_amount, tax_amount, payment_status,
 *   notes, created_by, created_at, updated_at
 */

const { query } = require('../config/database');
const logger = require('../config/logger');

/**
 * GET /api/invoices
 */
exports.getInvoices = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, payment_status, customer_id } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT i.*, c.name AS customer_name, COUNT(*) OVER() AS total_count
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (search) {
      sql += ` AND (i.invoice_number ILIKE $${idx} OR c.name ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }
    if (payment_status) {
      sql += ` AND i.payment_status = $${idx++}`;
      params.push(payment_status);
    }
    if (customer_id) {
      sql += ` AND i.customer_id = $${idx++}`;
      params.push(customer_id);
    }

    sql += ` ORDER BY i.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

    res.json({
      success: true,
      data: result.rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/invoices/:id
 */
exports.getInvoiceById = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT i.*, c.name AS customer_name
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       WHERE i.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/invoices
 */
exports.createInvoice = async (req, res, next) => {
  try {
    const { customer_id, sales_order_id, issue_date, due_date, total_amount, tax_amount, notes } = req.body;
    if (!customer_id || !total_amount) {
      return res.status(400).json({ success: false, message: 'customer_id and total_amount are required' });
    }

    // Auto-generate invoice number: INV-YYYYMMDD-XXXXXX
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.floor(100000 + Math.random() * 900000);
    const invoiceNumber = `INV-${datePart}-${randPart}`;

    const result = await query(
      `INSERT INTO invoices
         (invoice_number, customer_id, sales_order_id, issue_date, due_date,
          total_amount, tax_amount, payment_status, notes, created_by)
       VALUES ($1,$2,$3,COALESCE($4,CURRENT_DATE),$5,$6,COALESCE($7,0),'unpaid',$8,$9)
       RETURNING *`,
      [invoiceNumber, customer_id, sales_order_id, issue_date, due_date,
       total_amount, tax_amount, notes, req.user.id]
    );

    logger.info('Invoice created', { invoiceId: result.rows[0].id, createdBy: req.user.id });
    res.status(201).json({ success: true, message: 'Invoice created successfully', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/invoices/:id
 */
exports.updateInvoice = async (req, res, next) => {
  try {
    const { due_date, total_amount, tax_amount, notes } = req.body;
    const result = await query(
      `UPDATE invoices
       SET due_date     = COALESCE($1, due_date),
           total_amount = COALESCE($2, total_amount),
           tax_amount   = COALESCE($3, tax_amount),
           notes        = COALESCE($4, notes),
           updated_at   = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [due_date, total_amount, tax_amount, notes, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    res.json({ success: true, message: 'Invoice updated successfully', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/invoices/:id
 */
exports.deleteInvoice = async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM invoices WHERE id = $1 RETURNING id, invoice_number',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    logger.info('Invoice deleted', { invoiceId: req.params.id, deletedBy: req.user.id });
    res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/invoices/:id/payment
 */
exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const VALID_STATUSES = ['unpaid', 'partial', 'paid', 'overdue', 'cancelled'];
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`
      });
    }

    const result = await query(
      `UPDATE invoices
       SET payment_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    logger.info('Invoice payment status updated', { invoiceId: req.params.id, status, by: req.user.id });
    res.json({ success: true, message: 'Payment status updated', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};
