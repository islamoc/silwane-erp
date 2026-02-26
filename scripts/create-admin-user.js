/**
 * Create Admin User Script
 * Creates a default admin user in the database
 * 
 * Usage: node scripts/create-admin-user.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'silwane_erp',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

async function createAdminUser() {
  const client = await pool.connect();
  
  try {
    console.log('\n===========================================');
    console.log('Creating Admin User');
    console.log('===========================================\n');

    // Check if admin user already exists
    const checkQuery = 'SELECT id, email FROM users WHERE email = $1';
    const checkResult = await client.query(checkQuery, ['admin@gkprostones.dz']);
    
    if (checkResult.rows.length > 0) {
      console.log('⚠️  Admin user already exists!');
      console.log('Email:', checkResult.rows[0].email);
      console.log('\nTo reset password, use the update-admin-password.js script\n');
      return;
    }

    // Create password hash
    const password = 'Admin@2026!';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    console.log('Generated password hash...');

    // Get super_admin role ID
    const roleQuery = "SELECT id FROM user_roles WHERE name = 'super_admin'";
    const roleResult = await client.query(roleQuery);
    
    if (roleResult.rows.length === 0) {
      // Create super_admin role if it doesn't exist
      const createRoleQuery = `
        INSERT INTO user_roles (name, description, permissions)
        VALUES ('super_admin', 'Super Administrator with full system access', '{"all": true}')
        RETURNING id
      `;
      const createRoleResult = await client.query(createRoleQuery);
      var roleId = createRoleResult.rows[0].id;
      console.log('Created super_admin role...');
    } else {
      var roleId = roleResult.rows[0].id;
    }

    // Create admin user
    const insertQuery = `
      INSERT INTO users (username, email, password_hash, first_name, last_name, role_id, is_active, phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, email, first_name, last_name
    `;
    
    const result = await client.query(insertQuery, [
      'admin',
      'admin@gkprostones.dz',
      passwordHash,
      'Admin',
      'System',
      roleId,
      true,
      '+213 555 000 000'
    ]);

    const user = result.rows[0];
    
    console.log('\n✓ Admin user created successfully!\n');
    console.log('===========================================');
    console.log('Login Credentials:');
    console.log('===========================================');
    console.log('Email:', user.email);
    console.log('Password:', password);
    console.log('Name:', user.first_name, user.last_name);
    console.log('===========================================\n');
    console.log('⚠️  IMPORTANT: Change this password after first login!\n');
    
  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message);
    console.error('\nDetails:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

createAdminUser();
