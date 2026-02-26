/**
 * Update Admin Password Script
 * Updates the password for the admin user
 * 
 * Usage: node scripts/update-admin-password.js [new-password]
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

async function updateAdminPassword() {
  const client = await pool.connect();
  
  try {
    const newPassword = process.argv[2] || 'Admin@2026!';
    
    console.log('\n===========================================');
    console.log('Updating Admin Password');
    console.log('===========================================\n');

    // Check if admin user exists
    const checkQuery = 'SELECT id, email, first_name, last_name FROM users WHERE email = $1';
    const checkResult = await client.query(checkQuery, ['admin@gkprostones.dz']);
    
    if (checkResult.rows.length === 0) {
      console.log('❌ Admin user not found!');
      console.log('\nRun create-admin-user.js first to create the admin account.\n');
      return;
    }

    const user = checkResult.rows[0];
    console.log('Found user:', user.email);

    // Create password hash
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    
    console.log('Generated new password hash...');

    // Update password
    const updateQuery = `
      UPDATE users 
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE email = $2
      RETURNING id, email
    `;
    
    await client.query(updateQuery, [passwordHash, 'admin@gkprostones.dz']);

    console.log('\n✓ Password updated successfully!\n');
    console.log('===========================================');
    console.log('Updated Login Credentials:');
    console.log('===========================================');
    console.log('Email:', user.email);
    console.log('Password:', newPassword);
    console.log('Name:', user.first_name, user.last_name);
    console.log('===========================================\n');
    
  } catch (error) {
    console.error('\n❌ Error updating password:', error.message);
    console.error('\nDetails:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

updateAdminPassword();
