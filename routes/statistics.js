// MC09 - Module Statistiques (Statistics Module)
// G38 - Situation globale des tiers (Global Third-Party Situation)
// G39 - Statistiques de base (Base Statistics)
// G40 - Etats statistiques (Statistical Reports)
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// ============ GLOBAL STATISTICS (G38) ============

// Get global business overview
router.get('/overview', authenticate, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let dateFilter = '';
    const params = [];
    let paramCount = 1;

    if (start_date && end_date) {
      dateFilter = ` AND order_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(start_date, end_date);
      paramCount += 2;
    }

    // Sales statistics
    const salesStats = await query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as average_order_value,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
      FROM sales_orders
      WHERE 1=1 ${dateFilter}
    `, params);

    // Purchase statistics
    const purchaseStats = await query(`
      SELECT 
        COUNT(*) as total_purchases,
        SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END) as received_purchases,
        SUM(total_amount) as total_spending,
        AVG(total_amount) as average_purchase_value,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_purchases
      FROM purchase_orders
      WHERE 1=1 ${dateFilter}
    `, params);

    // Inventory statistics
    const inventoryStats = await query(`
      SELECT 
        COUNT(*) as total_products,
        SUM(quantity_in_stock) as total_stock_units,
        SUM(quantity_in_stock * cost_price) as total_inventory_value,
        COUNT(CASE WHEN quantity_in_stock <= min_stock_level THEN 1 END) as low_stock_products,
        COUNT(CASE WHEN quantity_in_stock = 0 THEN 1 END) as out_of_stock_products
      FROM products
    `);

    // Customer statistics
    const customerStats = await query(`
      SELECT 
        COUNT(*) as total_customers,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_customers
      FROM customers
    `);

    // Supplier statistics
    const supplierStats = await query(`
      SELECT 
        COUNT(*) as total_suppliers,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_suppliers
      FROM suppliers
    `);

    // Profit margin (revenue - cost)
    const profitMargin = parseFloat(salesStats.rows[0].total_revenue || 0) - 
                        parseFloat(purchaseStats.rows[0].total_spending || 0);

    res.json({
      success: true,
      data: {
        sales: salesStats.rows[0],
        purchases: purchaseStats.rows[0],
        inventory: inventoryStats.rows[0],
        customers: customerStats.rows[0],
        suppliers: supplierStats.rows[0],
        profit_margin: profitMargin
      }
    });
  } catch (error) {
    console.error('Error fetching global overview:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get top customers
router.get('/top-customers', authenticate, async (req, res) => {
  try {
    const { limit = 10, start_date, end_date } = req.query;
    let dateFilter = '';
    const params = [limit];
    let paramCount = 2;

    if (start_date && end_date) {
      dateFilter = ` AND so.order_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(start_date, end_date);
      paramCount += 2;
    }

    const result = await query(`
      SELECT 
        c.id,
        c.name,
        c.email,
        COUNT(so.id) as order_count,
        SUM(so.total_amount) as total_revenue,
        AVG(so.total_amount) as average_order_value,
        MAX(so.order_date) as last_order_date
      FROM customers c
      JOIN sales_orders so ON c.id = so.customer_id
      WHERE so.status != 'cancelled' ${dateFilter}
      GROUP BY c.id, c.name, c.email
      ORDER BY total_revenue DESC
      LIMIT $1
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching top customers:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get top suppliers
router.get('/top-suppliers', authenticate, async (req, res) => {
  try {
    const { limit = 10, start_date, end_date } = req.query;
    let dateFilter = '';
    const params = [limit];
    let paramCount = 2;

    if (start_date && end_date) {
      dateFilter = ` AND p.order_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(start_date, end_date);
      paramCount += 2;
    }

    const result = await query(`
      SELECT 
        s.id,
        s.name,
        s.email,
        COUNT(p.id) as purchase_count,
        SUM(p.total_amount) as total_spending,
        AVG(p.total_amount) as average_purchase_value,
        MAX(p.order_date) as last_purchase_date
      FROM suppliers s
      JOIN purchase_orders p ON s.id = p.supplier_id
      WHERE p.status != 'cancelled' ${dateFilter}
      GROUP BY s.id, s.name, s.email
      ORDER BY total_spending DESC
      LIMIT $1
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching top suppliers:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ============ BASE STATISTICS (G39) ============

// Get sales statistics
router.get('/sales', authenticate, async (req, res) => {
  try {
    const { period = 'month', start_date, end_date } = req.query;
    let dateGrouping;
    
    switch (period) {
      case 'day':
        dateGrouping = "DATE_TRUNC('day', order_date)";
        break;
      case 'week':
        dateGrouping = "DATE_TRUNC('week', order_date)";
        break;
      case 'month':
        dateGrouping = "DATE_TRUNC('month', order_date)";
        break;
      case 'year':
        dateGrouping = "DATE_TRUNC('year', order_date)";
        break;
      default:
        dateGrouping = "DATE_TRUNC('month', order_date)";
    }

    let queryText = `
      SELECT 
        ${dateGrouping} as period,
        COUNT(*) as order_count,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as average_order_value,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count
      FROM sales_orders
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (start_date) {
      queryText += ` AND order_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }
    if (end_date) {
      queryText += ` AND order_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    queryText += ' GROUP BY period ORDER BY period DESC';
    const result = await query(queryText, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching sales statistics:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get purchase statistics
router.get('/purchases', authenticate, async (req, res) => {
  try {
    const { period = 'month', start_date, end_date } = req.query;
    let dateGrouping;
    
    switch (period) {
      case 'day':
        dateGrouping = "DATE_TRUNC('day', order_date)";
        break;
      case 'week':
        dateGrouping = "DATE_TRUNC('week', order_date)";
        break;
      case 'month':
        dateGrouping = "DATE_TRUNC('month', order_date)";
        break;
      case 'year':
        dateGrouping = "DATE_TRUNC('year', order_date)";
        break;
      default:
        dateGrouping = "DATE_TRUNC('month', order_date)";
    }

    let queryText = `
      SELECT 
        ${dateGrouping} as period,
        COUNT(*) as purchase_count,
        SUM(total_amount) as total_spending,
        AVG(total_amount) as average_purchase_value,
        SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END) as received_count,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count
      FROM purchase_orders
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (start_date) {
      queryText += ` AND order_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }
    if (end_date) {
      queryText += ` AND order_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    queryText += ' GROUP BY period ORDER BY period DESC';
    const result = await query(queryText, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching purchase statistics:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get inventory turnover
router.get('/inventory-turnover', authenticate, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let dateFilter = '';
    const params = [];
    let paramCount = 1;

    if (start_date && end_date) {
      dateFilter = ` AND sm.movement_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(start_date, end_date);
      paramCount += 2;
    }

    const result = await query(`
      SELECT 
        p.id,
        p.sku,
        p.name,
        p.quantity_in_stock,
        p.cost_price,
        SUM(CASE WHEN sm.movement_type = 'OUT' THEN ABS(sm.quantity) ELSE 0 END) as units_sold,
        SUM(CASE WHEN sm.movement_type = 'IN' THEN sm.quantity ELSE 0 END) as units_purchased,
        COUNT(DISTINCT sm.id) as movement_count,
        (p.quantity_in_stock * p.cost_price) as inventory_value
      FROM products p
      LEFT JOIN stock_movements sm ON p.id = sm.product_id ${dateFilter}
      GROUP BY p.id, p.sku, p.name, p.quantity_in_stock, p.cost_price
      ORDER BY units_sold DESC
      LIMIT 50
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching inventory turnover:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ============ DETAILED STATISTICAL REPORTS (G40) ============

// Get sales by product
router.get('/sales-by-product', authenticate, async (req, res) => {
  try {
    const { start_date, end_date, limit = 20 } = req.query;
    let dateFilter = '';
    const params = [limit];
    let paramCount = 2;

    if (start_date && end_date) {
      dateFilter = ` AND so.order_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(start_date, end_date);
      paramCount += 2;
    }

    const result = await query(`
      SELECT 
        p.id,
        p.sku,
        p.name,
        SUM(si.quantity) as total_quantity_sold,
        SUM(si.line_total) as total_revenue,
        AVG(si.unit_price) as average_selling_price,
        COUNT(DISTINCT si.sales_order_id) as order_count
      FROM products p
      JOIN sales_order_items si ON p.id = si.product_id
      JOIN sales_orders so ON si.sales_order_id = so.id
      WHERE so.status != 'cancelled' ${dateFilter}
      GROUP BY p.id, p.sku, p.name
      ORDER BY total_revenue DESC
      LIMIT $1
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching sales by product:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get purchases by product
router.get('/purchases-by-product', authenticate, async (req, res) => {
  try {
    const { start_date, end_date, limit = 20 } = req.query;
    let dateFilter = '';
    const params = [limit];
    let paramCount = 2;

    if (start_date && end_date) {
      dateFilter = ` AND p.order_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(start_date, end_date);
      paramCount += 2;
    }

    const result = await query(`
      SELECT 
        pr.id,
        pr.sku,
        pr.name,
        SUM(pi.quantity) as total_quantity_purchased,
        SUM(pi.line_total) as total_cost,
        AVG(pi.unit_price) as average_purchase_price,
        COUNT(DISTINCT pi.purchase_order_id) as purchase_count
      FROM products pr
      JOIN purchase_order_items pi ON pr.id = pi.product_id
      JOIN purchase_orders p ON pi.purchase_order_id = p.id
      WHERE p.status != 'cancelled' ${dateFilter}
      GROUP BY pr.id, pr.sku, pr.name
      ORDER BY total_cost DESC
      LIMIT $1
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching purchases by product:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get sales by customer category
router.get('/sales-by-customer', authenticate, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let dateFilter = '';
    const params = [];
    let paramCount = 1;

    if (start_date && end_date) {
      dateFilter = ` AND so.order_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(start_date, end_date);
      paramCount += 2;
    }

    const result = await query(`
      SELECT 
        c.id,
        c.name,
        c.billing_city as city,
        c.billing_country as country,
        COUNT(so.id) as order_count,
        SUM(so.total_amount) as total_revenue,
        AVG(so.total_amount) as average_order_value,
        MAX(so.order_date) as last_order_date
      FROM customers c
      JOIN sales_orders so ON c.id = so.customer_id
      WHERE so.status != 'cancelled' ${dateFilter}
      GROUP BY c.id, c.name, c.billing_city, c.billing_country
      ORDER BY total_revenue DESC
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching sales by customer:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get financial summary
router.get('/financial-summary', authenticate, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let dateFilter = '';
    const params = [];
    let paramCount = 1;

    if (start_date && end_date) {
      dateFilter = ` WHERE transaction_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(start_date, end_date);
      paramCount += 2;
    }

    // Financial transactions summary
    const transactionsResult = await query(`
      SELECT 
        transaction_type as type,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount
      FROM financial_transactions
      ${dateFilter}
      GROUP BY transaction_type
    `, params);

    // Reset params for next query
    let salesDateFilter = '';
    const salesParams = [];
    if (start_date && end_date) {
      salesDateFilter = ` WHERE order_date BETWEEN $1 AND $2`;
      salesParams.push(start_date, end_date);
    }

    // Sales revenue
    const salesResult = await query(`
      SELECT 
        SUM(total_amount) as total_revenue,
        SUM(tax_amount) as total_tax
      FROM sales_orders
      ${salesDateFilter}${salesDateFilter ? ' AND' : ' WHERE'} status != 'cancelled'
    `, salesParams);

    // Purchase costs
    const purchaseResult = await query(`
      SELECT 
        SUM(total_amount) as total_cost,
        SUM(tax_amount) as total_tax
      FROM purchase_orders
      ${salesDateFilter}${salesDateFilter ? ' AND' : ' WHERE'} status != 'cancelled'
    `, salesParams);

    const totalIncome = parseFloat(salesResult.rows[0].total_revenue || 0);
    const totalExpense = parseFloat(purchaseResult.rows[0].total_cost || 0);
    const netProfit = totalIncome - totalExpense;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome * 100) : 0;

    res.json({
      success: true,
      data: {
        transactions: transactionsResult.rows,
        sales: salesResult.rows[0],
        purchases: purchaseResult.rows[0],
        summary: {
          total_income: totalIncome,
          total_expense: totalExpense,
          net_profit: netProfit,
          profit_margin: profitMargin
        }
      }
    });
  } catch (error) {
    console.error('Error fetching financial summary:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get stock movement analysis
router.get('/stock-movements-analysis', authenticate, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let dateFilter = '';
    const params = [];
    let paramCount = 1;

    if (start_date && end_date) {
      dateFilter = ` AND movement_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(start_date, end_date);
      paramCount += 2;
    }

    const result = await query(`
      SELECT 
        movement_type,
        COUNT(*) as movement_count,
        SUM(quantity) as total_quantity,
        SUM(ABS(quantity)) as absolute_quantity,
        SUM(quantity * unit_price) as total_value
      FROM stock_movements
      WHERE 1=1 ${dateFilter}
      GROUP BY movement_type
      ORDER BY movement_count DESC
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching stock movements analysis:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
