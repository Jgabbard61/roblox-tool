
'use client';

import { useRouter } from 'next/navigation';
import { CreditCard, AlertTriangle, X } from 'lucide-react';

interface InsufficientCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredCredits: number;
  currentBalance: number;
  searchMode: string;
}

export default function InsufficientCreditsModal({
  isOpen,
  onClose,
  requiredCredits,
  currentBalance,
  searchMode
}: InsufficientCreditsModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleBuyCredits = () => {
    router.push('/dashboard');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Insufficient Credits</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                You don&apos;t have enough credits to perform a <strong>{searchMode}</strong> search.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-1">Required Credits</p>
                <p className="text-2xl font-bold text-gray-900">{requiredCredits}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-1">Current Balance</p>
                <p className="text-2xl font-bold text-gray-900">{currentBalance}</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Need more credits?</strong> Purchase a credit package to continue using VerifyLens.
              </p>
            </div>

            <div className="pt-2">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Credit Costs:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• <strong>Exact Search:</strong> 1 credit (FREE if no results found)</li>
                <li>• <strong>Smart Search:</strong> 1 credit</li>
                <li>• <strong>Display Name Search:</strong> 1 credit</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleBuyCredits}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            Buy Credits
          </button>
        </div>
      </div>
    </div>
  );
}
