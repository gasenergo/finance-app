// src/app/invoices/page.tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/auth';
import { getInvoices, getParticipantsForPayment } from '@/app/actions/invoices';
import { getClients } from '@/app/actions/references';
import { AppLayout } from '@/components/layout/app-layout';
import { InvoicesList } from '@/components/features/invoices/invoices-list';

export default async function InvoicesPage() {
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    redirect('/login');
  }
  
  const [invoices, clients, participants] = await Promise.all([
    getInvoices(),
    getClients(),
    getParticipantsForPayment(),
  ]);
  
  return (
    <AppLayout isAdmin={currentUser.role === 'admin'} userName={currentUser.full_name}>
      <InvoicesList
        initialInvoices={invoices}
        clients={clients}
        currentUser={currentUser}
        participants={participants}
      />
    </AppLayout>
  );
}