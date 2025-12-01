#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✓ Connected to database');

    console.log('\nReading migration file...');
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '015_add_credits_to_customer_stats.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('✓ Migration file loaded');

    console.log('\nExecuting migration...');
    await client.query(migrationSQL);
    console.log('✓ Migration executed successfully');

    console.log('\nVerifying updated view...');
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'customer_stats' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\nColumns in customer_stats view:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    // Check if credit columns exist
    const creditColumns = result.rows.filter(r => 
      r.column_name === 'credit_balance' || 
      r.column_name === 'total_credits_purchased' || 
      r.column_name === 'total_credits_used'
    );

    if (creditColumns.length === 3) {
      console.log('\n✅ SUCCESS: Credit columns added to customer_stats view!');
    } else {
      console.log('\n⚠️  WARNING: Some credit columns may be missing');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✓ Database connection closed');
  }
}

runMigration();
