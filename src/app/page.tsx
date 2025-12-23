import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/auth';
import { getDashboardData } from '@/app/actions/dashboard';
import { AppLayout } from '@/components/layout/app-layout';
import { DashboardContent } from '@/components/features/dashboard/dashboard-content';

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    redirect('/login');
  }
  
  const dashboardData = await getDashboardData();
  
  return (
    <AppLayout isAdmin={currentUser.role === 'admin'} userName={currentUser.full_name}>
      <DashboardContent data={dashboardData} />
    </AppLayout>
  );
}