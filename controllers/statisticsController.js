const db = require('../database/connection');

// G38 - Global Tier Situation
exports.getGlobalTierSituation = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    // Customer statistics
    const customerStatsQuery = `
      SELECT 
        COUNT(DISTINCT c.id) as total_customers,
        COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.id END) as active_customers,
        COALESCE(SUM(so.total_amount), 0) as total_revenue,
        COALESCE(AVG(so.total_amount), 0) as avg_order_value
      FROM customers c
      LEFT JOIN sales_orders so ON c.id = so.customer_id
      WHERE ($1::date IS NULL OR so.order_date >= $1)
        AND ($2::date IS NULL OR so.order_date <= $2)
    `;

    const customerStatsResult = await db.query(customerStatsQuery, [
      start_date || null,
      end_date || null
    ]);

    // Supplier statistics
    const supplierStatsQuery = `
      SELECT 
        COUNT(DISTINCT s.id) as total_suppliers,
        COUNT(DISTINCT CASE WHEN s.status = 'active' THEN s.id END) as active_suppliers,
        COALESCE(SUM(po.total_amount), 0) as total_purchases,
        COALESCE(AVG(po.total_amount), 0) as avg_purchase_value
      FROM suppliers s
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id
      WHERE ($1::date IS NULL OR po.order_date >= $1)
        AND ($2::date IS NULL OR po.order_date <= $2)
    `;

    const supplierStatsResult = await db.query(supplierStatsQuery, [
      start_date || null,
      end_date || null
    ]);

    // Accounts receivable
    const receivableQuery = `
      SELECT 
        c.id, c.name, c.code,
        COALESCE(SUM(so.total_amount), 0) as total_orders,
        COALESCE(SUM(ft.amount), 0) as total_payments,
        (COALESCE(SUM(so.total_amount), 0) - COALESCE(SUM(ft.amount), 0)) as balance
      FROM customers c
      LEFT JOIN sales_orders so ON c.id = so.customer_id
      LEFT JOIN financial_transactions ft ON c.id = ft.customer_id 
        AND ft.transaction_type = 'income'
      WHERE ($1::date IS NULL OR so.order_date >= $1)
        AND ($2::date IS NULL OR so.order_date <= $2)
      GROUP BY c.id, c.name, c.code
      HAVING (COALESCE(SUM(so.total_amount), 0) - COALESCE(SUM(ft.amount), 0)) > 0
      ORDER BY balance DESC
      LIMIT 20
    `;

    const receivableResult = await db.query(receivableQuery, [
      start_date || null,
      end_date || null
    ]);

    // Accounts payable
    const payableQuery = `
      SELECT 
        s.id, s.name, s.code,
        COALESCE(SUM(po.total_amount), 0) as total_orders,
        COALESCE(SUM(ft.amount), 0) as total_payments,
        (COALESCE(SUM(po.total_amount), 0) - COALESCE(SUM(ft.amount), 0)) as balance
      FROM suppliers s
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id
      LEFT JOIN financial_transactions ft ON s.id = ft.supplier_id 
        AND ft.transaction_type = 'expense'
      WHERE ($1::date IS NULL OR po.order_date >= $1)
        AND ($2::date IS NULL OR po.order_date <= $2)
      GROUP BY s.id, s.name, s.code
      HAVING (COALESCE(SUM(po.total_amount), 0) - COALESCE(SUM(ft.amount), 0)) > 0
      ORDER BY balance DESC
      LIMIT 20
    `;

    const payableResult = await db.query(payableQuery, [
      start_date || null,
      end_date || null
    ]);

    res.json({
      success: true,
      data: {
        customers: customerStatsResult.rows[0],
        suppliers: supplierStatsResult.rows[0],
        accounts_receivable: receivableResult.rows,
        accounts_payable: payableResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching global tier situation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// G39 - Basic Statistics
exports.getBasicStatistics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    // Sales statistics
    const salesStatsQuery = `
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(AVG(total_amount), 0) as average_order,
        MAX(total_amount) as highest_order,
        MIN(total_amount) as lowest_order
      FROM sales_orders
      WHERE order_date >= DATE_TRUNC($1, CURRENT_DATE)
    `;

    const salesStatsResult = await db.query(salesStatsQuery, [period]);

    // Purchase statistics
    const purchaseStatsQuery = `
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_purchases,
        COALESCE(AVG(total_amount), 0) as average_purchase
      FROM purchase_orders
      WHERE order_date >= DATE_TRUNC($1, CURRENT_DATE)
    `;

    const purchaseStatsResult = await db.query(purchaseStatsQuery, [period]);

    // Inventory statistics
    const inventoryStatsQuery = `
      SELECT 
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT CASE WHEN current_stock.stock > 0 THEN p.id END) as in_stock_products,
        COUNT(DISTINCT CASE WHEN current_stock.stock <= p.minimum_stock THEN p.id END) as low_stock_products,
        COALESCE(SUM(current_stock.stock * p.price), 0) as inventory_value
      FROM products p
      LEFT JOIN (
        SELECT product_id, 
          SUM(CASE WHEN movement_type IN ('purchase', 'adjustment_in', 'return_in') 
            THEN quantity ELSE -quantity END) as stock
        FROM stock_movements
        GROUP BY product_id
      ) current_stock ON p.id = current_stock.product_id
    `;

    const inventoryStatsResult = await db.query(inventoryStatsQuery);

    // Financial statistics
    const financialStatsQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
        COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE -amount END), 0) as net_profit
      FROM financial_transactions
      WHERE transaction_date >= DATE_TRUNC($1, CURRENT_DATE)
    `;

    const financialStatsResult = await db.query(financialStatsQuery, [period]);

    res.json({
      success: true,
      data: {
        sales: salesStatsResult.rows[0],
        purchases: purchaseStatsResult.rows[0],
        inventory: inventoryStatsResult.rows[0],
        financial: financialStatsResult.rows[0]
      }
    });
  } catch (error) {
    console.error('Error fetching basic statistics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// G40 - Statistical Reports
exports.getStatisticalReport = async (req, res) => {
  try {
    const { report_type, start_date, end_date, group_by = 'month' } = req.query;

    let query, params;

    switch (report_type) {
      case 'sales_trend':
        query = `
          SELECT 
            DATE_TRUNC($1, order_date) as period,
            COUNT(*) as order_count,
            SUM(total_amount) as total_revenue,
            AVG(total_amount) as avg_order_value
          FROM sales_orders
          WHERE ($2::date IS NULL OR order_date >= $2)
            AND ($3::date IS NULL OR order_date <= $3)
          GROUP BY period
          ORDER BY period
        `;
        params = [group_by, start_date || null, end_date || null];
        break;

      case 'product_performance':
        query = `
          SELECT 
            p.id, p.name, p.code,
            COUNT(DISTINCT soi.order_id) as order_count,
            SUM(soi.quantity) as total_quantity_sold,
            SUM(soi.quantity * soi.unit_price) as total_revenue,
            AVG(soi.unit_price) as avg_price
          FROM products p
          JOIN sales_order_items soi ON p.id = soi.product_id
          JOIN sales_orders so ON soi.order_id = so.id
          WHERE ($1::date IS NULL OR so.order_date >= $1)
            AND ($2::date IS NULL OR so.order_date <= $2)
          GROUP BY p.id, p.name, p.code
          ORDER BY total_revenue DESC
          LIMIT 50
        `;
        params = [start_date || null, end_date || null];
        break;

      case 'customer_ranking':
        query = `
          SELECT 
            c.id, c.name, c.code,
            COUNT(DISTINCT so.id) as order_count,
            SUM(so.total_amount) as total_spent,
            AVG(so.total_amount) as avg_order_value,
            MAX(so.order_date) as last_order_date
          FROM customers c
          JOIN sales_orders so ON c.id = so.customer_id
          WHERE ($1::date IS NULL OR so.order_date >= $1)
            AND ($2::date IS NULL OR so.order_date <= $2)
          GROUP BY c.id, c.name, c.code
          ORDER BY total_spent DESC
          LIMIT 50
        `;
        params = [start_date || null, end_date || null];
        break;

      case 'inventory_turnover':
        query = `
          SELECT 
            p.id, p.name, p.code,
            COALESCE(SUM(CASE WHEN sm.movement_type = 'sale' THEN sm.quantity ELSE 0 END), 0) as quantity_sold,
            COALESCE(AVG(stock.current_stock), 0) as avg_stock,
            CASE 
              WHEN AVG(stock.current_stock) > 0 
              THEN SUM(CASE WHEN sm.movement_type = 'sale' THEN sm.quantity ELSE 0 END) / AVG(stock.current_stock)
              ELSE 0 
            END as turnover_ratio
          FROM products p
          LEFT JOIN stock_movements sm ON p.id = sm.product_id
          LEFT JOIN (
            SELECT product_id, 
              SUM(CASE WHEN movement_type IN ('purchase', 'adjustment_in') 
                THEN quantity ELSE -quantity END) as current_stock
            FROM stock_movements
            GROUP BY product_id
          ) stock ON p.id = stock.product_id
          WHERE ($1::date IS NULL OR sm.movement_date >= $1)
            AND ($2::date IS NULL OR sm.movement_date <= $2)
          GROUP BY p.id, p.name, p.code
          ORDER BY turnover_ratio DESC
          LIMIT 50
        `;
        params = [start_date || null, end_date || null];
        break;

      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid report type. Available types: sales_trend, product_performance, customer_ranking, inventory_turnover' 
        });
    }

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error generating statistical report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Dashboard Overview Statistics
exports.getDashboardOverview = async (req, res) => {
  try {
    // Get today's statistics
    const todayQuery = `
      SELECT 
        (SELECT COUNT(*) FROM sales_orders WHERE DATE(order_date) = CURRENT_DATE) as today_orders,
        (SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE DATE(order_date) = CURRENT_DATE) as today_revenue,
        (SELECT COUNT(*) FROM customers WHERE DATE(created_at) = CURRENT_DATE) as new_customers,
        (SELECT COUNT(*) FROM products WHERE track_stock = true AND 
          (SELECT SUM(quantity) FROM stock_movements WHERE product_id = products.id) <= minimum_stock
        ) as low_stock_alerts
    `;

    const todayResult = await db.query(todayQuery);

    // Get this month's statistics
    const monthQuery = `
      SELECT 
        (SELECT COUNT(*) FROM sales_orders 
          WHERE order_date >= DATE_TRUNC('month', CURRENT_DATE)) as month_orders,
        (SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders 
          WHERE order_date >= DATE_TRUNC('month', CURRENT_DATE)) as month_revenue,
        (SELECT COUNT(*) FROM purchase_orders 
          WHERE order_date >= DATE_TRUNC('month', CURRENT_DATE)) as month_purchases,
        (SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders 
          WHERE order_date >= DATE_TRUNC('month', CURRENT_DATE)) as month_purchase_amount
    `;

    const monthResult = await db.query(monthQuery);

    // Get pending items
    const pendingQuery = `
      SELECT 
        (SELECT COUNT(*) FROM sales_orders WHERE status = 'pending') as pending_orders,
        (SELECT COUNT(*) FROM sales_quotes WHERE status = 'pending') as pending_quotes,
        (SELECT COUNT(*) FROM vouchers WHERE status = 'pending') as pending_vouchers,
        (SELECT COUNT(*) FROM payment_schedules WHERE status = 'pending' AND due_date < CURRENT_DATE) as overdue_payments
    `;

    const pendingResult = await db.query(pendingQuery);

    res.json({
      success: true,
      data: {
        today: todayResult.rows[0],
        this_month: monthResult.rows[0],
        pending: pendingResult.rows[0]
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = exports;