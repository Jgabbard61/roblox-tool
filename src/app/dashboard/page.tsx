
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CreditCard, TrendingUp, TrendingDown, Calendar, DollarSign, AlertTriangle, RefreshCw, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';

interface CreditBalance {
  balance: number;
  total_purchased: number;
  total_used: number;
  last_purchase_at: string | null;
}

interface CreditTransaction {
  id: number;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
}

interface CreditPackage {
  id: number;
  name: string;
  credits: number;
  price_cents: number;
  is_active: boolean;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasingPackageId, setPurchasingPackageId] = useState<number | null>(null);

  // Handle payment status from query params
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      toast.success('Payment successful! Your credits have been added to your account.');
      // Remove query param
      router.replace('/dashboard');
      // Refresh data
      fetchData();
    } else if (paymentStatus === 'cancelled') {
      toast.error('Payment was cancelled. You can try again anytime.');
      // Remove query param
      router.replace('/dashboard');
    }
  }, [searchParams, router]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Fetch data on mount
  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
    }
  }, [status]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch credit balance
      const balanceRes = await fetch('/api/credits/balance');
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        setBalance(balanceData);
      }

      // Fetch transaction history
      const transactionsRes = await fetch('/api/credits/transactions?limit=20');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData.transactions);
      }

      // Fetch credit packages
      const packagesRes = await fetch('/api/credits/packages');
      if (packagesRes.ok) {
        const packagesData = await packagesRes.json();
        setPackages(packagesData.packages);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast.success('Dashboard refreshed');
  };

  const handlePurchase = async (packageId: number) => {
    try {
      setPurchasingPackageId(packageId);

      // Create checkout session
      const res = await fetch('/api/credits/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const { checkoutUrl } = await res.json();

      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Error creating checkout:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to initiate checkout';
      toast.error(errorMessage);
      setPurchasingPackageId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'purchase':
        return <ShoppingCart className="w-4 h-4 text-green-600" />;
      case 'usage':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'refund':
        return <TrendingUp className="w-4 h-4 text-blue-600" />;
      default:
        return <CreditCard className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'purchase':
        return 'text-green-600';
      case 'usage':
        return 'text-red-600';
      case 'refund':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const showLowBalanceAlert = balance && balance.balance < 10 && balance.balance > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">
                Welcome back, {session?.user?.name || session?.user?.username}!
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Low Balance Alert */}
        {showLowBalanceAlert && (
          <div className="mb-6 bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-orange-800">Low Credit Balance</h3>
                <p className="mt-1 text-sm text-orange-700">
                  You have {balance?.balance} credits remaining. Purchase more credits to continue using VerifyLens.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Credit Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Current Balance */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Current Balance</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{balance?.balance || 0}</p>
                <p className="text-xs text-gray-500 mt-1">credits</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Total Purchased */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Purchased</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{balance?.total_purchased || 0}</p>
                <p className="text-xs text-gray-500 mt-1">credits</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Total Used */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Used</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{balance?.total_used || 0}</p>
                <p className="text-xs text-gray-500 mt-1">searches</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          {/* Last Purchase */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Last Purchase</p>
                <p className="text-sm font-bold text-gray-900 mt-2">
                  {balance?.last_purchase_at 
                    ? formatDate(balance.last_purchase_at) 
                    : 'No purchases yet'}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Credit Packages */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Buy More Credits</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="text-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{pkg.name}</h3>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-900">{pkg.credits}</span>
                    <span className="text-sm text-gray-600 ml-1">credits</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-blue-600">
                      ${(pkg.price_cents / 100).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    ${(pkg.price_cents / pkg.credits / 100).toFixed(0)} per credit
                  </p>
                </div>
                <button
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={purchasingPackageId !== null}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {purchasingPackageId === pkg.id ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-4 h-4" />
                      Purchase
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Transaction History */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Transaction History</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>No transactions yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Balance After
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {getTransactionIcon(transaction.transaction_type)}
                            <span className="text-sm font-medium text-gray-900 capitalize">
                              {transaction.transaction_type}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">{transaction.description}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${getTransactionColor(transaction.transaction_type)}`}>
                            {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">{transaction.balance_after}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{formatDate(transaction.created_at)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
