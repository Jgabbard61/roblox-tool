# VerifyLens Registration & Checkout - Deployment Verification Guide

## 📋 Overview

This guide verifies that all 5 phases of the registration and checkout system are properly deployed and functional.

**Implementation Status:** ✅ **ALL PHASES COMPLETE**

## ✅ Phase 1: Registration System in Main App (roblox-tool)

### Implementation Details
- **File:** `/src/app/api/auth/register/route.ts`
- **Endpoint:** `POST /api/auth/register`
- **Status:** ✅ IMPLEMENTED

### Features Implemented
- [x] Email and password validation
- [x] Password complexity requirements (8+ chars, uppercase, lowercase, number, special char)
- [x] Duplicate email/company detection
- [x] Creates both customer and user records in transaction
- [x] Generates email verification token (24-hour expiry)
- [x] Sends verification email via Resend
- [x] Returns userId and customerId for checkout

### Database Migration Applied
- **File:** `/database/migrations/002_add_email_verification.sql`
- **Added fields:**
  - `email_verified` (BOOLEAN)
  - `email_verification_token` (VARCHAR(255))
  - `email_verification_expires` (TIMESTAMP)
  - `phone_number` (VARCHAR(50))

### Required Environment Variables
```env
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=https://www.verifylens.com
APP_URL=https://www.verifylens.com
RESEND_API_KEY=re_...
```

---

## ✅ Phase 2: Registration Modal on Landing Page (roblox-lander)

### Implementation Details
- **File:** `/components/registration-modal.tsx`
- **Integration:** `/app/credits/page.tsx`
- **Status:** ✅ IMPLEMENTED

### Features Implemented
- [x] Modern modal UI with Framer Motion animations
- [x] Real-time form validation
- [x] Password strength indicator
- [x] Show/hide password toggles
- [x] Loading states during registration
- [x] Package information display
- [x] Error handling with toast notifications
- [x] Calls main app registration API
- [x] Returns registration data to proceed with checkout

### User Flow
1. User clicks "Purchase Package" on credits page
2. Registration modal opens with package details
3. User fills in: First Name, Last Name, Email, Phone (optional), Company Name, Password
4. Form validates all fields
5. API call to `${NEXT_PUBLIC_APP_URL}/api/auth/register`
6. On success: modal closes, proceeds to checkout with userId/customerId
7. On error: displays error message in toast

### Required Environment Variables
```env
NEXT_PUBLIC_APP_URL=https://www.verifylens.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
```

---

## ✅ Phase 3: Updated Checkout Flow

### Implementation Details
- **File (Lander):** `/app/api/checkout/route.ts`
- **File (Main App):** `/src/app/api/credits/webhook/route.ts`
- **Status:** ✅ IMPLEMENTED

### Features Implemented
- [x] Requires email, customerId, and userId
- [x] Creates Stripe checkout session with metadata
- [x] Passes userId and customerId to Stripe webhook
- [x] Includes metadata in payment_intent_data
- [x] Redirects user to Stripe checkout page
- [x] Success/cancel URL handling

### Checkout Flow
```
Registration Success
  ↓
Create Checkout Session (with userId, customerId, email)
  ↓
Redirect to Stripe Checkout
  ↓
User Completes Payment
  ↓
Stripe Webhook Triggered
  ↓
Add Credits to Customer Account
  ↓
Send Welcome Email
  ↓
Redirect to Success Page
```

### Metadata Passed to Stripe
```json
{
  "customer_id": "123",
  "user_id": "456",
  "credits": "50",
  "packageName": "Professional",
  "package_id": "1",
  "price": "5000",
  "customerEmail": "user@law.com",
  "customerName": "John Doe",
  "source": "landing_page"
}
```

---

## ✅ Phase 4: Email Notifications

### Implementation Details
- **File:** `/src/app/lib/email/index.ts`
- **Service:** Resend API
- **Status:** ✅ IMPLEMENTED

### Email Types Implemented

#### 1. Verification Email
- **Trigger:** Immediately after registration
- **Contains:**
  - Personalized greeting with first name
  - Clickable verification button
  - Alternative verification link
  - 24-hour expiration notice
  - Security notice
- **Template:** Professional gradient design with branding

#### 2. Welcome Email (First Purchase)
- **Trigger:** After successful payment (webhook)
- **Conditions:**
  - userId and customerId present in metadata
  - First purchase for the user
- **Contains:**
  - Username for login
  - Login link to main app
  - Credit balance
  - Security notice
  - Getting started instructions
- **Note:** Does NOT include password (user set during registration)

#### 3. Welcome Email (Legacy Flow)
- **Trigger:** Payment without prior registration
- **Conditions:**
  - Only customerId present (no userId)
  - Legacy checkout flow
- **Contains:**
  - Generated username
  - Temporary password
  - Login link
  - Credit balance
  - Password change instructions

#### 4. Purchase Confirmation Email
- **Trigger:** Subsequent purchases
- **Conditions:**
  - User already exists and has made purchases before
- **Contains:**
  - Purchase summary
  - Credits added
  - Amount paid
  - New balance
  - Thank you message

### Email Configuration
```typescript
const FROM_EMAIL = 'VerifyLens <noreply@verifylens.com>';
const FROM_NAME = 'VerifyLens';
```

### Required Environment Variables
```env
RESEND_API_KEY=re_...
APP_URL=https://www.verifylens.com
NEXTAUTH_URL=https://www.verifylens.com
```

---

## ✅ Phase 5: Testing & Verification

### Pre-Deployment Checklist

#### Environment Variables - Main App (Vercel)
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `NEXTAUTH_SECRET` - Secret for JWT encryption (min 32 chars)
- [ ] `NEXTAUTH_URL` - `https://www.verifylens.com`
- [ ] `APP_URL` - `https://www.verifylens.com`
- [ ] `RESEND_API_KEY` - Resend API key (starts with `re_`)
- [ ] `STRIPE_SECRET_KEY` - Stripe secret key (starts with `sk_live_` or `sk_test_`)
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key (starts with `pk_live_` or `pk_test_`)
- [ ] `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret (starts with `whsec_`)
- [ ] `REDIS_URL` (optional) - Redis connection string

#### Environment Variables - Landing Page (Vercel)
- [ ] `NEXT_PUBLIC_APP_URL` - `https://www.verifylens.com`
- [ ] `NEXT_PUBLIC_SITE_URL` - `https://site.verifylens.com`
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Same as main app
- [ ] `STRIPE_SECRET_KEY` - Same as main app

#### Database Migration
```bash
# Run this SQL migration on your production database
psql $DATABASE_URL -f database/migrations/002_add_email_verification.sql
```

**Verify Migration:**
```sql
-- Check if columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('email_verified', 'email_verification_token', 'email_verification_expires', 'phone_number');
```

Expected output:
```
        column_name         |     data_type     
-----------------------------+-------------------
 email_verified              | boolean
 email_verification_token    | character varying
 email_verification_expires  | timestamp with time zone
 phone_number                | character varying
```

#### Stripe Webhook Setup
1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. **Endpoint URL:** `https://www.verifylens.com/api/credits/webhook`
4. **Listen to:** "Events on your account"
5. **Select events:**
   - ✅ `checkout.session.completed`
6. **API version:** `2025-09-30.clover` (or latest)
7. Copy the **Signing secret** (starts with `whsec_`)
8. Add to Vercel environment variables as `STRIPE_WEBHOOK_SECRET`

---

## 🧪 Testing Instructions

### Test 1: Registration Flow

**Steps:**
1. Go to `https://site.verifylens.com/credits`
2. Click "Purchase Package" on any package
3. Fill in registration form:
   - First Name: Test
   - Last Name: User
   - Email: `test+${timestamp}@example.com` (use unique email)
   - Phone: +1 (555) 123-4567
   - Company: Test Law Firm
   - Password: `TestPass123!`
   - Confirm Password: `TestPass123!`
4. Click "Create Account & Continue"

**Expected Results:**
- ✅ Success toast appears
- ✅ Modal closes
- ✅ Redirects to Stripe checkout page
- ✅ Verification email received within 1 minute

**Verification Email Checklist:**
- [ ] Email received from `VerifyLens <noreply@verifylens.com>`
- [ ] Subject: "Verify Your VerifyLens Email Address"
- [ ] Contains personalized greeting with first name
- [ ] Has clickable "Verify Email Address" button
- [ ] Has alternative verification link
- [ ] Has 24-hour expiration notice
- [ ] Has security notice

---

### Test 2: Email Verification

**Steps:**
1. Open verification email from Test 1
2. Click "Verify Email Address" button OR copy/paste link

**Expected Results:**
- ✅ Redirects to `https://www.verifylens.com/auth/signin?message=EmailVerified`
- ✅ Sign-in page shows success message: "Email verified successfully! You can now sign in."
- ✅ Database shows `email_verified = true`

**Database Verification:**
```sql
SELECT email, email_verified, email_verification_token 
FROM users 
WHERE email = 'test+timestamp@example.com';
```

Expected:
```
           email           | email_verified | email_verification_token
---------------------------+----------------+-------------------------
 test+timestamp@example.com|      true      |          NULL
```

---

### Test 3: Checkout Flow

**Prerequisites:** Complete Test 1 and return to Stripe checkout page

**Steps:**
1. On Stripe checkout page, verify package details are correct
2. Enter test card: `4242 4242 4242 4242`
3. Expiry: Any future date (e.g., `12/34`)
4. CVC: Any 3 digits (e.g., `123`)
5. Name: Test User
6. Click "Pay"

**Expected Results:**
- ✅ Payment processes successfully
- ✅ Redirects to success page: `https://site.verifylens.com/credits/success?session_id=...`
- ✅ Success page shows confirmation message
- ✅ Welcome email received within 1-2 minutes

**Welcome Email Checklist:**
- [ ] Email received from `VerifyLens <noreply@verifylens.com>`
- [ ] Subject: "Welcome to VerifyLens!"
- [ ] Contains username (generated from email prefix)
- [ ] Contains login link to `https://www.verifylens.com/auth/signin`
- [ ] Shows credit balance (e.g., "50 credits")
- [ ] Does NOT contain a password (user set during registration)
- [ ] Has "Get Started" section
- [ ] Has support contact information

---

### Test 4: Credit Addition

**Prerequisites:** Complete Test 3

**Steps:**
1. Check database for credit transaction

**Database Verification:**
```sql
-- Get customer ID
SELECT id, name, contact_email 
FROM customers 
WHERE name = 'Test Law Firm';

-- Check credits (replace {customer_id} with ID from above)
SELECT * FROM customer_stats 
WHERE id = {customer_id};

-- Check credit transactions
SELECT * FROM credit_transactions 
WHERE customer_id = {customer_id} 
ORDER BY created_at DESC 
LIMIT 5;
```

**Expected Results:**
- ✅ `customer_stats` shows correct total and available credits
- ✅ `credit_transactions` has entry with type 'credit' and correct amount
- ✅ `stripe_payments` table has payment record

---

### Test 5: Login & Access

**Prerequisites:** Complete Tests 1-4 and verify email

**Steps:**
1. Go to `https://www.verifylens.com/auth/signin`
2. Enter username (from welcome email or check database)
3. Enter password set during registration (`TestPass123!`)
4. Click "Sign In"

**Expected Results:**
- ✅ Successfully logged in
- ✅ Redirected to main dashboard
- ✅ Credit balance displayed correctly
- ✅ User can perform searches

**Database Verification:**
```sql
SELECT username, email, last_login, is_active 
FROM users 
WHERE email = 'test+timestamp@example.com';
```

Expected: `last_login` updated to current timestamp

---

### Test 6: Webhook Verification

**Steps:**
1. Go to Stripe Dashboard → Developers → Webhooks
2. Find the webhook endpoint for `www.verifylens.com`
3. Click on it to view details
4. Check "Sending" tab for recent events

**Expected Results:**
- ✅ Event `checkout.session.completed` shows status "succeeded"
- ✅ Response code is `200`
- ✅ Response body shows `{"received":true,"creditsAdded":50}`
- ✅ No errors in webhook logs

**If Webhook Failed:**
- Check `STRIPE_WEBHOOK_SECRET` in Vercel environment variables
- Check application logs in Vercel
- Verify webhook URL is correct: `https://www.verifylens.com/api/credits/webhook`
- Retry webhook from Stripe dashboard

---

### Test 7: Edge Cases

#### Test 7.1: Duplicate Email
**Steps:**
1. Try to register with same email from Test 1
2. Fill in all fields
3. Submit

**Expected:** Error toast: "Email address is already registered"

---

#### Test 7.2: Duplicate Company Name
**Steps:**
1. Try to register with same company name from Test 1
2. Use different email
3. Submit

**Expected:** Error toast: "Company name is already registered. Please contact support if you need access to this organization."

---

#### Test 7.3: Weak Password
**Steps:**
1. Try to register with password: `test123`
2. Submit

**Expected:** Error: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"

---

#### Test 7.4: Expired Verification Token
**Steps:**
1. Register new account
2. Wait or manually set `email_verification_expires` to past date:
   ```sql
   UPDATE users SET email_verification_expires = NOW() - INTERVAL '1 hour' WHERE email = 'test@example.com';
   ```
3. Try to verify email

**Expected:** Redirect to `/auth/signin?error=TokenExpired` with message "Verification link has expired. Please request a new one."

---

#### Test 7.5: Invalid Verification Token
**Steps:**
1. Try to access: `https://www.verifylens.com/api/auth/verify-email?token=invalid_token_12345`

**Expected:** Redirect to `/auth/signin?error=InvalidToken` with message "Invalid verification link. Please request a new one."

---

## 🐛 Troubleshooting

### Issue: Verification Email Not Received

**Possible Causes:**
1. **Resend API key not set or invalid**
   - Check Vercel environment variables
   - Verify `RESEND_API_KEY` starts with `re_`
   - Test key in Resend dashboard

2. **Email going to spam**
   - Check spam/junk folder
   - Add `noreply@verifylens.com` to safe senders
   - Verify DNS records for `verifylens.com` (SPF, DKIM, DMARC)

3. **Resend domain not verified**
   - Go to Resend dashboard → Domains
   - Verify `verifylens.com` is verified
   - Check DNS records are correctly configured

**Debug Steps:**
```bash
# Check Vercel logs
vercel logs roblox-tool --follow

# Check for email sending errors
# Look for: [Registration] Verification email sent to: email@example.com
# Or: [Registration] Failed to send verification email: error
```

---

### Issue: Welcome Email Not Received

**Possible Causes:**
1. **Webhook not triggering**
   - Verify webhook is set up in Stripe dashboard
   - Check webhook signing secret matches environment variable
   - Check webhook URL is correct

2. **Metadata not passed correctly**
   - Check Stripe checkout session includes `payment_intent_data.metadata`
   - Verify `userId` and `customerId` are present

3. **Email service failure**
   - Check Resend dashboard for delivery status
   - Check Vercel logs for email errors

**Debug Steps:**
```bash
# Check webhook logs in Stripe dashboard
# Look for: checkout.session.completed event

# Check application logs
vercel logs roblox-tool --follow

# Look for:
# [Webhook] Processing checkout session: cs_...
# [Webhook] Credits added: {...}
# [Email] Sending welcome email to: email@example.com
```

---

### Issue: Credits Not Added After Payment

**Possible Causes:**
1. **Webhook failed**
   - Check Stripe webhook logs for errors
   - Verify webhook secret is correct

2. **Database connection failed**
   - Check `DATABASE_URL` in environment variables
   - Test database connection

3. **Metadata missing**
   - Verify checkout session includes `customer_id` and `credits` in metadata

**Debug Steps:**
```sql
-- Check if customer_stats record exists
SELECT * FROM customer_stats WHERE id = {customer_id};

-- Check credit transactions
SELECT * FROM credit_transactions 
WHERE customer_id = {customer_id} 
ORDER BY created_at DESC;

-- Check stripe payments
SELECT * FROM stripe_payments 
WHERE customer_id = {customer_id} 
ORDER BY created_at DESC;
```

---

### Issue: Can't Login After Registration

**Possible Causes:**
1. **Email not verified**
   - Check `email_verified` column in database
   - User must verify email before login (if enforced)

2. **Wrong username**
   - Username is auto-generated from email prefix
   - Check database for correct username

3. **Wrong password**
   - Password must match what was set during registration
   - Use password reset if forgotten

4. **User or customer inactive**
   - Check `users.is_active` and `customers.is_active`
   - Both must be `true` for login

**Debug Steps:**
```sql
SELECT u.username, u.email, u.email_verified, u.is_active, c.is_active as customer_active
FROM users u
JOIN customers c ON u.customer_id = c.id
WHERE u.email = 'user@example.com';
```

---

## 📊 Monitoring

### Key Metrics to Track

1. **Registration Success Rate**
   ```sql
   SELECT 
     COUNT(*) as total_registrations,
     COUNT(CASE WHEN email_verified THEN 1 END) as verified_emails,
     ROUND(100.0 * COUNT(CASE WHEN email_verified THEN 1 END) / COUNT(*), 2) as verification_rate
   FROM users
   WHERE created_at > NOW() - INTERVAL '7 days';
   ```

2. **Checkout Completion Rate**
   ```sql
   SELECT 
     COUNT(DISTINCT customer_id) as customers_with_purchases,
     SUM(credits) as total_credits_sold,
     SUM(amount / 100.0) as total_revenue
   FROM stripe_payments
   WHERE created_at > NOW() - INTERVAL '7 days';
   ```

3. **Email Delivery Rate**
   - Check Resend dashboard for delivery stats
   - Monitor bounce rate, spam complaints

4. **Webhook Success Rate**
   - Check Stripe webhook dashboard
   - Monitor for failed events

---

## 🚀 Deployment Steps

### Step 1: Verify Database Migration
```bash
psql $DATABASE_URL -f database/migrations/002_add_email_verification.sql
```

### Step 2: Set Environment Variables in Vercel

**Main App (roblox-tool):**
```bash
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_URL production
vercel env add APP_URL production
vercel env add RESEND_API_KEY production
vercel env add STRIPE_SECRET_KEY production
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
```

**Landing Page (roblox-lander):**
```bash
vercel env add NEXT_PUBLIC_APP_URL production
vercel env add NEXT_PUBLIC_SITE_URL production
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
vercel env add STRIPE_SECRET_KEY production
```

### Step 3: Setup Stripe Webhook
1. Create webhook endpoint in Stripe dashboard
2. Copy signing secret to `STRIPE_WEBHOOK_SECRET`
3. Add to Vercel environment variables

### Step 4: Deploy to Vercel
```bash
# Main App
cd /home/ubuntu/github_repos/roblox-tool
git push origin main
# Vercel auto-deploys

# Landing Page
cd /home/ubuntu/github_repos/roblox-lander
git push origin main
# Vercel auto-deploys
```

### Step 5: Run Tests
Follow all tests in "Testing Instructions" section above

---

## ✅ Final Checklist

Before marking deployment complete, verify:

- [ ] All environment variables set in Vercel (both apps)
- [ ] Database migration applied successfully
- [ ] Stripe webhook configured and working
- [ ] Resend domain verified
- [ ] Test 1: Registration works
- [ ] Test 2: Email verification works
- [ ] Test 3: Checkout completes successfully
- [ ] Test 4: Credits added correctly
- [ ] Test 5: User can login
- [ ] Test 6: Webhook processing successful
- [ ] Test 7: Edge cases handled properly
- [ ] Monitoring setup complete

---

## 📞 Support

If you encounter issues:

1. Check Vercel logs: `vercel logs [app-name] --follow`
2. Check Stripe webhook logs in dashboard
3. Check Resend delivery logs in dashboard
4. Review database for inconsistencies
5. Contact support: support@verifylens.com

---

## 📝 Notes

- **Test Mode:** Use Stripe test keys for testing (starts with `sk_test_` and `pk_test_`)
- **Production Mode:** Use Stripe live keys for production (starts with `sk_live_` and `pk_live_`)
- **Email Verification:** Required before login (enforced in auth flow)
- **Credits Never Expire:** Once purchased, credits remain in account indefinitely
- **Webhook Retries:** Stripe automatically retries failed webhooks
- **Security:** All passwords hashed with bcrypt (10 rounds)

---

**Document Version:** 1.0  
**Last Updated:** October 29, 2025  
**Status:** ✅ ALL PHASES COMPLETE AND READY FOR DEPLOYMENT
