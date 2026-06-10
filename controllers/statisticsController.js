/**
 * Statistics Controller — MC09
 *
 * NOTE: SQL assumes the following tables from database/schema.sql:
 *   sales_orders (id, total_amount, order_date, status, customer_id)
 *   invoices (id, total_amount, payment_status, issue_date)
 *   products (id, name, sku, quantity_in_stock, min_stock_level, selling_price)
 *   customers (id, name, is_active)
 * Adjust column names if schema differs.
 */

const { query } = require('../config/database');
const logger = require('../config/logger');

/**
 * GET /api/statistics/dashboard
 */
exports.getDashboardOverview = async (req, res, next) => {
  try {
    const [salesRow, invoiceRow, productRow, customerRow] = await Promise.all([
      query(`SELECT COALESCE(SUM(total_amount),0) AS total_revenue,
                    COUNT(*) AS total_orders
             FROM sales_orders
             WHERE order_date >= DATE_TRUNC('month', CURRENT_DATE)`),
      query(`SELECT COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE payment_status = 'unpaid') AS unpaid
             FROM invoices`),
      query(`SELECT COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE quantity_in_stock <= min_stock_level) AS low_stock
             FROM products WHERE is_active = true`),
      query(`SELECT COUNT(*) AS total FROM customers WHERE is_active = true`),
    ]);

    res.json({
      success: true,
      data: {
        monthly_revenue:  parseFloat(salesRow.rows[0].total_revenue),
        monthly_orders:   parseInt(salesRow.rows[0].total_orders),
        total_invoices:   parseInt(invoiceRow.rows[0].total),
        unpaid_invoices:  parseInt(invoiceRow.rows[0].unpaid),
        total_products:   parseInt(productRow.rows[0].total),
        low_stock_count:  parseInt(productRow.rows[0].low_stock),
        active_customers: parseInt(customerRow.rows[0].total),
      }
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/statistics/sales
 */
exports.getSalesStatistics = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const result = await query(
      `SELECT
         DATE_TRUNC('month', order_date) AS month,
         COUNT(*) AS order_count,
         SUM(total_amount) AS revenue,
         AVG(total_amount) AS avg_order_value
       FROM sales_orders
       WHERE ($1::date IS NULL OR order_date >= $1)
         AND ($2::date IS NULL OR order_date <= $2)
       GROUP BY month
       ORDER BY month DESC`,
      [start_date || null, end_date || null]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

/**
 * GET /api/statistics/invoices
 */
exports.getInvoiceStatistics = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const result = await query(
      `SELECT
         payment_status,
         COUNT(*) AS count,
         COALESCE(SUM(total_amount), 0) AS total_amount
       FROM invoices
       WHERE ($1::date IS NULL OR issue_date >= $1)
         AND ($2::date IS NULL OR issue_date <= $2)
       GROUP BY payment_status
       ORDER BY payment_status`,
      [start_date || null, end_date || null]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

/**
 * GET /api/statistics/products
 */
exports.getProductStatistics = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         COUNT(*) AS total_products,
         COUNT(*) FILTER (WHERE is_active = true) AS active_products,
         COUNT(*) FILTER (WHERE quantity_in_stock <= min_stock_level) AS low_stock,
         COALESCE(SUM(quantity_in_stock * selling_price), 0) AS stock_value
       FROM products`
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

/**
 * GET /api/statistics/customers
 */
exports.getCustomerStatistics = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         COUNT(*) AS total_customers,
         COUNT(*) FILTER (WHERE is_active = true) AS active_customers,
         COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) AS new_this_month
       FROM customers`
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};
