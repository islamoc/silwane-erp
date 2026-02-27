// MC08 - Module Interface Utilisateurs (User Interface Module)
// G35 - Interface - barre d'information (Information Bar Interface)
// G41 - Recherches et filtres avancés (Advanced Search and Filters)
// N52 - Interface - recherche par colonne (Column Search Interface)

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorizeRoles } = require('../middleware/auth');

// ============ DASHBOARD INFO BAR (G35) ============

// Get dashboard summary
router.get('/dashboard/summary', authenticate, async (req, res) => {
  try {
    const productsResult = await pool.query('SELECT COUNT(*) as total, SUM(stock_quantity) as total_stock FROM products');
    const lowStockResult = await pool.query('SELECT COUNT(*) as count FROM products WHERE stock_quantity <= reorder_level AND reorder_level > 0');
    const pendingPurchasesResult = await pool.query("SELECT COUNT(*) as count, SUM(total_amount) as total FROM purchases WHERE status = 'draft'");
    const pendingSalesResult = await pool.query("SELECT COUNT(*) as count, SUM(total_amount) as total FROM sales_orders WHERE status = 'draft'");
    const confirmedPurchasesResult = await pool.query("SELECT COUNT(*) as count, SUM(total_amount) as total FROM purchases WHERE status = 'confirmed'");
    const confirmedSalesResult = await pool.query("SELECT COUNT(*) as count, SUM(total_amount) as total FROM sales_orders WHERE status = 'confirmed'");
    const pendingMovementsResult = await pool.query("SELECT COUNT(*) as count FROM stock_movements WHERE status = 'pending'");
    const inventoryValueResult = await pool.query('SELECT SUM(stock_quantity * unit_cost) as total_value FROM products WHERE stock_quantity > 0');
    const activeUsersResult = await pool.query("SELECT COUNT(*) as count FROM users WHERE is_active = true");

    res.json({
      products: {
        total: parseInt(productsResult.rows[0].total) || 0,
        total_stock: parseFloat(productsResult.rows[0].total_stock) || 0,
        low_stock: parseInt(lowStockResult.rows[0].count) || 0
      },
      purchases: {
        pending: { count: parseInt(pendingPurchasesResult.rows[0].count) || 0, total: parseFloat(pendingPurchasesResult.rows[0].total) || 0 },
        confirmed: { count: parseInt(confirmedPurchasesResult.rows[0].count) || 0, total: parseFloat(confirmedPurchasesResult.rows[0].total) || 0 }
      },
      sales: {
        pending: { count: parseInt(pendingSalesResult.rows[0].count) || 0, total: parseFloat(pendingSalesResult.rows[0].total) || 0 },
        confirmed: { count: parseInt(confirmedSalesResult.rows[0].count) || 0, total: parseFloat(confirmedSalesResult.rows[0].total) || 0 }
      },
      stock_movements: { pending: parseInt(pendingMovementsResult.rows[0].count) || 0 },
      inventory: { total_value: parseFloat(inventoryValueResult.rows[0].total_value) || 0 },
      users: { active: parseInt(activeUsersResult.rows[0].count) || 0 }
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent activities
router.get('/dashboard/activities', authenticate, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const movementsResult = await pool.query(`
      SELECT 'stock_movement' as activity_type, sm.id, sm.movement_type, sm.quantity, p.name as product_name, sm.created_at, u.username as user
      FROM stock_movements sm JOIN products p ON sm.product_id = p.id LEFT JOIN users u ON sm.created_by = u.id
      ORDER BY sm.created_at DESC LIMIT $1`, [Math.floor(limit / 3)]);
    const purchasesResult = await pool.query(`
      SELECT 'purchase' as activity_type, p.id, p.purchase_number, p.status, p.total_amount, s.name as supplier_name, p.created_at, u.username as user
      FROM purchases p JOIN suppliers s ON p.supplier_id = s.id LEFT JOIN users u ON p.created_by = u.id
      ORDER BY p.created_at DESC LIMIT $1`, [Math.floor(limit / 3)]);
    const salesResult = await pool.query(`
      SELECT 'sales_order' as activity_type, so.id, so.order_number, so.status, so.total_amount, c.name as customer_name, so.created_at, u.username as user
      FROM sales_orders so JOIN customers c ON so.customer_id = c.id LEFT JOIN users u ON so.created_by = u.id
      ORDER BY so.created_at DESC LIMIT $1`, [Math.floor(limit / 3)]);

    const activities = [...movementsResult.rows, ...purchasesResult.rows, ...salesResult.rows]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
    res.json({ activities });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get alerts
router.get('/dashboard/alerts', authenticate, async (req, res) => {
  try {
    const alerts = [];
    const lowStock = await pool.query("SELECT id, name, stock_quantity FROM products WHERE stock_quantity <= reorder_level AND reorder_level > 0 LIMIT 10");
    lowStock.rows.forEach(p => alerts.push({ type: 'low_stock', severity: p.stock_quantity === 0 ? 'critical' : 'warning', message: `Low stock: ${p.name} (${p.stock_quantity})` }));
    const pendingMovements = await pool.query("SELECT COUNT(*) FROM stock_movements WHERE status = 'pending'");
    if (parseInt(pendingMovements.rows[0].count) > 0) alerts.push({ type: 'pending_approval', severity: 'info', message: `${pendingMovements.rows[0].count} movements pending` });
    res.json({ alerts });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ USERS (INTERFACE) ============

router.get('/users', authenticate, authorizeRoles('Super Admin', 'Admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;
    let queryText = `
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.is_active as status, r.name as role
      FROM users u LEFT JOIN user_roles r ON u.role_id = r.id WHERE 1=1`;
    const queryParams = [];
    if (search) {
      queryText += ` AND (u.username ILIKE $1 OR u.email ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1)`;
      queryParams.push(`%${search}%`);
    }
    queryText += ` ORDER BY u.username ASC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);
    const result = await pool.query(queryText, queryParams);
    const users = result.rows.map(u => ({
      ...u,
      name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username,
      status: u.status ? 'active' : 'inactive'
    }));
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ ADVANCED SEARCH (G41) ============

router.get('/search/global', authenticate, async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;
    if (!query || query.length < 2) return res.status(400).json({ error: 'Min 2 chars' });
    const pattern = `%${query}%`;
    const products = await pool.query("SELECT id, sku, name FROM products WHERE name ILIKE $1 OR sku ILIKE $1 LIMIT $2", [pattern, limit]);
    const customers = await pool.query("SELECT id, name, email FROM customers WHERE name ILIKE $1 OR email ILIKE $1 LIMIT $2", [pattern, limit]);
    res.json({ products: products.rows, customers: customers.rows });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/search/advanced', authenticate, async (req, res) => {
  try {
    const { entity, filters, page = 1, limit = 20 } = req.body;
    const tableMap = { products: 'products', customers: 'customers', suppliers: 'suppliers', purchases: 'purchases', sales_orders: 'sales_orders' };
    const table = tableMap[entity];
    if (!table) return res.status(400).json({ error: 'Invalid entity' });
    let query = `SELECT *, COUNT(*) OVER() as total_count FROM ${table} WHERE 1=1`;
    const params = [];
    filters.forEach((f, i) => {
      query += ` AND ${f.field} ILIKE $${i + 1}`;
      params.push(`%${f.value}%`);
    });
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, (page - 1) * limit);
    const result = await pool.query(query, params);
    res.json({ results: result.rows, total: result.rows[0]?.total_count || 0 });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ COLUMN SEARCH (N52) ============

router.get('/search/columns/:entity', authenticate, async (req, res) => {
  try {
    const columnMap = {
      products: [{ field: 'sku', label: 'SKU' }, { field: 'name', label: 'Name' }],
      customers: [{ field: 'name', label: 'Name' }, { field: 'email', label: 'Email' }],
      users: [{ field: 'username', label: 'Username' }, { field: 'role', label: 'Role' }]
    };
    const columns = columnMap[req.params.entity];
    if (!columns) return res.status(404).json({ error: 'Not found' });
    res.json({ columns });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
