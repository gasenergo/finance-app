// src/app/invoices/page.tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/auth';
import { getInvoices } from '@/app/actions/invoices';
import { getClients } from '@/app/actions/references';
import { AppLayout } from '@/components/layout/app-layout';
import { InvoicesList } from '@/components/features/invoices/invoices-list';

export default async function InvoicesPage() {
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    redirect('/login');
  }
  
  const [invoices, clients] = await Promise.all([
    getInvoices(),
    getClients(),
  ]);
  
  return (
    <AppLayout isAdmin={currentUser.role === 'admin'} userName={currentUser.full_name}>
      <InvoicesList
        initialInvoices={invoices}
        clients={clients}
        currentUser={currentUser}
      />
    </AppLayout>
  );
}