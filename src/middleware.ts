// middleware.ts - Add response time logging
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const start = Date.now();

  const response = NextResponse.next();

  // Log response time
  response.headers.set("X-Response-Time", `${Date.now() - start}ms`);

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
