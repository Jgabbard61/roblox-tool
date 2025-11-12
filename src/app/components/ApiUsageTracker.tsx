'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCreditBalance } from '@/app/context/CreditContext';

interface ApiCall {
  endpoint: string;
  method: string;
  statusCode: number;
  creditsUsed: number;
  timestamp: string;
  responseTime: number;
  apiKeyName: string;
}

interface TopEndpoint {
  endpoint: string;
  method: string;
  callCount: number;
  creditsUsed: number;
  avgResponseTime: number;
  successRate: number;
}

interface UsageByDate {
  date: string;
  callCount: number;
  creditsUsed: number;
}

interface UsageStats {
  summary: {
    totalApiCalls: number;
    creditsConsumed: number;
    mostUsedEndpoint: string | null;
    averageResponseTime: number;
    successRate: number;
  };
  recentApiCalls: ApiCall[];
  topEndpoints: TopEndpoint[];
  usageByDate: UsageByDate[];
}

interface ApiUsageTrackerProps {
  className?: string;
}

export default function ApiUsageTracker({ className = '' }: ApiUsageTrackerProps) {
  const router = useRouter();
  const { balance } = useCreditBalance();
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'recent' | 'top'>('recent');

  useEffect(() => {
    fetchUsageStats();
  }, []);

  const fetchUsageStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/usage-stats?days=30&limit=20');
      
      if (!res.ok) {
        throw new Error('Failed to fetch usage statistics');
      }

      const data = await res.json();
      if (data.success) {
        setUsageStats(data.data);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Error fetching usage stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load usage statistics');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadgeColor = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) return 'bg-green-100 text-green-800';
    if (statusCode >= 400 && statusCode < 500) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getLowCreditWarning = () => {
    const currentBalance = balance?.balance || 0;
    if (currentBalance === 0) {
      return {
        level: 'critical',
        message: 'Your credit balance is zero. Purchase credits to continue using the API.',
        bgColor: 'bg-red-100 border-red-400 text-red-800',
        icon: '⚠️',
      };
    }
    if (currentBalance < 50) {
      return {
        level: 'warning',
        message: 'Your credit balance is running low. Consider purchasing more credits.',
        bgColor: 'bg-yellow-100 border-yellow-400 text-yellow-800',
        icon: '⚡',
      };
    }
    return null;
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-xl p-6 ${className}`}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-4 text-gray-600">Loading API usage statistics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-xl p-6 ${className}`}>
        <div className="text-center py-12">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Failed to Load Statistics</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={fetchUsageStats}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const lowCreditWarning = getLowCreditWarning();

  return (
    <div className={`bg-white rounded-lg shadow-xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">API Usage Tracking</h2>
          <p className="text-gray-500 text-sm mt-1">Monitor your API activity and credit consumption</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/dashboard/api-docs')}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition font-medium shadow-md flex items-center gap-2"
          >
            <span>📖</span>
            <span>API Docs</span>
          </button>
          <button
            onClick={fetchUsageStats}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium shadow-md flex items-center gap-2"
          >
            <span>🔄</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Low Credit Warning */}
      {lowCreditWarning && (
        <div className={`border px-4 py-3 rounded-lg mb-6 ${lowCreditWarning.bgColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-2xl mr-3">{lowCreditWarning.icon}</span>
              <div>
                <p className="font-bold">{lowCreditWarning.level === 'critical' ? 'Critical:' : 'Warning:'} Low Credit Balance</p>
                <p className="text-sm">{lowCreditWarning.message}</p>
              </div>
            </div>
            <a
              href="#credit-packages"
              className="px-4 py-2 bg-white rounded-lg hover:bg-gray-50 transition font-medium shadow-sm"
            >
              Buy Credits
            </a>
          </div>
        </div>
      )}

      {/* Credit Balance Card */}
      <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg p-6 mb-6 text-white shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium opacity-90 mb-2">Current Credit Balance</h3>
            <p className="text-5xl font-bold">{balance?.balance || 0}</p>
            <p className="text-sm opacity-80 mt-2">credits available</p>
          </div>
          <div className="text-right">
            <div className="bg-white bg-opacity-20 rounded-lg p-4 backdrop-blur-sm">
              <p className="text-sm opacity-90 mb-1">Total Purchased</p>
              <p className="text-2xl font-bold">{balance?.totalPurchased || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-600">Total API Calls</h4>
            <span className="text-2xl">📊</span>
          </div>
          <p className="text-3xl font-bold text-blue-600">{usageStats?.summary.totalApiCalls || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-600">Credits Consumed</h4>
            <span className="text-2xl">💳</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{usageStats?.summary.creditsConsumed || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-600">Success Rate</h4>
            <span className="text-2xl">✅</span>
          </div>
          <p className="text-3xl font-bold text-green-600">
            {usageStats?.summary.successRate 
              ? `${(usageStats.summary.successRate * 100).toFixed(1)}%`
              : 'N/A'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-600">Avg Response</h4>
            <span className="text-2xl">⚡</span>
          </div>
          <p className="text-3xl font-bold text-purple-600">{usageStats?.summary.averageResponseTime || 0}</p>
          <p className="text-xs text-gray-500 mt-1">milliseconds</p>
        </div>
      </div>

      {/* Most Used Endpoint */}
      {usageStats?.summary.mostUsedEndpoint && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-600 mb-1">Most Used Endpoint</h4>
              <p className="text-lg font-semibold text-gray-800 font-mono">{usageStats.summary.mostUsedEndpoint}</p>
            </div>
            <span className="text-3xl">🔥</span>
          </div>
        </div>
      )}

      {/* Tabs for Recent Calls and Top Endpoints */}
      <div className="mb-4">
        <div className="flex space-x-2 border-b border-gray-200">
          <button
            onClick={() => setSelectedTab('recent')}
            className={`px-4 py-2 font-medium transition ${
              selectedTab === 'recent'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Recent API Calls
          </button>
          <button
            onClick={() => setSelectedTab('top')}
            className={`px-4 py-2 font-medium transition ${
              selectedTab === 'top'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Top Endpoints
          </button>
        </div>
      </div>

      {/* Recent API Calls Table */}
      {selectedTab === 'recent' && (
        <div className="overflow-x-auto">
          {usageStats?.recentApiCalls && usageStats.recentApiCalls.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50">
                  <th className="text-left p-3 text-gray-600 font-semibold text-sm">Timestamp</th>
                  <th className="text-left p-3 text-gray-600 font-semibold text-sm">Endpoint</th>
                  <th className="text-left p-3 text-gray-600 font-semibold text-sm">Method</th>
                  <th className="text-left p-3 text-gray-600 font-semibold text-sm">Status</th>
                  <th className="text-right p-3 text-gray-600 font-semibold text-sm">Credits</th>
                  <th className="text-right p-3 text-gray-600 font-semibold text-sm">Response Time</th>
                  <th className="text-left p-3 text-gray-600 font-semibold text-sm">API Key</th>
                </tr>
              </thead>
              <tbody>
                {usageStats.recentApiCalls.map((call, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3 text-gray-700 text-sm">{formatDate(call.timestamp)}</td>
                    <td className="p-3 text-gray-700 text-sm font-mono">{call.endpoint}</td>
                    <td className="p-3">
                      <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium">
                        {call.method}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeColor(call.statusCode)}`}>
                        {call.statusCode}
                      </span>
                    </td>
                    <td className={`p-3 text-right font-semibold text-sm ${call.creditsUsed > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                      {call.creditsUsed > 0 ? `-${call.creditsUsed}` : '0'}
                    </td>
                    <td className="p-3 text-right text-gray-700 text-sm">{call.responseTime}ms</td>
                    <td className="p-3 text-gray-700 text-sm">{call.apiKeyName || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No API Calls Yet</h3>
              <p className="text-gray-500 mb-4">Start using your API keys to see activity here.</p>
              <button
                onClick={() => router.push('/dashboard/api-docs')}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                View API Documentation
              </button>
            </div>
          )}
        </div>
      )}

      {/* Top Endpoints Table */}
      {selectedTab === 'top' && (
        <div className="overflow-x-auto">
          {usageStats?.topEndpoints && usageStats.topEndpoints.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50">
                  <th className="text-left p-3 text-gray-600 font-semibold text-sm">Endpoint</th>
                  <th className="text-left p-3 text-gray-600 font-semibold text-sm">Method</th>
                  <th className="text-right p-3 text-gray-600 font-semibold text-sm">Total Calls</th>
                  <th className="text-right p-3 text-gray-600 font-semibold text-sm">Credits Used</th>
                  <th className="text-right p-3 text-gray-600 font-semibold text-sm">Avg Response</th>
                  <th className="text-right p-3 text-gray-600 font-semibold text-sm">Success Rate</th>
                </tr>
              </thead>
              <tbody>
                {usageStats.topEndpoints.map((endpoint, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3 text-gray-700 text-sm font-mono">{endpoint.endpoint}</td>
                    <td className="p-3">
                      <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium">
                        {endpoint.method}
                      </span>
                    </td>
                    <td className="p-3 text-right font-semibold text-gray-700 text-sm">{endpoint.callCount}</td>
                    <td className="p-3 text-right font-semibold text-red-600 text-sm">{endpoint.creditsUsed}</td>
                    <td className="p-3 text-right text-gray-700 text-sm">{endpoint.avgResponseTime}ms</td>
                    <td className="p-3 text-right text-gray-700 text-sm">
                      {(endpoint.successRate * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Endpoint Data</h3>
              <p className="text-gray-500">Endpoint statistics will appear here once you start using the API.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
