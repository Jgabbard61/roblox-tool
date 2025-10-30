
'use client';

import { useState } from 'react';
import { CreditCard, AlertTriangle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useCreditBalance } from '@/app/context/CreditContext';

export default function CreditHeader() {
  const { balance, loading, refreshBalance } = useCreditBalance();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshBalance();
    setRefreshing(false);
  };

  const showLowBalanceWarning = balance && balance.balance < 10 && balance.balance > 0;

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
        <RefreshCw className="w-4 h-4 animate-spin text-gray-600" />
        <span className="text-sm text-gray-600">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {/* Low Balance Warning */}
      {showLowBalanceWarning && (
        <div className="flex items-center gap-2 px-3 py-2 bg-orange-100 rounded-lg border border-orange-300">
          <AlertTriangle className="w-4 h-4 text-orange-600" />
          <span className="text-sm font-medium text-orange-800">Low Balance!</span>
        </div>
      )}

      {/* Credit Balance */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-lg border border-gray-200 shadow-sm">
        <CreditCard className="w-5 h-5 text-blue-600" />
        <div>
          <p className="text-xs text-gray-500">Credits</p>
          <p className="text-lg font-bold text-gray-900">{balance?.balance || 0}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="ml-2 p-1 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
          title="Refresh balance"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Buy Credits Button */}
      <Link
        href="/dashboard"
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
      >
        Buy Credits
      </Link>
    </div>
  );
}
