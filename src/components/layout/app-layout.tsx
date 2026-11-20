// src/components/layout/app-layout.tsx
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { getAccounts } from '@/app/actions/references';
import { AccountProvider } from '@/contexts/account-context';

interface AppLayoutProps {
  children: React.ReactNode;
  isAdmin: boolean;
  userName: string;
}

export async function AppLayout({ children, isAdmin, userName }: AppLayoutProps) {
  const accounts = await getAccounts();

  return (
    <AccountProvider accounts={accounts}>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isAdmin={isAdmin} userName={userName} />
        <BottomNav isAdmin={isAdmin} />
        <main className="md:pl-64">
          <div className="p-4 md:p-8 pb-24 md:pb-8">{children}</div>
        </main>
      </div>
    </AccountProvider>
  );
}