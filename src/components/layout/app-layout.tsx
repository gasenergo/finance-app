// src/components/layout/app-layout.tsx
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';

interface AppLayoutProps {
  children: React.ReactNode;
  isAdmin: boolean;
  userName: string;
}

export function AppLayout({ children, isAdmin, userName }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isAdmin={isAdmin} userName={userName} />
      <BottomNav isAdmin={isAdmin} />
      <main className="md:pl-64">
        <div className="p-4 md:p-8 pb-24 md:pb-8">{children}</div>
      </main>
    </div>
  );
}