// MC08 - Module Interface Utilisateurs (User Interface Module)
// G35 - Interface - barre d'information (Information Bar Interface)
// G41 - Recherches et filtres avancés (Advanced Search and Filters)
// N52 - Interface - recherche par colonne (Column Search Interface)

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

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
      'SELECT COUNT(*) as count, SUM(total_amount) as total FROM purchases WHERE status = \'draft\''
    );

    // Get pending sales
    const pendingSalesResult = await pool.query(
      'SELECT COUNT(*) as count, SUM(total_amount) as total FROM sales_orders WHERE status = \'draft\''
    );

    // Get confirmed purchases
    const confirmedPurchasesResult = await pool.query(
      'SELECT COUNT(*) as count, SUM(total_amount) as total FROM purchases WHERE status = \'confirmed\''
    );

    // Get confirmed sales
    const confirmedSalesResult = await pool.query(
      'SELECT COUNT(*) as count, SUM(total_amount) as total FROM sales_orders WHERE status = \'confirmed\''
    );

    // Get pending stock movements
    const pendingMovementsResult = await pool.query(
      'SELECT COUNT(*) as count FROM stock_movements WHERE status = \'pending\''
    );

    // Get inventory value
    const inventoryValueResult = await pool.query(
      'SELECT SUM(stock_quantity * unit_cost) as total_value FROM products WHERE stock_quantity > 0'
    );

    // Get active users
    const activeUsersResult = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE status = \'active\''
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

    // Search purchases
    const purchasesResult = await pool.query(`
      SELECT 'purchase' as entity_type, p.id, p.purchase_number, p.status, p.total_amount, s.name as supplier_name
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.purchase_number ILIKE $1 OR s.name ILIKE $1
      LIMIT $2
    `, [searchPattern, limit]);
    results.purchases = purchasesResult.rows;

    // Search sales orders
    const salesResult = await pool.query(`
      SELECT 'sales_order' as entity_type, so.id, so.order_number, so.status, so.total_amount, c.name as customer_name
      FROM sales_orders so
      JOIN customers c ON so.customer_id = c.id
      WHERE so.order_number ILIKE $1 OR c.name ILIKE $1
      LIMIT $2
    `, [searchPattern, limit]);
    results.sales_orders = salesResult.rows;

    res.json(results);
  } catch (error) {
    console.error('Error performing global search:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Advanced filter builder
router.post('/search/advanced', authenticate, async (req, res) => {
  try {
    const { entity, filters, sort_by, sort_order = 'ASC', page = 1, limit = 20 } = req.body;

    if (!entity || !filters) {
      return res.status(400).json({ error: 'Entity and filters are required' });
    }

    // Map entity to table
    const entityMap = {
      products: 'products',
      customers: 'customers',
      suppliers: 'suppliers',
      purchases: 'purchases',
      sales_orders: 'sales_orders',
      stock_movements: 'stock_movements'
    };

    const table = entityMap[entity];
    if (!table) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    // Build dynamic query
    let query = `SELECT *, COUNT(*) OVER() as total_count FROM ${table} WHERE 1=1`;
    const params = [];
    let paramCount = 1;

    // Apply filters
    filters.forEach(filter => {
      const { field, operator, value } = filter;

      switch (operator) {
        case 'equals':
          query += ` AND ${field} = $${paramCount}`;
          params.push(value);
          paramCount++;
          break;
        case 'not_equals':
          query += ` AND ${field} != $${paramCount}`;
          params.push(value);
          paramCount++;
          break;
        case 'contains':
          query += ` AND ${field} ILIKE $${paramCount}`;
          params.push(`%${value}%`);
          paramCount++;
          break;
        case 'starts_with':
          query += ` AND ${field} ILIKE $${paramCount}`;
          params.push(`${value}%`);
          paramCount++;
          break;
        case 'ends_with':
          query += ` AND ${field} ILIKE $${paramCount}`;
          params.push(`%${value}`);
          paramCount++;
          break;
        case 'greater_than':
          query += ` AND ${field} > $${paramCount}`;
          params.push(value);
          paramCount++;
          break;
        case 'less_than':
          query += ` AND ${field} < $${paramCount}`;
          params.push(value);
          paramCount++;
          break;
        case 'between':
          query += ` AND ${field} BETWEEN $${paramCount} AND $${paramCount + 1}`;
          params.push(value.min, value.max);
          paramCount += 2;
          break;
        case 'in':
          query += ` AND ${field} = ANY($${paramCount})`;
          params.push(value);
          paramCount++;
          break;
        case 'is_null':
          query += ` AND ${field} IS NULL`;
          break;
        case 'is_not_null':
          query += ` AND ${field} IS NOT NULL`;
          break;
      }
    });

    // Apply sorting
    if (sort_by) {
      query += ` ORDER BY ${sort_by} ${sort_order}`;
    }

    // Apply pagination
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await pool.query(query, params);

    res.json({
      results: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows[0]?.total_count || 0
      }
    });
  } catch (error) {
    console.error('Error performing advanced search:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ COLUMN SEARCH (N52) ============

// Get searchable columns for entity
router.get('/search/columns/:entity', authenticate, async (req, res) => {
  try {
    const { entity } = req.params;

    // Define searchable columns for each entity
    const columnMap = {
      products: [
        { field: 'sku', label: 'SKU', type: 'text' },
        { field: 'name', label: 'Name', type: 'text' },
        { field: 'description', label: 'Description', type: 'text' },
        { field: 'stock_quantity', label: 'Stock Quantity', type: 'number' },
        { field: 'unit_cost', label: 'Unit Cost', type: 'number' },
        { field: 'unit_price', label: 'Unit Price', type: 'number' },
        { field: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] }
      ],
      customers: [
        { field: 'name', label: 'Name', type: 'text' },
        { field: 'email', label: 'Email', type: 'text' },
        { field: 'phone', label: 'Phone', type: 'text' },
        { field: 'city', label: 'City', type: 'text' },
        { field: 'country', label: 'Country', type: 'text' },
        { field: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] }
      ],
      suppliers: [
        { field: 'name', label: 'Name', type: 'text' },
        { field: 'email', label: 'Email', type: 'text' },
        { field: 'phone', label: 'Phone', type: 'text' },
        { field: 'city', label: 'City', type: 'text' },
        { field: 'country', label: 'Country', type: 'text' },
        { field: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] }
      ],
      purchases: [
        { field: 'purchase_number', label: 'Purchase Number', type: 'text' },
        { field: 'status', label: 'Status', type: 'select', options: ['draft', 'confirmed', 'partial', 'received', 'cancelled'] },
        { field: 'order_date', label: 'Order Date', type: 'date' },
        { field: 'expected_date', label: 'Expected Date', type: 'date' },
        { field: 'total_amount', label: 'Total Amount', type: 'number' }
      ],
      sales_orders: [
        { field: 'order_number', label: 'Order Number', type: 'text' },
        { field: 'status', label: 'Status', type: 'select', options: ['draft', 'confirmed', 'shipped', 'delivered', 'cancelled'] },
        { field: 'order_date', label: 'Order Date', type: 'date' },
        { field: 'delivery_date', label: 'Delivery Date', type: 'date' },
        { field: 'total_amount', label: 'Total Amount', type: 'number' }
      ]
    };

    const columns = columnMap[entity];
    if (!columns) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    res.json({ columns });
  } catch (error) {
    console.error('Error fetching searchable columns:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;