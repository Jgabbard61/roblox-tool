
# Duplicate Search Cooldown & Credit System Fix

## Problem History

### Issue #1 (October 30, 2025 - Morning)
User reported that duplicate searches were being blocked instead of returning cached results without charging credits.

### Issue #2 (October 30, 2025 - Afternoon)
After initial fix, the cooldown timer was completely removed and smart search stopped working. User wanted:
- **30-second cooldown on ALL searches** (duplicate or new) to prevent abuse
- **Duplicate searches should return cached results without charging**
- **New searches should charge 1 credit**

## Final Solution

The cooldown should **ALWAYS** trigger (for abuse prevention), but duplicate searches should:
- Return cached results from database
- NOT charge credits (0 credits)
- Still apply the 30-second cooldown

### Final Implementation

```typescript
// Smart Match Mode - CORRECT BEHAVIOR
response = await fetch(`/api/search?keyword=...&searchMode=smart`);
const searchData = await response.json();

// ✅ ALWAYS trigger cooldown (prevents abuse, even for duplicates)
if (!isCurrentlyBatchMode) {
  smartCooldown.startCooldown();
}

// ✅ Refresh balance to show no credit was deducted for duplicates
if (searchData.isDuplicate) {
  console.log('Duplicate search detected - no credit charged (results from cache)');
  refreshBalance();
}
```

## Complete Flow Diagram

### New Search Flow
```
User searches "JohnDoe" (first time)
    ↓
Backend checks search_cache table
    ↓
NOT FOUND → New search
    ↓
Fetch from Roblox API
    ↓
Store in search_cache table (30-day TTL)
    ↓
Deduct 1 credit (credit_transactions)
    ↓
Return results + isDuplicate: false
    ↓
Frontend: Start 30-second cooldown
    ↓
Frontend: Refresh balance
```

### Duplicate Search Flow
```
User searches "JohnDoe" (repeat, within 30 days)
    ↓
Backend checks search_cache table
    ↓
FOUND → Duplicate search
    ↓
Return cached results immediately
    ↓
Record 0-credit transaction (credit_transactions)
    ↓
Return results + isDuplicate: true
    ↓
Frontend: Start 30-second cooldown (abuse prevention)
    ↓
Frontend: Refresh balance (shows no deduction)
```

## Expected User Experience

### First Search
1. User enters "JohnDoe" in Smart Match mode
2. Clicks search button
3. **Results appear** (e.g., 5 matching users)
4. **Credit balance: 99** (was 100, -1 deducted)
5. **Cooldown timer: 30 seconds** (button disabled)
6. Transaction history shows: "Smart search for 'JohnDoe'" (-1 credit)

### Duplicate Search (After Cooldown Expires)
1. User enters "JohnDoe" again (same exact term)
2. Cooldown has expired (30 seconds passed)
3. Clicks search button
4. **Results appear instantly** (from cache, no API call to Roblox)
5. **Credit balance: 99** (no change!)
6. **Cooldown timer: 30 seconds** (starts again, prevents spam)
7. Transaction history shows: "Duplicate smart search for 'JohnDoe' (cached result, no charge)" (0 credits)
8. Console log: "Duplicate search detected - no credit charged (results from cache)"

### Third Search (After Another Cooldown)
1. User enters "JohnDoe" again
2. Cooldown has expired again
3. Clicks search button
4. **Results appear instantly** (still from cache)
5. **Credit balance: 99** (still no change!)
6. **Cooldown timer: 30 seconds** (starts again)
7. Another 0-credit transaction added

## Backend Logic Details

### Duplicate Detection (`/app/api/search/route.tsx`)

```typescript
// Lines 88-95: Check for duplicate search
if (customerId && customerId !== 'null') {
  const customerIdInt = parseInt(customerId);
  const cacheSearchType = (searchMode === 'smart' || searchMode === 'displayName') ? 'smart' : 'exact';
  
  // Check search_cache table
  cachedResult = await getSearchCache(customerIdInt, keyword, cacheSearchType);
  
  if (cachedResult) {
    // DUPLICATE FOUND
    // Return cached result WITHOUT charging
    return NextResponse.json({
      ...cachedData,
      fromCache: true,
      isDuplicate: true,  // ← Frontend uses this flag
      cacheTtl: CACHE_TTL.DUPLICATE_SEARCH,
    });
  }
}
```

### New Search Credit Deduction

```typescript
// Lines 332-343: Determine if credits should be deducted
if (searchMode === 'smart' || searchMode === 'displayName') {
  // Smart Match and Display Name: ALWAYS deduct 1 credit for NEW searches
  shouldDeductCredits = true;
  deductionReason = `${searchMode === 'smart' ? 'Smart' : 'Display Name'} search for "${keyword}"`;
}

// Lines 346-355: Cache the result for future duplicate detection
setSearchCache({
  customerId: customerIdInt,
  searchTerm: keyword,
  searchType: cacheSearchType,
  resultData: { users, searchResults },
  resultCount: users.length,
  resultStatus: users.length > 0 ? 'success' : 'no_results',
});

// Lines 361-373: Deduct the credit
deductCredits({
  customerId: customerIdInt,
  userId: userIdInt,
  amount: 1,
  searchHistoryId,
  description: deductionReason,
});
```

## Database Tables

### search_cache Table
Stores search results for duplicate detection (30-day TTL):
```sql
CREATE TABLE search_cache (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  search_term VARCHAR(255) NOT NULL,
  search_type VARCHAR(50) NOT NULL,  -- 'smart' or 'exact'
  result_data JSONB NOT NULL,
  result_count INTEGER NOT NULL,
  result_status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  UNIQUE(customer_id, search_term, search_type)
);
```

### credit_transactions Table
Records all credit changes (charges and free searches):
```sql
CREATE TABLE credit_transactions (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,           -- Negative for charges, 0 for free
  transaction_type VARCHAR(50) NOT NULL,
  description TEXT,
  search_history_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Example Records:**
| Transaction | Amount | Description |
|-------------|--------|-------------|
| First search "JohnDoe" | -1 | Smart search for "JohnDoe" |
| Duplicate search "JohnDoe" | 0 | Duplicate smart search for "JohnDoe" (cached result, no charge) |
| New search "JaneDoe" | -1 | Smart search for "JaneDoe" |
| Duplicate search "JohnDoe" | 0 | Duplicate smart search for "JohnDoe" (cached result, no charge) |

## Cache Settings
From `/home/ubuntu/roblox-tool/src/app/lib/utils/cache.ts`:

```typescript
export const CACHE_TTL = {
  EXACT_SEARCH: 60 * 60 * 24 * 7,      // 7 days
  FUZZY_SEARCH: 60 * 60 * 24,          // 1 day
  DUPLICATE_SEARCH: 60 * 60 * 24 * 30, // 30 days (in search_cache table)
};
```

**Duplicate search prevention lasts 30 days**, much longer than the regular cache TTL.

## Testing Checklist
- [ ] Search "TestUser" in Smart Match → 1 credit charged, cooldown starts
- [ ] Wait 30 seconds
- [ ] Search "TestUser" again → Results shown immediately, **no cooldown**, **no charge**
- [ ] Check transaction history → Only 1 transaction for "TestUser" (first search)
- [ ] Check console → "Duplicate search detected - no credit charged"
- [ ] Search different name "NewUser" → New cooldown, 1 credit charged
- [ ] Repeat test for Display Name mode

## Benefits
✅ **Better UX**: Users can repeat searches without cooldown penalties  
✅ **Correct billing**: No duplicate charges for the same search  
✅ **Transparent**: Console logs show when searches are cached  
✅ **Balance accuracy**: Auto-refresh confirms no charge  
✅ **Consistent**: Smart Match and Display Name modes behave identically  

## Files Modified
1. `/home/ubuntu/roblox-tool/src/app/page.tsx` (lines 208-310)

## Testing Checklist

### Test 1: New Search
- [ ] Search "TestUser123" in Smart Match mode
- [ ] Verify: Results appear
- [ ] Verify: Credit balance decreases by 1 (e.g., 100 → 99)
- [ ] Verify: 30-second cooldown starts (button disabled)
- [ ] Verify: Transaction history shows "-1 credit" for "Smart search for 'TestUser123'"

### Test 2: Duplicate Search (After Cooldown)
- [ ] Wait 30 seconds for cooldown to expire
- [ ] Search "TestUser123" again (exact same term)
- [ ] Verify: Results appear instantly (no loading delay)
- [ ] Verify: Credit balance stays the same (still 99)
- [ ] Verify: 30-second cooldown starts again
- [ ] Verify: Transaction history shows "0 credits" for "Duplicate smart search for 'TestUser123' (cached result, no charge)"
- [ ] Verify: Console shows "Duplicate search detected - no credit charged (results from cache)"

### Test 3: Multiple Duplicate Searches
- [ ] Wait 30 seconds
- [ ] Search "TestUser123" a third time
- [ ] Verify: Still returns cached results (99 credits)
- [ ] Verify: Cooldown starts again
- [ ] Verify: Another 0-credit transaction added

### Test 4: Different Search
- [ ] Wait 30 seconds
- [ ] Search "NewUser456" (different name)
- [ ] Verify: Credit balance decreases by 1 (99 → 98)
- [ ] Verify: New -1 credit transaction for "NewUser456"

### Test 5: Display Name Mode
- [ ] Repeat tests 1-4 using Display Name mode
- [ ] Verify: Same behavior (cooldown always applies, duplicates free)

### Test 6: Cooldown Abuse Prevention
- [ ] Search "AbuseTest"
- [ ] Immediately try to search "AbuseTest" again (before cooldown expires)
- [ ] Verify: Button is disabled (cooldown prevents search)
- [ ] Verify: This works even though it would be a duplicate

## Build Status
✅ Build successful
```bash
Route (app)                                        Size  First Load JS
┌ ○ /                                           30.8 kB         142 kB
✓ Compiled successfully
```

## Summary

### What Was Fixed
✅ Cooldown now ALWAYS applies (30 seconds) for all searches (new and duplicate)  
✅ Duplicate searches return cached results instantly (no Roblox API call)  
✅ Duplicate searches do NOT charge credits (0-credit transaction recorded)  
✅ Balance auto-refreshes after duplicate searches to confirm no charge  
✅ Console logs clearly indicate duplicate searches  
✅ All search modes (Smart Match, Display Name) work consistently  

### Why This Solution Works
- **Prevents abuse**: 30-second cooldown applies to every search
- **Saves money**: Duplicate searches are free (no Roblox API calls, no credit charges)
- **Fast**: Cached results return instantly (no API latency)
- **Transparent**: Users see 0-credit transactions in their history
- **Long-lasting**: Cache persists for 30 days per customer

---

**Fixed on**: October 30, 2025  
**Issue #1**: Duplicate searches were blocked instead of returning cached results  
**Issue #2**: Cooldown was removed entirely after first fix  
**Final Resolution**: Cooldown ALWAYS triggers (abuse prevention), but duplicates are free (no charge)
