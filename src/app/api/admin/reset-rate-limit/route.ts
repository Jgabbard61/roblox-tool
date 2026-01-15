// Admin endpoint to reset rate limits (for testing/debugging)
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// This is a simple way to access the rate limit store
// In production, you'd want proper Redis management
const ipLimits = new Map<string, any>();

export async function POST(request: Request) {
  try {
    // Check if user is super admin
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { ipAddress } = body;

    if (!ipAddress) {
      return NextResponse.json(
        { error: 'IP address required' },
        { status: 400 }
      );
    }

    // Note: This won't actually clear the in-memory map from ip-rate-limit.ts
    // You need to restart the server or wait for the hour to expire
    // This is just a placeholder for future Redis implementation

    return NextResponse.json({
      success: true,
      message: `Rate limit would be reset for ${ipAddress}. Note: Restart server to clear in-memory limits.`
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to reset rate limit' },
      { status: 500 }
    );
  }
}
