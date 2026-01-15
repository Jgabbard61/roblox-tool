/* eslint-disable @typescript-eslint/no-require-imports */
// Migration runner script for migration 013
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/roblox_verifier',
});

async function runMigration() {
  try {
    const migrationFile = path.join(__dirname, '..', 'database', 'migrations', '013_add_credits_to_customer_stats.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('Running migration: 013_add_credits_to_customer_stats.sql');
    console.log('This will update the customer_stats view to include credit information...\n');
    
    await pool.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('\nThe customer_stats view now includes:');
    console.log('  - credit_balance');
    console.log('  - total_credits_purchased');
    console.log('  - total_credits_used');
    console.log('\nYou can now view credit balances in the admin dashboard.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\nPlease check your database connection and try again.');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
