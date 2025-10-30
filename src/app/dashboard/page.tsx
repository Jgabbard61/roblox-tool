
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

interface CreditPackage {
  id: number;
  name: string;
  credits: number;
  price_cents: number;
  description: string;
}

interface Transaction {
  id: number;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  created_at: string;
  package_name: string | null;
  payment_amount_cents: number | null;
  user_username: string | null;
}

interface CreditBalance {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
}

function DashboardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [balance, setBalance] = useState<CreditBalance>({ balance: 0, totalPurchased: 0, totalUsed: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [customerLogo, setCustomerLogo] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Check for purchase success and verify payment
  useEffect(() => {
    const verifyPayment = async () => {
      const purchaseStatus = searchParams.get('purchase');
      const sessionId = searchParams.get('session_id');
      
      if (purchaseStatus === 'success' && sessionId) {
        try {
          // Verify and process the payment
          const verifyRes = await fetch(`/api/credits/verify-payment?session_id=${sessionId}`);
          
          if (verifyRes.ok) {
            const verifyData = await verifyRes.json();
            console.log('Payment verification:', verifyData);
            
            setPurchaseSuccess(true);
            setTimeout(() => setPurchaseSuccess(false), 5000);
            
            // Trigger a refresh of the data after a short delay
            setTimeout(() => {
              window.location.href = '/dashboard';
            }, 2000);
          } else {
            console.error('Payment verification failed');
            alert('Payment verification failed. Please refresh the page or contact support if credits are not showing.');
          }
        } catch (error) {
          console.error('Error verifying payment:', error);
          alert('Error verifying payment. Please refresh the page.');
        }
      }
    };
    
    verifyPayment();
  }, [searchParams]);

  // Fetch customer logo
  useEffect(() => {
    const fetchCustomerLogo = async () => {
      if (session?.user?.customerId) {
        try {
          const res = await fetch(`/api/customer-logo/${session.user.customerId}`);
          if (res.ok) {
            const data = await res.json();
            setCustomerLogo(data.logoUrl);
          }
        } catch (error) {
          console.error('Failed to fetch customer logo:', error);
        }
      }
    };

    if (session) {
      fetchCustomerLogo();
    }
  }, [session]);

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.user) return;

      try {
        setLoading(true);

        // Fetch credit packages
        const packagesRes = await fetch('/api/credit-packages');
        if (packagesRes.ok) {
          const packagesData = await packagesRes.json();
          setPackages(packagesData.packages || []);
        }

        // Fetch balance
        const balanceRes = await fetch('/api/credits/balance');
        if (balanceRes.ok) {
          const balanceData = await balanceRes.json();
          setBalance({
            balance: balanceData.balance,
            totalPurchased: balanceData.totalPurchased,
            totalUsed: balanceData.totalUsed,
          });
        }

        // Fetch transactions
        const transactionsRes = await fetch('/api/credits/transactions?limit=10');
        if (transactionsRes.ok) {
          const transactionsData = await transactionsRes.json();
          setTransactions(transactionsData.transactions || []);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session, purchaseSuccess]);

  const handlePurchase = async (packageId: number) => {
    try {
      const res = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ packageId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } else {
        alert('Failed to initiate purchase. Please try again.');
      }
    } catch (error) {
      console.error('Error initiating purchase:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (priceCents: number) => {
    return (priceCents / 100).toFixed(2);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              {customerLogo && (
                <div className="mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={customerLogo}
                    alt="Customer Logo"
                    className="max-h-12 object-contain"
                  />
                </div>
              )}
              <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
              <p className="text-gray-600">Welcome back, {session.user.name || session.user.username}!</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium shadow-md flex items-center gap-2"
              >
                <span>←</span>
                <span>Return to Verifier</span>
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition font-medium shadow-md flex items-center gap-2"
              >
                <span>🔄</span>
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {/* Purchase Success Alert */}
        {purchaseSuccess && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-6 shadow-md">
            <p className="font-bold">✓ Purchase Successful!</p>
            <p>Your credits have been added to your account.</p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-gray-500 text-sm font-medium mb-2">Current Balance</h3>
            <p className="text-4xl font-bold text-blue-600">{balance.balance}</p>
            <p className="text-gray-500 text-xs mt-1">credits</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-gray-500 text-sm font-medium mb-2">Total Purchased</h3>
            <p className="text-4xl font-bold text-green-600">{balance.totalPurchased}</p>
            <p className="text-gray-500 text-xs mt-1">credits</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-gray-500 text-sm font-medium mb-2">Total Used</h3>
            <p className="text-4xl font-bold text-red-600">{balance.totalUsed}</p>
            <p className="text-gray-500 text-xs mt-1">searches</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-gray-500 text-sm font-medium mb-2">Last Purchase</h3>
            {(() => {
              const lastPurchase = transactions.find(t => t.transaction_type === 'PURCHASE');
              if (lastPurchase) {
                const date = new Date(lastPurchase.created_at);
                const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const formattedTime = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                return (
                  <>
                    <p className="text-lg font-bold text-purple-600">{formattedDate}</p>
                    <p className="text-gray-500 text-xs mt-1">{formattedTime}</p>
                  </>
                );
              }
              return (
                <>
                  <p className="text-2xl font-bold text-purple-600">No purchases yet</p>
                  <p className="text-gray-500 text-xs mt-1"></p>
                </>
              );
            })()}
          </div>
        </div>

        {/* Credit Packages */}
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Buy More Credits</h2>
          
          {packages.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Credit Packages Available</h3>
              <p className="text-gray-500 mb-4">Credit packages haven&apos;t been configured yet. Please contact your administrator.</p>
              <div className="text-sm text-gray-400">
                <p className="mb-2">If you&apos;re the administrator, you need to:</p>
                <ol className="text-left inline-block">
                  <li>1. Run the credit packages seed migration on your database</li>
                  <li>2. Ensure your DATABASE_URL is correctly configured</li>
                  <li>3. Refresh this page after seeding</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {packages.map((pkg) => (
                <div key={pkg.id} className="border-2 border-gray-200 rounded-lg p-6 hover:border-blue-500 transition">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{pkg.name}</h3>
                  <p className="text-3xl font-bold text-blue-600 mb-1">{pkg.credits}</p>
                  <p className="text-gray-500 text-sm mb-4">credits</p>
                  <p className="text-2xl font-semibold text-gray-700 mb-4">${formatPrice(pkg.price_cents)}</p>
                  {pkg.description && <p className="text-gray-600 text-sm mb-4">{pkg.description}</p>}
                  <button
                    onClick={() => handlePurchase(pkg.id)}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2 px-4 rounded-lg hover:from-blue-600 hover:to-purple-700 transition font-medium shadow-md"
                  >
                    Purchase
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-lg shadow-xl p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Transaction History</h2>
          
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-600">No transactions yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left p-3 text-gray-600 font-semibold">Date</th>
                    <th className="text-left p-3 text-gray-600 font-semibold">Type</th>
                    <th className="text-left p-3 text-gray-600 font-semibold">Description</th>
                    <th className="text-right p-3 text-gray-600 font-semibold">Amount</th>
                    <th className="text-right p-3 text-gray-600 font-semibold">Balance After</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3 text-gray-700">{formatDate(transaction.created_at)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          transaction.transaction_type === 'purchase' 
                            ? 'bg-green-100 text-green-800' 
                            : transaction.transaction_type === 'usage'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {transaction.transaction_type}
                        </span>
                      </td>
                      <td className="p-3 text-gray-700">
                        {transaction.package_name || transaction.description || 'N/A'}
                      </td>
                      <td className={`p-3 text-right font-semibold ${
                        transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.amount >= 0 ? '+' : ''}{transaction.amount}
                      </td>
                      <td className="p-3 text-right text-gray-700">{transaction.balance_after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-xl text-gray-600">Loading dashboard...</div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
