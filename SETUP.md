# Setup Guide: PostgreSQL Database for Roblox Verifier Tool

## Understanding PostgreSQL vs Supabase

### What is PostgreSQL?
**PostgreSQL** is a powerful, open-source relational database management system (RDBMS). Think of it as the actual database software that stores and manages your data. However, PostgreSQL itself is just the database engine - you need to host it somewhere (like your own server, AWS RDS, or a cloud provider).

### What is Supabase?
**Supabase** is a **Backend-as-a-Service (BaaS)** platform that provides:
- **Hosted PostgreSQL databases** (fully managed)
- **Authentication system**
- **Real-time subscriptions**
- **Storage for files**
- **Auto-generated REST APIs**
- **Easy-to-use dashboard**

**Key Point:** Supabase uses PostgreSQL under the hood! When you create a Supabase project, you're actually getting a fully managed PostgreSQL database + extra features.

### PostgreSQL vs Supabase: Which Should You Use?

| Feature | Self-Hosted PostgreSQL | Supabase |
|---------|----------------------|----------|
| **Setup Difficulty** | Hard (requires server setup, security, backups) | Easy (5 minutes to get started) |
| **Cost** | Variable (server costs) | Free tier available (500MB database) |
| **Maintenance** | You manage everything | Fully managed by Supabase |
| **Backups** | You configure | Automatic daily backups |
| **Security** | You configure | SSL enabled by default |
| **Scaling** | Manual configuration | Automatic (with paid plans) |
| **Dashboard** | Need to install (pgAdmin) | Built-in beautiful dashboard |
| **Connection String** | postgresql://... | Same format! postgresql://... |

### ✅ Recommended: Use Supabase

For this project, **we strongly recommend using Supabase** because:
- ✅ **Free to start** - 500MB database, 2GB bandwidth
- ✅ **No server management needed**
- ✅ **Automatic backups**
- ✅ **SSL/Security configured automatically**
- ✅ **Easy to use dashboard**
- ✅ **Same PostgreSQL you know** - all PostgreSQL commands work!

---

## Step-by-Step Setup with Supabase

### Step 1: Create a Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click **"Start your project"** or **"Sign Up"**
3. Sign up using:
   - GitHub account (recommended)
   - Email and password
   - Or other OAuth providers

### Step 2: Create a New Project

1. After signing in, click **"New Project"**
2. Fill in the project details:
   - **Project Name:** `roblox-verifier` (or any name you prefer)
   - **Database Password:** Choose a strong password (save it securely!)
   - **Region:** Choose the closest region to your users
   - **Pricing Plan:** Select **"Free"** tier to start

3. Click **"Create new project"**
4. Wait 1-2 minutes for your database to be provisioned

### Step 3: Get Your Database Connection String

1. In your Supabase project dashboard, click on **"Settings"** (gear icon in the sidebar)
2. Navigate to **"Database"** section
3. Scroll down to **"Connection string"**
4. Select the **"URI"** tab (not Nodejs or Session mode)
5. You'll see a connection string like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
6. Replace `[YOUR-PASSWORD]` with the database password you created in Step 2
7. **Copy this complete connection string** - you'll need it in the next step

**Example:**
```
postgresql://postgres:MyStr0ngP@ssw0rd@db.abcdefghijk.supabase.co:5432/postgres
```

### Step 4: Set Up Environment Variables

#### For Local Development:

1. Open your project in VS Code (or your preferred editor)
2. Create or edit the `.env.local` file in the root directory
3. Add the following environment variables:

```env
# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres"

# NextAuth Secret (generate a random string)
NEXTAUTH_SECRET="your-super-secret-random-string-here"
NEXTAUTH_URL="http://localhost:3000"

# Redis (Optional - for caching)
REDIS_URL="your-redis-url-here"
```

**To generate a NEXTAUTH_SECRET:**
```bash
# On macOS/Linux:
openssl rand -base64 32

# Or visit: https://generate-secret.vercel.app/32
```

#### For Vercel Deployment:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:
   - **Name:** `DATABASE_URL`
     - **Value:** Your Supabase connection string
     - **Environment:** Production, Preview, Development (select all)
   
   - **Name:** `NEXTAUTH_SECRET`
     - **Value:** Your generated secret
     - **Environment:** Production, Preview, Development
   
   - **Name:** `NEXTAUTH_URL`
     - **Value:** `https://your-app-domain.vercel.app`
     - **Environment:** Production

4. Click **"Save"**

### Step 5: Run Database Migrations

The project includes SQL migration scripts to create all necessary tables. You have two options:

#### Option A: Using Supabase Dashboard (Recommended for beginners)

1. In your Supabase project, go to **"SQL Editor"** in the sidebar
2. Click **"New Query"**
3. Open the file `database/schema.sql` from this project
4. Copy and paste its entire contents into the SQL editor
5. Click **"Run"** (or press Ctrl/Cmd + Enter)
6. You should see: "Success. No rows returned"

#### Option B: Using Command Line (Advanced users)

```bash
# Install PostgreSQL client tools (if not already installed)
# macOS: brew install postgresql
# Ubuntu/Debian: sudo apt-get install postgresql-client
# Windows: Download from https://www.postgresql.org/download/

# Run the migration script
psql "postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres" -f database/schema.sql
```

### Step 6: Verify Database Setup

1. In Supabase dashboard, click **"Table Editor"** in the sidebar
2. You should see the following tables:
   - `customers` - Stores customer/tenant information
   - `users` - Stores user accounts
   - `search_history` - Logs all searches
   - `customer_stats` - View for customer statistics

### Step 7: Create Super Admin User

To create your first super admin user:

1. In Supabase dashboard, go to **"SQL Editor"**
2. Run this query (replace with your details):

```sql
-- Create the super admin customer
INSERT INTO customers (name, is_active) 
VALUES ('System Admin', true) 
RETURNING id;

-- Note the returned ID, then create the super admin user
-- Replace 1 with the actual customer ID from above if different
INSERT INTO users (
  username, 
  password_hash, 
  role, 
  customer_id, 
  email,
  full_name,
  is_active
) VALUES (
  'admin',                                                                    -- Username
  '$2b$10$YourBcryptHashHere',                                               -- Password hash (see below)
  'SUPER_ADMIN',                                                             -- Role
  1,                                                                         -- Customer ID from above
  'admin@yourdomain.com',                                                    -- Email
  'System Administrator',                                                    -- Full name
  true                                                                       -- Active
);
```

**To generate a password hash:**

```bash
# Using Node.js (run this in your project directory)
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('YourPassword123', 10, (err, hash) => console.log(hash));"

# Or use an online tool (not recommended for production):
# https://bcrypt-generator.com/
```

**Recommended:** Use the application's built-in user creation after initial setup instead of manual SQL.

### Step 8: Start Your Application

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit http://localhost:3000 and sign in with your admin credentials!

---

## Environment Variables Reference

Here's a complete list of environment variables used by the application:

```env
# Required - Database
DATABASE_URL="postgresql://user:password@host:port/database"

# Required - Authentication
NEXTAUTH_SECRET="random-secret-string"
NEXTAUTH_URL="http://localhost:3000"  # Change to production URL in production

# Optional - Caching (Redis)
REDIS_URL="redis://host:port"

# Optional - For development
NODE_ENV="development"  # or "production"
```

---

## Troubleshooting

### Issue: "Connection to database failed"

**Solutions:**
1. Verify your `DATABASE_URL` is correct
2. Make sure you replaced `[YOUR-PASSWORD]` with your actual password
3. Check if there are special characters in your password that need URL encoding:
   - Space → `%20`
   - `@` → `%40`
   - `#` → `%23`
   - etc.

### Issue: "SSL connection error"

**Solution:** Supabase requires SSL connections. The app is configured to handle this automatically, but if you see SSL errors, make sure your connection string includes the SSL parameter or use the connection pooler string from Supabase.

### Issue: "No tables found"

**Solution:** You haven't run the database migrations. Follow Step 5 above.

### Issue: "Cannot sign in"

**Solutions:**
1. Verify you created a super admin user (Step 7)
2. Check the password hash was generated correctly
3. Ensure the `customers` and `users` tables exist
4. Check the customer is set to `is_active = true`

### Issue: "Vercel deployment fails with database error"

**Solutions:**
1. Make sure you added `DATABASE_URL` to Vercel environment variables
2. The environment variable should be available in all environments (Production, Preview, Development)
3. Redeploy after adding environment variables

---

## Alternative: Self-Hosted PostgreSQL

If you still prefer to self-host PostgreSQL, here are brief instructions:

### Using Docker (Easiest)

```bash
# Create a docker-compose.yml file
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: yourpassword
      POSTGRES_DB: roblox_verifier
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:

# Start PostgreSQL
docker-compose up -d

# Your connection string:
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/roblox_verifier"
```

### Using Cloud Providers

- **AWS RDS:** [Guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_GettingStarted.CreatingConnecting.PostgreSQL.html)
- **Google Cloud SQL:** [Guide](https://cloud.google.com/sql/docs/postgres/quickstart)
- **Azure Database:** [Guide](https://learn.microsoft.com/en-us/azure/postgresql/)

---

## Database Schema Overview

The application uses the following tables:

### `customers`
Stores tenant/customer information for multi-tenant architecture.
- `id` - Unique customer identifier
- `name` - Customer/company name
- `is_active` - Whether the customer account is active
- `created_at` - Account creation timestamp

### `users`
Stores user accounts with role-based access control.
- `id` - Unique user identifier
- `username` - Login username (unique)
- `password_hash` - Bcrypt hashed password
- `role` - User role (SUPER_ADMIN, CUSTOMER_ADMIN, USER)
- `customer_id` - Links to customer (except for SUPER_ADMIN)
- `email` - User email address
- `full_name` - User's full name
- `is_active` - Whether the account is active
- `created_at` - Account creation timestamp
- `last_login` - Last login timestamp

### `search_history`
Logs all Roblox searches performed by users.
- `id` - Unique search record identifier
- `user_id` - User who performed the search
- `customer_id` - Customer the user belongs to
- `search_type` - Type of search (exact_match, smart_match, display_name)
- `search_query` - Search query text
- `roblox_username` - Found username (if any)
- `roblox_user_id` - Found user ID (if any)
- `roblox_display_name` - Found display name (if any)
- `has_verified_badge` - Whether user has verified badge
- `result_data` - Full JSON response data
- `result_count` - Number of results found
- `result_status` - success/no_results/error
- `error_message` - Error details (if any)
- `response_time_ms` - API response time
- `searched_at` - Timestamp of search

### `customer_stats` (View)
Pre-computed statistics for each customer combining data from multiple tables.

---

## Security Best Practices

1. **Never commit `.env.local` or `.env` files to Git** - They contain sensitive credentials
2. **Use strong database passwords** - At least 16 characters with mixed case, numbers, and symbols
3. **Rotate your `NEXTAUTH_SECRET` regularly** - Especially if you suspect it may be compromised
4. **Enable SSL for database connections** - Supabase does this by default
5. **Use environment-specific credentials** - Different passwords for development, staging, and production
6. **Regularly backup your database** - Supabase does this automatically, but export important data
7. **Monitor for suspicious activity** - Check the `search_history` table regularly

---

## Need Help?

- **Supabase Documentation:** https://supabase.com/docs
- **PostgreSQL Documentation:** https://www.postgresql.org/docs/
- **Next.js Environment Variables:** https://nextjs.org/docs/basic-features/environment-variables
- **NextAuth.js Documentation:** https://next-auth.js.org/

---

## Quick Reference: Connection String Format

```
postgresql://[username]:[password]@[host]:[port]/[database]?[options]

Example:
postgresql://postgres:MyPassword123@db.abcdefghijk.supabase.co:5432/postgres

Components:
- username: postgres (default for Supabase)
- password: Your database password
- host: db.abcdefghijk.supabase.co (from Supabase dashboard)
- port: 5432 (standard PostgreSQL port)
- database: postgres (default database name)
```

---

## Summary

To get started quickly:

1. ✅ Create a free Supabase account
2. ✅ Create a new project
3. ✅ Get your database connection string
4. ✅ Add `DATABASE_URL` to `.env.local`
5. ✅ Run the database migration (copy/paste schema.sql in Supabase SQL Editor)
6. ✅ Create your super admin user
7. ✅ Run `npm run dev` and start using the app!

**Total time: ~10 minutes** ⚡

Good luck with your Roblox Verifier Tool! 🚀
