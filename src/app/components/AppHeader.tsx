'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import CreditHeader from './CreditHeader';

export default function AppHeader() {
  const { data: session } = useSession();
  const router = useRouter();

  return (
    <header className="w-full bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Company Branding */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center">
              <svg
                className="w-8 h-8 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Verify<span className="text-purple-600">Lens</span>
              </h1>
              <p className="text-xs text-gray-500">Roblox Verifier</p>
            </div>
          </div>

          {/* Right Side: Credits/Rate Limit and Admin Button */}
          <div className="flex items-center gap-4">
            {/* Credit Balance or Rate Limit Info */}
            {session ? (
              <CreditHeader />
            ) : (
              <div className="text-sm text-gray-600 font-medium">
                Free Public Tool - 25 Searches/Hour
              </div>
            )}
            
            {/* Admin Dashboard Button (for Super Admin only) */}
            {session?.user?.role === 'SUPER_ADMIN' && (
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-medium shadow-sm hover:shadow-md flex items-center gap-2"
                aria-label="Go to Admin Dashboard"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <span className="hidden sm:inline">Admin Dashboard</span>
                <span className="sm:hidden">Admin</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
