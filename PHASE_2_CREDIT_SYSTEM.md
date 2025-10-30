# Phase 2: Credit System Implementation

## Overview

This document describes the complete credit system implementation for the Roblox Verifier Tool. The system allows customers to purchase credits via Stripe and use them to perform searches.

## Architecture

### Database Schema

The credit system consists of four new tables:

1. **credit_packages** - Defines available packages for purchase
2. **customer_credits** - Tracks credit balance for each customer
3. **credit_transactions** - Logs all credit movements (purchases, usage, refunds)
4. **credit_pricing** - Defines cost in credits for different operations

### API Endpoints

#### Credit Packages
- `GET /api/credit-packages` - Fetch all active credit packages

#### Credits Management
- `GET /api/credits/balance` - Get current balance for authenticated customer
- `GET /api/credits/transactions` - Get transaction history
- `POST /api/credits/purchase` - Create Stripe checkout session
- `POST /api/credits/webhook` - Handle Stripe webhook events

### User Interface

#### Dashboard Page (`/dashboard`)
The customer dashboard displays:
- Current credit balance
- Total purchased and used credits
- Available credit packages for purchase
- Recent transaction history
- Navigation back to the verifier tool

Features:
- Responsive design
- Real-time balance updates
- Stripe checkout integration
- Success/error notifications

#### Main Verifier Page
- Added "Buy Credits" button in header for easy access to dashboard
- Button visible to all authenticated users
- Admin button remains visible only to SUPER_ADMIN role

## Setup Instructions

### 1. Run Database Migration

Execute the credit system migration on your Supabase database:

```sql
-- Connect to your Supabase SQL Editor and run:
-- File: database/migrations/004_add_credit_system.sql

-- The migration will:
-- 1. Create the four credit system tables
-- 2. Add indexes for performance
-- 3. Set up triggers for timestamp updates
-- 4. Seed default credit packages
-- 5. Seed default credit pricing for operations
```

The default packages seeded are:
- **Starter Pack**: 10 credits for $10.00
- **Professional Pack**: 50 credits for $50.00
- **Business Pack**: 100 credits for $100.00
- **Enterprise Pack**: 200 credits for $200.00

The default operation costs are:
- **Exact Search**: 1 credit
- **Smart Search**: 3 credits
- **Display Name Search**: 2 credits
- **Forensic Mode**: 5 credits
- **Deep Context**: 2 credits

### 2. Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# App URL (for Stripe redirects)
NEXTAUTH_URL=https://your-app-url.vercel.app
```

### 3. Configure Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Create a new webhook endpoint:
   - URL: `https://your-app-url.vercel.app/api/credits/webhook`
   - Events to listen for: `checkout.session.completed`
3. Copy the webhook signing secret and add it to `.env.local` as `STRIPE_WEBHOOK_SECRET`

### 4. Add Environment Variables to Vercel

1. Go to your Vercel project settings
2. Navigate to Environment Variables
3. Add the three Stripe variables:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET`
4. Make sure `NEXTAUTH_URL` is also set correctly
5. Redeploy the application

## Usage Flow

### Customer Purchase Flow

1. Customer navigates to dashboard via "Buy Credits" button
2. Dashboard displays:
   - Current balance
   - Available packages
   - Transaction history
3. Customer clicks "Purchase" on desired package
4. Redirected to Stripe Checkout
5. After successful payment:
   - Stripe sends webhook to `/api/credits/webhook`
   - Credits are added to customer balance
   - Transaction is recorded
   - Customer redirected to dashboard with success message

### Credit Usage Flow (Future Implementation)

When implementing credit deduction for searches:

```typescript
// Example: Deduct credits for a search
import { query } from '@/app/lib/db';

async function deductCredits(
  customerId: number,
  userId: number,
  searchType: string,
  searchHistoryId: number
) {
  // Get operation cost
  const costResult = await query(
    `SELECT cost_in_credits 
     FROM credit_pricing 
     WHERE operation_type = $1 AND is_active = true`,
    [searchType]
  );
  
  if (costResult.rows.length === 0) {
    throw new Error('Operation pricing not configured');
  }
  
  const cost = costResult.rows[0].cost_in_credits;
  
  // Begin transaction
  await query('BEGIN', []);
  
  try {
    // Check and update balance
    const balanceResult = await query(
      `UPDATE customer_credits 
       SET balance = balance - $1,
           total_used = total_used + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE customer_id = $2 AND balance >= $1
       RETURNING balance`,
      [cost, customerId]
    );
    
    if (balanceResult.rows.length === 0) {
      throw new Error('Insufficient credits');
    }
    
    const newBalance = balanceResult.rows[0].balance;
    
    // Record transaction
    await query(
      `INSERT INTO credit_transactions 
       (customer_id, user_id, transaction_type, amount, balance_after, 
        search_history_id, usage_description)
       VALUES ($1, $2, 'usage', $3, $4, $5, $6)`,
      [
        customerId,
        userId,
        -cost, // Negative for deduction
        newBalance,
        searchHistoryId,
        `${searchType} search`
      ]
    );
    
    await query('COMMIT', []);
    return { success: true, newBalance };
  } catch (error) {
    await query('ROLLBACK', []);
    throw error;
  }
}
```

## Testing

### Test Credit Purchase

1. Use Stripe test cards:
   - Success: `4242 4242 4242 4242`
   - Requires Authentication: `4000 0025 0000 3155`
   - Declined: `4000 0000 0000 9995`

2. Test the webhook locally:
   ```bash
   # Install Stripe CLI
   stripe listen --forward-to localhost:3000/api/credits/webhook
   
   # Trigger test checkout event
   stripe trigger checkout.session.completed
   ```

### Verify Database

```sql
-- Check credit packages
SELECT * FROM credit_packages WHERE is_active = true;

-- Check customer balance
SELECT * FROM customer_credits WHERE customer_id = 1;

-- Check transactions
SELECT * FROM credit_transactions 
WHERE customer_id = 1 
ORDER BY created_at DESC 
LIMIT 10;

-- Check pricing
SELECT * FROM credit_pricing WHERE is_active = true;
```

## Customization

### Adding New Credit Packages

```sql
INSERT INTO credit_packages (name, credits, price_cents, is_active, description)
VALUES ('Premium Pack', 500, 40000, true, 'Maximum value for power users');
```

### Updating Operation Costs

```sql
UPDATE credit_pricing
SET cost_in_credits = 5
WHERE operation_type = 'smart_search';
```

### Managing Customer Credits (Admin)

```sql
-- Manual credit adjustment (e.g., for support issues)
INSERT INTO credit_transactions 
(customer_id, transaction_type, amount, balance_after, description)
VALUES (
  1, 
  'adjustment', 
  100, 
  (SELECT balance + 100 FROM customer_credits WHERE customer_id = 1),
  'Compensation for service outage'
);

UPDATE customer_credits
SET balance = balance + 100
WHERE customer_id = 1;
```

## Security Considerations

1. **Webhook Signature Verification**: The webhook endpoint verifies Stripe signatures to prevent tampering
2. **Database Transactions**: All credit operations use database transactions to ensure consistency
3. **Balance Checks**: Credits are only deducted if sufficient balance exists
4. **Audit Trail**: All transactions are logged with full context

## Monitoring

Key metrics to monitor:

1. **Revenue Metrics**
   - Total purchases per package
   - Average order value
   - Purchase conversion rate

2. **Usage Metrics**
   - Credits used per customer
   - Most used operations
   - Credit balance distribution

3. **System Health**
   - Failed webhook deliveries
   - Transaction failures
   - Negative balance attempts (should be 0)

## Support

For issues:
1. Check Vercel logs for API errors
2. Check Stripe Dashboard for webhook delivery status
3. Query database for transaction history
4. Verify environment variables are set correctly

## Future Enhancements

1. **Auto-recharge**: Automatic credit purchase when balance is low
2. **Credit expiration**: Optional expiration policy for unused credits
3. **Volume discounts**: Bulk pricing for large purchases
4. **Usage alerts**: Notify customers when credits are running low
5. **Referral credits**: Bonus credits for customer referrals
6. **Credit sharing**: Allow credit pools for organizations
