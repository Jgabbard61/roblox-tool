// FILE: src/app/api/auth/[...nextauth]/route.ts
// This file handles all NextAuth authentication logic with database integration

import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import * as bcrypt from 'bcrypt';
import { getUserByUsername, updateUserLastLogin } from '@/app/lib/db';

// NextAuth configuration with database authentication
const authOptions: NextAuthOptions = {
  // Configure authentication providers
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text", placeholder: "Enter your username" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        try {
          // Get user from database
          const user = await getUserByUsername(credentials.username);
          
          if (!user) {
            console.log('User not found:', credentials.username);
            return null;
          }

          // Check if user is active
          if (!user.is_active) {
            console.log('User is inactive:', credentials.username);
            return null;
          }

          // Check if customer is active (for non-super-admin users)
          if (user.role !== 'SUPER_ADMIN' && !user.customer_is_active) {
            console.log('Customer is inactive for user:', credentials.username);
            return null;
          }

          // Verify password
          const isPasswordValid = await bcrypt.compare(credentials.password, user.password_hash);
          
          if (!isPasswordValid) {
            console.log('Invalid password for user:', credentials.username);
            return null;
          }

          // Update last login timestamp
          await updateUserLastLogin(user.id);

          // Return user object for session
          return {
            id: user.id.toString(),
            name: user.full_name || user.username,
            email: user.email,
            username: user.username,
            role: user.role,
            customerId: user.customer_id?.toString(),
            customerName: user.customer_name,
          };
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
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
    maxAge: 30 * 24 * 60 * 60, // JWT expires after 30 days
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

// Create and export the NextAuth handler
const handler = NextAuth(authOptions);

// Export for both GET and POST requests
export { handler as GET, handler as POST };