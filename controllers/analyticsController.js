const db = require('../database/connection');
const ExcelJS = require('exceljs');

// G31 - Product Sheet + Stock Sheet
exports.getProductAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    // Get product details with current stock
    const productQuery = `
      SELECT p.*, pf.name as family_name,
        COALESCE(SUM(CASE WHEN sm.movement_type IN ('purchase', 'adjustment_in', 'return_in') 
          THEN sm.quantity ELSE -sm.quantity END), 0) as current_stock,
        COALESCE(SUM(CASE WHEN sm.movement_type = 'sale' THEN sm.quantity ELSE 0 END), 0) as total_sold,
        COALESCE(SUM(CASE WHEN sm.movement_type = 'purchase' THEN sm.quantity ELSE 0 END), 0) as total_purchased,
        COUNT(DISTINCT sm.id) as total_movements
      FROM products p
      LEFT JOIN product_families pf ON p.family_id = pf.id
      LEFT JOIN stock_movements sm ON p.id = sm.product_id
      WHERE p.id = $1
      GROUP BY p.id, pf.name
    `;

    const productResult = await db.query(productQuery, [id]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Get stock movement history
    const movementQuery = `
      SELECT sm.*, u.username as created_by_username
      FROM stock_movements sm
      LEFT JOIN users u ON sm.created_by = u.id
      WHERE sm.product_id = $1
        AND ($2::date IS NULL OR sm.movement_date >= $2)
        AND ($3::date IS NULL OR sm.movement_date <= $3)
      ORDER BY sm.movement_date DESC
      LIMIT 100
    `;

    const movementResult = await db.query(movementQuery, [
      id,
      start_date || null,
      end_date || null
    ]);

    // Get sales performance
    const salesQuery = `
      SELECT 
        DATE_TRUNC('month', sm.movement_date) as month,
        SUM(sm.quantity) as quantity_sold,
        AVG(sm.unit_price) as avg_price,
        SUM(sm.quantity * sm.unit_price) as total_revenue
      FROM stock_movements sm
      WHERE sm.product_id = $1 
        AND sm.movement_type = 'sale'
        AND ($2::date IS NULL OR sm.movement_date >= $2)
        AND ($3::date IS NULL OR sm.movement_date <= $3)
      GROUP BY DATE_TRUNC('month', sm.movement_date)
      ORDER BY month DESC
    `;

    const salesResult = await db.query(salesQuery, [
      id,
      start_date || null,
      end_date || null
    ]);

    // Get top customers for this product
    const customersQuery = `
      SELECT c.id, c.name, c.code,
        SUM(sm.quantity) as total_quantity,
        SUM(sm.quantity * sm.unit_price) as total_amount,
        COUNT(DISTINCT so.id) as order_count
      FROM stock_movements sm
      JOIN sales_orders so ON sm.sales_order_id = so.id
      JOIN customers c ON so.customer_id = c.id
      WHERE sm.product_id = $1 AND sm.movement_type = 'sale'
      GROUP BY c.id, c.name, c.code
      ORDER BY total_amount DESC
      LIMIT 10
    `;

    const customersResult = await db.query(customersQuery, [id]);

    res.json({
      success: true,
      data: {
        product: productResult.rows[0],
        movements: movementResult.rows,
        sales_performance: salesResult.rows,
        top_customers: customersResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching product analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// G33 - Customer/Supplier Analytics Sheet
exports.getCustomerAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    // Get customer details with statistics
    const customerQuery = `
      SELECT c.*,
        COUNT(DISTINCT so.id) as total_orders,
        COALESCE(SUM(so.total_amount), 0) as total_revenue,
        COALESCE(AVG(so.total_amount), 0) as average_order_value,
        MAX(so.order_date) as last_order_date,
        MIN(so.order_date) as first_order_date
      FROM customers c
      LEFT JOIN sales_orders so ON c.id = so.customer_id
      WHERE c.id = $1
        AND ($2::date IS NULL OR so.order_date >= $2)
        AND ($3::date IS NULL OR so.order_date <= $3)
      GROUP BY c.id
    `;

    const customerResult = await db.query(customerQuery, [
      id,
      start_date || null,
      end_date || null
    ]);

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Get order history
    const ordersQuery = `
      SELECT so.*, 
        u.username as created_by_username,
        COUNT(soi.id) as item_count
      FROM sales_orders so
      LEFT JOIN users u ON so.created_by = u.id
      LEFT JOIN sales_order_items soi ON so.id = soi.order_id
      WHERE so.customer_id = $1
        AND ($2::date IS NULL OR so.order_date >= $2)
        AND ($3::date IS NULL OR so.order_date <= $3)
      GROUP BY so.id, u.username
      ORDER BY so.order_date DESC
      LIMIT 50
    `;

    const ordersResult = await db.query(ordersQuery, [
      id,
      start_date || null,
      end_date || null
    ]);

    // Get top purchased products
    const productsQuery = `
      SELECT p.id, p.name, p.code,
        SUM(soi.quantity) as total_quantity,
        SUM(soi.quantity * soi.unit_price) as total_amount,
        AVG(soi.unit_price) as avg_price
      FROM sales_order_items soi
      JOIN products p ON soi.product_id = p.id
      JOIN sales_orders so ON soi.order_id = so.id
      WHERE so.customer_id = $1
        AND ($2::date IS NULL OR so.order_date >= $2)
        AND ($3::date IS NULL OR so.order_date <= $3)
      GROUP BY p.id, p.name, p.code
      ORDER BY total_amount DESC
      LIMIT 10
    `;

    const productsResult = await db.query(productsQuery, [
      id,
      start_date || null,
      end_date || null
    ]);

    // Get payment history
    const paymentsQuery = `
      SELECT ft.*
      FROM financial_transactions ft
      WHERE ft.customer_id = $1
      ORDER BY ft.transaction_date DESC
      LIMIT 20
    `;

    const paymentsResult = await db.query(paymentsQuery, [id]);

    // Get monthly revenue trend
    const trendQuery = `
      SELECT 
        DATE_TRUNC('month', so.order_date) as month,
        COUNT(so.id) as order_count,
        SUM(so.total_amount) as revenue
      FROM sales_orders so
      WHERE so.customer_id = $1
        AND ($2::date IS NULL OR so.order_date >= $2)
        AND ($3::date IS NULL OR so.order_date <= $3)
      GROUP BY month
      ORDER BY month DESC
    `;

    const trendResult = await db.query(trendQuery, [
      id,
      start_date || null,
      end_date || null
    ]);

    res.json({
      success: true,
      data: {
        customer: customerResult.rows[0],
        orders: ordersResult.rows,
        top_products: productsResult.rows,
        payments: paymentsResult.rows,
        revenue_trend: trendResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching customer analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getSupplierAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    // Get supplier details with statistics
    const supplierQuery = `
      SELECT s.*,
        COUNT(DISTINCT po.id) as total_orders,
        COALESCE(SUM(po.total_amount), 0) as total_spent,
        COALESCE(AVG(po.total_amount), 0) as average_order_value,
        MAX(po.order_date) as last_order_date,
        MIN(po.order_date) as first_order_date
      FROM suppliers s
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id
      WHERE s.id = $1
        AND ($2::date IS NULL OR po.order_date >= $2)
        AND ($3::date IS NULL OR po.order_date <= $3)
      GROUP BY s.id
    `;

    const supplierResult = await db.query(supplierQuery, [
      id,
      start_date || null,
      end_date || null
    ]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    // Get purchase order history
    const ordersQuery = `
      SELECT po.*, 
        u.username as created_by_username,
        COUNT(poi.id) as item_count
      FROM purchase_orders po
      LEFT JOIN users u ON po.created_by = u.id
      LEFT JOIN purchase_order_items poi ON po.id = poi.order_id
      WHERE po.supplier_id = $1
        AND ($2::date IS NULL OR po.order_date >= $2)
        AND ($3::date IS NULL OR po.order_date <= $3)
      GROUP BY po.id, u.username
      ORDER BY po.order_date DESC
      LIMIT 50
    `;

    const ordersResult = await db.query(ordersQuery, [
      id,
      start_date || null,
      end_date || null
    ]);

    // Get top purchased products from this supplier
    const productsQuery = `
      SELECT p.id, p.name, p.code,
        SUM(poi.quantity) as total_quantity,
        SUM(poi.quantity * poi.unit_price) as total_amount,
        AVG(poi.unit_price) as avg_price
      FROM purchase_order_items poi
      JOIN products p ON poi.product_id = p.id
      JOIN purchase_orders po ON poi.order_id = po.id
      WHERE po.supplier_id = $1
        AND ($2::date IS NULL OR po.order_date >= $2)
        AND ($3::date IS NULL OR po.order_date <= $3)
      GROUP BY p.id, p.name, p.code
      ORDER BY total_amount DESC
      LIMIT 10
    `;

    const productsResult = await db.query(productsQuery, [
      id,
      start_date || null,
      end_date || null
    ]);

    res.json({
      success: true,
      data: {
        supplier: supplierResult.rows[0],
        orders: ordersResult.rows,
        top_products: productsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching supplier analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Export Product Analytics to Excel
exports.exportProductAnalytics = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch product analytics data
    const productQuery = `
      SELECT p.*, pf.name as family_name,
        COALESCE(SUM(CASE WHEN sm.movement_type IN ('purchase', 'adjustment_in') 
          THEN sm.quantity ELSE -sm.quantity END), 0) as current_stock
      FROM products p
      LEFT JOIN product_families pf ON p.family_id = pf.id
      LEFT JOIN stock_movements sm ON p.id = sm.product_id
      WHERE p.id = $1
      GROUP BY p.id, pf.name
    `;

    const productResult = await db.query(productQuery, [id]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Product Analytics');

    // Add header
    worksheet.columns = [
      { header: 'Field', key: 'field', width: 30 },
      { header: 'Value', key: 'value', width: 50 }
    ];

    // Add product data
    worksheet.addRow({ field: 'Product Code', value: product.code });
    worksheet.addRow({ field: 'Product Name', value: product.name });
    worksheet.addRow({ field: 'Family', value: product.family_name });
    worksheet.addRow({ field: 'Current Stock', value: product.current_stock });
    worksheet.addRow({ field: 'Price', value: product.price });
    worksheet.addRow({ field: 'Status', value: product.status });

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=product_${product.code}_analytics.xlsx`
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting product analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = exports;