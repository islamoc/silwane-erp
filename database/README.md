# Database Setup Guide

## Overview

This directory contains all database-related files for the Silwane ERP system.

## Files

- **schema.sql** - Complete database schema with all tables, indexes, and triggers
- **seed.sql** - Initial seed data including default users and sample data

## Setup Instructions

### 1. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE silwane_erp;

# Exit psql
\q
```

### 2. Run Schema

Create all tables and structures:

```bash
psql -U postgres -d silwane_erp -f schema.sql
```

### 3. Run Seed Data

Insert initial data including admin user:

```bash
psql -U postgres -d silwane_erp -f seed.sql
```

## Default Login Credentials

After running the seed script, you can login with:

### Super Admin Account
- **Email:** `admin@gkprostones.dz`
- **Password:** `Admin@2026!`
- **Role:** Super Administrator
- **Access:** Full system access

### Demo Accounts (Optional)

All demo accounts use password: `Demo@2026!`

| Role | Email | Username |
|------|-------|----------|
| Manager | manager@gkprostones.dz | manager |
| Accountant | accountant@gkprostones.dz | accountant |
| Sales | sales@gkprostones.dz | sales |
| Warehouse | warehouse@gkprostones.dz | warehouse |

## ⚠️ Security Notice

**IMPORTANT:** Change the default admin password immediately after first login!

### Change Password via API

```bash
# 1. Login to get token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@gkprostones.dz", "password": "Admin@2026!"}'

# 2. Change password (use token from step 1)
curl -X POST http://localhost:5000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "current_password": "Admin@2026!",
    "new_password": "YourSecurePassword123!"
  }'
```

### Change Password via Frontend

1. Login at http://localhost:3000
2. Go to Profile/Settings
3. Click "Change Password"
4. Enter current password and new password
5. Save changes

## User Roles

The system includes 7 role levels:

| Role | Code | Description | Permissions |
|------|------|-------------|-------------|
| Super Admin | `super_admin` | Full system access | All modules |
| Admin | `admin` | Administrative access | Most modules |
| Manager | `manager` | Operational management | Sales, purchases, stock, reports |
| Accountant | `accountant` | Financial management | Finance, analytics, reports |
| Sales | `sales` | Sales operations | Sales, customers, quotes, orders |
| Warehouse | `warehouse` | Inventory management | Stock, products, movements |
| Viewer | `viewer` | Read-only access | View-only permissions |

## Database Schema Overview

### Core Tables
- **users** - User accounts and authentication
- **user_roles** - Role definitions and permissions
- **settings** - System configuration

### Stock Management (MC01)
- **product_families** - Product categorization
- **products** - Product catalog
- **stock_movements** - Inventory transactions

### Purchasing (MC03)
- **suppliers** - Supplier information
- **purchase_orders** - Purchase orders
- **purchase_order_items** - Order line items

### Sales (MC04)
- **customers** - Customer information
- **sales_quotes** - Quotes and proformas
- **sales_quote_items** - Quote line items
- **sales_orders** - Sales orders
- **sales_order_items** - Order line items

### Finance (MC05)
- **financial_transactions** - All financial transactions
- **vouchers** - Payment vouchers
- **payment_schedules** - Payment terms

### Statistics (MC09)
- **statistical_reports** - Generated reports
- **audit_logs** - System audit trail

## Sample Data

The seed script includes optional sample data:

- ✅ **5 Product Families** (Stone, Marble, Granite, Tools, Supplies)
- ✅ **3 Sample Products** (Granite slab, Marble slab, Diamond saw)
- ✅ **2 Sample Customers** (Construction company, Decoration shop)
- ✅ **2 Sample Suppliers** (Italian importer, Local quarry)
- ✅ **Company Settings** (Name, address, contact info, VAT rate)

## Database Maintenance

### Backup Database

```bash
# Full backup
pg_dump -U postgres -d silwane_erp -F c -f silwane_erp_backup.dump

# SQL format backup
pg_dump -U postgres -d silwane_erp -f silwane_erp_backup.sql
```

### Restore Database

```bash
# From custom format
pg_restore -U postgres -d silwane_erp -c silwane_erp_backup.dump

# From SQL format
psql -U postgres -d silwane_erp -f silwane_erp_backup.sql
```

### Reset Database (⚠️ Destructive)

```bash
# Drop and recreate
psql -U postgres << EOF
DROP DATABASE IF EXISTS silwane_erp;
CREATE DATABASE silwane_erp;
EOF

# Rerun schema and seed
psql -U postgres -d silwane_erp -f schema.sql
psql -U postgres -d silwane_erp -f seed.sql
```

## Verification

### Check Database Connection

```bash
psql -U postgres -d silwane_erp -c "SELECT version();"
```

### Verify Tables Created

```bash
psql -U postgres -d silwane_erp -c "\dt"
```

### Verify Users Created

```bash
psql -U postgres -d silwane_erp -c "SELECT email, first_name, last_name FROM users;"
```

### Check Table Counts

```bash
psql -U postgres -d silwane_erp << EOF
SELECT 'Users' as table_name, COUNT(*) FROM users
UNION ALL
SELECT 'Products', COUNT(*) FROM products
UNION ALL
SELECT 'Customers', COUNT(*) FROM customers
UNION ALL
SELECT 'Suppliers', COUNT(*) FROM suppliers;
EOF
```

## Troubleshooting

### Issue: Permission denied

```bash
# Ensure PostgreSQL user has proper permissions
sudo -u postgres psql -c "ALTER USER postgres WITH SUPERUSER;"
```

### Issue: Database already exists

```bash
# Drop existing database first
psql -U postgres -c "DROP DATABASE silwane_erp;"
psql -U postgres -c "CREATE DATABASE silwane_erp;"
```

### Issue: Schema file errors

```bash
# Check syntax
psql -U postgres -d silwane_erp -f schema.sql --echo-errors
```

### Issue: Cannot login with default credentials

1. Verify seed.sql was run successfully
2. Check password hash is correct
3. Manually create admin user:

```sql
INSERT INTO users (username, email, password_hash, first_name, last_name, is_active)
VALUES (
    'admin',
    'admin@gkprostones.dz',
    '$2a$10$YmxJW8k6Y9ZvR0xP.Hx3.eZJF7Q1N5XH8fH6KqzE8qB1xN3YjN5P.',
    'Admin',
    'System',
    true
);
```

## Production Considerations

### Security

1. ✅ Change all default passwords
2. ✅ Use strong passwords (min 12 characters)
3. ✅ Limit database access to application server only
4. ✅ Enable SSL for database connections
5. ✅ Regular security audits
6. ✅ Implement backup strategy

### Performance

1. ✅ All indexes created by schema.sql
2. ✅ Regular VACUUM and ANALYZE
3. ✅ Monitor query performance
4. ✅ Optimize slow queries
5. ✅ Connection pooling (handled by backend)

### Monitoring

```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('silwane_erp'));

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'silwane_erp';
```

## Support

For database-related issues:
1. Check PostgreSQL logs
2. Verify connection settings in backend `.env`
3. Ensure PostgreSQL service is running
4. Review error messages carefully

---

**Database Version:** PostgreSQL 13+  
**Schema Version:** 1.0.0  
**Last Updated:** February 2026
