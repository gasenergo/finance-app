// src/app/actions/invoices.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { calculateDistribution } from '@/lib/engine/distribution';
import type { Participant } from '@/lib/engine/distribution';
import { getCurrentUserId, requireAdmin } from '@/lib/auth';

export async function getInvoices(accountId?: string) {
  const supabase = await createClient();

  let query = supabase
    .from('invoices')
    .select(`
      *,
      account:accounts(id, name, bank_name, account_number),
      client:clients(id, name, inn, director_name),
      creator:profiles(id, full_name),
      jobs:invoice_jobs(
        job:jobs(id, description, amount, quantity, unit, work_type:work_types(name, default_price), custom_work_name)
      )
    `)
    .order('created_at', { ascending: false });

  if (accountId) {
    query = query.eq('account_id', accountId);
  }

  const { data } = await query;

  return data || [];
}

async function getNextInvoiceNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('account_id', accountId);

  // Новые акты нумеруются простыми числами: 10, 11, 12… внутри каждого счёта.
  const plainNumbers = (existing ?? [])
    .map(row => String(row.invoice_number).trim())
    .filter(s => /^\d+$/.test(s))
    .map(Number);

  const next = plainNumbers.length > 0 ? Math.max(...plainNumbers) + 1 : 10;
  return String(next);
}

export async function createInvoice(clientId: string, jobIds: string[], accountId?: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!clientId || jobIds.length === 0) {
    throw new Error('Укажите клиента и хотя бы одну работу');
  }

  // Получаем работы, их суммы и привязку к счёту
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, amount, account_id')
    .in('id', jobIds)
    .eq('status', 'available');

  if (jobsError) throw jobsError;

  if (!jobs || jobs.length === 0) {
    throw new Error('Работы не найдены или уже в акте');
  }

  // Проверяем, что все выбранные работы относятся к одному счёту
  const uniqueAccountIds = Array.from(new Set(jobs.map(j => j.account_id)));
  if (uniqueAccountIds.length > 1) {
    throw new Error('Нельзя объединить в один акт работы из разных филиалов (счетов)');
  }

  const resolvedAccountId = accountId || uniqueAccountIds[0];
  if (accountId && uniqueAccountIds[0] !== accountId) {
    throw new Error('Выбранные работы принадлежат другому счёту');
  }

  const totalAmount = jobs.reduce((sum, job) => sum + Number(job.amount), 0);

  // Генерируем номер счёта внутри выбранного филиала
  const invoiceNumber = await getNextInvoiceNumber(supabase, resolvedAccountId);

  // Создаём счёт
  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      account_id: resolvedAccountId,
      invoice_number: invoiceNumber,
      client_id: clientId,
      total_amount: totalAmount,
      status: 'draft',
      created_by: userId
    })
    .select()
    .single();

  if (error) throw error;

  // Связываем работы со счётом
  const { error: linkError } = await supabase.from('invoice_jobs').insert(
    jobIds.map(jobId => ({ invoice_id: invoice.id, job_id: jobId }))
  );

  if (linkError) throw linkError;

  // Обновляем статус работ
  const { error: jobStatusError } = await supabase
    .from('jobs')
    .update({ status: 'invoiced' })
    .in('id', jobIds);

  if (jobStatusError) throw jobStatusError;

  revalidatePath('/jobs');
  revalidatePath('/invoices');
  revalidatePath('/');

  return invoice;
}

export async function updateInvoiceStatus(invoiceId: string, status: 'draft' | 'sent' | 'cancelled') {
  await requireAdmin();
  const supabase = await createClient();

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
      const { error: jobError } = await supabase
        .from('jobs')
        .update({ status: 'available' })
        .in('id', invoiceJobs.map(ij => ij.job_id));

      if (jobError) throw jobError;
    }
  }

  revalidatePath('/invoices');
  revalidatePath('/jobs');
  revalidatePath('/');

  return { success: true };
}

export async function markInvoiceAsPaid(invoiceId: string, participantIds: string[]) {
  const supabase = await createClient();
  const userId = await requireAdmin();

  if (participantIds.length === 0) {
    throw new Error('Выберите хотя бы одного участника');
  }

  // Получаем счёт с клиентом и работами
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

  const accountId: string = invoice.account_id;


  // Проверяем наличие существующих транзакций дохода по этому акту
  const { data: existingIncomeTxs, error: txError } = await supabase
    .from('transactions')
    .select('id')
    .eq('related_invoice_id', invoiceId)
    .eq('type', 'income')
    .limit(1);

  if (txError) {
    throw new Error(`Ошибка при проверке транзакций: ${txError.message}`);
  }

  if (existingIncomeTxs && existingIncomeTxs.length > 0) {
    throw new Error('Для этого акта уже существует транзакция дохода');
  }

  // Получаем настройки, фонд конкретного счёта и активных участников
  const [{ data: account }, { data: participants }] = await Promise.all([
    supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .single(),
  
    supabase
      .from('profiles')
      .select('id, full_name, participant_type, percentage_rate')
      .eq('is_active', true)
      .not('participant_type', 'is', null)
  ]);

  if (!account) throw new Error('Расчётный счёт не найден');

  // Преобразуем участников
  const mappedParticipants: Participant[] = (participants || []).map(p => ({
    id: p.id,
    full_name: p.full_name,
    type: p.participant_type as 'partner' | 'percentage',
    rate: p.percentage_rate
  }));

  // Определяем ставку налога (индивидуальная клиента или базовая ставка счёта)
  const taxRate = invoice.client?.tax_rate ?? Number(account.tax_rate);

 // Рассчитываем распределение только для выбранных участников
  const distribution = calculateDistribution(
    Number(invoice.total_amount),
    {
      tax_rate: taxRate,
      fund_contribution_rate: Number(account.fund_contribution_rate),
      fund_limit: Number(account.fund_limit),
    },
    Number(account.current_fund_balance),
    mappedParticipants,
    participantIds
  );

  // Получаем ID системных категорий
  const { data: categories } = await supabase
    .from('expense_categories')
    .select('id, slug')
    .in('slug', ['tax', 'fund_contribution']);

  const categoryMap = new Map(categories?.map(c => [c.slug, c.id]) || []);

  // === СОЗДАЁМ ТРАНЗАКЦИИ ===
  const date = new Date().toISOString().split('T')[0];
  const timestamp = new Date().toISOString();

  const rollbacks: Array<() => Promise<void>> = [];

  try {
    // 1. Доход на счёт акта
    const incomeResult = await supabase.from('transactions').insert({
      date,
      type: 'income',
      account_id: accountId,
      description: `Оплата акта ${invoice.invoice_number}`,
      amount: invoice.total_amount,
      related_invoice_id: invoiceId,
      created_by: userId
    });
    if (incomeResult.error) throw new Error(`Не удалось записать доход: ${incomeResult.error.message}`);

    // 2. Налоги
    if (distribution.breakdown.taxAmount > 0) {
      const taxResult = await supabase.from('transactions').insert({
        date,
        type: 'expense',
        account_id: accountId,
        category_id: categoryMap.get('tax'),
        description: `Налог по акту ${invoice.invoice_number}`,
        amount: distribution.breakdown.taxAmount,
        related_invoice_id: invoiceId,
        created_by: userId
      });
      if (taxResult.error) throw new Error(`Не удалось записать налог: ${taxResult.error.message}`);
    }

    // 3. Отчисление в фонд
    if (distribution.breakdown.fundContribution > 0) {
      const fundTxResult = await supabase.from('transactions').insert({
        date,
        type: 'expense',
        account_id: accountId,
        category_id: categoryMap.get('fund_contribution'),
        description: `Отчисление в фонд по акту ${invoice.invoice_number}`,
        amount: distribution.breakdown.fundContribution,
        related_invoice_id: invoiceId,
        created_by: userId
      });
      if (fundTxResult.error) throw new Error(`Не удалось записать отчисление в фонд: ${fundTxResult.error.message}`);
    }

    // 4. Обновляем баланс резервного фонда конкретного счёта
    const fundResult = await supabase
      .from('accounts')
      .update({
        current_fund_balance: distribution.breakdown.newFundBalance,
        updated_at: timestamp
      })
      .eq('id', accountId);
    if (fundResult.error) throw new Error(`Не удалось обновить фонд: ${fundResult.error.message}`);

    rollbacks.push(async () => {
      await supabase
        .from('accounts')
        .update({
          current_fund_balance: account.current_fund_balance,
          updated_at: timestamp
        })
        .eq('id', accountId);
    });

    // 5. Обновляем балансы участников в разрезе этого счёта
    for (const update of distribution.balanceUpdates) {
      const balanceResult = await supabase.rpc('increment_balance', {
        p_user_id: update.userId,
        p_amount: update.amount,
        p_account_id: accountId
      });
      if (balanceResult.error) throw new Error(`Не удалось начислить баланс: ${balanceResult.error.message}`);

      rollbacks.push(async () => {
        await supabase.rpc('decrement_balance', {
          p_user_id: update.userId,
          p_amount: update.amount,
          p_account_id: accountId
        });
      });
    }

    // 6. Сохраняем участников счёта (для истории)
    const participantsResult = await supabase.from('invoice_participants').insert(
      participantIds.map(id => ({
        invoice_id: invoiceId,
        user_id: id
      }))
    );
    if (participantsResult.error) throw new Error(`Не удалось сохранить участников: ${participantsResult.error.message}`);

    // 7. Обновляем статус счёта
    const invoiceResult = await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: timestamp,
        updated_at: timestamp
      })
      .eq('id', invoiceId);
    if (invoiceResult.error) throw new Error(`Не удалось обновить счёт: ${invoiceResult.error.message}`);

    // 8. Обновляем статус работ
    const jobIds = invoice.jobs?.map((j: { job: { id: string } }) => j.job.id) || [];
    if (jobIds.length > 0) {
      const jobsResult = await supabase
        .from('jobs')
        .update({ status: 'paid' })
        .in('id', jobIds);
      if (jobsResult.error) throw new Error(`Не удалось обновить статус работ: ${jobsResult.error.message}`);
    }
  } catch (error) {
    for (const rollback of rollbacks.reverse()) {
      try {
        await rollback();
      } catch {
        // Игнорируем ошибки отката, чтобы сохранить исходную ошибку
      }
    }
    throw error;
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
  await requireAdmin();
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', invoiceId)
    .single();

  if (!invoice) throw new Error('Счёт не найден');
  if (invoice.status === 'paid') throw new Error('Нельзя удалить оплаченный акт');

  const { data: invoiceJobs } = await supabase
    .from('invoice_jobs')
    .select('job_id')
    .eq('invoice_id', invoiceId);

  if (invoiceJobs && invoiceJobs.length > 0) {
    const { error: jobError } = await supabase
      .from('jobs')
      .update({ status: 'available' })
      .in('id', invoiceJobs.map(ij => ij.job_id));

    if (jobError) throw jobError;
  }

  const { error: linkError } = await supabase
    .from('invoice_jobs')
    .delete()
    .eq('invoice_id', invoiceId);

  if (linkError) throw linkError;

  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId);

  if (error) throw error;

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