// MC09 - Module Statistiques (Statistics Module)
// G38 - Situation globale des tiers (Global Third-Party Situation)
// G39 - Statistiques de base (Base Statistics)
// G40 - Etats statistiques (Statistical Reports)

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// ============ DASHBOARD STATISTICS ============

// Get global business overview (Dashboard)
router.get('/dashboard', authenticate, async (req, res) => {
    try {
        // 1. KPIs
        const kpisQuery = await query(`
            WITH current_month AS (
                SELECT 
                    SUM(total_amount) as revenue,
                    COUNT(*) as orders
                FROM sales_orders
                WHERE status != 'cancelled' 
                AND order_date >= DATE_TRUNC('month', CURRENT_DATE)
            ),
            previous_month AS (
                SELECT 
                    SUM(total_amount) as revenue,
                    COUNT(*) as orders
                FROM sales_orders
                WHERE status != 'cancelled' 
                AND order_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                AND order_date < DATE_TRUNC('month', CURRENT_DATE)
            )
            SELECT 
                (SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE status != 'cancelled') as total_revenue,
                (SELECT COUNT(*) FROM sales_orders WHERE status != 'cancelled') as total_orders,
                (SELECT COUNT(*) FROM products) as total_products,
                (SELECT COUNT(*) FROM customers) as total_customers,
                COALESCE(((cm.revenue - pm.revenue) / NULLIF(pm.revenue, 0)) * 100, 0) as revenue_growth,
                COALESCE(((cm.orders - pm.orders) / NULLIF(pm.orders, 0)) * 100, 0) as order_growth
            FROM current_month cm, previous_month pm
        `);

        // 2. Sales Trend (Last 12 Months)
        const trendQuery = await query(`
            SELECT 
                TO_CHAR(DATE_TRUNC('month', order_date), 'Mon YYYY') as month,
                COALESCE(SUM(total_amount), 0) as revenue,
                COUNT(*) as orders
            FROM sales_orders
            WHERE status != 'cancelled'
            AND order_date >= CURRENT_DATE - INTERVAL '12 months'
            GROUP BY DATE_TRUNC('month', order_date)
            ORDER BY DATE_TRUNC('month', order_date)
        `);

        // 3. Top Products (By Revenue)
        const topProductsQuery = await query(`
            SELECT 
                p.name,
                SUM(si.line_total) as value
            FROM products p
            JOIN sales_order_items si ON p.id = si.product_id
            JOIN sales_orders so ON si.sales_order_id = so.id
            WHERE so.status != 'cancelled'
            GROUP BY p.name
            ORDER BY value DESC
            LIMIT 5
        `);

        // 4. Monthly Comparison
        const comparisonQuery = await query(`
            SELECT 
                'Revenue' as category,
                (SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE order_date >= DATE_TRUNC('month', CURRENT_DATE)) as current,
                (SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE order_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND order_date < DATE_TRUNC('month', CURRENT_DATE)) as previous
            UNION ALL
            SELECT 
                'Expenses',
                (SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders WHERE order_date >= DATE_TRUNC('month', CURRENT_DATE)),
                (SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders WHERE order_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND order_date < DATE_TRUNC('month', CURRENT_DATE))
        `);

        // 5. Financial Summary
        const financeSummaryQuery = await query(`
            SELECT 
                (SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE status != 'cancelled') as revenue,
                (SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders WHERE status != 'cancelled') as expenses
        `);
        const fs = financeSummaryQuery.rows[0];
        const profit = fs.revenue - fs.expenses;
        const margin = fs.revenue > 0 ? (profit / fs.revenue * 100).toFixed(2) : 0;

        // 6. Quick Stats
        const quickStatsQuery = await query(`
            SELECT 
                (SELECT COUNT(*) FROM sales_orders WHERE status = 'pending') as pending_orders,
                (SELECT COUNT(*) FROM products WHERE quantity_in_stock <= min_stock_level) as low_stock_products
        `);

        res.json({
            success: true,
            data: {
                kpis: kpisQuery.rows[0],
                sales_trend: trendQuery.rows,
                top_products: topProductsQuery.rows,
                monthly_comparison: comparisonQuery.rows,
                financial_summary: {
                    revenue: fs.revenue,
                    expenses: fs.expenses,
                    profit: profit,
                    margin: margin
                },
                quick_stats: {
                    ...quickStatsQuery.rows[0],
                    pending_invoices: 0,
                    cash_balance: 0
                }
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// ============ BASE STATISTICS (G39) ============

// Get sales statistics
router.get('/sales', authenticate, async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                TO_CHAR(DATE_TRUNC('month', order_date), 'Mon YYYY') as month,
                SUM(total_amount) as sales
            FROM sales_orders
            WHERE status != 'cancelled'
            GROUP BY DATE_TRUNC('month', order_date)
            ORDER BY DATE_TRUNC('month', order_date)
        `);
        res.json({ success: true, data: { monthly: result.rows } });
    } catch (error) {
        console.error('Error fetching sales stats:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Aliases for other frontend requests
router.get('/invoices', authenticate, async (req, res) => {
    res.json({ success: true, data: [] });
});

router.get('/products', authenticate, async (req, res) => {
    try {
        const result = await query(`
            SELECT p.name, SUM(si.line_total) as revenue
            FROM products p
            JOIN sales_order_items si ON p.id = si.product_id
            GROUP BY p.name ORDER BY revenue DESC LIMIT 10
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/customers', authenticate, async (req, res) => {
    try {
        const result = await query(`
            SELECT c.name, SUM(so.total_amount) as revenue
            FROM customers c
            JOIN sales_orders so ON c.id = so.customer_id
            GROUP BY c.name ORDER BY revenue DESC LIMIT 10
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
