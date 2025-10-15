"use client";

import { useEffect, useState } from "react";

interface ServiceStatus {
  title: string;
  value: string;
  status: "healthy" | "degraded" | "warning";
}

interface Summary {
  totalRequests: number;
  cacheHitRate: number;
  avgResponseTime: number;
  errorRate: number;
  rateLimited: number;
}

function StatusCard({ title, value, status }: ServiceStatus) {
  const statusColors = {
    healthy: "bg-green-100 border-green-500 text-green-800",
    degraded: "bg-red-100 border-red-500 text-red-800",
    warning: "bg-yellow-100 border-yellow-500 text-yellow-800",
  };

  return (
    <div className={`p-6 border-l-4 rounded-lg ${statusColors[status]}`}>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

export default function StatusPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch("/api/admin/metrics");
        const data = await response.json();
        setSummary(data.summary);
      } catch (error) {
        console.error("Failed to fetch metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">Service Status</h1>
        <p>Loading metrics...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">Service Status</h1>
        <p>No metrics available.</p>
      </div>
    );
  }

  const getStatus = (
    value: number,
    goodThreshold: number,
    warningThreshold: number
  ): "healthy" | "degraded" | "warning" => {
    if (value < goodThreshold) return "healthy";
    if (value < warningThreshold) return "warning";
    return "degraded";
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Service Status</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatusCard
          title="Service Availability"
          value={`${(100 - summary.errorRate).toFixed(2)}%`}
          status={getStatus(summary.errorRate, 1, 5)}
        />
        <StatusCard
          title="Average Response Time"
          value={`${summary.avgResponseTime.toFixed(0)}ms`}
          status={getStatus(summary.avgResponseTime, 2000, 5000)}
        />
        <StatusCard
          title="Cache Performance"
          value={`${summary.cacheHitRate.toFixed(1)}%`}
          status={summary.cacheHitRate > 70 ? "healthy" : summary.cacheHitRate > 50 ? "warning" : "degraded"}
        />
      </div>

      {summary.rateLimited > 0 && (
        <div className="mt-8 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
          <p className="text-yellow-800">
            <strong>Notice:</strong> We&apos;re currently experiencing elevated API
            usage. Some searches may be temporarily delayed.
          </p>
        </div>
      )}

      <div className="mt-8 p-6 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Detailed Metrics</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Requests</p>
            <p className="text-2xl font-bold">{summary.totalRequests}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Rate Limited Requests</p>
            <p className="text-2xl font-bold">{summary.rateLimited}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
