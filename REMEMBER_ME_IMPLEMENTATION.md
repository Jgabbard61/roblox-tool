# Remember Me Feature Implementation

## Overview
Added a "Remember Me" feature to the login page that allows users to choose whether to stay logged in for an extended period (30 days) or have their session expire after 2 hours.

## Changes Made

### 1. Login Page UI (src/app/auth/signin/page.tsx)
- Added `rememberMe` state to track checkbox status
- Added "Remember Me" checkbox in the login form (between password field and submit button)
- Updated `handleSubmit` to:
  - Store remember me preference in localStorage
  - Pass rememberMe parameter to signIn function

### 2. Authentication Configuration (src/app/lib/auth.ts)
- Added `rememberMe` to credentials definition
- Updated `authorize` function to:
  - Accept and log rememberMe parameter
  - Return rememberMe value in user object
- Modified JWT callback to:
  - Store rememberMe preference in token
  - Set dynamic token expiration:
    - **Remember Me checked**: 30 days (30 * 24 * 60 * 60 seconds)
    - **Remember Me unchecked**: 2 hours (2 * 60 * 60 seconds)
- Added cookies configuration for secure session management

### 3. Type Definitions (next-auth.d.ts)
- Added `rememberMe?: boolean` to User interface
- Added `rememberMe?: boolean` and `exp?: number` to JWT interface

## How It Works

1. **User checks "Remember Me"**:
   - Session cookie set to expire in 30 days
   - JWT token valid for 30 days
   - User stays logged in even after closing browser

2. **User doesn't check "Remember Me"**:
   - Session cookie expires in 2 hours
   - JWT token valid for 2 hours
   - User will be logged out after session expires

## Security Considerations
- Sessions use httpOnly cookies to prevent XSS attacks
- Secure flag enabled in production
- SameSite: lax for CSRF protection
- All session tokens are encrypted using NEXTAUTH_SECRET

## Testing
To test the feature:
1. Login without checking "Remember Me" - session should expire in 2 hours
2. Login with "Remember Me" checked - session should persist for 30 days
3. Close and reopen browser - verify session persistence based on checkbox selection

## Files Modified
1. `/src/app/auth/signin/page.tsx` - Added UI and logic for remember me checkbox
2. `/src/app/lib/auth.ts` - Implemented session duration logic
3. `/next-auth.d.ts` - Updated TypeScript definitions

## Dependencies
No new dependencies required. Uses existing:
- next-auth
- react
- TypeScript
