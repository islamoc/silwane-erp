/**
 * Test Login Script
 * Tests login functionality with provided credentials
 * 
 * Usage: node scripts/test-login.js [email] [password]
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

async function testLogin() {
  const client = await pool.connect();
  
  try {
    const email = process.argv[2] || 'admin@gkprostones.dz';
    const password = process.argv[3] || 'Admin@2026!';
    
    console.log('\n===========================================');
    console.log('Testing Login');
    console.log('===========================================\n');
    console.log('Email:', email);
    console.log('Password:', password.replace(/./g, '*'));
    console.log();

    // Get user by email
    const query = `
      SELECT id, email, password_hash, first_name, last_name, role_id, is_active
      FROM users
      WHERE email = $1
    `;
    
    const result = await client.query(query, [email]);

    if (result.rows.length === 0) {
      console.log('❌ User not found!');
      console.log('\nAvailable users:');
      const usersQuery = 'SELECT email, first_name, last_name, is_active FROM users';
      const users = await client.query(usersQuery);
      users.rows.forEach(u => {
        console.log(`  - ${u.email} (${u.first_name} ${u.last_name}) ${u.is_active ? '✓ Active' : '✗ Inactive'}`);
      });
      console.log();
      return;
    }

    const user = result.rows[0];
    
    console.log('User found:');
    console.log('  ID:', user.id);
    console.log('  Email:', user.email);
    console.log('  Name:', user.first_name, user.last_name);
    console.log('  Active:', user.is_active ? '✓ Yes' : '✗ No');
    console.log();

    if (!user.is_active) {
      console.log('❌ Account is deactivated!\n');
      return;
    }

    // Verify password
    console.log('Verifying password...');
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (isPasswordValid) {
      console.log('\n✓ Login successful!\n');
      console.log('===========================================');
      console.log('Authentication Details:');
      console.log('===========================================');
      console.log('User ID:', user.id);
      console.log('Email:', user.email);
      console.log('Role ID:', user.role_id);
      console.log('Status: Active');
      console.log('===========================================\n');
    } else {
      console.log('\n❌ Invalid password!\n');
      console.log('Password hash in database:');
      console.log(user.password_hash);
      console.log('\nTo reset password, run:');
      console.log('node scripts/update-admin-password.js "YourNewPassword"\n');
    }
    
  } catch (error) {
    console.error('\n❌ Error testing login:', error.message);
    console.error('\nDetails:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testLogin();
