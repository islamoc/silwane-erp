// MC07 - Module Fiches Analytiques (Analytics Module)
// G31 - Fiche produit + Fiche de stock (Product File + Stock Card)
// G33 - Fiche client / fournisseur (Client / Supplier File)

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// ============ PRODUCT ANALYTICS (G31) ============

// Get product analytics
router.get('/products/:id/analytics', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    // Get product details
    const productResult = await pool.query(`
      SELECT 
        p.*,
        pf.name as family_name
      FROM products p
      LEFT JOIN product_families pf ON p.family_id = pf.id
      WHERE p.id = $1
    `, [id]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Get stock movements summary
    let movementQuery = `
      SELECT 
        movement_type,
        COUNT(*) as count,
        SUM(quantity) as total_quantity,
        SUM(quantity * unit_price) as total_value
      FROM stock_movements
      WHERE product_id = $1
    `;
    const movementParams = [id];
    let paramCount = 2;

    if (start_date) {
      movementQuery += ` AND movement_date >= $${paramCount}`;
      movementParams.push(start_date);
      paramCount++;
    }

    if (end_date) {
      movementQuery += ` AND movement_date <= $${paramCount}`;
      movementParams.push(end_date);
      paramCount++;
    }

    movementQuery += ' GROUP BY movement_type';

    const movementsResult = await pool.query(movementQuery, movementParams);

    // Get recent movements
    const recentMovementsResult = await pool.query(`
      SELECT 
        sm.*,
        u.username as created_by_username
      FROM stock_movements sm
      LEFT JOIN users u ON sm.created_by = u.id
      WHERE sm.product_id = $1
      ORDER BY sm.movement_date DESC
      LIMIT 50
    `, [id]);

    // Get purchase history
    const purchaseHistoryResult = await pool.query(`
      SELECT 
        pi.quantity,
        pi.unit_price,
        pi.total_price,
        p.purchase_number,
        p.order_date,
        p.status,
        s.name as supplier_name
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE pi.product_id = $1
      ORDER BY p.order_date DESC
      LIMIT 20
    `, [id]);

    // Get sales history
    const salesHistoryResult = await pool.query(`
      SELECT 
        si.quantity,
        si.unit_price,
        si.total_price,
        so.order_number,
        so.order_date,
        so.status,
        c.name as customer_name
      FROM sales_order_items si
      JOIN sales_orders so ON si.sales_order_id = so.id
      JOIN customers c ON so.customer_id = c.id
      WHERE si.product_id = $1
      ORDER BY so.order_date DESC
      LIMIT 20
    `, [id]);

    // Calculate statistics
    const statsResult = await pool.query(`
      SELECT 
        SUM(CASE WHEN movement_type = 'purchase_receipt' THEN quantity ELSE 0 END) as total_purchased,
        SUM(CASE WHEN movement_type = 'sales_shipment' THEN ABS(quantity) ELSE 0 END) as total_sold,
        AVG(CASE WHEN movement_type = 'purchase_receipt' THEN unit_price END) as avg_purchase_price,
        AVG(CASE WHEN movement_type = 'sales_shipment' THEN unit_price END) as avg_sale_price
      FROM stock_movements
      WHERE product_id = $1
    `, [id]);

    res.json({
      product,
      movements_summary: movementsResult.rows,
      recent_movements: recentMovementsResult.rows,
      purchase_history: purchaseHistoryResult.rows,
      sales_history: salesHistoryResult.rows,
      statistics: statsResult.rows[0]
    });
  } catch (error) {
    console.error('Error fetching product analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get stock card for product
router.get('/products/:id/stock-card', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date, page = 1, limit = 50 } = req.query;

    let query = `
      SELECT 
        sm.*,
        u.username as created_by_username,
        COUNT(*) OVER() as total_count
      FROM stock_movements sm
      LEFT JOIN users u ON sm.created_by = u.id
      WHERE sm.product_id = $1
    `;
    const params = [id];
    let paramCount = 2;

    if (start_date) {
      query += ` AND sm.movement_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND sm.movement_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    query += ' ORDER BY sm.movement_date DESC, sm.created_at DESC';
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await pool.query(query, params);

    // Calculate running balance
    let balance = 0;
    const movements = result.rows.map(movement => {
      balance += parseFloat(movement.quantity);
      return {
        ...movement,
        running_balance: balance
      };
    }).reverse(); // Reverse to show chronological order

    res.json({
      movements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows[0]?.total_count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching stock card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get inventory valuation
router.get('/inventory-valuation', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id,
        p.sku,
        p.name,
        p.stock_quantity,
        p.unit_cost,
        (p.stock_quantity * p.unit_cost) as total_value,
        pf.name as family_name
      FROM products p
      LEFT JOIN product_families pf ON p.family_id = pf.id
      WHERE p.stock_quantity > 0
      ORDER BY (p.stock_quantity * p.unit_cost) DESC
    `);

    const totalValue = result.rows.reduce((sum, row) => {
      return sum + parseFloat(row.total_value || 0);
    }, 0);

    res.json({
      products: result.rows,
      total_value: totalValue
    });
  } catch (error) {
    console.error('Error fetching inventory valuation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ CLIENT/SUPPLIER ANALYTICS (G33) ============

// Get customer analytics
router.get('/customers/:id/analytics', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    // Get customer details
    const customerResult = await pool.query(
      'SELECT * FROM customers WHERE id = $1',
      [id]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Get orders summary
    let ordersQuery = `
      SELECT 
        status,
        COUNT(*) as order_count,
        SUM(total_amount) as total_amount
      FROM sales_orders
      WHERE customer_id = $1
    `;
    const ordersParams = [id];
    let paramCount = 2;

    if (start_date) {
      ordersQuery += ` AND order_date >= $${paramCount}`;
      ordersParams.push(start_date);
      paramCount++;
    }

    if (end_date) {
      ordersQuery += ` AND order_date <= $${paramCount}`;
      ordersParams.push(end_date);
      paramCount++;
    }

    ordersQuery += ' GROUP BY status';

    const ordersSummaryResult = await pool.query(ordersQuery, ordersParams);

    // Get recent orders
    const recentOrdersResult = await pool.query(`
      SELECT *
      FROM sales_orders
      WHERE customer_id = $1
      ORDER BY order_date DESC
      LIMIT 20
    `, [id]);

    // Get top products purchased
    const topProductsResult = await pool.query(`
      SELECT 
        p.id,
        p.name,
        p.sku,
        SUM(si.quantity) as total_quantity,
        SUM(si.total_price) as total_value,
        COUNT(DISTINCT si.sales_order_id) as order_count
      FROM sales_order_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales_orders so ON si.sales_order_id = so.id
      WHERE so.customer_id = $1
      GROUP BY p.id, p.name, p.sku
      ORDER BY total_value DESC
      LIMIT 10
    `, [id]);

    // Calculate statistics
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as average_order_value,
        MAX(order_date) as last_order_date,
        MIN(order_date) as first_order_date
      FROM sales_orders
      WHERE customer_id = $1 AND status != 'cancelled'
    `, [id]);

    res.json({
      customer: customerResult.rows[0],
      orders_summary: ordersSummaryResult.rows,
      recent_orders: recentOrdersResult.rows,
      top_products: topProductsResult.rows,
      statistics: statsResult.rows[0]
    });
  } catch (error) {
    console.error('Error fetching customer analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get supplier analytics
router.get('/suppliers/:id/analytics', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    // Get supplier details
    const supplierResult = await pool.query(
      'SELECT * FROM suppliers WHERE id = $1',
      [id]
    );

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Get purchases summary
    let purchasesQuery = `
      SELECT 
        status,
        COUNT(*) as purchase_count,
        SUM(total_amount) as total_amount
      FROM purchases
      WHERE supplier_id = $1
    `;
    const purchasesParams = [id];
    let paramCount = 2;

    if (start_date) {
      purchasesQuery += ` AND order_date >= $${paramCount}`;
      purchasesParams.push(start_date);
      paramCount++;
    }

    if (end_date) {
      purchasesQuery += ` AND order_date <= $${paramCount}`;
      purchasesParams.push(end_date);
      paramCount++;
    }

    purchasesQuery += ' GROUP BY status';

    const purchasesSummaryResult = await pool.query(purchasesQuery, purchasesParams);

    // Get recent purchases
    const recentPurchasesResult = await pool.query(`
      SELECT *
      FROM purchases
      WHERE supplier_id = $1
      ORDER BY order_date DESC
      LIMIT 20
    `, [id]);

    // Get top products purchased
    const topProductsResult = await pool.query(`
      SELECT 
        p.id,
        p.name,
        p.sku,
        SUM(pi.quantity) as total_quantity,
        SUM(pi.total_price) as total_value,
        COUNT(DISTINCT pi.purchase_id) as purchase_count,
        AVG(pi.unit_price) as average_price
      FROM purchase_items pi
      JOIN products p ON pi.product_id = p.id
      JOIN purchases pu ON pi.purchase_id = pu.id
      WHERE pu.supplier_id = $1
      GROUP BY p.id, p.name, p.sku
      ORDER BY total_value DESC
      LIMIT 10
    `, [id]);

    // Calculate statistics
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_purchases,
        SUM(total_amount) as total_spending,
        AVG(total_amount) as average_purchase_value,
        MAX(order_date) as last_purchase_date,
        MIN(order_date) as first_purchase_date
      FROM purchases
      WHERE supplier_id = $1 AND status != 'cancelled'
    `, [id]);

    res.json({
      supplier: supplierResult.rows[0],
      purchases_summary: purchasesSummaryResult.rows,
      recent_purchases: recentPurchasesResult.rows,
      top_products: topProductsResult.rows,
      statistics: statsResult.rows[0]
    });
  } catch (error) {
    console.error('Error fetching supplier analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get customer account statement
router.get('/customers/:id/statement', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    let query = `
      SELECT 
        so.id,
        so.order_number,
        so.order_date,
        so.total_amount,
        so.status,
        'order' as transaction_type
      FROM sales_orders so
      WHERE so.customer_id = $1
    `;
    const params = [id];
    let paramCount = 2;

    if (start_date) {
      query += ` AND so.order_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND so.order_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    query += ' ORDER BY so.order_date DESC';

    const result = await pool.query(query, params);

    // Calculate balance
    let balance = 0;
    const transactions = result.rows.map(transaction => {
      balance += parseFloat(transaction.total_amount);
      return {
        ...transaction,
        running_balance: balance
      };
    });

    res.json({
      transactions,
      current_balance: balance
    });
  } catch (error) {
    console.error('Error fetching customer statement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get supplier account statement
router.get('/suppliers/:id/statement', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    let query = `
      SELECT 
        p.id,
        p.purchase_number,
        p.order_date,
        p.total_amount,
        p.status,
        'purchase' as transaction_type
      FROM purchases p
      WHERE p.supplier_id = $1
    `;
    const params = [id];
    let paramCount = 2;

    if (start_date) {
      query += ` AND p.order_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND p.order_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    query += ' ORDER BY p.order_date DESC';

    const result = await pool.query(query, params);

    // Calculate balance
    let balance = 0;
    const transactions = result.rows.map(transaction => {
      balance += parseFloat(transaction.total_amount);
      return {
        ...transaction,
        running_balance: balance
      };
    });

    res.json({
      transactions,
      current_balance: balance
    });
  } catch (error) {
    console.error('Error fetching supplier statement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;