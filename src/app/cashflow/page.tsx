// src/app/cashflow/page.tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/auth';
import { getTransactions } from '@/app/actions/cashflow';
import { getExpenseCategories, getTeamMembers } from '@/app/actions/references';
import { AppLayout } from '@/components/layout/app-layout';
import { CashFlowList } from '@/components/features/cashflow/cashflow-list';

export default async function CashFlowPage() {
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    redirect('/login');
  }
  
  const [transactions, categories, members] = await Promise.all([
    getTransactions(),
    getExpenseCategories(),
    getTeamMembers(),
  ]);
  
  return (
    <AppLayout isAdmin={currentUser.role === 'admin'} userName={currentUser.full_name}>
      <CashFlowList
        initialTransactions={transactions}
        categories={categories}
        members={members}
        currentUser={currentUser}
      />
    </AppLayout>
  );
}