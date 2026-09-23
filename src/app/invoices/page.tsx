// src/app/invoices/page.tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/auth';
import { getInvoices, getParticipantsForPayment } from '@/app/actions/invoices';
import { AppLayout } from '@/components/layout/app-layout';
import { InvoicesList } from '@/components/features/invoices/invoices-list';

export default async function InvoicesPage() {
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    redirect('/login');
  }
  
  const [invoices, participants] = await Promise.all([
    getInvoices(),
    getParticipantsForPayment(),
  ]);
  
  return (
    <AppLayout isAdmin={currentUser.role === 'admin'} userName={currentUser.full_name}>
      <InvoicesList
        initialInvoices={invoices}
        currentUser={currentUser}
        participants={participants}
      />
    </AppLayout>
  );
}