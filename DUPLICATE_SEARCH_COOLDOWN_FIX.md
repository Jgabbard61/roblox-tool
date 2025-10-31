
# Duplicate Search Cooldown Fix

## Problem
When a user performed a search (e.g., "JohnDoe") and then searched for the same term again after the 30-second cooldown, the search was being **blocked by the cooldown mechanism** even though the backend was correctly returning cached results without charging credits.

### User-Reported Behavior
1. Search "JohnDoe" in Smart Match mode → Results shown, 1 credit deducted ✅
2. Wait 30 seconds (cooldown expires) ✅
3. Search "JohnDoe" again → **Button becomes disabled immediately** ❌
4. Expected: Results should be shown from cache with no credit charge

## Root Cause
The issue was in **`/home/ubuntu/roblox-tool/src/app/page.tsx`**:

### Before Fix
```typescript
// Smart Match Mode
if (!isCurrentlyBatchMode) {
  smartCooldown.startCooldown(); // ❌ Cooldown started BEFORE API call
}

response = await fetch(`/api/search?keyword=...&searchMode=smart`);
const searchData = await response.json();
```

The cooldown was being triggered **before** the API call, so:
1. Cooldown starts immediately (30 seconds)
2. Button becomes disabled
3. API returns cached results (no charge)
4. But the damage is done - cooldown already started

### Button Disable Logic
```typescript
<button
  disabled={
    loading || 
    (searchMode === 'smart' && smartCooldown.isOnCooldown) ||
    (searchMode === 'displayName' && displayNameCooldown.isOnCooldown)
  }
>
```

## Solution
**Move the cooldown trigger AFTER the API call** and only activate it if the search is **NOT a duplicate**.

### After Fix
```typescript
// Smart Match Mode
response = await fetch(`/api/search?keyword=...&searchMode=smart`);
const searchData = await response.json();

// ✅ Only trigger cooldown if this was NOT a duplicate/cached search
if (!isCurrentlyBatchMode && !searchData.isDuplicate) {
  smartCooldown.startCooldown();
}

// ✅ Refresh balance to show no credit was deducted for duplicates
if (searchData.isDuplicate) {
  console.log('Duplicate search detected - no credit charged');
  refreshBalance();
}
```

## Changes Made

### 1. Smart Match Mode (`page.tsx` lines 208-244)
- **Moved** `smartCooldown.startCooldown()` to execute AFTER the API response
- **Added** check: only trigger cooldown if `!searchData.isDuplicate`
- **Added** balance refresh for duplicate searches

### 2. Display Name Mode (`page.tsx` lines 268-310)
- **Moved** `displayNameCooldown.startCooldown()` to execute AFTER the API response
- **Added** check: only trigger cooldown if `!searchData.isDuplicate`
- **Added** balance refresh for duplicate searches

### 3. Backend Already Correct
The backend (`/home/ubuntu/roblox-tool/src/app/api/search/route.tsx`) was already:
- ✅ Detecting duplicate searches via `getSearchCache()`
- ✅ Returning cached results with `isDuplicate: true`
- ✅ Recording free search transactions (0 credits)
- ✅ Not charging credits for duplicates

## Expected Behavior After Fix
### Scenario 1: New Search
1. User searches "JohnDoe" (first time)
2. API charges 1 credit
3. **Cooldown starts (30 seconds)**
4. Button disabled during cooldown
5. Results stored in cache

### Scenario 2: Duplicate Search (After Cooldown)
1. User searches "JohnDoe" again (after 30 seconds)
2. API returns cached results instantly
3. **No cooldown triggered** ✅
4. **No credit charged** ✅
5. **Button remains enabled** ✅
6. Balance refreshed to confirm no charge

### Scenario 3: Duplicate Search (Within Cache Period)
1. User searches "JohnDoe" (day 1)
2. User searches "JohnDoe" again (day 2, within 30-day cache period)
3. API returns cached results
4. **No cooldown triggered** ✅
5. **No credit charged** ✅

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

## Build Status
✅ Build successful
```bash
Route (app)                                        Size  First Load JS
┌ ○ /                                           30.8 kB         142 kB
✓ Compiled successfully
```

---

**Fixed on**: October 30, 2025  
**Issue**: Duplicate search cooldown blocking user searches  
**Resolution**: Conditional cooldown trigger based on API response
