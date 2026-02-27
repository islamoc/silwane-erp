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
    // Get total products
    const productsResult = await pool.query(
      'SELECT COUNT(*) as total, SUM(stock_quantity) as total_stock FROM products'
    );

    // Get low stock products
    const lowStockResult = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE stock_quantity <= reorder_level AND reorder_level > 0'
    );

    // Get pending purchases
    const pendingPurchasesResult = await pool.query(
      "SELECT COUNT(*) as count, SUM(total_amount) as total FROM purchases WHERE status = 'draft'"
    );

    // Get pending sales
    const pendingSalesResult = await pool.query(
      "SELECT COUNT(*) as count, SUM(total_amount) as total FROM sales_orders WHERE status = 'draft'"
    );

    // Get confirmed purchases
    const confirmedPurchasesResult = await pool.query(
      "SELECT COUNT(*) as count, SUM(total_amount) as total FROM purchases WHERE status = 'confirmed'"
    );

    // Get confirmed sales
    const confirmedSalesResult = await pool.query(
      "SELECT COUNT(*) as count, SUM(total_amount) as total FROM sales_orders WHERE status = 'confirmed'"
    );

    // Get pending stock movements
    const pendingMovementsResult = await pool.query(
      "SELECT COUNT(*) as count FROM stock_movements WHERE status = 'pending'"
    );

    // Get inventory value
    const inventoryValueResult = await pool.query(
      'SELECT SUM(stock_quantity * unit_cost) as total_value FROM products WHERE stock_quantity > 0'
    );

    // Get active users
    const activeUsersResult = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE is_active = true"
    );

    res.json({
      products: {
        total: parseInt(productsResult.rows[0].total) || 0,
        total_stock: parseFloat(productsResult.rows[0].total_stock) || 0,
        low_stock: parseInt(lowStockResult.rows[0].count) || 0
      },
      purchases: {
        pending: {
          count: parseInt(pendingPurchasesResult.rows[0].count) || 0,
          total: parseFloat(pendingPurchasesResult.rows[0].total) || 0
        },
        confirmed: {
          count: parseInt(confirmedPurchasesResult.rows[0].count) || 0,
          total: parseFloat(confirmedPurchasesResult.rows[0].total) || 0
        }
      },
      sales: {
        pending: {
          count: parseInt(pendingSalesResult.rows[0].count) || 0,
          total: parseFloat(pendingSalesResult.rows[0].total) || 0
        },
        confirmed: {
          count: parseInt(confirmedSalesResult.rows[0].count) || 0,
          total: parseFloat(confirmedSalesResult.rows[0].total) || 0
        }
      },
      stock_movements: {
        pending: parseInt(pendingMovementsResult.rows[0].count) || 0
      },
      inventory: {
        total_value: parseFloat(inventoryValueResult.rows[0].total_value) || 0
      },
      users: {
        active: parseInt(activeUsersResult.rows[0].count) || 0
      }
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
    
    // Get recent stock movements
    const movementsResult = await pool.query(`
      SELECT 
        'stock_movement' as activity_type,
        sm.id,
        sm.movement_type,
        sm.quantity,
        p.name as product_name,
        sm.created_at,
        u.username as user
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      LEFT JOIN users u ON sm.created_by = u.id
      ORDER BY sm.created_at DESC
      LIMIT $1
    `, [Math.floor(limit / 3)]);

    // Get recent purchases
    const purchasesResult = await pool.query(`
      SELECT 
        'purchase' as activity_type,
        p.id,
        p.purchase_number,
        p.status,
        p.total_amount,
        s.name as supplier_name,
        p.created_at,
        u.username as user
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN users u ON p.created_by = u.id
      ORDER BY p.created_at DESC
      LIMIT $1
    `, [Math.floor(limit / 3)]);

    // Get recent sales
    const salesResult = await pool.query(`
      SELECT 
        'sales_order' as activity_type,
        so.id,
        so.order_number,
        so.status,
        so.total_amount,
        c.name as customer_name,
        so.created_at,
        u.username as user
      FROM sales_orders so
      JOIN customers c ON so.customer_id = c.id
      LEFT JOIN users u ON so.created_by = u.id
      ORDER BY so.created_at DESC
      LIMIT $1
    `, [Math.floor(limit / 3)]);

    // Combine and sort all activities
    const activities = [
      ...movementsResult.rows,
      ...purchasesResult.rows,
      ...salesResult.rows
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);

    res.json({ activities });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get alerts and notifications
router.get('/dashboard/alerts', authenticate, async (req, res) => {
  try {
    const alerts = [];

    // Low stock alerts
    const lowStockResult = await pool.query(`
      SELECT id, sku, name, stock_quantity, reorder_level
      FROM products
      WHERE stock_quantity <= reorder_level AND reorder_level > 0
      ORDER BY stock_quantity ASC
      LIMIT 10
    `);

    lowStockResult.rows.forEach(product => {
      alerts.push({
        type: 'low_stock',
        severity: product.stock_quantity === 0 ? 'critical' : 'warning',
        message: `Low stock: ${product.name} (${product.stock_quantity} units)`,
        data: product
      });
    });

    // Pending approvals
    const pendingMovementsResult = await pool.query(`
      SELECT COUNT(*) as count FROM stock_movements WHERE status = 'pending'
    `);
    
    if (parseInt(pendingMovementsResult.rows[0].count) > 0) {
      alerts.push({
        type: 'pending_approval',
        severity: 'info',
        message: `${pendingMovementsResult.rows[0].count} stock movements pending approval`,
        data: { count: pendingMovementsResult.rows[0].count }
      });
    }

    // Overdue purchases
    const overduePurchasesResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM purchases
      WHERE status = 'confirmed' AND expected_date < CURRENT_DATE
    `);

    if (parseInt(overduePurchasesResult.rows[0].count) > 0) {
      alerts.push({
        type: 'overdue_purchase',
        severity: 'warning',
        message: `${overduePurchasesResult.rows[0].count} overdue purchases`,
        data: { count: overduePurchasesResult.rows[0].count }
      });
    }

    // Overdue sales
    const overdueSalesResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM sales_orders
      WHERE status = 'confirmed' AND delivery_date < CURRENT_DATE
    `);

    if (parseInt(overdueSalesResult.rows[0].count) > 0) {
      alerts.push({
        type: 'overdue_sale',
        severity: 'warning',
        message: `${overdueSalesResult.rows[0].count} overdue sales orders`,
        data: { count: overdueSalesResult.rows[0].count }
      });
    }

    res.json({ alerts });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ USERS (INTERFACE) ============

/**
 * @route GET /api/interface/users
 * @desc Get all users for the interface
 */
router.get('/users', authenticate, authorizeRoles('Super Admin', 'Admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let queryText = `
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, 
             u.is_active as status, r.name as role
      FROM users u
      LEFT JOIN user_roles r ON u.role_id = r.id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      queryText += ` AND (u.username ILIKE $${paramCount} OR u.email ILIKE $${paramCount} OR u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    queryText += ` ORDER BY u.username ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(limit, offset);

    const result = await pool.query(queryText, queryParams);
    
    // Map status for frontend compatibility
    const users = result.rows.map(user => ({
      ...user,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
      status: user.status ? 'active' : 'inactive'
    }));

    res.json({ users });
  } catch (error) {
    console.error('Error fetching users for interface:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route GET /api/interface/users/:id
 */
router.get('/users/:id', authenticate, authorizeRoles('Super Admin', 'Admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       LEFT JOIN user_roles r ON u.role_id = r.id 
       WHERE u.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ ADVANCED SEARCH (G41) ============

// Global search across all entities
router.get('/search/global', authenticate, async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;
    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const searchPattern = `%${query}%`;
    const results = {};

    // Search products
    const productsResult = await pool.query(`
      SELECT 'product' as entity_type, id, sku, name, stock_quantity
      FROM products
      WHERE name ILIKE $1 OR sku ILIKE $1 OR description ILIKE $1
      LIMIT $2
    `, [searchPattern, limit]);
    results.products = productsResult.rows;

    // Search customers
    const customersResult = await pool.query(`
      SELECT 'customer' as entity_type, id, name, email, phone
      FROM customers
      WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1
      LIMIT $2
    `, [searchPattern, limit]);
    results.customers = customersResult.rows;

    // Search suppliers
    const suppliersResult = await pool.query(`
      SELECT 'supplier' as entity_type, id, name, email, phone
      FROM suppliers
      WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1
      LIMIT $2
    `, [searchPattern, limit]);
    results.suppliers = suppliersResult.rows;

    res.json(results);
  } catch (error) {
    console.error('Error performing global search:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ COLUMN SEARCH (N52) ============

// Get searchable columns for entity
router.get('/search/columns/:entity', authenticate, async (req, res) => {
  try {
    const { entity } = req.params;
    
    const columnMap = {
      products: [
        { field: 'sku', label: 'SKU', type: 'text' },
        { field: 'name', label: 'Name', type: 'text' },
        { field: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] }
      ],
      customers: [
        { field: 'name', label: 'Name', type: 'text' },
        { field: 'email', label: 'Email', type: 'text' }
      ],
      users: [
        { field: 'username', label: 'Username', type: 'text' },
        { field: 'email', label: 'Email', type: 'text' },
        { field: 'role', label: 'Role', type: 'text' }
      ]
    };

    const columns = columnMap[entity];
    if (!columns) return res.status(404).json({ error: 'Entity not found' });
    
    res.json({ columns });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
