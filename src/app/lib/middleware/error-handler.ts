import { NextResponse } from "next/server";
import { RateLimitError } from "@/app/lib/utils/rate-limit-detector";

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

export function handleApiError(error: unknown): NextResponse<ApiError> {
  console.error("API Error:", error);

  // Rate limit error
  if (error instanceof RateLimitError) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "Too many requests. Please wait before trying again.",
        statusCode: 429,
        details: {
          retryAfter: error.rateLimitInfo.retryAfterSeconds,
          retryAfterDate: error.rateLimitInfo.retryAfterDate?.toISOString(),
        },
      },
      { status: 429 }
    );
  }

  // Circuit breaker open
  if (error instanceof Error && error.message.includes("Circuit breaker is OPEN")) {
    return NextResponse.json(
      {
        error: "service_unavailable",
        message: "Service temporarily unavailable. Please try again later.",
        statusCode: 503,
      },
      { status: 503 }
    );
  }

  // Generic error
  return NextResponse.json(
    {
      error: "internal_error",
      message: error instanceof Error ? error.message : "An unexpected error occurred",
      statusCode: 500,
    },
    { status: 500 }
  );
}

// Usage wrapper
export function withErrorHandling(
  handler: (request: Request) => Promise<NextResponse>
) {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      return handleApiError(error);
    }
  };
}
