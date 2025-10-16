'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Customer {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
  total_users: number;
  active_users: number;
  total_searches: number;
  last_search_at: string | null;
  last_login_at: string | null;
}

interface SearchLog {
  id: number;
  search_type: string;
  search_query: string;
  searched_at: string;
  roblox_username: string | null;
  roblox_user_id: number | null;
  result_status: string;
  searched_by: string;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchLogs, setSearchLogs] = useState<SearchLog[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for creating new customer
  const [newCustomer, setNewCustomer] = useState({
    customerName: '',
    adminUsername: '',
    adminPassword: '',
    adminEmail: '',
  });

  // Redirect if not super admin
  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session || session.user.role !== 'SUPER_ADMIN') {
      router.push('/');
    }
  }, [session, status, router]);

  // Fetch customers on mount
  useEffect(() => {
    if (session?.user.role === 'SUPER_ADMIN') {
      fetchCustomers();
    }
  }, [session]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/customers');
      const data = await res.json();
      
      if (res.ok) {
        setCustomers(data.customers);
      } else {
        setError(data.error || 'Failed to fetch customers');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSearchLogs = async (customerId: number) => {
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/searches?limit=50`);
      const data = await res.json();
      
      if (res.ok) {
        setSearchLogs(data.searches);
      }
    } catch (error) {
      console.error('Failed to fetch search logs:', error);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer),
      });

      const data = await res.json();

      if (res.ok) {
        alert(`✅ Customer created successfully!\n\nAdmin Credentials:\nUsername: ${newCustomer.adminUsername}\nPassword: ${newCustomer.adminPassword}\n\nPlease save these credentials!`);
        setShowCreateModal(false);
        setNewCustomer({
          customerName: '',
          adminUsername: '',
          adminPassword: '',
          adminEmail: '',
        });
        fetchCustomers();
      } else {
        setError(data.error || 'Failed to create customer');
      }
    } catch {
      setError('Network error');
    } finally {
      setCreateLoading(false);
    }
  };

  const toggleCustomerStatus = async (customerId: number, currentStatus: boolean) => {
    const confirmed = confirm(
      `Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this customer?`
    );

    if (!confirmed) return;

    try {
      const res = await fetch('/api/admin/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          isActive: !currentStatus,
        }),
      });

      if (res.ok) {
        fetchCustomers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update customer status');
      }
    } catch {
      alert('Network error');
    }
  };

  const viewCustomerDetails = (customer: Customer) => {
    setSelectedCustomer(customer);
    fetchSearchLogs(customer.id);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (session?.user.role !== 'SUPER_ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              🔐 Super Admin Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Welcome, <span className="font-semibold">{session.user.username}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors font-medium"
            >
              🏠 Home
            </button>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-3xl font-bold">{customers.length}</div>
            <div className="text-blue-100 mt-1">Total Customers</div>
          </div>
          <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-3xl font-bold">
              {customers.filter(c => c.is_active).length}
            </div>
            <div className="text-green-100 mt-1">Active Customers</div>
          </div>
          <div className="bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-3xl font-bold">
              {customers.reduce((sum, c) => sum + (c.total_users || 0), 0)}
            </div>
            <div className="text-purple-100 mt-1">Total Users</div>
          </div>
          <div className="bg-gradient-to-br from-pink-400 to-pink-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-3xl font-bold">
              {customers.reduce((sum, c) => sum + (c.total_searches || 0), 0)}
            </div>
            <div className="text-pink-100 mt-1">Total Searches</div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            ➕ Create New Customer
          </button>
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600">
            <h2 className="text-xl font-bold text-white">📊 Customers</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Searches
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Activity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {customer.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {customer.id}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          customer.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {customer.is_active ? '✓ Active' : '✗ Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {customer.active_users || 0} / {customer.total_users || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {customer.total_searches || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {customer.last_search_at
                        ? new Date(customer.last_search_at).toLocaleString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => viewCustomerDetails(customer)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => toggleCustomerStatus(customer.id, customer.is_active)}
                        className={`${
                          customer.is_active
                            ? 'text-red-600 hover:text-red-900'
                            : 'text-green-600 hover:text-green-900'
                        }`}
                      >
                        {customer.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer Details Modal */}
        {selectedCustomer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">
                  {selectedCustomer.name} - Search History
                </h3>
                <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setSearchLogs([]);
                  }}
                  className="text-white hover:text-gray-200 text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="p-6">
                {searchLogs.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No search history found</p>
                ) : (
                  <div className="space-y-4">
                    {searchLogs.map((log) => (
                      <div
                        key={log.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {log.search_query}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              Type: {log.search_type} • By: {log.searched_by}
                            </div>
                            {log.roblox_username && (
                              <div className="text-sm text-gray-600">
                                Result: {log.roblox_username} (ID: {log.roblox_user_id})
                              </div>
                            )}
                          </div>
                          <div className="ml-4 text-right">
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                log.result_status === 'success'
                                  ? 'bg-green-100 text-green-800'
                                  : log.result_status === 'no_results'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {log.result_status}
                            </span>
                            <div className="text-xs text-gray-500 mt-1">
                              {new Date(log.searched_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create Customer Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">Create New Customer</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-white hover:text-gray-200 text-2xl"
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={newCustomer.customerName}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, customerName: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Username *
                  </label>
                  <input
                    type="text"
                    value={newCustomer.adminUsername}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, adminUsername: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Password * (min 8 chars)
                  </label>
                  <input
                    type="password"
                    value={newCustomer.adminPassword}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, adminPassword: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    minLength={8}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Email (optional)
                  </label>
                  <input
                    type="email"
                    value={newCustomer.adminEmail}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, adminEmail: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50"
                  >
                    {createLoading ? 'Creating...' : 'Create Customer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
