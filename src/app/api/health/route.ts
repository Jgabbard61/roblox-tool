import { NextResponse } from "next/server";
import { robloxApiCircuitBreaker } from "@/app/lib/utils/circuit-breaker";
import { robloxApiQueue } from "@/app/lib/utils/request-queue";

export async function GET() {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      cache: "unknown",
      robloxApi: "unknown",
      circuitBreaker: robloxApiCircuitBreaker.getState(),
      requestQueue: robloxApiQueue.getStatus(),
    },
  };

  // Check cache (Redis)
  try {
    if (process.env.REDIS_URL) {
      const getRedisClient = (await import("@/app/lib/redis")).default;
      const redis = getRedisClient();
      await redis.set("health_check", Date.now().toString());
      const value = await redis.get("health_check");
      health.services.cache = value ? "healthy" : "degraded";
    } else {
      health.services.cache = "not_configured";
    }
  } catch (_error) {
    health.services.cache = "unhealthy";
    health.status = "degraded";
  }

  // Check Roblox API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch("https://users.roblox.com/v1/users/1", {
      method: "GET",
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    health.services.robloxApi = response.ok ? "healthy" : "degraded";
  } catch (_error) {
    health.services.robloxApi = "unhealthy";
    health.status = "degraded";
  }

  const statusCode = health.status === "healthy" ? 200 : 503;
  return NextResponse.json(health, { status: statusCode });
}