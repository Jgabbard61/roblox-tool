/* eslint-disable @typescript-eslint/no-require-imports */
// Migration runner for 013_fix_customer_stats_view
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/roblox_verifier',
});

async function runMigration() {
  try {
    const migrationFile = path.join(__dirname, '..', 'database', 'migrations', '013_fix_customer_stats_view.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('Running migration: 013_fix_customer_stats_view.sql');
    console.log('This will update the customer_stats view to include contact_email, max_users, and logo_url fields...\n');
    
    await pool.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('✅ customer_stats view now includes all required fields');
    console.log('✅ Admin dashboard Customers tab should now work correctly');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
