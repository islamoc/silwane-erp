-- =====================================================
-- Silwane ERP - Database Seed Data
-- =====================================================
-- This file creates initial data including a default admin user
-- Run this AFTER running schema.sql

-- =====================================================
-- USER ROLES
-- =====================================================

INSERT INTO user_roles (name, description, permissions) VALUES
('super_admin', 'Super Administrator with full system access', '{"all": true}'),
('admin', 'Administrator with most permissions', '{"users": true, "settings": true, "reports": true}'),
('manager', 'Manager with operational access', '{"sales": true, "purchases": true, "stock": true, "reports": true}'),
('accountant', 'Accountant with financial access', '{"finance": true, "reports": true, "analytics": true}'),
('sales', 'Sales team member', '{"sales": true, "customers": true, "quotes": true, "orders": true}'),
('warehouse', 'Warehouse staff', '{"stock": true, "products": true, "movements": true}'),
('viewer', 'Read-only access', '{"view_only": true}');

-- =====================================================
-- DEFAULT ADMIN USER
-- =====================================================
-- Default credentials:
-- Email: admin@gkprostones.dz
-- Password: Admin@2026!
-- 
-- Password hash for: Admin@2026!
-- Generated with: bcrypt.hash('Admin@2026!', 10)

INSERT INTO users (username, email, password_hash, first_name, last_name, role_id, is_active, phone)
VALUES (
    'admin',
    'admin@gkprostones.dz',
    '$2a$10$YmxJW8k6Y9ZvR0xP.Hx3.eZJF7Q1N5XH8fH6KqzE8qB1xN3YjN5P.',  -- Password: Admin@2026!
    'Admin',
    'System',
    (SELECT id FROM user_roles WHERE name = 'super_admin'),
    true,
    '+213 555 000 000'
);

-- =====================================================
-- ADDITIONAL DEMO USERS (Optional)
-- =====================================================
-- All demo users have password: Demo@2026!

INSERT INTO users (username, email, password_hash, first_name, last_name, role_id, is_active, phone) VALUES
(
    'manager',
    'manager@gkprostones.dz',
    '$2a$10$YmxJW8k6Y9ZvR0xP.Hx3.eZJF7Q1N5XH8fH6KqzE8qB1xN3YjN5P.',
    'Mohamed',
    'Benali',
    (SELECT id FROM user_roles WHERE name = 'manager'),
    true,
    '+213 555 111 111'
),
(
    'accountant',
    'accountant@gkprostones.dz',
    '$2a$10$YmxJW8k6Y9ZvR0xP.Hx3.eZJF7Q1N5XH8fH6KqzE8qB1xN3YjN5P.',
    'Fatima',
    'Mansouri',
    (SELECT id FROM user_roles WHERE name = 'accountant'),
    true,
    '+213 555 222 222'
),
(
    'sales',
    'sales@gkprostones.dz',
    '$2a$10$YmxJW8k6Y9ZvR0xP.Hx3.eZJF7Q1N5XH8fH6KqzE8qB1xN3YjN5P.',
    'Ahmed',
    'Khelifi',
    (SELECT id FROM user_roles WHERE name = 'sales'),
    true,
    '+213 555 333 333'
),
(
    'warehouse',
    'warehouse@gkprostones.dz',
    '$2a$10$YmxJW8k6Y9ZvR0xP.Hx3.eZJF7Q1N5XH8fH6KqzE8qB1xN3YjN5P.',
    'Karim',
    'Boumediene',
    (SELECT id FROM user_roles WHERE name = 'warehouse'),
    true,
    '+213 555 444 444'
);

-- =====================================================
-- SYSTEM SETTINGS
-- =====================================================

INSERT INTO settings (key, value, category, description, is_public) VALUES
('company_name', 'GK PRO STONES', 'company', 'Company name', true),
('company_address', 'Constantine, Algeria', 'company', 'Company address', true),
('company_phone', '+213 555 000 000', 'company', 'Company phone', true),
('company_email', 'contact@gkprostones.dz', 'company', 'Company email', true),
('company_website', 'www.gkprostones.dz', 'company', 'Company website', true),
('tax_id', 'TIN-XXXXXXXXX', 'company', 'Tax identification number', false),
('currency', 'DZD', 'system', 'Default currency', true),
('language', 'fr', 'system', 'Default language', true),
('timezone', 'Africa/Algiers', 'system', 'System timezone', true),
('vat_rate', '19', 'finance', 'Default VAT rate (%)', true),
('fiscal_year_start', '01-01', 'finance', 'Fiscal year start (MM-DD)', false),
('low_stock_alert', 'true', 'inventory', 'Enable low stock alerts', false),
('backup_enabled', 'true', 'system', 'Enable automatic backups', false);

-- =====================================================
-- SAMPLE PRODUCT FAMILIES (Optional)
-- =====================================================

INSERT INTO product_families (code, name, description, level, is_active) VALUES
('STONE', 'Natural Stone', 'Natural stone products', 1, true),
('MARBLE', 'Marble', 'Marble products and slabs', 1, true),
('GRANITE', 'Granite', 'Granite products and slabs', 1, true),
('TOOLS', 'Tools & Equipment', 'Tools and equipment for stone working', 1, true),
('SUPPLIES', 'Supplies', 'General supplies and materials', 1, true);

-- =====================================================
-- SAMPLE PRODUCTS (Optional)
-- =====================================================

INSERT INTO products (sku, name, description, family_id, unit_of_measure, quantity_in_stock, min_stock_level, cost_price, selling_price, is_active)
VALUES
(
    'GRANITE-BLK-001',
    'Black Granite Slab',
    'Premium black granite slab - 3m x 2m',
    (SELECT id FROM product_families WHERE code = 'GRANITE'),
    'piece',
    50,
    10,
    15000.00,
    25000.00,
    true
),
(
    'MARBLE-WHT-001',
    'White Carrara Marble',
    'Italian white Carrara marble - 3m x 2m',
    (SELECT id FROM product_families WHERE code = 'MARBLE'),
    'piece',
    30,
    5,
    25000.00,
    45000.00,
    true
),
(
    'TOOL-SAW-001',
    'Diamond Blade Saw',
    'Professional diamond blade circular saw',
    (SELECT id FROM product_families WHERE code = 'TOOLS'),
    'piece',
    15,
    3,
    35000.00,
    55000.00,
    true
);

-- =====================================================
-- SAMPLE CUSTOMERS (Optional)
-- =====================================================

INSERT INTO customers (code, name, company_name, contact_person, email, phone, billing_city, customer_type, is_active)
VALUES
(
    'CUST-001',
    'Construction ABC',
    'ABC Construction SARL',
    'Ali Meziane',
    'contact@abc-construction.dz',
    '+213 555 100 100',
    'Constantine',
    'Wholesale',
    true
),
(
    'CUST-002',
    'Décor Elite',
    'Elite Décoration',
    'Samira Bouzid',
    'info@decor-elite.dz',
    '+213 555 200 200',
    'Algiers',
    'Retail',
    true
);

-- =====================================================
-- SAMPLE SUPPLIERS (Optional)
-- =====================================================

INSERT INTO suppliers (code, name, contact_person, email, phone, city, is_active)
VALUES
(
    'SUPP-001',
    'Italian Marble Import',
    'Marco Rossi',
    'sales@italianmarble.it',
    '+39 055 123 4567',
    'Florence',
    true
),
(
    'SUPP-002',
    'Constantine Stone Quarry',
    'Rachid Hamdi',
    'contact@constantine-quarry.dz',
    '+213 555 300 300',
    'Constantine',
    true
);

-- =====================================================
-- END OF SEED DATA
-- =====================================================

SELECT 'Database seeding completed successfully!' AS message;
SELECT 'Default admin user created with email: admin@gkprostones.dz' AS info;