
// Script to initialize the database with schema and super admin
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

async function initializeDatabase() {
  console.log('🚀 Starting database initialization...\n');

  // Check for DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set!');
    console.error('Please set DATABASE_URL in your .env.local file');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    // Test connection
    console.log('📡 Testing database connection...');
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful!\n');

    // Read and execute schema
    console.log('📝 Creating database schema...');
    const schemaPath = path.join(__dirname, '../src/app/lib/db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    await pool.query(schema);
    console.log('✅ Database schema created successfully!\n');

    // Create super admin user
    console.log('👤 Creating SUPER_ADMIN user...');
    
    const superAdminUsername = 'admin';
    const superAdminPassword = generateSecurePassword();
    const passwordHash = await bcrypt.hash(superAdminPassword, 10);

    // Check if super admin already exists
    const existingAdmin = await pool.query(
      'SELECT id FROM users WHERE role = $1',
      ['SUPER_ADMIN']
    );

    if (existingAdmin.rows.length > 0) {
      console.log('ℹ️  SUPER_ADMIN already exists. Skipping creation.');
    } else {
      await pool.query(
        `INSERT INTO users (username, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4)`,
        [superAdminUsername, passwordHash, 'SUPER_ADMIN', true]
      );

      console.log('✅ SUPER_ADMIN user created successfully!\n');
      console.log('╔═══════════════════════════════════════════════════════╗');
      console.log('║           🔐 SUPER ADMIN CREDENTIALS                  ║');
      console.log('╠═══════════════════════════════════════════════════════╣');
      console.log(`║  Username: ${superAdminUsername.padEnd(42)} ║`);
      console.log(`║  Password: ${superAdminPassword.padEnd(42)} ║`);
      console.log('╠═══════════════════════════════════════════════════════╣');
      console.log('║  ⚠️  IMPORTANT: Save these credentials securely!     ║');
      console.log('║  You will need them to access the admin dashboard.   ║');
      console.log('╚═══════════════════════════════════════════════════════╝');
      console.log('');
    }

    console.log('✨ Database initialization completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Save the super admin credentials above');
    console.log('2. Start the development server: npm run dev');
    console.log('3. Login at: http://localhost:3000/auth/signin');
    console.log('4. Access admin dashboard at: http://localhost:3000/admin\n');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Generate a secure random password
 */
function generateSecurePassword(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  password += '0123456789'[Math.floor(Math.random() * 10)];
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)];
  
  // Fill the rest
  for (let i = password.length; i < length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Run the initialization
initializeDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
