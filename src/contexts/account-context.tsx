// src/contexts/account-context.tsx
'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import type { Account } from '@/types/database';

interface AccountContextValue {
  accounts: Account[];
  selectedAccountId: string; // 'all' или UUID конкретного счёта
  setSelectedAccountId: (id: string) => void;
  activeAccount: Account | null; // Конкретный выбранный счёт (или null, если выбран режим 'all')
  defaultOperationAccountId: string; // ID счёта для создания новых записей (выбранный или первый активный)
}

const AccountContext = createContext<AccountContextValue | null>(null);

const STORAGE_KEY = 'finance_selected_account_id';

export function AccountProvider({
  accounts,
  children,
}: {
  accounts: Account[];
  children: React.ReactNode;
}) {
  const [selectedAccountId, setSelectedAccountIdState] = useState<string>('all');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && (saved === 'all' || accounts.some(a => a.id === saved))) {
        setSelectedAccountIdState(saved);
      }
    } catch {
      // ignore storage errors
    }
  }, [accounts]);

  const setSelectedAccountId = (id: string) => {
    setSelectedAccountIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore storage errors
    }
  };

  const activeAccount =
    selectedAccountId === 'all'
      ? null
      : accounts.find(a => a.id === selectedAccountId) || null;

  const defaultOperationAccountId =
    activeAccount?.id || accounts[0]?.id || '';

  return (
    <AccountContext.Provider
      value={{
        accounts,
        selectedAccountId,
        setSelectedAccountId,
        activeAccount,
        defaultOperationAccountId,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccountContext() {
  const ctx = useContext(AccountContext);
  if (!ctx) {
    throw new Error('useAccountContext must be used within AccountProvider');
  }
  return ctx;
}