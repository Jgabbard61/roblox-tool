'use client';

import { useState, useEffect } from 'react';

interface User {
  id: number;
  username: string;
  role: string;
  customer_id: number | null;
  customer_name: string | null;
  email: string | null;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

interface Customer {
  id: number;
  name: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    customerId: 'all',
    role: 'all',
    search: '',
  });

  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'CUSTOMER_USER',
    customerId: '',
    email: '',
    fullName: '',
  });

  const [editUser, setEditUser] = useState({
    role: '',
    customerId: '',
    email: '',
    fullName: '',
    isActive: true,
  });

  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchCustomers();
  }, [filters]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.customerId !== 'all') params.append('customerId', filters.customerId);
      if (filters.role !== 'all') params.append('role', filters.role);
      if (filters.search) params.append('search', filters.search);

      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      
      if (res.ok) {
        setUsers(data.users);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch users');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/admin/customers');
      const data = await res.json();
      if (res.ok) {
        setCustomers(data.customers);
      }
    } catch {
      console.error('Failed to fetch customers');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUser.username,
          password: newUser.password,
          role: newUser.role,
          customerId: newUser.customerId || null,
          email: newUser.email || null,
          fullName: newUser.fullName || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(`✅ User created successfully!\n\nUsername: ${newUser.username}\nPassword: ${newUser.password}\n\nPlease save these credentials!`);
        setShowCreateModal(false);
        setNewUser({
          username: '',
          password: '',
          role: 'CUSTOMER_USER',
          customerId: '',
          email: '',
          fullName: '',
        });
        fetchUsers();
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch {
      setError('Network error');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setCreateLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          updates: {
            role: editUser.role,
            customer_id: editUser.customerId || null,
            email: editUser.email || null,
            full_name: editUser.fullName || null,
            is_active: editUser.isActive,
          },
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert('✅ User updated successfully!');
        setShowEditModal(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        setError(data.error || 'Failed to update user');
      }
    } catch {
      setError('Network error');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setCreateLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/users/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          newPassword,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(`✅ Password reset successfully!\n\nUsername: ${data.username}\nNew Password: ${newPassword}\n\nPlease save these credentials!`);
        setShowPasswordModal(false);
        setSelectedUser(null);
        setNewPassword('');
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch {
      setError('Network error');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const confirmed = confirm(`⚠️ Are you sure you want to delete user "${user.username}"?\n\nThis action cannot be undone.`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/users?userId=${userId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        alert('✅ User deleted successfully!');
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete user');
      }
    } catch {
      alert('Network error');
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditUser({
      role: user.role,
      customerId: user.customer_id?.toString() || '',
      email: user.email || '',
      fullName: user.full_name || '',
      isActive: user.is_active,
    });
    setShowEditModal(true);
  };

  const openPasswordModal = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  if (loading && users.length === 0) {
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

      {/* Filters and Actions */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Username, email, or name..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer
            </label>
            <select
              value={filters.customerId}
              onChange={(e) => setFilters({ ...filters, customerId: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Customers</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <select
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="CUSTOMER_ADMIN">Customer Admin</option>
              <option value="CUSTOMER_USER">Customer User</option>
            </select>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all font-semibold shadow-lg"
          >
            ➕ Create User
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600">
          <h2 className="text-xl font-bold text-white">👥 Users ({users.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{user.username}</div>
                    {user.email && <div className="text-sm text-gray-500">{user.email}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      user.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-800' :
                      user.role === 'CUSTOMER_ADMIN' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {user.customer_name || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium space-x-2">
                    <button onClick={() => openEditModal(user)} className="text-blue-600 hover:text-blue-900">
                      Edit
                    </button>
                    <button onClick={() => openPasswordModal(user)} className="text-yellow-600 hover:text-yellow-900">
                      Reset Password
                    </button>
                    <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-900">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 flex justify-between items-center sticky top-0">
              <h3 className="text-xl font-bold text-white">Create New User</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-white hover:text-gray-200 text-2xl">×</button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Username *</label>
                <input type="text" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password * (min 8 chars)</label>
                <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" minLength={8} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" required>
                  <option value="CUSTOMER_USER">Customer User</option>
                  <option value="CUSTOMER_ADMIN">Customer Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
              {newUser.role !== 'SUPER_ADMIN' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer *</label>
                  <select value={newUser.customerId} onChange={(e) => setNewUser({ ...newUser, customerId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" required>
                    <option value="">Select Customer</option>
                    {customers.map((customer) => (<option key={customer.id} value={customer.id}>{customer.name}</option>))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input type="text" value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={createLoading}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg disabled:opacity-50">
                  {createLoading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal - Similar structure */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Edit User</h3>
              <button onClick={() => setShowEditModal(false)} className="text-white text-2xl">×</button>
            </div>
            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                <select value={editUser.role} onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg" required>
                  <option value="CUSTOMER_USER">Customer User</option>
                  <option value="CUSTOMER_ADMIN">Customer Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={editUser.isActive} onChange={(e) => setEditUser({ ...editUser, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg">Cancel</button>
                <button type="submit" disabled={createLoading}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg disabled:opacity-50">
                  {createLoading ? 'Updating...' : 'Update User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 bg-gradient-to-r from-yellow-600 to-orange-600 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Reset Password</h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-white text-2xl">×</button>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-4">Resetting password for: <strong>{selectedUser.username}</strong></p>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Password * (min 8 chars)</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg" minLength={8} required />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowPasswordModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg">Cancel</button>
                <button type="submit" disabled={createLoading}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-lg disabled:opacity-50">
                  {createLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
