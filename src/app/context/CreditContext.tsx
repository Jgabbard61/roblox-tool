
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface CreditBalance {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  lastPurchaseAt: string | null;
}

interface CreditContextType {
  balance: CreditBalance | null;
  loading: boolean;
  refreshBalance: () => Promise<void>;
  setBalance: (balance: CreditBalance) => void;
}

const CreditContext = createContext<CreditContextType | undefined>(undefined);

export function CreditProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    // Only fetch if user is authenticated
    if (status !== 'authenticated' || !session?.user) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/credits/balance');
      if (res.ok) {
        const data = await res.json();
        setBalance({
          balance: data.balance || 0,
          totalPurchased: data.totalPurchased || 0,
          totalUsed: data.totalUsed || 0,
          lastPurchaseAt: data.lastPurchaseAt || null,
        });
      }
    } catch (error) {
      console.error('Error fetching credit balance:', error);
    } finally {
      setLoading(false);
    }
  }, [session, status]);

  // Initial fetch on mount and when session changes
  useEffect(() => {
    if (status === 'authenticated') {
      fetchBalance();
    } else if (status === 'unauthenticated') {
      setLoading(false);
      setBalance(null);
    }
  }, [status, fetchBalance]);

  // Optional: Poll for balance updates every 30 seconds
  // This ensures balance stays fresh even if multiple tabs are open
  useEffect(() => {
    if (status !== 'authenticated') return;

    const intervalId = setInterval(() => {
      fetchBalance();
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(intervalId);
  }, [status, fetchBalance]);

  const refreshBalance = useCallback(async () => {
    await fetchBalance();
  }, [fetchBalance]);

  return (
    <CreditContext.Provider value={{ balance, loading, refreshBalance, setBalance }}>
      {children}
    </CreditContext.Provider>
  );
}

export function useCreditBalance() {
  const context = useContext(CreditContext);
  if (context === undefined) {
    throw new Error('useCreditBalance must be used within a CreditProvider');
  }
  return context;
}
