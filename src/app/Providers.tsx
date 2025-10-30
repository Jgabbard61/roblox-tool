'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';
import type { ReactNode } from 'react';
import { CreditProvider } from './context/CreditContext';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <CreditProvider>
        {children}
        <Toaster position="top-right" />
      </CreditProvider>
    </SessionProvider>
  );
}
