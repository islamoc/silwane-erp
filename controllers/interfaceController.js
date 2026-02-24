const db = require('../database/connection');

// G35 - Information Dashboard Bar
exports.getDashboardInfo = async (req, res) => {
  try {
    // Real-time KPIs
    const kpisQuery = `
      SELECT 
        (SELECT COUNT(*) FROM sales_orders WHERE status = 'pending') as pending_orders,
        (SELECT COUNT(*) FROM sales_quotes WHERE status = 'pending') as pending_quotes,
        (SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders 
          WHERE DATE(order_date) = CURRENT_DATE) as today_sales,
        (SELECT COUNT(*) FROM products WHERE track_stock = true AND 
          (SELECT COALESCE(SUM(quantity), 0) FROM stock_movements WHERE product_id = products.id) <= minimum_stock
        ) as low_stock_items,
        (SELECT COUNT(*) FROM payment_schedules WHERE status = 'pending' AND due_date < CURRENT_DATE) as overdue_payments,
        (SELECT COUNT(*) FROM vouchers WHERE status = 'pending') as pending_vouchers
    `;

    const kpisResult = await db.query(kpisQuery);

    // Recent activities
    const activitiesQuery = `
      SELECT 'order' as type, reference as title, order_date as date, status
      FROM sales_orders
      WHERE order_date >= CURRENT_DATE - INTERVAL '7 days'
      UNION ALL
      SELECT 'quote' as type, reference as title, quote_date as date, status
      FROM sales_quotes
      WHERE quote_date >= CURRENT_DATE - INTERVAL '7 days'
      UNION ALL
      SELECT 'payment' as type, reference as title, transaction_date as date, status::text
      FROM financial_transactions
      WHERE transaction_date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY date DESC
      LIMIT 10
    `;

    const activitiesResult = await db.query(activitiesQuery);

    // System notifications
    const notificationsQuery = `
      SELECT 
        'Low Stock Alert' as type,
        'Product ' || p.name || ' is low on stock' as message,
        'warning' as severity,
        CURRENT_TIMESTAMP as created_at
      FROM products p
      WHERE track_stock = true AND 
        (SELECT COALESCE(SUM(quantity), 0) FROM stock_movements WHERE product_id = p.id) <= p.minimum_stock
      
      UNION ALL
      
      SELECT 
        'Overdue Payment' as type,
        'Payment schedule overdue for ' || c.name as message,
        'error' as severity,
        ps.due_date as created_at
      FROM payment_schedules ps
      JOIN sales_orders so ON ps.order_id = so.id
      JOIN customers c ON so.customer_id = c.id
      WHERE ps.status = 'pending' AND ps.due_date < CURRENT_DATE
      
      UNION ALL
      
      SELECT 
        'Pending Approval' as type,
        'Order ' || reference || ' pending approval' as message,
        'info' as severity,
        created_at
      FROM sales_orders
      WHERE status = 'pending'
      
      ORDER BY created_at DESC
      LIMIT 15
    `;

    const notificationsResult = await db.query(notificationsQuery);

    res.json({
      success: true,
      data: {
        kpis: kpisResult.rows[0],
        recent_activities: activitiesResult.rows,
        notifications: notificationsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// G41 - Advanced Search and Filters
exports.advancedSearch = async (req, res) => {
  try {
    const { 
      entity_type, // 'products', 'customers', 'orders', etc.
      filters,      // Array of filter objects
      sort_by,
      sort_order = 'ASC',
      page = 1,
      limit = 20
    } = req.body;

    const offset = (page - 1) * limit;

    // Build dynamic query based on entity type and filters
    let baseQuery, countQuery;
    const params = [];
    let paramIndex = 1;
    let whereClause = 'WHERE 1=1';

    // Build WHERE clause from filters
    if (filters && Array.isArray(filters)) {
      for (const filter of filters) {
        const { field, operator, value } = filter;
        
        switch (operator) {
          case 'equals':
            whereClause += ` AND ${field} = $${paramIndex}`;
            params.push(value);
            paramIndex++;
            break;
          case 'not_equals':
            whereClause += ` AND ${field} != $${paramIndex}`;
            params.push(value);
            paramIndex++;
            break;
          case 'contains':
            whereClause += ` AND ${field} ILIKE $${paramIndex}`;
            params.push(`%${value}%`);
            paramIndex++;
            break;
          case 'starts_with':
            whereClause += ` AND ${field} ILIKE $${paramIndex}`;
            params.push(`${value}%`);
            paramIndex++;
            break;
          case 'ends_with':
            whereClause += ` AND ${field} ILIKE $${paramIndex}`;
            params.push(`%${value}`);
            paramIndex++;
            break;
          case 'greater_than':
            whereClause += ` AND ${field} > $${paramIndex}`;
            params.push(value);
            paramIndex++;
            break;
          case 'less_than':
            whereClause += ` AND ${field} < $${paramIndex}`;
            params.push(value);
            paramIndex++;
            break;
          case 'between':
            whereClause += ` AND ${field} BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
            params.push(value.min, value.max);
            paramIndex += 2;
            break;
          case 'in':
            whereClause += ` AND ${field} = ANY($${paramIndex}::text[])`;
            params.push(value);
            paramIndex++;
            break;
          case 'is_null':
            whereClause += ` AND ${field} IS NULL`;
            break;
          case 'is_not_null':
            whereClause += ` AND ${field} IS NOT NULL`;
            break;
        }
      }
    }

    // Define queries based on entity type
    switch (entity_type) {
      case 'products':
        baseQuery = `
          SELECT p.*, pf.name as family_name,
            COALESCE(SUM(sm.quantity), 0) as current_stock
          FROM products p
          LEFT JOIN product_families pf ON p.family_id = pf.id
          LEFT JOIN stock_movements sm ON p.id = sm.product_id
          ${whereClause}
          GROUP BY p.id, pf.name
        `;
        countQuery = `SELECT COUNT(DISTINCT p.id) FROM products p ${whereClause}`;
        break;

      case 'customers':
        baseQuery = `
          SELECT c.*,
            COUNT(DISTINCT so.id) as order_count,
            COALESCE(SUM(so.total_amount), 0) as total_spent
          FROM customers c
          LEFT JOIN sales_orders so ON c.id = so.customer_id
          ${whereClause}
          GROUP BY c.id
        `;
        countQuery = `SELECT COUNT(*) FROM customers c ${whereClause}`;
        break;

      case 'sales_orders':
        baseQuery = `
          SELECT so.*, c.name as customer_name,
            u.username as created_by_username
          FROM sales_orders so
          LEFT JOIN customers c ON so.customer_id = c.id
          LEFT JOIN users u ON so.created_by = u.id
          ${whereClause}
        `;
        countQuery = `SELECT COUNT(*) FROM sales_orders so ${whereClause}`;
        break;

      case 'purchase_orders':
        baseQuery = `
          SELECT po.*, s.name as supplier_name,
            u.username as created_by_username
          FROM purchase_orders po
          LEFT JOIN suppliers s ON po.supplier_id = s.id
          LEFT JOIN users u ON po.created_by = u.id
          ${whereClause}
        `;
        countQuery = `SELECT COUNT(*) FROM purchase_orders po ${whereClause}`;
        break;

      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid entity type' 
        });
    }

    // Add sorting
    if (sort_by) {
      baseQuery += ` ORDER BY ${sort_by} ${sort_order}`;
    }

    // Add pagination
    baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    // Execute queries
    const [dataResult, countResult] = await Promise.all([
      db.query(baseQuery, params),
      db.query(countQuery, params.slice(0, -2)) // Exclude limit and offset for count
    ]);

    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in advanced search:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// N52 - Column-based Search
exports.columnSearch = async (req, res) => {
  try {
    const { 
      table,
      column,
      search_term,
      page = 1,
      limit = 20
    } = req.query;

    const offset = (page - 1) * limit;

    // Validate table and column to prevent SQL injection
    const allowedTables = [
      'products', 'customers', 'suppliers', 'sales_orders', 
      'purchase_orders', 'stock_movements', 'financial_transactions'
    ];

    if (!allowedTables.includes(table)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid table name' 
      });
    }

    // Get column metadata
    const columnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = 'public'
    `;

    const columnsResult = await db.query(columnsQuery, [table]);
    const columns = columnsResult.rows.map(row => row.column_name);

    if (!columns.includes(column)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid column name' 
      });
    }

    // Build and execute search query
    const query = `
      SELECT * FROM ${table}
      WHERE ${column}::text ILIKE $1
      ORDER BY ${column}
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [
      `%${search_term}%`,
      limit,
      offset
    ]);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) FROM ${table}
      WHERE ${column}::text ILIKE $1
    `;

    const countResult = await db.query(countQuery, [`%${search_term}%`]);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in column search:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Save Search Template
exports.saveSearchTemplate = async (req, res) => {
  try {
    const { name, description, entity_type, filters, sort_config } = req.body;

    const query = `
      INSERT INTO search_templates (
        name, description, entity_type, filters, sort_config, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await db.query(query, [
      name,
      description,
      entity_type,
      JSON.stringify(filters),
      JSON.stringify(sort_config),
      req.user.id
    ]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error saving search template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get Saved Search Templates
exports.getSearchTemplates = async (req, res) => {
  try {
    const { entity_type } = req.query;

    let query = `
      SELECT st.*, u.username as created_by_username
      FROM search_templates st
      LEFT JOIN users u ON st.created_by = u.id
      WHERE 1=1
    `;

    const params = [];
    if (entity_type) {
      query += ' AND st.entity_type = $1';
      params.push(entity_type);
    }

    query += ' ORDER BY st.created_at DESC';

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching search templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get Available Filters for Entity
exports.getAvailableFilters = async (req, res) => {
  try {
    const { entity_type } = req.params;

    // Define filterable fields for each entity
    const filterableFields = {
      products: [
        { field: 'name', type: 'text', operators: ['contains', 'equals', 'starts_with'] },
        { field: 'code', type: 'text', operators: ['contains', 'equals'] },
        { field: 'price', type: 'number', operators: ['equals', 'greater_than', 'less_than', 'between'] },
        { field: 'status', type: 'select', operators: ['equals', 'in'], options: ['active', 'inactive', 'discontinued'] },
        { field: 'family_id', type: 'reference', operators: ['equals', 'in'] },
        { field: 'created_at', type: 'date', operators: ['equals', 'greater_than', 'less_than', 'between'] }
      ],
      customers: [
        { field: 'name', type: 'text', operators: ['contains', 'equals', 'starts_with'] },
        { field: 'code', type: 'text', operators: ['contains', 'equals'] },
        { field: 'email', type: 'text', operators: ['contains', 'equals'] },
        { field: 'phone', type: 'text', operators: ['contains', 'equals'] },
        { field: 'status', type: 'select', operators: ['equals'], options: ['active', 'inactive'] },
        { field: 'credit_limit', type: 'number', operators: ['greater_than', 'less_than', 'between'] }
      ],
      sales_orders: [
        { field: 'reference', type: 'text', operators: ['contains', 'equals'] },
        { field: 'status', type: 'select', operators: ['equals', 'in'], options: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] },
        { field: 'total_amount', type: 'number', operators: ['greater_than', 'less_than', 'between'] },
        { field: 'order_date', type: 'date', operators: ['equals', 'greater_than', 'less_than', 'between'] },
        { field: 'customer_id', type: 'reference', operators: ['equals', 'in'] }
      ]
    };

    const filters = filterableFields[entity_type];

    if (!filters) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid entity type' 
      });
    }

    res.json({ success: true, data: filters });
  } catch (error) {
    console.error('Error fetching available filters:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = exports;