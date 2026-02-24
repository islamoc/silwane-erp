-- Migration: Add new tables for enhanced features
-- Date: 2026-02-24
-- Description: Tables for warehouses, payment schedules, and search templates

-- Create warehouses table
CREATE TABLE IF NOT EXISTS warehouses (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(255),
  manager_id INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'active',
  is_default BOOLEAN DEFAULT false,
  capacity DECIMAL(15,2),
  capacity_unit VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id)
);

-- Create payment_schedule_models table
CREATE TABLE IF NOT EXISTS payment_schedule_models (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  terms JSONB NOT NULL,
  -- terms structure: [{percentage: 25, days_offset: 0, description: "Down payment"}, ...]
  is_default BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id)
);

-- Create payment_schedules table
CREATE TABLE IF NOT EXISTS payment_schedules (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES sales_orders(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  percentage DECIMAL(5,2),
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  -- status: pending, paid, overdue, cancelled
  paid_date DATE,
  paid_amount DECIMAL(15,2),
  payment_method VARCHAR(50),
  transaction_id INTEGER REFERENCES financial_transactions(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create search_templates table for saved searches (G41)
CREATE TABLE IF NOT EXISTS search_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  entity_type VARCHAR(100) NOT NULL,
  filters JSONB NOT NULL,
  sort_config JSONB,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id)
);

-- Add warehouse_id to stock_movements if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name='stock_movements' AND column_name='warehouse_id') THEN
    ALTER TABLE stock_movements ADD COLUMN warehouse_id INTEGER REFERENCES warehouses(id);
  END IF;
END $$;

-- Add dimensions and weight columns to products if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name='products' AND column_name='weight') THEN
    ALTER TABLE products ADD COLUMN weight DECIMAL(10,3);
    ALTER TABLE products ADD COLUMN weight_unit VARCHAR(10) DEFAULT 'kg';
    ALTER TABLE products ADD COLUMN volume DECIMAL(10,3);
    ALTER TABLE products ADD COLUMN volume_unit VARCHAR(10) DEFAULT 'l';
    ALTER TABLE products ADD COLUMN length DECIMAL(10,2);
    ALTER TABLE products ADD COLUMN width DECIMAL(10,2);
    ALTER TABLE products ADD COLUMN height DECIMAL(10,2);
    ALTER TABLE products ADD COLUMN dimension_unit VARCHAR(10) DEFAULT 'cm';
  END IF;
END $$;

-- Add category and remarks to financial_transactions if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name='financial_transactions' AND column_name='category') THEN
    ALTER TABLE financial_transactions ADD COLUMN category VARCHAR(100);
    ALTER TABLE financial_transactions ADD COLUMN subcategory VARCHAR(100);
    ALTER TABLE financial_transactions ADD COLUMN remarks TEXT;
    ALTER TABLE financial_transactions ADD COLUMN tags TEXT[];
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_schedules_order_id ON payment_schedules(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_due_date ON payment_schedules(due_date);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_status ON payment_schedules(status);
CREATE INDEX IF NOT EXISTS idx_search_templates_entity_type ON search_templates(entity_type);
CREATE INDEX IF NOT EXISTS idx_search_templates_created_by ON search_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse_id ON stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_status ON warehouses(status);

-- Create default warehouse
INSERT INTO warehouses (code, name, address, status, is_default, created_by)
VALUES ('WH-001', 'Main Warehouse', 'Default Location', 'active', true, 1)
ON CONFLICT (code) DO NOTHING;

-- Insert some default payment schedule models
INSERT INTO payment_schedule_models (name, description, terms, is_default, created_by)
VALUES 
  ('30/70 Model', '30% upfront, 70% on delivery', 
   '[{"percentage": 30, "days_offset": 0, "description": "Down payment"}, {"percentage": 70, "days_offset": 30, "description": "Final payment"}]'::jsonb,
   true, 1),
  ('50/50 Model', '50% upfront, 50% on delivery', 
   '[{"percentage": 50, "days_offset": 0, "description": "Down payment"}, {"percentage": 50, "days_offset": 30, "description": "Final payment"}]'::jsonb,
   false, 1),
  ('25/25/25/25 Model', 'Four equal installments', 
   '[{"percentage": 25, "days_offset": 0, "description": "First installment"}, {"percentage": 25, "days_offset": 30, "description": "Second installment"}, {"percentage": 25, "days_offset": 60, "description": "Third installment"}, {"percentage": 25, "days_offset": 90, "description": "Final installment"}]'::jsonb,
   false, 1)
ON CONFLICT DO NOTHING;

COMMIT;