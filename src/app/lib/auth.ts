// FILE: src/app/lib/auth.ts
// NextAuth configuration with database authentication

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import * as bcrypt from 'bcrypt';
import { getUserByUsername, updateUserLastLogin } from '@/app/lib/db';

// NextAuth configuration with database authentication
export const authOptions: NextAuthOptions = {
  // Configure authentication providers
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text", placeholder: "Enter your username" },
        password: { label: "Password", type: "password" },
        rememberMe: { label: "Remember Me", type: "text" }
      },
      async authorize(credentials) {
        // Validate credentials exist
        if (!credentials?.username || !credentials?.password) {
          console.log('[Auth] Missing credentials');
          return null;
        }

        try {
          console.log('[Auth] Attempting authentication for:', credentials.username);
          console.log('[Auth] Remember me:', credentials.rememberMe === 'true');
          
          // Get user from database with error handling
          let user;
          try {
            user = await getUserByUsername(credentials.username);
          } catch (dbError) {
            console.error('[Auth] Database query error:', dbError);
            throw new Error('Database connection error. Please check your database configuration.');
          }
          
          if (!user) {
            console.log('[Auth] User not found:', credentials.username);
            return null;
          }

          // Check if user is active
          if (!user.is_active) {
            console.log('[Auth] User is inactive:', credentials.username);
            return null;
          }

          // Check if customer is active (for non-super-admin users)
          if (user.role !== 'SUPER_ADMIN' && !user.customer_is_active) {
            console.log('[Auth] Customer is inactive for user:', credentials.username);
            return null;
          }

          // Verify password with detailed logging
          let isPasswordValid = false;
          try {
            isPasswordValid = await bcrypt.compare(credentials.password, user.password_hash);
          } catch (bcryptError) {
            console.error('[Auth] Password comparison error:', bcryptError);
            return null;
          }
          
          if (!isPasswordValid) {
            console.log('[Auth] Invalid password for user:', credentials.username);
            return null;
          }

          console.log('[Auth] Authentication successful for:', credentials.username);

          // Update last login timestamp
          try {
            await updateUserLastLogin(user.id);
          } catch (updateError) {
            // Log but don't fail auth if we can't update last login
            console.error('[Auth] Failed to update last login:', updateError);
          }

          // Return user object for session
          return {
            id: user.id.toString(),
            name: user.full_name || user.username,
            email: user.email,
            username: user.username,
            role: user.role,
            customerId: user.customer_id?.toString(),
            customerName: user.customer_name,
            rememberMe: credentials.rememberMe === 'true',
          };
        } catch (error) {
          console.error('[Auth] Authentication error:', error);
          // Re-throw error to ensure it's properly handled
          throw error;
        }
      }
    })
  ],
  
  // Configure custom pages
  pages: {
    signIn: '/auth/signin',  // Custom sign-in page
    error: '/auth/signin',    // Redirect errors to sign-in page
  },
  
  // Configure session strategy
  session: {
    strategy: 'jwt',  // Use JSON Web Tokens for sessions
    maxAge: 30 * 24 * 60 * 60, // Session expires after 30 days
  },
  
  // Configure JWT
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // JWT expires after 30 days (max possible)
  },
  
  // Configure cookies
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        // Don't set maxAge here - it will be set dynamically based on rememberMe
      },
    },
  },
  
  // Callbacks to customize behavior
  callbacks: {
    // This callback runs when JWT is created or updated
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.customerId = user.customerId;
        token.customerName = user.customerName;
        token.rememberMe = user.rememberMe;
        
        // Set token expiration based on remember me preference
        const now = Date.now();
        if (user.rememberMe) {
          // Remember me: 30 days
          token.exp = Math.floor(now / 1000) + (30 * 24 * 60 * 60);
        } else {
          // Don't remember: 2 hours (session expires when browser closes)
          token.exp = Math.floor(now / 1000) + (2 * 60 * 60);
        }
      }
      return token;
    },
    
    // This callback runs when session is accessed
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.role = token.role as string;
        session.user.customerId = token.customerId as string | undefined;
        session.user.customerName = token.customerName as string | undefined;
      }
      return session;
    }
  },
  
  // Secret key for encrypting tokens (MUST be set in .env.local)
  secret: process.env.NEXTAUTH_SECRET,
  
  // Enable debug in development
  debug: process.env.NODE_ENV === 'development',
};
