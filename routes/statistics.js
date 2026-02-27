const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.get('/dashboard', authenticate, async (req, res) => {
    try {
        const productCount = await query('SELECT COUNT(*) FROM products WHERE is_active = true');
        const customerCount = await query('SELECT COUNT(*) FROM customers WHERE is_active = true');
        const orderCount = await query('SELECT COUNT(*) FROM sales_orders WHERE status != \'CANCELLED\'');
        const revenue = await query('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE status != \'CANCELLED\'');
        
        // Growth (simplified as 0 for now)
        const growth = { revenue: 0, orders: 0, customers: 0 };

        const salesTrend = await query(`
            SELECT TO_CHAR(order_date, 'Mon') as month, 
                   COALESCE(SUM(total_amount), 0) as revenue,
                   COUNT(*) as orders
            FROM sales_orders 
            WHERE status != 'CANCELLED' AND order_date >= NOW() - INTERVAL '11 months'
            GROUP BY TO_CHAR(order_date, 'Mon'), DATE_TRUNC('month', order_date)
            ORDER BY DATE_TRUNC('month', order_date)
        `);

        const topProducts = await query(`
            SELECT p.name, SUM(soi.line_total) as value
            FROM sales_order_items soi
            JOIN products p ON soi.product_id = p.id
            GROUP BY p.name
            ORDER BY value DESC
            LIMIT 5
        `);

        const monthlyComparison = await query(`
            WITH current_month AS (
                SELECT COALESCE(SUM(total_amount), 0) as sales
                FROM sales_orders
                WHERE order_date >= DATE_TRUNC('month', CURRENT_DATE) AND status != 'CANCELLED'
            ),
            prev_month AS (
                SELECT COALESCE(SUM(total_amount), 0) as sales
                FROM sales_orders
                WHERE order_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') 
                  AND order_date < DATE_TRUNC('month', CURRENT_DATE)
                  AND status != 'CANCELLED'
            )
            SELECT 'Sales' as category, c.sales as current, p.sales as previous
            FROM current_month c, prev_month p
        `);

        const financialSummary = await query(`
            WITH income AS (
                SELECT COALESCE(SUM(amount), 0) as total
                FROM financial_transactions
                WHERE transaction_type = 'INCOME' AND status = 'COMPLETED'
            ),
            expense AS (
                SELECT COALESCE(SUM(amount), 0) as total
                FROM financial_transactions
                WHERE transaction_type = 'EXPENSE' AND status = 'COMPLETED'
            )
            SELECT i.total as revenue, e.total as expenses, (i.total - e.total) as profit,
                   CASE WHEN i.total > 0 THEN ROUND(((i.total - e.total) / i.total) * 100, 2) ELSE 0 END as margin
            FROM income i, expense e
        `);

        const lowStock = await query('SELECT COUNT(*) FROM products WHERE quantity_in_stock <= min_stock_level');
        const pendingOrders = await query('SELECT COUNT(*) FROM sales_orders WHERE status = \'PENDING\'');
        const pendingInvoices = await query('SELECT COUNT(*) FROM sales_orders WHERE payment_status != \'PAID\' AND status != \'CANCELLED\'');
        const cashBalance = await query(`
            SELECT (
                (SELECT COALESCE(SUM(amount), 0) FROM financial_transactions WHERE transaction_type = 'INCOME' AND status = 'COMPLETED') -
                (SELECT COALESCE(SUM(amount), 0) FROM financial_transactions WHERE transaction_type = 'EXPENSE' AND status = 'COMPLETED')
            ) as balance
        `);

        res.json({
            success: true,
            data: {
                kpis: {
                    total_revenue: parseFloat(revenue.rows[0].total),
                    revenue_growth: growth.revenue,
                    total_orders: parseInt(orderCount.rows[0].count),
                    order_growth: growth.orders,
                    total_products: parseInt(productCount.rows[0].count),
                    total_customers: parseInt(customerCount.rows[0].count),
                    customer_growth: growth.customers
                },
                sales_trend: salesTrend.rows.map(r => ({ ...r, revenue: parseFloat(r.revenue), orders: parseInt(r.orders) })),
                top_products: topProducts.rows.map(r => ({ ...r, value: parseFloat(r.value) })),
                monthly_comparison: monthlyComparison.rows.map(r => ({ ...r, current: parseFloat(r.current), previous: parseFloat(r.previous) })),
                financial_summary: {
                    revenue: parseFloat(financialSummary.rows[0].revenue),
                    expenses: parseFloat(financialSummary.rows[0].expenses),
                    profit: parseFloat(financialSummary.rows[0].profit),
                    margin: parseFloat(financialSummary.rows[0].margin)
                },
                quick_stats: {
                    pending_invoices: parseInt(pendingInvoices.rows[0].count),
                    pending_orders: parseInt(pendingOrders.rows[0].count),
                    low_stock_products: parseInt(lowStock.rows[0].count),
                    cash_balance: parseFloat(cashBalance.rows[0].balance)
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/sales', authenticate, async (req, res) => {
    try {
        const monthlySales = await query(`
            SELECT TO_CHAR(order_date, 'Month') as month, COALESCE(SUM(total_amount), 0) as sales
            FROM sales_orders
            WHERE status != 'CANCELLED'
            GROUP BY TO_CHAR(order_date, 'Month'), DATE_TRUNC('month', order_date)
            ORDER BY DATE_TRUNC('month', order_date)
        `);
        res.json({ success: true, data: { monthly: monthlySales.rows.map(r => ({ ...r, sales: parseFloat(r.sales) })) } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
