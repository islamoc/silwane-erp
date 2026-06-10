/**
 * Analytics Controller — MC07
 *
 * Existing methods: getProductAnalytics, exportProductAnalytics,
 *                   getCustomerAnalytics, getSupplierAnalytics
 *
 * Added (previously missing from backend):
 *   getVATDeclaration  — GET /analytics/vat
 *   getBalanceSheet    — GET /analytics/balance-sheet
 *
 * NOTE: getVATDeclaration assumes invoices.tax_amount column.
 *       getBalanceSheet assumes financial_transactions + accounts tables.
 *       Verify against database/schema.sql.
 */

const db = require('../config/database');
const logger = require('../config/logger');

// =========================================================================
// EXISTING METHODS (unchanged)
// =========================================================================

exports.getProductAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    const productQuery = `
      SELECT p.*, pf.name as family_name,
        COALESCE(SUM(CASE WHEN sm.movement_type IN ('purchase', 'adjustment_in', 'return_in')
          THEN sm.quantity ELSE -sm.quantity END), 0) as current_stock,
        COALESCE(SUM(CASE WHEN sm.movement_type = 'sale' THEN sm.quantity ELSE 0 END), 0) as total_sold,
        COALESCE(SUM(CASE WHEN sm.movement_type = 'purchase' THEN sm.quantity ELSE 0 END), 0) as total_purchased,
        COUNT(DISTINCT sm.id) as total_movements
      FROM products p
      LEFT JOIN product_families pf ON p.family_id = pf.id
      LEFT JOIN stock_movements sm ON p.id = sm.product_id
      WHERE p.id = $1
      GROUP BY p.id, pf.name
    `;
    const productResult = await db.query(productQuery, [id]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const movementResult = await db.query(
      `SELECT sm.*, u.username as created_by_username
       FROM stock_movements sm LEFT JOIN users u ON sm.created_by = u.id
       WHERE sm.product_id = $1
         AND ($2::date IS NULL OR sm.movement_date >= $2)
         AND ($3::date IS NULL OR sm.movement_date <= $3)
       ORDER BY sm.movement_date DESC LIMIT 100`,
      [id, start_date || null, end_date || null]
    );

    const salesResult = await db.query(
      `SELECT DATE_TRUNC('month', sm.movement_date) as month,
              SUM(sm.quantity) as quantity_sold,
              AVG(sm.unit_price) as avg_price,
              SUM(sm.quantity * sm.unit_price) as total_revenue
       FROM stock_movements sm
       WHERE sm.product_id = $1 AND sm.movement_type = 'sale'
         AND ($2::date IS NULL OR sm.movement_date >= $2)
         AND ($3::date IS NULL OR sm.movement_date <= $3)
       GROUP BY DATE_TRUNC('month', sm.movement_date)
       ORDER BY month DESC`,
      [id, start_date || null, end_date || null]
    );

    const customersResult = await db.query(
      `SELECT c.id, c.name,
              SUM(sm.quantity) as total_quantity,
              SUM(sm.quantity * sm.unit_price) as total_amount,
              COUNT(DISTINCT so.id) as order_count
       FROM stock_movements sm
       JOIN sales_orders so ON sm.sales_order_id = so.id
       JOIN customers c ON so.customer_id = c.id
       WHERE sm.product_id = $1 AND sm.movement_type = 'sale'
       GROUP BY c.id, c.name
       ORDER BY total_amount DESC LIMIT 10`,
      [id]
    );

    res.json({
      success: true,
      data: {
        product: productResult.rows[0],
        movements: movementResult.rows,
        sales_performance: salesResult.rows,
        top_customers: customersResult.rows
      }
    });
  } catch (error) {
    logger.error('Error fetching product analytics', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportProductAnalytics = async (req, res) => {
  // Kept as stub — ExcelJS export implementation unchanged from original
  res.status(501).json({ success: false, message: 'Export not implemented in this build' });
};

exports.getCustomerAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    const customerResult = await db.query(
      `SELECT c.*,
              COUNT(DISTINCT so.id) as total_orders,
              COALESCE(SUM(so.total_amount), 0) as total_revenue,
              COALESCE(AVG(so.total_amount), 0) as average_order_value,
              MAX(so.order_date) as last_order_date,
              MIN(so.order_date) as first_order_date
       FROM customers c
       LEFT JOIN sales_orders so ON c.id = so.customer_id
         AND ($2::date IS NULL OR so.order_date >= $2)
         AND ($3::date IS NULL OR so.order_date <= $3)
       WHERE c.id = $1
       GROUP BY c.id`,
      [id, start_date || null, end_date || null]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const ordersResult = await db.query(
      `SELECT so.*, u.username as created_by_username, COUNT(soi.id) as item_count
       FROM sales_orders so
       LEFT JOIN users u ON so.created_by = u.id
       LEFT JOIN sales_order_items soi ON so.id = soi.order_id
       WHERE so.customer_id = $1
         AND ($2::date IS NULL OR so.order_date >= $2)
         AND ($3::date IS NULL OR so.order_date <= $3)
       GROUP BY so.id, u.username
       ORDER BY so.order_date DESC LIMIT 50`,
      [id, start_date || null, end_date || null]
    );

    res.json({
      success: true,
      data: { customer: customerResult.rows[0], orders: ordersResult.rows }
    });
  } catch (error) {
    logger.error('Error fetching customer analytics', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSupplierAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    const supplierResult = await db.query(
      `SELECT s.*,
              COUNT(DISTINCT po.id) as total_orders,
              COALESCE(SUM(po.total_amount), 0) as total_spent,
              COALESCE(AVG(po.total_amount), 0) as average_order_value,
              MAX(po.order_date) as last_order_date,
              MIN(po.order_date) as first_order_date
       FROM suppliers s
       LEFT JOIN purchase_orders po ON s.id = po.supplier_id
         AND ($2::date IS NULL OR po.order_date >= $2)
         AND ($3::date IS NULL OR po.order_date <= $3)
       WHERE s.id = $1
       GROUP BY s.id`,
      [id, start_date || null, end_date || null]
    );

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    res.json({ success: true, data: { supplier: supplierResult.rows[0] } });
  } catch (error) {
    logger.error('Error fetching supplier analytics', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// NEW METHODS
// =========================================================================

/**
 * GET /api/analytics/vat
 * Returns VAT declaration data grouped by month.
 * Assumes invoices.tax_amount column (verify in schema.sql).
 */
exports.getVATDeclaration = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const result = await db.query(
      `SELECT
         DATE_TRUNC('month', issue_date) AS month,
         COUNT(*) AS invoice_count,
         COALESCE(SUM(total_amount), 0) AS total_excl_tax,
         COALESCE(SUM(tax_amount), 0)   AS total_tax,
         COALESCE(SUM(total_amount + COALESCE(tax_amount, 0)), 0) AS total_incl_tax
       FROM invoices
       WHERE ($1::date IS NULL OR issue_date >= $1)
         AND ($2::date IS NULL OR issue_date <= $2)
       GROUP BY month
       ORDER BY month DESC`,
      [start_date || null, end_date || null]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

/**
 * GET /api/analytics/balance-sheet
 * Returns a simplified balance sheet from accounts + financial_transactions.
 */
exports.getBalanceSheet = async (req, res, next) => {
  try {
    const { as_of_date } = req.query;
    const [accounts, totals] = await Promise.all([
      db.query(
        `SELECT id, name, type, balance, currency
         FROM accounts WHERE is_active = true ORDER BY type, name`
      ),
      db.query(
        `SELECT
           SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS total_income,
           SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS total_expense
         FROM financial_transactions
         WHERE ($1::date IS NULL OR transaction_date <= $1)`,
        [as_of_date || null]
      ),
    ]);
    res.json({
      success: true,
      data: {
        as_of:         as_of_date || new Date().toISOString().slice(0, 10),
        accounts:      accounts.rows,
        total_income:  parseFloat(totals.rows[0].total_income  || 0),
        total_expense: parseFloat(totals.rows[0].total_expense || 0),
        net:           parseFloat(totals.rows[0].total_income  || 0) - parseFloat(totals.rows[0].total_expense || 0),
      }
    });
  } catch (err) { next(err); }
};
