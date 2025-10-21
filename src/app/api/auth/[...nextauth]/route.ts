// FILE: src/app/api/auth/[...nextauth]/route.ts
// This file handles all NextAuth authentication logic with database integration

import NextAuth from 'next-auth';
import { authOptions } from '@/app/lib/auth';

// Create and export the NextAuth handler
const handler = NextAuth(authOptions);

// Export for both GET and POST requests
export { handler as GET, handler as POST };
