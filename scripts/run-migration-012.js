const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const sql = fs.readFileSync(
      path.join(__dirname, '../database/migrations/012_allow_zero_credit_transactions.sql'),
      'utf8'
    );

    console.log('Running migration: 012_allow_zero_credit_transactions.sql');
    await pool.query(sql);
    console.log('✅ Migration completed successfully!');
    console.log('Zero-credit transactions are now allowed in credit_transactions table.');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
