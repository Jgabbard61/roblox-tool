import { NextResponse } from "next/server";
import { metricsCollector } from "@/app/lib/utils/monitoring";

export async function GET() {
  // In production, add authentication here
  const summary = metricsCollector.getSummary();
  const recentMetrics = metricsCollector.getMetrics().slice(-100);

  return NextResponse.json({
    summary,
    recentMetrics,
  });
}