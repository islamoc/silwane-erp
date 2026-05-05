#!/usr/bin/env node
/**
 * Silwane ERP - Initial Admin Account Creator
 * Called by deploy-windows.bat during first deployment.
 * Uses bcryptjs (already a project dependency) to hash the password
 * and inserts directly into the users + user_roles tables.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Pool } = require('pg');
const bcrypt    = require('bcryptjs');
const readline  = require('readline');
const crypto    = require('crypto');

// ── DB Connection ────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'silwane_erp',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

// ── CLI helpers ──────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask    = (q)         => new Promise(r => rl.question(q, r));
const askHide = (q)        => new Promise(r => {
  process.stdout.write(q);
  process.stdin.setRawMode(true);
  let val = '';
  const onData = (ch) => {
    ch = ch.toString();
    if (ch === '\r' || ch === '\n') {
      process.stdin.setRawMode(false);
      process.stdin.removeListener('data', onData);
      process.stdout.write('\n');
      r(val);
    } else if (ch === '\u0003') {
      process.exit();
    } else if (ch === '\u007F') {
      if (val.length > 0) { val = val.slice(0, -1); process.stdout.write('\b \b'); }
    } else {
      val += ch;
      process.stdout.write('*');
    }
  };
  process.stdin.on('data', onData);
});

// ── Generate random password ─────────────────────────────────────
function genPassword(len = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  return Array.from(crypto.randomBytes(len))
    .map(b => chars[b % chars.length])
    .join('');
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('===================================================');
  console.log('  Silwane ERP - Initial Admin Account Setup');
  console.log('===================================================');
  console.log('');

  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    console.error('[ERROR] Cannot connect to database:', err.message);
    console.error('        Check your .env DB_* credentials and ensure PostgreSQL is running.');
    rl.close();
    process.exit(1);
  }

  try {
    // ── 1. Check if admin role exists, create if not ─────────────
    let roleId;
    const roleRes = await client.query(
      `SELECT id FROM user_roles WHERE name = 'admin' LIMIT 1`
    );
    if (roleRes.rows.length > 0) {
      roleId = roleRes.rows[0].id;
      console.log(`  [OK] Admin role found (id=${roleId})`);
    } else {
      const ins = await client.query(`
        INSERT INTO user_roles (name, description, permissions)
        VALUES ('admin', 'System Administrator - Full Access', $1)
        RETURNING id`,
        [JSON.stringify({ all: true })]
      );
      roleId = ins.rows[0].id;
      console.log(`  [OK] Admin role created (id=${roleId})`);
    }

    // ── 2. Check if any admin already exists ─────────────────────
    const existingAdmin = await client.query(
      `SELECT id, username, email FROM users WHERE role_id = $1 LIMIT 1`,
      [roleId]
    );
    if (existingAdmin.rows.length > 0) {
      const u = existingAdmin.rows[0];
      console.log('');
      console.log('  [INFO] An admin account already exists:');
      console.log(`         Username : ${u.username}`);
      console.log(`         Email    : ${u.email}`);
      console.log('');
      const overwrite = await ask('  Create a new admin account anyway? (y/N): ');
      if (overwrite.trim().toLowerCase() !== 'y') {
        console.log('  Skipping admin creation.');
        rl.close();
        client.release();
        await pool.end();
        return;
      }
    }

    // ── 3. Collect admin details ──────────────────────────────────
    console.log('');
    console.log('  Enter admin account details (press Enter to use defaults):');
    console.log('');

    const defaultUser  = 'admin';
    const defaultEmail = 'admin@silwane-erp.local';
    const defaultFname = 'System';
    const defaultLname = 'Administrator';
    const autoPass     = genPassword(16);

    const username   = (await ask(`  Username   [${defaultUser}]  : `)).trim()  || defaultUser;
    const email      = (await ask(`  Email      [${defaultEmail}]: `)).trim() || defaultEmail;
    const firstName  = (await ask(`  First name [${defaultFname}] : `)).trim()  || defaultFname;
    const lastName   = (await ask(`  Last name  [${defaultLname}]: `)).trim() || defaultLname;

    console.log('');
    console.log('  Password options:');
    console.log(`    [A] Auto-generate a secure password (recommended): ${autoPass}`);
    console.log('    [M] Enter your own password manually');
    console.log('');
    const pwChoice = (await ask('  Choose [A/m]: ')).trim().toLowerCase();

    let plainPassword;
    if (pwChoice === 'm') {
      let p1, p2;
      do {
        p1 = await askHide('  New password       : ');
        p2 = await askHide('  Confirm password   : ');
        if (p1 !== p2) console.log('  [WARN] Passwords do not match, try again.');
        if (p1.length < 8)  console.log('  [WARN] Password must be at least 8 characters.');
      } while (p1 !== p2 || p1.length < 8);
      plainPassword = p1;
    } else {
      plainPassword = autoPass;
    }

    rl.close();

    // ── 4. Hash password and insert user ─────────────────────────
    const SALT_ROUNDS = 12;
    console.log('');
    console.log('  Hashing password (bcrypt, 12 rounds)...');
    const passwordHash = await bcrypt.hash(plainPassword, SALT_ROUNDS);

    // Check username/email uniqueness
    const dupCheck = await client.query(
      `SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1`,
      [username, email]
    );
    if (dupCheck.rows.length > 0) {
      console.error(`  [ERROR] Username '${username}' or email '${email}' already exists in the database.`);
      console.error('          Please re-run and choose a different username/email.');
      client.release();
      await pool.end();
      process.exit(1);
    }

    const insertRes = await client.query(`
      INSERT INTO users
        (username, email, password_hash, first_name, last_name, role_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id, username, email, first_name, last_name, created_at`,
      [username, email, passwordHash, firstName, lastName, roleId]
    );

    const newUser = insertRes.rows[0];

    // ── 5. Print summary ──────────────────────────────────────────
    const border = '='.repeat(51);
    console.log('');
    console.log(border);
    console.log('  ADMIN ACCOUNT CREATED SUCCESSFULLY');
    console.log(border);
    console.log('');
    console.log(`  ID         : ${newUser.id}`);
    console.log(`  Username   : ${newUser.username}`);
    console.log(`  Email      : ${newUser.email}`);
    console.log(`  Full Name  : ${newUser.first_name} ${newUser.last_name}`);
    console.log(`  Role       : admin (id=${roleId})`);
    console.log(`  Active     : yes`);
    console.log(`  Created at : ${newUser.created_at}`);
    console.log('');
    console.log('  CREDENTIALS (save these now - password is not recoverable)');
    console.log('  ---------------------------------------------------------');
    console.log(`  Username   : ${newUser.username}`);
    console.log(`  Password   : ${plainPassword}`);
    console.log('');
    console.log('  Login URL  : http://localhost:' + (process.env.PORT || '5000'));
    console.log(border);
    console.log('');
    console.log('  [SECURITY] Change your password after first login.');
    console.log('');

  } catch (err) {
    console.error('[ERROR] Failed to create admin:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
