// src/app/actions/invoices.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { calculateDistribution } from '@/lib/engine/distribution';
import type { Participant } from '@/lib/engine/distribution';

export async function getInvoices() {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients(id, name),
      creator:profiles(id, full_name),
      jobs:invoice_jobs(
        job:jobs(id, description, amount, work_type:work_types(name), custom_work_name)
      )
    `)
    .order('created_at', { ascending: false });
  
  return data || [];
}

export async function getInvoiceById(id: string) {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients(id, name),
      creator:profiles(id, full_name),
      jobs:invoice_jobs(
        job:jobs(id, description, amount, created_by, work_type:work_types(name), custom_work_name)
      )
    `)
    .eq('id', id)
    .single();
  
  return data;
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
    throw new Error('Работы не найдены или уже в счёте');
  }
  
  const totalAmount = jobs.reduce((sum, job) => sum + Number(job.amount), 0);
  
  // Генерируем номер счёта
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true });
  
  const invoiceNumber = `INV-${String((count || 0) + 1).padStart(4, '0')}`;
  
  // Создаём счёт
  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      invoice_number: invoiceNumber,
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
  revalidatePath('/');
  
  return invoice;
}

export async function updateInvoiceStatus(invoiceId: string, status: 'draft' | 'sent' | 'cancelled') {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Не авторизован');
  
  // Проверяем права админа
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
    
  if (profile?.role !== 'admin') {
    throw new Error('Только админ может менять статус счёта');
  }
  
  const { error } = await supabase
    .from('invoices')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', invoiceId);
  
  if (error) throw error;
  
  // Если отменён — возвращаем работы в статус available
  if (status === 'cancelled') {
    const { data: invoiceJobs } = await supabase
      .from('invoice_jobs')
      .select('job_id')
      .eq('invoice_id', invoiceId);
    
    if (invoiceJobs && invoiceJobs.length > 0) {
      await supabase
        .from('jobs')
        .update({ status: 'available' })
        .in('id', invoiceJobs.map(ij => ij.job_id));
    }
  }
  
  revalidatePath('/invoices');
  revalidatePath('/jobs');
  revalidatePath('/');
  
  return { success: true };
}

export async function markInvoiceAsPaid(invoiceId: string, participantIds: string[]) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Не авторизован');
  
  // Проверяем права админа
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
    
  if (profile?.role !== 'admin') {
    throw new Error('Только админ может отмечать оплату');
  }

  if (participantIds.length === 0) {
    throw new Error('Выберите хотя бы одного участника');
  }

  // Получаем счёт с клиентом
  const { data: invoice } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients(id, name, tax_rate),
      jobs:invoice_jobs(
        job:jobs(id, created_by, amount)
      )
    `)
    .eq('id', invoiceId)
    .single();
    
  if (!invoice) throw new Error('Счёт не найден');
  if (invoice.status === 'paid') throw new Error('Счёт уже оплачен');
  if (invoice.status === 'cancelled') throw new Error('Счёт отменён');

  // Получаем настройки и фонд
  const [{ data: settings }, { data: fund }, { data: participants }] = await Promise.all([
    supabase.from('settings').select('*').single(),
    supabase.from('fund').select('*').single(),
    supabase
      .from('profiles')
      .select('id, full_name, participant_type, percentage_rate')
      .eq('is_active', true)
      .not('participant_type', 'is', null)
  ]);

  if (!settings) throw new Error('Настройки не найдены');
  if (!fund) throw new Error('Фонд не найден');

  // Преобразуем участников
  const mappedParticipants: Participant[] = (participants || []).map(p => ({
    id: p.id,
    full_name: p.full_name,
    type: p.participant_type as 'partner' | 'percentage',
    rate: p.percentage_rate
  }));

  // Определяем ставку налога
  const taxRate = invoice.client?.tax_rate ?? settings.tax_rate;

  // Рассчитываем распределение только для выбранных участников
  const distribution = calculateDistribution(
    invoice.total_amount,
    { ...settings, tax_rate: taxRate },
    fund.current_balance,
    mappedParticipants,
    participantIds  // ← передаём список участников
  );

  // Получаем ID категорий
  const { data: categories } = await supabase
    .from('expense_categories')
    .select('id, slug')
    .in('slug', ['tax', 'fund_contribution']);
    
  const categoryMap = new Map(categories?.map(c => [c.slug, c.id]) || []);

  // === СОЗДАЁМ ТРАНЗАКЦИИ ===
  
  // 1. Доход
  await supabase.from('transactions').insert({
    date: new Date().toISOString().split('T')[0],
    type: 'income',
    description: `Оплата счёта ${invoice.invoice_number}`,
    amount: invoice.total_amount,
    related_invoice_id: invoiceId,
    created_by: user.id
  });

  // 2. Налоги
  if (distribution.breakdown.taxAmount > 0) {
    await supabase.from('transactions').insert({
      date: new Date().toISOString().split('T')[0],
      type: 'expense',
      category_id: categoryMap.get('tax'),
      description: `Налог по счёту ${invoice.invoice_number}`,
      amount: distribution.breakdown.taxAmount,
      related_invoice_id: invoiceId,
      created_by: user.id
    });
  }

  // 3. Отчисление в фонд
  if (distribution.breakdown.fundContribution > 0) {
    await supabase.from('transactions').insert({
      date: new Date().toISOString().split('T')[0],
      type: 'expense',
      category_id: categoryMap.get('fund_contribution'),
      description: `Отчисление в фонд по счёту ${invoice.invoice_number}`,
      amount: distribution.breakdown.fundContribution,
      related_invoice_id: invoiceId,
      created_by: user.id
    });
  }

  // 4. Обновляем фонд
  await supabase
    .from('fund')
    .update({ 
      current_balance: distribution.breakdown.newFundBalance,
      updated_at: new Date().toISOString()
    })
    .eq('id', 1);

  // 5. Обновляем балансы участников
  for (const update of distribution.balanceUpdates) {
    await supabase.rpc('increment_balance', {
      p_user_id: update.userId,
      p_amount: update.amount
    });
  }

  // 6. Сохраняем участников счёта (для истории)
  await supabase.from('invoice_participants').insert(
    participantIds.map(id => ({
      invoice_id: invoiceId,
      user_id: id
    }))
  );

  // 7. Обновляем статус счёта
  await supabase
    .from('invoices')
    .update({ 
      status: 'paid', 
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', invoiceId);

  // 8. Обновляем статус работ
  const jobIds = invoice.jobs?.map((j: { job: { id: string } }) => j.job.id) || [];
  if (jobIds.length > 0) {
    await supabase
      .from('jobs')
      .update({ status: 'paid' })
      .in('id', jobIds);
  }

  revalidatePath('/');
  revalidatePath('/invoices');
  revalidatePath('/cashflow');
  revalidatePath('/jobs');
  
  return { 
    success: true, 
    breakdown: distribution.breakdown 
  };
}

export async function deleteInvoice(invoiceId: string) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Не авторизован');
  
  // Проверяем права админа
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
    
  if (profile?.role !== 'admin') {
    throw new Error('Только админ может удалять счета');
  }

  // Получаем счёт
  const { data: invoice } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', invoiceId)
    .single();
  
  if (!invoice) throw new Error('Счёт не найден');
  if (invoice.status === 'paid') throw new Error('Нельзя удалить оплаченный счёт');

  // Получаем связанные работы
  const { data: invoiceJobs } = await supabase
    .from('invoice_jobs')
    .select('job_id')
    .eq('invoice_id', invoiceId);

  // Возвращаем работы в статус available
  if (invoiceJobs && invoiceJobs.length > 0) {
    await supabase
      .from('jobs')
      .update({ status: 'available' })
      .in('id', invoiceJobs.map(ij => ij.job_id));
  }

  // Удаляем связи
  await supabase
    .from('invoice_jobs')
    .delete()
    .eq('invoice_id', invoiceId);

  // Удаляем счёт
  await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId);

  revalidatePath('/invoices');
  revalidatePath('/jobs');
  revalidatePath('/');
  
  return { success: true };
}

export async function getParticipantsForPayment() {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, participant_type, percentage_rate')
    .eq('is_active', true)
    .not('participant_type', 'is', null)
    .order('full_name');
  
  return data || [];
}
