/**
 * Password Hash Generator
 * Generates bcrypt hashes for passwords
 * 
 * Usage: node scripts/generate-password-hash.js [password]
 */

const bcrypt = require('bcryptjs');

const password = process.argv[2] || 'Admin@2026!';
const rounds = 10;

console.log('\n===========================================');
console.log('Password Hash Generator');
console.log('===========================================\n');

bcrypt.hash(password, rounds, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }
  
  console.log('Password:', password);
  console.log('Rounds:', rounds);
  console.log('\nGenerated Hash:');
  console.log(hash);
  console.log('\n===========================================\n');
  
  // Verify the hash works
  bcrypt.compare(password, hash, (err, result) => {
    if (err) {
      console.error('Error verifying hash:', err);
      process.exit(1);
    }
    
    if (result) {
      console.log('✓ Hash verification successful!\n');
    } else {
      console.log('✗ Hash verification failed!\n');
      process.exit(1);
    }
  });
});
