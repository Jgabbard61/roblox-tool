const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function queryPackages() {
  try {
    const result = await pool.query('SELECT id, name, credits, price, price_per_credit FROM credit_packages ORDER BY sort_order;');
    console.log('Current Credit Packages:');
    console.table(result.rows);
  } catch (error) {
    console.error('Error querying packages:', error);
  } finally {
    await pool.end();
  }
}

queryPackages();
