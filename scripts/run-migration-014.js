#!/usr/bin/env node

/**
 * Migration Runner for Migration 014
 * 
 * Purpose: Fix payment_id column type in credit_transactions table
 * 
 * Usage:
 *   node scripts/run-migration-014.js
 * 
 * Prerequisites:
 *   - PostgreSQL database connection configured in .env
 *   - Database user has ALTER TABLE privileges
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('📦 Connecting to database...');
    await client.connect();
    console.log('✓ Connected to database\n');

    // Read migration SQL file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '014_fix_payment_id_column_type.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔧 Running Migration 014: Fix payment_id column type...');
    console.log('   This migration will:');
    console.log('   - Drop foreign key constraint to stripe_payments');
    console.log('   - Change payment_id from INTEGER to TEXT');
    console.log('   - Add validation constraint for payment ID formats');
    console.log('   - Add index for better query performance\n');

    // Execute migration
    await client.query(migrationSQL);

    console.log('✓ Migration 014 completed successfully!\n');

    // Verify the migration
    console.log('🔍 Verifying migration...');
    const verifyResult = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'credit_transactions' 
      AND column_name = 'payment_id'
    `);

    if (verifyResult.rows.length > 0) {
      const column = verifyResult.rows[0];
      console.log('✓ Column verification:');
      console.log(`   - Column name: ${column.column_name}`);
      console.log(`   - Data type: ${column.data_type}`);
      console.log(`   - Max length: ${column.character_maximum_length || 'unlimited'}\n`);

      if (column.data_type === 'text') {
        console.log('✅ Migration verified successfully!');
        console.log('   payment_id column is now TEXT type');
        console.log('   Admin credit additions should now work correctly\n');
      } else {
        console.log('⚠️  Warning: Column type is not TEXT');
        console.log('   Expected: text');
        console.log(`   Actual: ${column.data_type}\n`);
      }
    } else {
      console.log('⚠️  Warning: Could not verify column changes\n');
    }

    console.log('📋 Next steps:');
    console.log('   1. Test adding credits through the admin dashboard');
    console.log('   2. Verify that manual credit additions work without errors');
    console.log('   3. Check that Stripe payment processing still works correctly\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\nError details:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('👋 Database connection closed');
  }
}

// Run the migration
runMigration();
