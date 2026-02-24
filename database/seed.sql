-- =====================================================
-- Silwane ERP - Seed Data
-- =====================================================

-- =====================================================
-- USER ROLES
-- =====================================================

INSERT INTO user_roles (name, description, permissions) VALUES
('Super Admin', 'Full system access', '{"all": true}'),
('Admin', 'Administrative access', '{"users": true, "settings": true, "reports": true}'),
('Manager', 'Management level access', '{"approve_orders": true, "view_reports": true, "manage_inventory": true}'),
('Sales', 'Sales team access', '{"sales": true, "customers": true, "quotes": true, "orders": true}'),
('Purchase', 'Purchasing team access', '{"purchases": true, "suppliers": true, "purchase_orders": true}'),
('Warehouse', 'Warehouse operations', '{"inventory": true, "stock_movements": true}'),
('Finance', 'Financial operations', '{"transactions": true, "vouchers": true, "reports": true}'),
('User', 'Basic user access', '{"view_products": true, "view_orders": true}');

-- =====================================================
-- DEFAULT USERS
-- =====================================================
-- Password for all: Password123!
-- Hash: $2a$10$YourHashedPasswordHere (use bcrypt to generate)

INSERT INTO users (username, email, password_hash, first_name, last_name, role_id, is_active) VALUES
('admin', 'admin@silwane-erp.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'User', 1, true),
('islam', 'azeddine.mennouchi@owasp.org', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Islam Azeddine', 'Mennouchi', 1, true),
('sales_user', 'sales@silwane-erp.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Sales', 'Representative', 4, true),
('purchase_user', 'purchase@silwane-erp.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Purchase', 'Manager', 5, true),
('warehouse_user', 'warehouse@silwane-erp.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Warehouse', 'Staff', 6, true);

-- =====================================================
-- SYSTEM SETTINGS
-- =====================================================

INSERT INTO settings (key, value, category, description, is_public) VALUES
('company_name', 'Silwane Company', 'company', 'Company Name', true),
('company_address', 'Algiers, Algeria', 'company', 'Company Address', true),
('company_phone', '+213 XXX XXX XXX', 'company', 'Company Phone', true),
('company_email', 'contact@silwane-erp.com', 'company', 'Company Email', true),
('default_currency', 'DZD', 'financial', 'Default Currency', true),
('default_tax_rate', '19', 'financial', 'Default Tax Rate (%)', true),
('low_stock_threshold', '10', 'inventory', 'Low Stock Alert Threshold', false),
('reorder_point', '20', 'inventory', 'Default Reorder Point', false),
('date_format', 'DD/MM/YYYY', 'system', 'Date Display Format', true),
('time_format', '24h', 'system', '24-hour or 12-hour time format', true);

-- =====================================================
-- PRODUCT FAMILIES (G02 - Hierarchical)
-- =====================================================

INSERT INTO product_families (code, name, parent_id, description, level, path, created_by) VALUES
('F001', 'Electronics', NULL, 'Electronic devices and components', 1, '/F001', 1),
('F001-01', 'Computers', 1, 'Desktop and laptop computers', 2, '/F001/F001-01', 1),
('F001-02', 'Smartphones', 1, 'Mobile phones and accessories', 2, '/F001/F001-02', 1),
('F001-03', 'Tablets', 1, 'Tablet devices', 2, '/F001/F001-03', 1),

('F002', 'Office Supplies', NULL, 'Office equipment and supplies', 1, '/F002', 1),
('F002-01', 'Stationery', 5, 'Pens, papers, notebooks', 2, '/F002/F002-01', 1),
('F002-02', 'Furniture', 5, 'Office furniture', 2, '/F002/F002-02', 1),

('F003', 'Industrial Equipment', NULL, 'Industrial machinery and tools', 1, '/F003', 1),
('F003-01', 'Power Tools', 8, 'Electric and pneumatic tools', 2, '/F003/F003-01', 1),
('F003-02', 'Measuring Instruments', 8, 'Measurement devices', 2, '/F003/F003-02', 1);

-- =====================================================
-- PRODUCTS (G01, G05)
-- =====================================================

INSERT INTO products (sku, barcode, name, description, family_id, weight, weight_unit, volume, volume_unit, 
    length, width, height, dimension_unit, unit_of_measure, quantity_in_stock, min_stock_level, reorder_point, 
    cost_price, selling_price, warehouse_location, is_active, created_by) VALUES

-- Electronics
('LAPTOP-001', '1234567890123', 'Dell Latitude 5520', 'Business laptop with Intel Core i7', 2, 1.8, 'kg', 3.5, 'L', 35.5, 23.5, 2.0, 'cm', 'Unit', 25, 5, 10, 85000, 120000, 'A-01-01', true, 1),
('LAPTOP-002', '1234567890124', 'HP ProBook 450', 'Professional laptop for business use', 2, 2.0, 'kg', 4.0, 'L', 36.0, 24.0, 2.2, 'cm', 'Unit', 15, 5, 10, 75000, 105000, 'A-01-02', true, 1),
('PHONE-001', '1234567890125', 'Samsung Galaxy A54', '5G smartphone with 128GB storage', 3, 0.202, 'kg', 0.15, 'L', 15.8, 7.7, 0.82, 'cm', 'Unit', 50, 10, 20, 45000, 65000, 'A-02-01', true, 1),
('PHONE-002', '1234567890126', 'iPhone 13', 'Apple iPhone 13 128GB', 3, 0.174, 'kg', 0.12, 'L', 14.7, 7.2, 0.77, 'cm', 'Unit', 30, 10, 15, 95000, 130000, 'A-02-02', true, 1),
('TABLET-001', '1234567890127', 'iPad Air', 'Apple iPad Air 64GB', 4, 0.461, 'kg', 0.35, 'L', 24.8, 17.9, 0.61, 'cm', 'Unit', 20, 5, 10, 75000, 105000, 'A-02-03', true, 1),

-- Office Supplies
('STAT-001', '2234567890123', 'A4 Paper Ream', 'White A4 paper, 500 sheets', 6, 2.5, 'kg', 5.0, 'L', 29.7, 21.0, 5.0, 'cm', 'Ream', 200, 50, 100, 450, 650, 'B-01-01', true, 1),
('STAT-002', '2234567890124', 'Ballpoint Pens Box', 'Blue ballpoint pens, box of 50', 6, 0.5, 'kg', 1.0, 'L', 20.0, 10.0, 5.0, 'cm', 'Box', 100, 20, 40, 1200, 1800, 'B-01-02', true, 1),
('FURN-001', '2234567890125', 'Office Chair Executive', 'Ergonomic office chair with lumbar support', 7, 15.0, 'kg', 120.0, 'L', 65.0, 65.0, 120.0, 'cm', 'Unit', 10, 3, 5, 18000, 28000, 'B-02-01', true, 1),
('FURN-002', '2234567890126', 'Office Desk 1.4m', 'Modern office desk with drawers', 7, 35.0, 'kg', 180.0, 'L', 140.0, 70.0, 75.0, 'cm', 'Unit', 8, 2, 4, 25000, 38000, 'B-02-02', true, 1),

-- Industrial Equipment
('TOOL-001', '3234567890123', 'Cordless Drill 18V', 'Professional cordless drill with battery', 9, 2.2, 'kg', 8.0, 'L', 25.0, 20.0, 8.0, 'cm', 'Unit', 30, 5, 10, 12000, 18000, 'C-01-01', true, 1),
('TOOL-002', '3234567890124', 'Angle Grinder 125mm', 'Electric angle grinder 125mm disc', 9, 2.5, 'kg', 10.0, 'L', 30.0, 12.0, 15.0, 'cm', 'Unit', 25, 5, 10, 8500, 13000, 'C-01-02', true, 1),
('MEAS-001', '3234567890125', 'Digital Caliper', 'Digital caliper 0-150mm precision', 10, 0.3, 'kg', 0.5, 'L', 20.0, 8.0, 2.0, 'cm', 'Unit', 40, 10, 15, 2800, 4500, 'C-02-01', true, 1);

-- =====================================================
-- SUPPLIERS (MC03)
-- =====================================================

INSERT INTO suppliers (code, name, contact_person, email, phone, address_line1, city, country, 
    payment_terms, credit_limit, is_active, created_by) VALUES
('SUP-001', 'Tech Distributors Algeria', 'Ahmed Benali', 'contact@techdist.dz', '+213 21 XXX XXX', 
    '123 Rue de la Liberté', 'Algiers', 'Algeria', 'Net 30', 500000, true, 1),
('SUP-002', 'Office Supplies Co.', 'Fatima Zohra', 'sales@officesupplies.dz', '+213 21 YYY YYY', 
    '456 Boulevard Mohamed V', 'Oran', 'Algeria', 'Net 30', 300000, true, 1),
('SUP-003', 'Industrial Tools Ltd', 'Karim Mansour', 'info@industrialtools.dz', '+213 31 ZZZ ZZZ', 
    '789 Avenue de l''Indépendance', 'Constantine', 'Algeria', 'Net 45', 400000, true, 1),
('SUP-004', 'Electronics Wholesale', 'Nadia Kerroum', 'orders@electronicswholesale.dz', '+213 21 AAA AAA', 
    '321 Rue Didouche Mourad', 'Algiers', 'Algeria', 'Net 30', 600000, true, 1),
('SUP-005', 'Global Import Export', 'Rachid Boudiaf', 'contact@globalimport.dz', '+213 41 BBB BBB', 
    '654 Route Nationale 5', 'Annaba', 'Algeria', 'Net 60', 750000, true, 1);

-- =====================================================
-- CUSTOMERS (MC04)
-- =====================================================

INSERT INTO customers (code, name, company_name, contact_person, email, phone, 
    billing_address_line1, billing_city, billing_country, payment_terms, credit_limit, 
    customer_type, is_active, created_by) VALUES
('CUST-001', 'Mohamed Saidi', 'Saidi Enterprises', 'Mohamed Saidi', 'mohamed@saidienterprises.dz', '+213 551 XXX XXX', 
    '111 Rue Larbi Ben M''hidi', 'Algiers', 'Algeria', 'Net 30', 200000, 'Wholesale', true, 1),
('CUST-002', 'Samira Bouzid', 'Bouzid Trading', 'Samira Bouzid', 'samira@bouzidtrading.dz', '+213 552 YYY YYY', 
    '222 Avenue Emir Abdelkader', 'Oran', 'Algeria', 'Net 15', 100000, 'Retail', true, 1),
('CUST-003', 'Youcef Hamdi', 'Hamdi Corp', 'Youcef Hamdi', 'youcef@hamdicorp.dz', '+213 661 ZZZ ZZZ', 
    '333 Boulevard de la Soummam', 'Constantine', 'Algeria', 'Net 30', 250000, 'VIP', true, 1),
('CUST-004', 'Leila Messaoudi', 'Messaoudi Industries', 'Leila Messaoudi', 'leila@messaoudiind.dz', '+213 662 AAA AAA', 
    '444 Rue du 1er Novembre', 'Annaba', 'Algeria', 'Net 45', 300000, 'Wholesale', true, 1),
('CUST-005', 'Kamel Yahiaoui', 'Yahiaoui Electronics', 'Kamel Yahiaoui', 'kamel@yahiaouielec.dz', '+213 771 BBB BBB', 
    '555 Avenue de l''ALN', 'Sétif', 'Algeria', 'Net 30', 150000, 'Retail', true, 1),
('CUST-006', 'Amina Larbi', NULL, 'Amina Larbi', 'amina.larbi@email.dz', '+213 772 CCC CCC', 
    '666 Cité des Jardins', 'Algiers', 'Algeria', 'Cash', 50000, 'Regular', true, 1);

-- =====================================================
-- PAYMENT SCHEDULE TEMPLATES (N75)
-- =====================================================

INSERT INTO payment_schedules (template_name, description, schedule_type, number_of_payments, payment_frequency, schedule_details, created_by) VALUES
('30-60-90 Days', 'Three equal payments at 30, 60, and 90 days', 'PERCENTAGE', 3, 'CUSTOM', 
    '[{"payment_number": 1, "percentage": 33.33, "days_from_start": 30, "description": "First payment"}, 
      {"payment_number": 2, "percentage": 33.33, "days_from_start": 60, "description": "Second payment"}, 
      {"payment_number": 3, "percentage": 33.34, "days_from_start": 90, "description": "Final payment"}]', 1),

('50-50 Split', 'Two equal payments: 50% upfront, 50% on delivery', 'PERCENTAGE', 2, 'MILESTONE', 
    '[{"payment_number": 1, "percentage": 50, "milestone": "Order Confirmation", "description": "Advance payment"}, 
      {"payment_number": 2, "percentage": 50, "milestone": "Delivery", "description": "Balance payment"}]', 1),

('Monthly - 12 Months', 'Equal monthly payments over 12 months', 'FIXED', 12, 'MONTHLY', 
    '[{"payment_number": 1, "percentage": 8.33, "days_from_start": 30}, 
      {"payment_number": 2, "percentage": 8.33, "days_from_start": 60}, 
      {"payment_number": 3, "percentage": 8.33, "days_from_start": 90}, 
      {"payment_number": 4, "percentage": 8.33, "days_from_start": 120}, 
      {"payment_number": 5, "percentage": 8.33, "days_from_start": 150}, 
      {"payment_number": 6, "percentage": 8.33, "days_from_start": 180}, 
      {"payment_number": 7, "percentage": 8.33, "days_from_start": 210}, 
      {"payment_number": 8, "percentage": 8.33, "days_from_start": 240}, 
      {"payment_number": 9, "percentage": 8.33, "days_from_start": 270}, 
      {"payment_number": 10, "percentage": 8.33, "days_from_start": 300}, 
      {"payment_number": 11, "percentage": 8.33, "days_from_start": 330}, 
      {"payment_number": 12, "percentage": 8.37, "days_from_start": 360}]', 1);

-- =====================================================
-- SAMPLE PURCHASE ORDERS (MC03 - G11)
-- =====================================================

INSERT INTO purchase_orders (po_number, supplier_id, order_date, expected_delivery_date, status, 
    subtotal, tax_amount, total_amount, payment_terms, created_by) VALUES
('PO-2026-0001', 1, '2026-02-01', '2026-02-15', 'RECEIVED', 255000, 48450, 303450, 'Net 30', 4),
('PO-2026-0002', 2, '2026-02-10', '2026-02-24', 'ORDERED', 125000, 23750, 148750, 'Net 30', 4),
('PO-2026-0003', 3, '2026-02-15', '2026-03-01', 'APPROVED', 185000, 35150, 220150, 'Net 45', 4);

INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_price, tax_rate, line_total) VALUES
(1, 1, 3, 85000, 19, 255000),
(2, 6, 100, 450, 19, 45000),
(2, 7, 50, 1200, 19, 60000),
(3, 10, 10, 12000, 19, 120000),
(3, 11, 5, 8500, 19, 42500);

-- =====================================================
-- SAMPLE SALES QUOTES (MC04 - G17)
-- =====================================================

INSERT INTO sales_quotes (quote_number, customer_id, quote_type, quote_date, valid_until, status, 
    subtotal, tax_amount, total_amount, created_by) VALUES
('QT-2026-0001', 1, 'QUOTE', '2026-02-10', '2026-03-10', 'SENT', 240000, 45600, 285600, 3),
('QT-2026-0002', 3, 'PROFORMA', '2026-02-15', '2026-03-15', 'ACCEPTED', 130000, 24700, 154700, 3),
('QT-2026-0003', 5, 'QUOTE', '2026-02-20', '2026-03-20', 'DRAFT', 65000, 12350, 77350, 3);

INSERT INTO sales_quote_items (sales_quote_id, product_id, quantity, unit_price, tax_rate, line_total) VALUES
(1, 1, 2, 120000, 19, 240000),
(2, 4, 1, 130000, 19, 130000),
(3, 3, 1, 65000, 19, 65000);

-- =====================================================
-- SAMPLE SALES ORDERS (MC04 - G18)
-- =====================================================

INSERT INTO sales_orders (order_number, customer_id, quote_id, order_date, expected_delivery_date, 
    status, fulfillment_status, subtotal, tax_amount, total_amount, payment_status, created_by) VALUES
('SO-2026-0001', 1, NULL, '2026-02-05', '2026-02-19', 'DELIVERED', 'FULFILLED', 120000, 22800, 142800, 'PAID', 3),
('SO-2026-0002', 2, NULL, '2026-02-12', '2026-02-26', 'PROCESSING', 'PARTIAL', 183000, 34770, 217770, 'PARTIAL', 3),
('SO-2026-0003', 3, 2, '2026-02-16', '2026-03-02', 'CONFIRMED', 'UNFULFILLED', 130000, 24700, 154700, 'UNPAID', 3);

INSERT INTO sales_order_items (sales_order_id, product_id, quantity, shipped_quantity, unit_price, tax_rate, line_total) VALUES
(1, 1, 1, 1, 120000, 19, 120000),
(2, 3, 2, 1, 65000, 19, 130000),
(2, 12, 1, 1, 4500, 19, 4500),
(2, 6, 50, 50, 650, 19, 32500),
(3, 4, 1, 0, 130000, 19, 130000);

-- =====================================================
-- SAMPLE STOCK MOVEMENTS (MC01 - G09)
-- =====================================================

INSERT INTO stock_movements (movement_type, reference_number, product_id, quantity, unit_price, 
    total_value, quantity_before, quantity_after, from_location, to_location, warehouse, 
    related_document_type, reason, created_by, is_approved, approved_by) VALUES

('IN', 'SM-IN-2026-0001', 1, 3, 85000, 255000, 22, 25, 'RECEIVING', 'A-01-01', 'Main Warehouse', 'PURCHASE_ORDER', 'Purchase Order PO-2026-0001', 5, true, 3),
('OUT', 'SM-OUT-2026-0001', 1, 1, 120000, 120000, 25, 24, 'A-01-01', 'SHIPPING', 'Main Warehouse', 'SALES_ORDER', 'Sales Order SO-2026-0001', 5, true, 3),
('IN', 'SM-IN-2026-0002', 6, 100, 450, 45000, 100, 200, 'RECEIVING', 'B-01-01', 'Main Warehouse', 'PURCHASE_ORDER', 'Purchase Order PO-2026-0002', 5, true, 3),
('OUT', 'SM-OUT-2026-0002', 3, 2, 65000, 130000, 50, 48, 'A-02-01', 'SHIPPING', 'Main Warehouse', 'SALES_ORDER', 'Sales Order SO-2026-0002', 5, true, 3),
('ADJUSTMENT', 'SM-ADJ-2026-0001', 7, -2, 1800, -3600, 102, 100, 'B-01-02', 'B-01-02', 'Main Warehouse', NULL, 'Inventory adjustment - damaged items', 5, true, 3);

-- =====================================================
-- SAMPLE FINANCIAL TRANSACTIONS (MC05 - G26, G30)
-- =====================================================

INSERT INTO financial_transactions (transaction_number, transaction_type, category, transaction_date, 
    amount, from_account, to_account, related_party_type, related_party_id, reference_type, reference_number, 
    payment_method, status, description, created_by, approved_by, is_reconciled) VALUES

('FT-2026-0001', 'INCOME', 'Sales Revenue', '2026-02-19', 142800, 'Customer', 'Cash Account', 'CUSTOMER', 1, 'SALES_ORDER', 'SO-2026-0001', 'BANK_TRANSFER', 'COMPLETED', 'Payment for Sales Order SO-2026-0001', 7, 3, true),
('FT-2026-0002', 'EXPENSE', 'Purchase', '2026-02-15', 303450, 'Cash Account', 'Supplier', 'SUPPLIER', 1, 'PURCHASE_ORDER', 'PO-2026-0001', 'BANK_TRANSFER', 'COMPLETED', 'Payment for Purchase Order PO-2026-0001', 7, 3, true),
('FT-2026-0003', 'INCOME', 'Sales Revenue', '2026-02-20', 100000, 'Customer', 'Cash Account', 'CUSTOMER', 2, 'SALES_ORDER', 'SO-2026-0002', 'CHECK', 'COMPLETED', 'Partial payment for Sales Order SO-2026-0002', 7, 3, true),
('FT-2026-0004', 'EXPENSE', 'Operating Expense', '2026-02-10', 35000, 'Cash Account', 'Expense', NULL, NULL, NULL, NULL, 'CASH', 'COMPLETED', 'Monthly rent payment', 7, 3, false);

-- =====================================================
-- SAMPLE VOUCHERS (MC05 - G08)
-- =====================================================

INSERT INTO vouchers (voucher_number, voucher_type, voucher_date, amount, party_type, party_id, party_name, 
    reference_type, reference_number, payment_method, status, description, created_by, approved_by, posted_by) VALUES

('VCH-PAY-2026-0001', 'PAYMENT', '2026-02-15', 303450, 'SUPPLIER', 1, 'Tech Distributors Algeria', 'PURCHASE_ORDER', 'PO-2026-0001', 'BANK_TRANSFER', 'POSTED', 'Payment voucher for PO-2026-0001', 7, 3, 7),
('VCH-REC-2026-0001', 'RECEIPT', '2026-02-19', 142800, 'CUSTOMER', 1, 'Mohamed Saidi', 'SALES_ORDER', 'SO-2026-0001', 'BANK_TRANSFER', 'POSTED', 'Receipt voucher for SO-2026-0001', 7, 3, 7),
('VCH-REC-2026-0002', 'RECEIPT', '2026-02-20', 100000, 'CUSTOMER', 2, 'Samira Bouzid', 'SALES_ORDER', 'SO-2026-0002', 'CHECK', 'POSTED', 'Partial payment receipt for SO-2026-0002', 7, 3, 7);

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

SELECT 'Database seeded successfully!' AS message;