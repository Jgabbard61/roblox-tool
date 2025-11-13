// middleware.ts - Authentication and authorization middleware
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const start = Date.now();
  const { pathname } = request.nextUrl;

  // Get the JWT token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Public paths that don't require authentication
  const publicPaths = [
    '/auth/signin',
    '/api/auth',
    '/api/health',
    '/api/v1/keys/create',  // Public API endpoint for creating new customers
    '/api/v1/verify',        // Public API endpoints for verification (with API key)
    '/api/v1/usage',         // Public API endpoints for usage (with API key)
    '/api/v1/credits',       // Public API endpoints for credits (with API key)
    '/_next',
    '/favicon.ico',
  ];

  // Check if the path is public
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  // If not authenticated and trying to access protected route, redirect to login
  if (!isPublicPath && !token) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // If authenticated and trying to access login page, redirect to home
  if (pathname === '/auth/signin' && token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Check admin routes - only SUPER_ADMIN can access
  if (pathname.startsWith('/admin') && token?.role !== 'SUPER_ADMIN') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Check admin API routes - only SUPER_ADMIN can access
  if (pathname.startsWith('/api/admin') && token?.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    );
  }

  const response = NextResponse.next();

  // Add user info to headers for API routes
  if (token && pathname.startsWith('/api/')) {
    response.headers.set('X-User-Id', token.id as string);
    response.headers.set('X-User-Role', token.role as string);
    // Set customer ID even if null (for SUPER_ADMIN)
    response.headers.set('X-Customer-Id', token.customerId as string || 'null');
  }

  // Log response time
  response.headers.set("X-Response-Time", `${Date.now() - start}ms`);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
