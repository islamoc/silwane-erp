# Utility Scripts

This directory contains utility scripts for managing the Silwane ERP system.

## Available Scripts

### 1. Generate Password Hash

Generates a bcrypt hash for a password.

```bash
node scripts/generate-password-hash.js "YourPassword"
```

Example:
```bash
node scripts/generate-password-hash.js "Admin@2026!"
```

### 2. Create Admin User

Creates the default admin user in the database.

```bash
node scripts/create-admin-user.js
```

This will create:
- **Email:** admin@gkprostones.dz
- **Password:** Admin@2026!
- **Role:** Super Administrator

### 3. Update Admin Password

Updates the password for the admin user.

```bash
node scripts/update-admin-password.js "NewPassword"
```

Example:
```bash
node scripts/update-admin-password.js "MySecurePassword123!"
```

### 4. Test Login

Tests login functionality with provided credentials.

```bash
node scripts/test-login.js [email] [password]
```

Examples:
```bash
# Test with default credentials
node scripts/test-login.js

# Test with specific credentials
node scripts/test-login.js "admin@gkprostones.dz" "Admin@2026!"
```

## Troubleshooting Login Issues

### Issue: "Invalid credentials" error

**Solution 1: Verify user exists**
```bash
psql -U postgres -d silwane_erp -c "SELECT email, first_name, is_active FROM users;"
```

**Solution 2: Test login**
```bash
node scripts/test-login.js "admin@gkprostones.dz" "Admin@2026!"
```

**Solution 3: Reset password**
```bash
node scripts/update-admin-password.js "Admin@2026!"
```

**Solution 4: Recreate admin user**
```bash
# Delete existing admin user
psql -U postgres -d silwane_erp -c "DELETE FROM users WHERE email = 'admin@gkprostones.dz';"

# Create new admin user
node scripts/create-admin-user.js
```

### Issue: User not found

**Check if seed script was run:**
```bash
psql -U postgres -d silwane_erp -f database/seed.sql
```

**Or create manually:**
```bash
node scripts/create-admin-user.js
```

### Issue: Account deactivated

**Activate account:**
```bash
psql -U postgres -d silwane_erp -c "UPDATE users SET is_active = true WHERE email = 'admin@gkprostones.dz';"
```

### Issue: Database connection error

**Check .env file:**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=silwane_erp
DB_USER=postgres
DB_PASSWORD=your_password
```

**Test connection:**
```bash
psql -U postgres -d silwane_erp -c "SELECT 1;"
```

## Quick Fix for Login Issues

If you're having login problems, run these commands in order:

```bash
# 1. Test current login
node scripts/test-login.js

# 2. If test fails, reset password
node scripts/update-admin-password.js "Admin@2026!"

# 3. Test again
node scripts/test-login.js

# 4. If still fails, recreate user
psql -U postgres -d silwane_erp -c "DELETE FROM users WHERE email = 'admin@gkprostones.dz';"
node scripts/create-admin-user.js

# 5. Final test
node scripts/test-login.js
```

## Prerequisites

All scripts require:
- Node.js installed
- PostgreSQL running
- `.env` file configured
- Database created and schema loaded

## Usage Notes

1. Always run scripts from the project root directory
2. Ensure `.env` file has correct database credentials
3. Database must be created before running scripts
4. Scripts use the same database configuration as the main application

## Security

- Never commit password hashes to version control
- Change default passwords in production
- Use strong passwords (min 12 characters)
- Regularly rotate passwords
- Keep scripts secure with proper file permissions
