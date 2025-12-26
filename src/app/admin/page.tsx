// src/app/admin/page.tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/auth';
import { getSettings, getTeamWithBalances, getClients, getWorkTypes, getExpenseCategories } from '@/app/actions/admin';
import { AppLayout } from '@/components/layout/app-layout';
import { AdminPanel } from '@/components/features/admin/admin-panel';

export default async function AdminPage() {
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    redirect('/login');
  }
  
  if (currentUser.role !== 'admin') {
    redirect('/');
  }
  
  const [settings, team, clients, workTypes, categories] = await Promise.all([
    getSettings(),
    getTeamWithBalances(),
    getClients(),
    getWorkTypes(),
    getExpenseCategories(),
  ]);
  
  return (
    <AppLayout isAdmin={true} userName={currentUser.full_name}>
      <AdminPanel
        settings={settings}
        team={team}
        clients={clients}
        workTypes={workTypes}
        categories={categories}
      />
    </AppLayout>
  );
}