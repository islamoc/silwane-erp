const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/dashboard', authenticate, async (req, res) => {
    try {
        const productCount = await query('SELECT COUNT(*) FROM products WHERE is_active = true');
        const customerCount = await query('SELECT COUNT(*) FROM customers WHERE is_active = true');
        const orderCount = await query('SELECT COUNT(*) FROM sales_orders WHERE status != \'CANCELLED\'');
        const revenue = await query('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE status != \'CANCELLED\'');
        
        const salesTrend = await query(`
            SELECT TO_CHAR(order_date, 'Mon') as month, COALESCE(SUM(total_amount), 0) as sales
            FROM sales_orders 
            WHERE order_date >= NOW() - INTERVAL '6 months'
            GROUP BY TO_CHAR(order_date, 'Mon'), DATE_TRUNC('month', order_date)
            ORDER BY DATE_TRUNC('month', order_date)
        `);

        const topProducts = await query(`
            SELECT p.name, SUM(soi.quantity) as volume, SUM(soi.line_total) as value
            FROM sales_order_items soi
            JOIN products p ON soi.product_id = p.id
            GROUP BY p.name
            ORDER BY value DESC
            LIMIT 5
        `);

        const lowStock = await query('SELECT COUNT(*) FROM products WHERE quantity_in_stock <= min_stock_level');
        const pendingOrders = await query('SELECT COUNT(*) FROM sales_orders WHERE status = \'PENDING\'');

        res.json({
            success: true,
            data: {
                kpis: {
                    total_revenue: parseFloat(revenue.rows[0].total),
                    revenue_growth: 0,
                    total_orders: parseInt(orderCount.rows[0].count),
                    order_growth: 0,
                    total_products: parseInt(productCount.rows[0].count),
                    total_customers: parseInt(customerCount.rows[0].count),
                    customer_growth: 0
                },
                sales_trend: salesTrend.rows,
                top_products: topProducts.rows,
                quick_stats: {
                    pending_invoices: 0,
                    pending_orders: parseInt(pendingOrders.rows[0].count),
                    low_stock_products: parseInt(lowStock.rows[0].count),
                    cash_balance: 0
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
        res.json({ success: true, data: { monthly: monthlySales.rows } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
