'use client';

import { useState, useEffect } from 'react';

interface Stats {
  customers: {
    total_customers: number;
    active_customers: number;
    new_customers: number;
  };
  users: {
    total_users: number;
    active_users: number;
    super_admins: number;
    customer_admins: number;
    customer_users: number;
    new_users: number;
  };
  searches: {
    total_searches: number;
    recent_searches: number;
    successful_searches: number;
    no_results_searches: number;
    error_searches: number;
    avg_response_time: number;
    active_searchers: number;
  };
  recentActivity: Array<{
    id: number;
    search_query: string;
    search_type: string;
    result_status: string;
    searched_at: string;
    response_time_ms: number;
    username: string;
    customer_name: string | null;
  }>;
  topCustomers: Array<{
    id: number;
    name: string;
    search_count: number;
    active_users: number;
  }>;
}

export default function DashboardOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/stats?days=30');
      const data = await res.json();
      
      if (res.ok) {
        setStats(data);
      } else {
        setError(data.error || 'Failed to fetch statistics');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-purple-600"></div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error || 'Failed to load statistics'}
      </div>
    );
  }

  const successRate = stats.searches.total_searches > 0
    ? ((stats.searches.successful_searches / stats.searches.total_searches) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Customers */}
        <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl p-6 text-white shadow-lg transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">{stats.customers.total_customers}</div>
              <div className="text-blue-100 mt-1">Total Customers</div>
              <div className="text-sm text-blue-100 mt-2">
                {stats.customers.active_customers} active
              </div>
            </div>
            <div className="text-5xl opacity-20">🏢</div>
          </div>
        </div>

        {/* Total Users */}
        <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-xl p-6 text-white shadow-lg transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">{stats.users.total_users}</div>
              <div className="text-green-100 mt-1">Total Users</div>
              <div className="text-sm text-green-100 mt-2">
                {stats.users.active_users} active
              </div>
            </div>
            <div className="text-5xl opacity-20">👥</div>
          </div>
        </div>

        {/* Total Searches */}
        <div className="bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl p-6 text-white shadow-lg transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">{stats.searches.total_searches.toLocaleString()}</div>
              <div className="text-purple-100 mt-1">Total Searches</div>
              <div className="text-sm text-purple-100 mt-2">
                {stats.searches.recent_searches} in last 30 days
              </div>
            </div>
            <div className="text-5xl opacity-20">🔍</div>
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-gradient-to-br from-pink-400 to-pink-600 rounded-xl p-6 text-white shadow-lg transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">{successRate}%</div>
              <div className="text-pink-100 mt-1">Success Rate</div>
              <div className="text-sm text-pink-100 mt-2">
                Avg {Math.round(stats.searches.avg_response_time || 0)}ms
              </div>
            </div>
            <div className="text-5xl opacity-20">✅</div>
          </div>
        </div>
      </div>

      {/* Detailed Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Breakdown */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">👥</span>
            User Breakdown
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Super Admins</span>
              <span className="font-bold text-purple-600">{stats.users.super_admins}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Customer Admins</span>
              <span className="font-bold text-blue-600">{stats.users.customer_admins}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Customer Users</span>
              <span className="font-bold text-green-600">{stats.users.customer_users}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-gray-700">New Users (30 days)</span>
              <span className="font-bold text-green-600">{stats.users.new_users}</span>
            </div>
          </div>
        </div>

        {/* Search Statistics */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">📈</span>
            Search Statistics
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Successful</span>
              <span className="font-bold text-green-600">{stats.searches.successful_searches}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">No Results</span>
              <span className="font-bold text-yellow-600">{stats.searches.no_results_searches}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Errors</span>
              <span className="font-bold text-red-600">{stats.searches.error_searches}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span className="text-gray-700">Active Searchers</span>
              <span className="font-bold text-blue-600">{stats.searches.active_searchers}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Customers */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
          <span className="mr-2">🏆</span>
          Top Customers (Last 30 Days)
        </h3>
        {stats.topCustomers.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No customer activity yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Searches</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active Users</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.topCustomers.map((customer, index) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="text-2xl">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{customer.name}</td>
                    <td className="px-4 py-3 text-gray-600">{customer.search_count}</td>
                    <td className="px-4 py-3 text-gray-600">{customer.active_users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
          <span className="mr-2">⏱️</span>
          Recent Activity
        </h3>
        {stats.recentActivity.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {stats.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{activity.search_query}</div>
                  <div className="text-sm text-gray-600">
                    By {activity.username} • {activity.customer_name || 'Super Admin'}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    activity.result_status === 'success'
                      ? 'bg-green-100 text-green-800'
                      : activity.result_status === 'no_results'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {activity.result_status}
                  </span>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(activity.searched_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
