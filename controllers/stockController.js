const db = require('../database/connection');
const { validationResult } = require('express-validator');

// G01 - Stock Management Base
exports.getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, family_id, status } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, pf.name as family_name, pf.code as family_code,
        COALESCE(SUM(sm.quantity), 0) as current_stock
      FROM products p
      LEFT JOIN product_families pf ON p.family_id = pf.id
      LEFT JOIN stock_movements sm ON p.id = sm.product_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (p.name ILIKE $${paramIndex} OR p.code ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (family_id) {
      query += ` AND p.family_id = $${paramIndex}`;
      params.push(family_id);
      paramIndex++;
    }

    if (status) {
      query += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` GROUP BY p.id, pf.name, pf.code ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(DISTINCT p.id) FROM products p WHERE 1=1';
    const countParams = [];
    let countIndex = 1;

    if (search) {
      countQuery += ` AND (p.name ILIKE $${countIndex} OR p.code ILIKE $${countIndex})`;
      countParams.push(`%${search}%`);
      countIndex++;
    }

    if (family_id) {
      countQuery += ` AND p.family_id = $${countIndex}`;
      countParams.push(family_id);
    }

    const countResult = await db.query(countQuery, countParams);
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
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// G02 - Hierarchical Families
exports.getProductFamilies = async (req, res) => {
  try {
    const query = `
      WITH RECURSIVE family_tree AS (
        SELECT id, code, name, parent_id, description, 0 as level,
          ARRAY[id] as path, name::text as full_path
        FROM product_families
        WHERE parent_id IS NULL
        
        UNION ALL
        
        SELECT pf.id, pf.code, pf.name, pf.parent_id, pf.description,
          ft.level + 1,
          ft.path || pf.id,
          ft.full_path || ' > ' || pf.name
        FROM product_families pf
        JOIN family_tree ft ON pf.parent_id = ft.id
      )
      SELECT ft.*, 
        (SELECT COUNT(*) FROM products WHERE family_id = ft.id) as product_count,
        (SELECT COUNT(*) FROM product_families WHERE parent_id = ft.id) as child_count
      FROM family_tree ft
      ORDER BY ft.path
    `;

    const result = await db.query(query);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching product families:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// G05 - Weight, Volume and Dimensions
exports.updateProductDimensions = async (req, res) => {
  try {
    const { id } = req.params;
    const { weight, volume, length, width, height, weight_unit, volume_unit, dimension_unit } = req.body;

    const query = `
      UPDATE products SET
        weight = $1,
        volume = $2,
        length = $3,
        width = $4,
        height = $5,
        weight_unit = $6,
        volume_unit = $7,
        dimension_unit = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `;

    const result = await db.query(query, [
      weight, volume, length, width, height,
      weight_unit || 'kg', volume_unit || 'l', dimension_unit || 'cm',
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating product dimensions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// G09 - Stock Movement Journal
exports.getStockMovementJournal = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      product_id, 
      movement_type, 
      start_date, 
      end_date,
      warehouse_id 
    } = req.query;
    
    const offset = (page - 1) * limit;

    let query = `
      SELECT sm.*, 
        p.name as product_name, p.code as product_code,
        u.username as created_by_username,
        COALESCE(w.name, 'Default') as warehouse_name,
        po.reference as purchase_reference,
        so.reference as sales_reference
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      JOIN users u ON sm.created_by = u.id
      LEFT JOIN warehouses w ON sm.warehouse_id = w.id
      LEFT JOIN purchase_orders po ON sm.purchase_order_id = po.id
      LEFT JOIN sales_orders so ON sm.sales_order_id = so.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (product_id) {
      query += ` AND sm.product_id = $${paramIndex}`;
      params.push(product_id);
      paramIndex++;
    }

    if (movement_type) {
      query += ` AND sm.movement_type = $${paramIndex}`;
      params.push(movement_type);
      paramIndex++;
    }

    if (start_date) {
      query += ` AND sm.movement_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND sm.movement_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    if (warehouse_id) {
      query += ` AND sm.warehouse_id = $${paramIndex}`;
      params.push(warehouse_id);
      paramIndex++;
    }

    query += ` ORDER BY sm.movement_date DESC, sm.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM stock_movements sm WHERE 1=1';
    const countParams = [];
    let countIndex = 1;

    if (product_id) {
      countQuery += ` AND sm.product_id = $${countIndex}`;
      countParams.push(product_id);
      countIndex++;
    }

    if (movement_type) {
      countQuery += ` AND sm.movement_type = $${countIndex}`;
      countParams.push(movement_type);
      countIndex++;
    }

    if (start_date) {
      countQuery += ` AND sm.movement_date >= $${countIndex}`;
      countParams.push(start_date);
      countIndex++;
    }

    if (end_date) {
      countQuery += ` AND sm.movement_date <= $${countIndex}`;
      countParams.push(end_date);
    }

    const countResult = await db.query(countQuery, countParams);
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
    console.error('Error fetching stock movement journal:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Stock Alerts and Low Stock Notification
exports.getLowStockAlerts = async (req, res) => {
  try {
    const query = `
      SELECT p.*, pf.name as family_name,
        COALESCE(SUM(sm.quantity), 0) as current_stock,
        p.minimum_stock,
        (p.minimum_stock - COALESCE(SUM(sm.quantity), 0)) as shortage
      FROM products p
      LEFT JOIN product_families pf ON p.family_id = pf.id
      LEFT JOIN stock_movements sm ON p.id = sm.product_id
      WHERE p.track_stock = true
      GROUP BY p.id, pf.name
      HAVING COALESCE(SUM(sm.quantity), 0) <= p.minimum_stock
      ORDER BY shortage DESC
    `;

    const result = await db.query(query);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching low stock alerts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Bulk Stock Update
exports.bulkStockUpdate = async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    const { movements } = req.body; // Array of stock movements

    for (const movement of movements) {
      const query = `
        INSERT INTO stock_movements (
          product_id, quantity, movement_type, movement_date,
          reference, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      await client.query(query, [
        movement.product_id,
        movement.quantity,
        movement.movement_type,
        movement.movement_date || new Date(),
        movement.reference,
        movement.notes,
        req.user.id
      ]);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Bulk stock update completed' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in bulk stock update:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

module.exports = exports;