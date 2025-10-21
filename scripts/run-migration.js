/* eslint-disable @typescript-eslint/no-require-imports */
// Simple migration runner script
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/roblox_verifier',
});

async function runMigration() {
  try {
    const migrationFile = path.join(__dirname, '..', 'database', 'migrations', '003_add_customer_logo.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('Running migration: 003_add_customer_logo.sql');
    await pool.query(sql);
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
