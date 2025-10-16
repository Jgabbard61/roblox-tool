# 🔐 Multi-Tenant Authentication System - Setup Guide

This guide will help you set up and configure the multi-tenant authentication system for the Roblox Verifier Tool.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Database Setup](#database-setup)
4. [Environment Configuration](#environment-configuration)
5. [Initialize Database](#initialize-database)
6. [Running the Application](#running-the-application)
7. [Super Admin Dashboard](#super-admin-dashboard)
8. [User Roles](#user-roles)
9. [Architecture](#architecture)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This implementation adds a complete multi-tenant authentication system with:

- **PostgreSQL database** for storing customers, users, and search history
- **Role-based access control** (SUPER_ADMIN, CUSTOMER_ADMIN, CUSTOMER_USER)
- **NextAuth.js authentication** with credentials provider
- **Super Admin Dashboard** for managing customers and viewing analytics
- **Multi-tenant data isolation** - users only see their customer's data
- **Search history logging** - all searches are automatically logged
- **Secure password hashing** with bcrypt

---

## ✅ Prerequisites

Before you begin, ensure you have:

1. **Node.js** (v18 or higher)
2. **PostgreSQL** database (local or cloud)
3. **Git** for version control

### PostgreSQL Options

You can use any PostgreSQL provider:

- **Local PostgreSQL**: Install locally for development
- **Vercel Postgres**: Integrated with Vercel deployment
- **Supabase**: Free tier with PostgreSQL database
- **Railway**: Easy PostgreSQL hosting
- **Render**: Simple PostgreSQL instances

---

## 🗄️ Database Setup

### Option 1: Local PostgreSQL

```bash
# Install PostgreSQL (macOS)
brew install postgresql
brew services start postgresql

# Create database
createdb roblox_verifier

# Create user (optional)
psql postgres
CREATE USER your_username WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE roblox_verifier TO your_username;
```

### Option 2: Cloud PostgreSQL (Recommended)

#### Using Vercel Postgres

1. Go to your Vercel project dashboard
2. Navigate to Storage → Create Database → Postgres
3. Copy the connection string (starts with `postgresql://`)

#### Using Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings → Database
3. Copy the connection string (URI format)

---

## ⚙️ Environment Configuration

### Step 1: Copy Environment Template

```bash
cp .env.example .env.local
```

### Step 2: Configure .env.local

Edit `.env.local` with your actual values:

```bash
# ============================================
# DATABASE CONFIGURATION
# ============================================
# Replace with your actual PostgreSQL connection string
DATABASE_URL=postgresql://username:password@host:port/database

# Examples:
# Local: postgresql://postgres:password@localhost:5432/roblox_verifier
# Vercel: postgresql://default:xxxxx@ep-xxxxx.us-east-1.postgres.vercel-storage.com:5432/verceldb
# Supabase: postgresql://postgres:xxxxx@db.xxxxx.supabase.co:5432/postgres

# ============================================
# NEXTAUTH CONFIGURATION
# ============================================
# Generate a secure secret key (run this command):
# openssl rand -base64 32
NEXTAUTH_SECRET=your-generated-secret-here

# Your application URL
NEXTAUTH_URL=http://localhost:3000

# ============================================
# APPLICATION CONFIGURATION
# ============================================
NODE_ENV=development
```

### Step 3: Generate NEXTAUTH_SECRET

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

Copy the output and replace `your-generated-secret-here` in `.env.local`

---

## 🚀 Initialize Database

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Run Database Initialization Script

This script will:
- Create all database tables (customers, users, search_history, audit_logs)
- Set up indexes and views
- Create the SUPER_ADMIN account with a secure password

```bash
npm run init-db
```

**Expected Output:**

```
🚀 Starting database initialization...

📡 Testing database connection...
✅ Database connection successful!

📝 Creating database schema...
✅ Database schema created successfully!

👤 Creating SUPER_ADMIN user...
✅ SUPER_ADMIN user created successfully!

╔═══════════════════════════════════════════════════════╗
║           🔐 SUPER ADMIN CREDENTIALS                  ║
╠═══════════════════════════════════════════════════════╣
║  Username: admin                                      ║
║  Password: Xy9#mK8$pL2@vN4&qR6!                      ║
╠═══════════════════════════════════════════════════════╣
║  ⚠️  IMPORTANT: Save these credentials securely!     ║
║  You will need them to access the admin dashboard.   ║
╚═══════════════════════════════════════════════════════╝

✨ Database initialization completed successfully!

📋 Next steps:
1. Save the super admin credentials above
2. Start the development server: npm run dev
3. Login at: http://localhost:3000/auth/signin
4. Access admin dashboard at: http://localhost:3000/admin
```

**⚠️ IMPORTANT:** Save the displayed username and password! You'll need these to login.

### Add init-db Script to package.json

Add this script to your `package.json`:

```json
{
  "scripts": {
    "init-db": "tsx scripts/init-db.ts"
  }
}
```

If you don't have `tsx`, install it:

```bash
npm install -D tsx
```

---

## 🎨 Running the Application

### Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### First Login

1. Navigate to `http://localhost:3000/auth/signin`
2. Enter the SUPER_ADMIN credentials from the initialization step
3. You'll be redirected to the home page
4. Access the admin dashboard at `http://localhost:3000/admin`

---

## 👨‍💼 Super Admin Dashboard

The Super Admin Dashboard (`/admin`) provides:

### 📊 Overview Statistics

- Total Customers
- Active Customers
- Total Users across all customers
- Total Searches across all customers

### 🏢 Customer Management

**View All Customers:**
- Customer name and ID
- Active/Inactive status
- Number of users (active/total)
- Total searches
- Last activity timestamp

**Create New Customer:**
1. Click "➕ Create New Customer"
2. Fill in:
   - Customer Name (e.g., "ACME Corp")
   - Admin Username (for customer's admin)
   - Admin Password (min 8 characters)
   - Admin Email (optional)
3. Click "Create Customer"
4. **Save the generated credentials** - give them to your customer

**Activate/Deactivate Customers:**
- Click "Activate" or "Deactivate" button for any customer
- Inactive customers cannot login or use the tool

**View Customer Details:**
- Click "View Details" to see search history
- Shows recent searches with:
  - Search query and type
  - Username who performed the search
  - Results found
  - Timestamp

---

## 👥 User Roles

### 🔴 SUPER_ADMIN (You)

**Capabilities:**
- Access Super Admin Dashboard (`/admin`)
- Create and manage customers
- View all customer statistics
- View search history for any customer
- Activate/deactivate customers
- Cannot be assigned to a customer (platform owner)

**Access:**
- Dashboard: ✅ Yes
- Admin API: ✅ Yes
- Search Tool: ✅ Yes (not customer-scoped)

### 🟡 CUSTOMER_ADMIN (Customer Admin)

**Capabilities:**
- Login to the tool
- Use all search features
- View their own search history (future feature)
- Belongs to a specific customer
- In future: Can manage users within their customer

**Access:**
- Dashboard: ❌ No
- Admin API: ❌ No
- Search Tool: ✅ Yes (customer-scoped)

### 🟢 CUSTOMER_USER (Future Role)

**Capabilities:**
- Login to the tool
- Use all search features
- View their own search history (future feature)
- Belongs to a specific customer
- Regular user access

**Access:**
- Dashboard: ❌ No
- Admin API: ❌ No
- Search Tool: ✅ Yes (customer-scoped)

---

## 🏗️ Architecture

### Database Schema

**customers** table:
- Stores customer organizations
- Fields: id, name, is_active, created_at, contact_email, max_users

**users** table:
- Stores user accounts
- Fields: id, username, password_hash, role, customer_id, email, full_name, is_active, last_login
- Constraints: SUPER_ADMIN has no customer_id, others must have customer_id

**search_history** table:
- Logs all searches
- Fields: id, user_id, customer_id, search_type, search_query, roblox_username, roblox_user_id, result_data, result_status, response_time_ms, searched_at
- Automatically populated when users perform searches

**audit_logs** table (optional, for future use):
- Tracks admin actions
- Fields: id, user_id, customer_id, action, entity_type, old_values, new_values, ip_address, created_at

### Multi-Tenant Data Isolation

**How it works:**

1. **Middleware** (`src/middleware.ts`):
   - Checks authentication on every request
   - Sets user info in request headers: `X-User-Id`, `X-Customer-Id`, `X-User-Role`
   - Redirects unauthenticated users to login
   - Restricts `/admin` routes to SUPER_ADMIN only

2. **API Routes**:
   - Read user/customer ID from request headers
   - All database queries include `customer_id` filter
   - Users can only access their customer's data

3. **Search Logging**:
   - Every search automatically logs to `search_history`
   - Tagged with `user_id` and `customer_id`
   - Includes query, results, and performance metrics

### Authentication Flow

```
User submits credentials
      ↓
NextAuth validates with database
      ↓
Checks: user exists, is_active, customer is_active
      ↓
Verifies password with bcrypt
      ↓
Updates last_login timestamp
      ↓
Creates JWT session with user info
      ↓
User is authenticated
```

### Protected Routes

All routes require authentication except:
- `/auth/signin` - Login page
- `/api/auth/*` - NextAuth endpoints
- `/api/health` - Health check
- `/_next/*` - Next.js internal routes

---

## 🔍 Search Logging

Every search performed by authenticated users is automatically logged:

**Logged Information:**
- User who performed the search
- Customer they belong to
- Search type (username, userId, displayName, etc.)
- Search query
- Roblox user found (if any)
- Number of results
- Success/failure status
- Response time in milliseconds
- Timestamp

**Viewing Logs:**
- Super Admin: View any customer's search logs in dashboard
- Future: Customer admins can view their own logs

---

## 🐛 Troubleshooting

### Database Connection Issues

**Error: "Failed to connect to database"**

1. Verify DATABASE_URL is correct in `.env.local`
2. Check database is running:
   ```bash
   # For local PostgreSQL
   psql -U postgres -d roblox_verifier -c "SELECT 1"
   ```
3. Check network/firewall settings for cloud databases
4. Verify credentials are correct

### Authentication Issues

**Error: "Invalid credentials"**

1. Double-check username and password
2. Verify user exists in database:
   ```sql
   SELECT username, is_active, role FROM users;
   ```
3. Check user is active: `is_active = true`
4. For customer users, verify customer is active

**Error: "Unauthorized"**

1. Check NEXTAUTH_SECRET is set in `.env.local`
2. Clear browser cookies and try again
3. Verify middleware is correctly configured

### Cannot Access Admin Dashboard

**Error: Redirected to home page**

1. Verify you're logged in as SUPER_ADMIN
2. Check session:
   ```javascript
   const { data: session } = useSession();
   console.log(session?.user?.role);
   ```
3. Only SUPER_ADMIN role can access `/admin`

### Search Logging Not Working

**Searches not appearing in dashboard**

1. Check middleware is setting headers:
   ```javascript
   // In API route
   console.log(request.headers.get('X-User-Id'));
   console.log(request.headers.get('X-Customer-Id'));
   ```
2. Verify `logSearch` function doesn't throw errors (check server logs)
3. Check database connectivity

---

## 🚀 Production Deployment

### Before Deploying

1. ✅ Set secure NEXTAUTH_SECRET (production-grade)
2. ✅ Use production PostgreSQL database
3. ✅ Set NEXTAUTH_URL to production domain
4. ✅ Enable SSL for database connection
5. ✅ Backup super admin credentials
6. ✅ Test authentication flow
7. ✅ Test customer creation flow

### Environment Variables for Production

```bash
DATABASE_URL=postgresql://user:pass@production-host:5432/dbname?sslmode=require
NEXTAUTH_SECRET=<production-secret-64-chars>
NEXTAUTH_URL=https://your-production-domain.com
NODE_ENV=production
```

### Vercel Deployment

1. Push code to GitHub
2. Import repository in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy
5. After first deployment, run init-db manually:
   - Use Vercel CLI: `vercel env pull` then `npm run init-db`
   - Or connect to production database directly

---

## 📚 Additional Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)

---

## 🤝 Support

If you encounter issues:

1. Check this troubleshooting guide
2. Review server logs: `npm run dev` output
3. Check browser console for frontend errors
4. Verify database connection and queries
5. Review middleware logs for authentication issues

---

## 🎉 Congratulations!

You've successfully set up the multi-tenant authentication system! 

**Next Steps:**

1. ✅ Login with super admin credentials
2. ✅ Create your first customer
3. ✅ Test customer login
4. ✅ Perform a search and verify it's logged
5. ✅ Explore the admin dashboard

Happy managing! 🚀
