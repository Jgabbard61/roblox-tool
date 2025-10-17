'use client';

import { useState, useEffect } from 'react';

interface Customer {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
  total_users: number;
  active_users: number;
  total_searches: number;
  contact_email?: string;
  max_users?: number;
}

export default function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  const [newCustomer, setNewCustomer] = useState({
    customerName: '',
    adminUsername: '',
    adminPassword: '',
    adminEmail: '',
  });

  const [editCustomer, setEditCustomer] = useState({
    name: '',
    contactEmail: '',
    maxUsers: 5,
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/customers');
      const data = await res.json();
      
      if (res.ok) {
        setCustomers(data.customers);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch customers');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
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

  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    setCreateLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          ...editCustomer,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert('✅ Customer updated successfully!');
        setShowEditModal(false);
        setSelectedCustomer(null);
        fetchCustomers();
      } else {
        setError(data.error || 'Failed to update customer');
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

  const handleDeleteCustomer = async (customerId: number, force: boolean = false) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    if (!force && customer.total_users > 0) {
      const confirmed = confirm(
        `⚠️ WARNING: This customer has ${customer.total_users} associated user(s).\n\nDeleting the customer will also delete all associated users and their search history.\n\nAre you sure you want to proceed?`
      );

      if (!confirmed) return;
    }

    try {
      const res = await fetch(`/api/admin/customers?customerId=${customerId}&force=true`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (res.ok) {
        alert(`✅ Customer deleted successfully. ${data.deletedUsers} user(s) removed.`);
        fetchCustomers();
      } else {
        alert(data.error || 'Failed to delete customer');
      }
    } catch {
      alert('Network error');
    }
  };

  const openEditModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditCustomer({
      name: customer.name,
      contactEmail: customer.contact_email || '',
      maxUsers: customer.max_users || 5,
    });
    setShowEditModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Action Button */}
      <div>
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
          <h2 className="text-xl font-bold text-white">🏢 Customers ({customers.length})</h2>
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
                  Created
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
                    {new Date(customer.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => openEditModal(customer)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleCustomerStatus(customer.id, customer.is_active)}
                      className={`${
                        customer.is_active
                          ? 'text-yellow-600 hover:text-yellow-900'
                          : 'text-green-600 hover:text-green-900'
                      }`}
                    >
                      {customer.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(customer.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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

      {/* Edit Customer Modal */}
      {showEditModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Edit Customer</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-white hover:text-gray-200 text-2xl"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleEditCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={editCustomer.name}
                  onChange={(e) =>
                    setEditCustomer({ ...editCustomer, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={editCustomer.contactEmail}
                  onChange={(e) =>
                    setEditCustomer({ ...editCustomer, contactEmail: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Users
                </label>
                <input
                  type="number"
                  value={editCustomer.maxUsers}
                  onChange={(e) =>
                    setEditCustomer({ ...editCustomer, maxUsers: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min={1}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50"
                >
                  {createLoading ? 'Updating...' : 'Update Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
