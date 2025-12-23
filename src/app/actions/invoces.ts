'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getInvoices() {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients(id, name),
      creator:profiles(id, full_name)
    `)
    .order('created_at', { ascending: false });
  
  return data || [];
}

export async function createInvoice(clientId: string, jobIds: string[]) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Не авторизован');
  
  // Получаем работы и считаем сумму
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, amount')
    .in('id', jobIds)
    .eq('status', 'available');
  
  if (!jobs || jobs.length === 0) {
    throw new Error('Работы не найдены');
  }
  
  const totalAmount = jobs.reduce((sum, job) => sum + Number(job.amount), 0);
  
  // Создаём счёт
  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      client_id: clientId,
      total_amount: totalAmount,
      status: 'draft',
      created_by: user.id
    })
    .select()
    .single();
  
  if (error) throw error;
  
  // Связываем работы со счётом
  await supabase.from('invoice_jobs').insert(
    jobIds.map(jobId => ({ invoice_id: invoice.id, job_id: jobId }))
  );
  
  // Обновляем статус работ
  await supabase
    .from('jobs')
    .update({ status: 'invoiced' })
    .in('id', jobIds);
  
  revalidatePath('/jobs');
  revalidatePath('/invoices');
  
  return invoice;
}