// src/app/page.tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/auth';
import { getDashboardData } from '@/app/actions/dashboard';
import { getAccounts } from '@/app/actions/references';
import { AppLayout } from '@/components/layout/app-layout';
import { DashboardContent } from '@/components/features/dashboard/dashboard-content';

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect('/login');
  }

  const [dashboardData, accounts] = await Promise.all([
    getDashboardData(),
    getAccounts(),
  ]);

  return (
    <AppLayout isAdmin={currentUser.role === 'admin'} userName={currentUser.full_name}>
      <DashboardContent
        initialData={dashboardData}
        accounts={accounts}
        currentUser={currentUser}
      />
    </AppLayout>
  );
}