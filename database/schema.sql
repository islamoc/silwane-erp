-- =====================================================
-- Silwane ERP - Complete Database Schema
-- =====================================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS statistical_reports CASCADE;
DROP TABLE IF EXISTS financial_transactions CASCADE;
DROP TABLE IF EXISTS payment_schedules CASCADE;
DROP TABLE IF EXISTS vouchers CASCADE;
DROP TABLE IF EXISTS sales_order_items CASCADE;
DROP TABLE IF EXISTS sales_orders CASCADE;
DROP TABLE IF EXISTS sales_quote_items CASCADE;
DROP TABLE IF EXISTS sales_quotes CASCADE;
DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_families CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- =====================================================
-- CORE TABLES
-- =====================================================

-- User Roles Table
CREATE TABLE user_roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users Table (MC08 - Interface Utilisateurs)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role_id INTEGER REFERENCES user_roles(id),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    phone VARCHAR(20),
    address TEXT,
    avatar_url VARCHAR(500),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System Settings Table
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    category VARCHAR(50),
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- MC01 - MODULE STOCK (Inventory Management)
-- =====================================================

-- G02 - Product Families (Hierarchical)
CREATE TABLE product_families (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    parent_id INTEGER REFERENCES product_families(id),
    description TEXT,
    level INTEGER DEFAULT 1,
    path VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- G01, G05 - Products (Stock Base + Dimensions)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) UNIQUE NOT NULL,
    barcode VARCHAR(100) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    family_id INTEGER REFERENCES product_families(id),
    
    -- G05 - Weight, Volume, and Dimensions
    weight DECIMAL(10, 3),
    weight_unit VARCHAR(10) DEFAULT 'kg',
    volume DECIMAL(10, 3),
    volume_unit VARCHAR(10) DEFAULT 'L',
    length DECIMAL(10, 2),
    width DECIMAL(10, 2),
    height DECIMAL(10, 2),
    dimension_unit VARCHAR(10) DEFAULT 'cm',
    
    -- Stock Information
    unit_of_measure VARCHAR(20),
    quantity_in_stock DECIMAL(10, 2) DEFAULT 0,
    min_stock_level DECIMAL(10, 2) DEFAULT 0,
    max_stock_level DECIMAL(10, 2),
    reorder_point DECIMAL(10, 2),
    reorder_quantity DECIMAL(10, 2),
    
    -- Pricing
    cost_price DECIMAL(12, 2),
    selling_price DECIMAL(12, 2),
    currency VARCHAR(3) DEFAULT 'DZD',
    tax_rate DECIMAL(5, 2) DEFAULT 19.00,
    
    -- Location
    warehouse_location VARCHAR(100),
    shelf_location VARCHAR(100),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    image_url VARCHAR(500),
    additional_images JSONB DEFAULT '[]',
    
    -- Metadata
    manufacturer VARCHAR(255),
    brand VARCHAR(100),
    model VARCHAR(100),
    color VARCHAR(50),
    size VARCHAR(50),
    tags JSONB DEFAULT '[]',
    custom_fields JSONB DEFAULT '{}',
    
    -- Tracking
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_stock_check TIMESTAMP
);

-- G09 - Stock Movements Journal
CREATE TABLE stock_movements (
    id SERIAL PRIMARY KEY,
    movement_type VARCHAR(50) NOT NULL, -- 'IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'RETURN'
    reference_number VARCHAR(100) UNIQUE NOT NULL,
    product_id INTEGER REFERENCES products(id) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit_price DECIMAL(12, 2),
    total_value DECIMAL(12, 2),
    
    -- Before and After
    quantity_before DECIMAL(10, 2),
    quantity_after DECIMAL(10, 2),
    
    -- Location
    from_location VARCHAR(100),
    to_location VARCHAR(100),
    warehouse VARCHAR(100),
    
    -- Reference
    related_document_type VARCHAR(50), -- 'PURCHASE_ORDER', 'SALES_ORDER', 'TRANSFER', etc.
    related_document_id INTEGER,
    
    -- Details
    reason VARCHAR(100),
    notes TEXT,
    batch_number VARCHAR(100),
    expiry_date DATE,
    
    -- Tracking
    movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    is_approved BOOLEAN DEFAULT false,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SUPPLIERS AND CUSTOMERS
-- =====================================================

-- Suppliers Table (MC03 - Module Achats)
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    mobile VARCHAR(20),
    fax VARCHAR(20),
    website VARCHAR(255),
    
    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Algeria',
    
    -- Tax Information
    tax_id VARCHAR(100),
    registration_number VARCHAR(100),
    
    -- Financial
    currency VARCHAR(3) DEFAULT 'DZD',
    payment_terms VARCHAR(100),
    credit_limit DECIMAL(12, 2),
    current_balance DECIMAL(12, 2) DEFAULT 0,
    
    -- Bank Details
    bank_name VARCHAR(255),
    bank_account VARCHAR(100),
    bank_branch VARCHAR(255),
    iban VARCHAR(100),
    swift_code VARCHAR(20),
    
    -- Rating and Performance
    rating DECIMAL(3, 2) DEFAULT 0,
    total_purchases DECIMAL(12, 2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    tags JSONB DEFAULT '[]',
    custom_fields JSONB DEFAULT '{}',
    
    -- Tracking
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers Table (MC04 - Module Ventes)
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    mobile VARCHAR(20),
    fax VARCHAR(20),
    website VARCHAR(255),
    
    -- Address
    billing_address_line1 VARCHAR(255),
    billing_address_line2 VARCHAR(255),
    billing_city VARCHAR(100),
    billing_state_province VARCHAR(100),
    billing_postal_code VARCHAR(20),
    billing_country VARCHAR(100) DEFAULT 'Algeria',
    
    shipping_address_line1 VARCHAR(255),
    shipping_address_line2 VARCHAR(255),
    shipping_city VARCHAR(100),
    shipping_state_province VARCHAR(100),
    shipping_postal_code VARCHAR(20),
    shipping_country VARCHAR(100) DEFAULT 'Algeria',
    
    -- Tax Information
    tax_id VARCHAR(100),
    registration_number VARCHAR(100),
    
    -- Financial
    currency VARCHAR(3) DEFAULT 'DZD',
    payment_terms VARCHAR(100),
    credit_limit DECIMAL(12, 2),
    current_balance DECIMAL(12, 2) DEFAULT 0,
    
    -- Bank Details
    bank_name VARCHAR(255),
    bank_account VARCHAR(100),
    bank_branch VARCHAR(255),
    
    -- Customer Segmentation
    customer_type VARCHAR(50) DEFAULT 'Regular', -- 'VIP', 'Wholesale', 'Retail', etc.
    customer_category VARCHAR(50),
    loyalty_points INTEGER DEFAULT 0,
    
    -- Performance
    total_sales DECIMAL(12, 2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    average_order_value DECIMAL(12, 2) DEFAULT 0,
    last_order_date DATE,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    tags JSONB DEFAULT '[]',
    custom_fields JSONB DEFAULT '{}',
    
    -- Tracking
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- MC03 - MODULE ACHATS (Purchasing)
-- =====================================================

-- G11 - Purchase Orders
CREATE TABLE purchase_orders (
    id SERIAL PRIMARY KEY,
    po_number VARCHAR(100) UNIQUE NOT NULL,
    supplier_id INTEGER REFERENCES suppliers(id) NOT NULL,
    
    -- Order Details
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'DRAFT', -- 'DRAFT', 'PENDING', 'APPROVED', 'ORDERED', 'PARTIAL', 'RECEIVED', 'CANCELLED'
    
    -- Financial
    currency VARCHAR(3) DEFAULT 'DZD',
    subtotal DECIMAL(12, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    shipping_cost DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) DEFAULT 0,
    
    -- Payment
    payment_terms VARCHAR(100),
    payment_status VARCHAR(50) DEFAULT 'UNPAID', -- 'UNPAID', 'PARTIAL', 'PAID'
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    
    -- Delivery
    delivery_address TEXT,
    delivery_contact VARCHAR(255),
    delivery_phone VARCHAR(20),
    
    -- Additional Information
    notes TEXT,
    internal_notes TEXT,
    terms_and_conditions TEXT,
    attachments JSONB DEFAULT '[]',
    
    -- Tracking
    created_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    received_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    cancelled_at TIMESTAMP
);

-- Purchase Order Items
CREATE TABLE purchase_order_items (
    id SERIAL PRIMARY KEY,
    purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) NOT NULL,
    
    -- Quantity
    quantity DECIMAL(10, 2) NOT NULL,
    received_quantity DECIMAL(10, 2) DEFAULT 0,
    unit_of_measure VARCHAR(20),
    
    -- Pricing
    unit_price DECIMAL(12, 2) NOT NULL,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    line_total DECIMAL(12, 2) NOT NULL,
    
    -- Additional
    notes TEXT,
    
    -- Tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- MC04 - MODULE VENTES (Sales)
-- =====================================================

-- G17 - Sales Quotes and Proforma
CREATE TABLE sales_quotes (
    id SERIAL PRIMARY KEY,
    quote_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) NOT NULL,
    
    -- Quote Details
    quote_type VARCHAR(50) DEFAULT 'QUOTE', -- 'QUOTE', 'PROFORMA'
    quote_date DATE NOT NULL,
    valid_until DATE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'DRAFT', -- 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'
    
    -- Financial
    currency VARCHAR(3) DEFAULT 'DZD',
    subtotal DECIMAL(12, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    shipping_cost DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) DEFAULT 0,
    
    -- Reference
    reference VARCHAR(255),
    customer_po_number VARCHAR(100),
    
    -- Additional Information
    notes TEXT,
    internal_notes TEXT,
    terms_and_conditions TEXT,
    attachments JSONB DEFAULT '[]',
    
    -- Conversion
    converted_to_order_id INTEGER,
    converted_at TIMESTAMP,
    
    -- Tracking
    created_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    accepted_at TIMESTAMP,
    rejected_at TIMESTAMP
);

-- Sales Quote Items
CREATE TABLE sales_quote_items (
    id SERIAL PRIMARY KEY,
    sales_quote_id INTEGER REFERENCES sales_quotes(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) NOT NULL,
    
    -- Quantity
    quantity DECIMAL(10, 2) NOT NULL,
    unit_of_measure VARCHAR(20),
    
    -- Pricing
    unit_price DECIMAL(12, 2) NOT NULL,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    line_total DECIMAL(12, 2) NOT NULL,
    
    -- Additional
    description TEXT,
    notes TEXT,
    
    -- Tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- G18 - Sales Orders
CREATE TABLE sales_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) NOT NULL,
    quote_id INTEGER REFERENCES sales_quotes(id),
    
    -- Order Details
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'
    fulfillment_status VARCHAR(50) DEFAULT 'UNFULFILLED', -- 'UNFULFILLED', 'PARTIAL', 'FULFILLED'
    
    -- Financial
    currency VARCHAR(3) DEFAULT 'DZD',
    subtotal DECIMAL(12, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    shipping_cost DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) DEFAULT 0,
    
    -- Payment
    payment_method VARCHAR(50),
    payment_terms VARCHAR(100),
    payment_status VARCHAR(50) DEFAULT 'UNPAID', -- 'UNPAID', 'PARTIAL', 'PAID', 'REFUNDED'
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    
    -- Shipping
    shipping_method VARCHAR(100),
    shipping_address TEXT,
    shipping_contact VARCHAR(255),
    shipping_phone VARCHAR(20),
    tracking_number VARCHAR(100),
    
    -- Reference
    customer_po_number VARCHAR(100),
    sales_person_id INTEGER REFERENCES users(id),
    
    -- Additional Information
    notes TEXT,
    internal_notes TEXT,
    terms_and_conditions TEXT,
    attachments JSONB DEFAULT '[]',
    
    -- Tracking
    created_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    cancelled_at TIMESTAMP
);

-- Sales Order Items
CREATE TABLE sales_order_items (
    id SERIAL PRIMARY KEY,
    sales_order_id INTEGER REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) NOT NULL,
    
    -- Quantity
    quantity DECIMAL(10, 2) NOT NULL,
    shipped_quantity DECIMAL(10, 2) DEFAULT 0,
    returned_quantity DECIMAL(10, 2) DEFAULT 0,
    unit_of_measure VARCHAR(20),
    
    -- Pricing
    unit_price DECIMAL(12, 2) NOT NULL,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    line_total DECIMAL(12, 2) NOT NULL,
    
    -- Additional
    description TEXT,
    notes TEXT,
    
    -- Tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- MC05 - MODULE TRÉSORERIE ET FINANCES
-- =====================================================

-- G26, G30 - Financial Transactions (Treasury + Categorization)
CREATE TABLE financial_transactions (
    id SERIAL PRIMARY KEY,
    transaction_number VARCHAR(100) UNIQUE NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- 'INCOME', 'EXPENSE', 'TRANSFER'
    category VARCHAR(100),
    subcategory VARCHAR(100),
    
    -- Transaction Details
    transaction_date DATE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'DZD',
    
    -- Parties
    from_account VARCHAR(100),
    to_account VARCHAR(100),
    related_party_type VARCHAR(50), -- 'CUSTOMER', 'SUPPLIER', 'EMPLOYEE', 'OTHER'
    related_party_id INTEGER,
    
    -- Reference
    reference_type VARCHAR(50), -- 'SALES_ORDER', 'PURCHASE_ORDER', 'INVOICE', 'VOUCHER', etc.
    reference_id INTEGER,
    reference_number VARCHAR(100),
    
    -- Payment Details
    payment_method VARCHAR(50), -- 'CASH', 'BANK_TRANSFER', 'CHECK', 'CARD', etc.
    check_number VARCHAR(100),
    bank_reference VARCHAR(100),
    
    -- Status
    status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'COMPLETED', 'CANCELLED', 'RECONCILED'
    is_reconciled BOOLEAN DEFAULT false,
    reconciled_at TIMESTAMP,
    
    -- G30 - Remarks and Notes
    description TEXT,
    remarks TEXT,
    notes TEXT,
    tags JSONB DEFAULT '[]',
    
    -- Attachments
    attachments JSONB DEFAULT '[]',
    
    -- Tracking
    created_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP
);

-- G08 - Vouchers (Settlement)
CREATE TABLE vouchers (
    id SERIAL PRIMARY KEY,
    voucher_number VARCHAR(100) UNIQUE NOT NULL,
    voucher_type VARCHAR(50) NOT NULL, -- 'PAYMENT', 'RECEIPT', 'JOURNAL', 'CONTRA'
    
    -- Voucher Details
    voucher_date DATE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'DZD',
    
    -- Party
    party_type VARCHAR(50), -- 'CUSTOMER', 'SUPPLIER', 'EMPLOYEE'
    party_id INTEGER,
    party_name VARCHAR(255),
    
    -- Reference
    reference_type VARCHAR(50),
    reference_id INTEGER,
    reference_number VARCHAR(100),
    
    -- Payment Details
    payment_method VARCHAR(50),
    check_number VARCHAR(100),
    check_date DATE,
    bank_name VARCHAR(255),
    bank_reference VARCHAR(100),
    
    -- Status
    status VARCHAR(50) DEFAULT 'DRAFT', -- 'DRAFT', 'APPROVED', 'POSTED', 'CANCELLED'
    
    -- Description
    description TEXT,
    narration TEXT,
    notes TEXT,
    
    -- Tracking
    created_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    posted_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    posted_at TIMESTAMP
);

-- N75 - Payment Schedule Models/Templates
CREATE TABLE payment_schedules (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Schedule Type
    schedule_type VARCHAR(50) NOT NULL, -- 'FIXED', 'PERCENTAGE', 'MILESTONE'
    
    -- Terms
    number_of_payments INTEGER,
    payment_frequency VARCHAR(50), -- 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'
    
    -- Schedule Details (JSONB for flexibility)
    schedule_details JSONB NOT NULL, -- [{"payment_number": 1, "percentage": 30, "days_from_start": 0}, ...]
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_template BOOLEAN DEFAULT true,
    
    -- Tracking
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- MC09 - MODULE STATISTIQUES (Statistics)
-- =====================================================

-- G38, G39, G40 - Statistical Reports
CREATE TABLE statistical_reports (
    id SERIAL PRIMARY KEY,
    report_name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL, -- 'SALES', 'PURCHASES', 'INVENTORY', 'FINANCIAL', 'CUSTOM'
    report_category VARCHAR(50), -- 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'
    
    -- Period
    period_start DATE,
    period_end DATE,
    
    -- Report Data (JSONB for flexibility)
    report_data JSONB NOT NULL,
    
    -- Filters Applied
    filters JSONB DEFAULT '{}',
    
    -- Summary Metrics
    summary_metrics JSONB DEFAULT '{}',
    
    -- Status
    is_automated BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT false,
    
    -- Tracking
    generated_by INTEGER REFERENCES users(id),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- AUDIT AND LOGGING
-- =====================================================

-- Audit Logs Table
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role_id ON users(role_id);

-- Product Families
CREATE INDEX idx_product_families_parent_id ON product_families(parent_id);
CREATE INDEX idx_product_families_code ON product_families(code);

-- Products
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_family_id ON products(family_id);
CREATE INDEX idx_products_name ON products(name);

-- Stock Movements
CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_movement_date ON stock_movements(movement_date);
CREATE INDEX idx_stock_movements_reference_number ON stock_movements(reference_number);

-- Suppliers
CREATE INDEX idx_suppliers_code ON suppliers(code);
CREATE INDEX idx_suppliers_name ON suppliers(name);

-- Customers
CREATE INDEX idx_customers_code ON customers(code);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_email ON customers(email);

-- Purchase Orders
CREATE INDEX idx_purchase_orders_po_number ON purchase_orders(po_number);
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_order_date ON purchase_orders(order_date);

-- Sales Quotes
CREATE INDEX idx_sales_quotes_quote_number ON sales_quotes(quote_number);
CREATE INDEX idx_sales_quotes_customer_id ON sales_quotes(customer_id);
CREATE INDEX idx_sales_quotes_status ON sales_quotes(status);

-- Sales Orders
CREATE INDEX idx_sales_orders_order_number ON sales_orders(order_number);
CREATE INDEX idx_sales_orders_customer_id ON sales_orders(customer_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(status);
CREATE INDEX idx_sales_orders_order_date ON sales_orders(order_date);

-- Financial Transactions
CREATE INDEX idx_financial_transactions_transaction_date ON financial_transactions(transaction_date);
CREATE INDEX idx_financial_transactions_transaction_type ON financial_transactions(transaction_type);
CREATE INDEX idx_financial_transactions_status ON financial_transactions(status);

-- Vouchers
CREATE INDEX idx_vouchers_voucher_number ON vouchers(voucher_number);
CREATE INDEX idx_vouchers_voucher_date ON vouchers(voucher_date);
CREATE INDEX idx_vouchers_status ON vouchers(status);

-- Audit Logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_families_updated_at BEFORE UPDATE ON product_families
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_quotes_updated_at BEFORE UPDATE ON sales_quotes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON sales_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_financial_transactions_updated_at BEFORE UPDATE ON financial_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vouchers_updated_at BEFORE UPDATE ON vouchers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();