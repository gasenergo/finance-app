// src/app/actions/cashflow.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';

export interface TransactionWithRelations {
  id: string;
  date: string;
  type: 'income' | 'expense' | 'payout' | 'transfer';
  account_id: string;
  target_account_id: string | null;
  transfer_group_id: string | null;
  category_id: string | null;
  description: string | null;
  amount: number;
  related_invoice_id: string | null;
  related_user_id: string | null;
  created_by: string;
  created_at: string;
  account: { id: string; name: string } | null;
  target_account: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  related_user: { id: string; full_name: string } | null;
  invoice: { invoice_number: string } | null;
  running_balance?: number;
}

export async function getTransactions(year?: number, month?: number, accountId?: string) {
  const supabase = await createClient();

  let query = supabase
    .from('transactions')
    .select(`
      *,
      account:accounts!transactions_account_id_fkey(id, name),
      target_account:accounts!transactions_target_account_id_fkey(id, name),
      category:expense_categories(id, name),
      related_user:profiles!transactions_related_user_id_fkey(id, full_name),
      invoice:invoices!transactions_related_invoice_id_fkey(invoice_number)
    `)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });

  if (accountId) {
    query = query.or(`account_id.eq.${accountId},target_account_id.eq.${accountId}`);
  }

  const { data } = await query;

  if (!data || data.length === 0) return [];

  // Рассчитываем running balance по всем записям в хронологическом порядке
  let balance = 0;
  const transactions = data.map(tx => {
    const amt = Number(tx.amount);
    if (tx.type === 'income') {
      balance += amt;
    } else if (tx.type === 'expense' || tx.type === 'payout') {
      balance -= amt;
    } else if (tx.type === 'transfer') {
      if (accountId) {
        if (tx.target_account_id === accountId) balance += amt;
        if (tx.account_id === accountId) balance -= amt;
      }
      // В режиме «Все счета» (accountId не задан) внутренний перевод не меняет общий итог
    }
    return { ...tx, running_balance: balance };
  });

  // Фильтр по году/месяцу применяем после расчёта баланса
  let result = transactions;
  if (year && month) {
    result = transactions.filter(tx => {
      const [y, m] = tx.date.split('-').map(Number);
      return y === year && m === month;
    });
  }

  // Возвращаем в обратном порядке (новые сверху)
  return result.reverse();
}

export async function createExpense(data: {
  account_id: string;
  date: string;
  category_id: string;
  description: string;
  amount: number;
}) {
  const userId = await requireAdmin();
  const supabase = await createClient();

  if (!data.account_id) {
    throw new Error('Выберите расчётный счёт');
  }

  // Списываем из резервного фонда выбранного счёта (RPC проверит остаток и заблокирует строку)
  const { error: fundError } = await supabase.rpc('decrement_fund', {
    p_amount: data.amount,
    p_account_id: data.account_id
  });

  if (fundError) {
    throw new Error(fundError.message);
  }

  const { data: transaction, error } = await supabase
    .from('transactions')
    .insert({
      account_id: data.account_id,
      date: data.date,
      type: 'expense',
      category_id: data.category_id,
      description: data.description,
      amount: data.amount,
      created_by: userId
    })
    .select(`
      *,
      account:accounts!transactions_account_id_fkey(id, name),
      category:expense_categories(id, name)
    `)
    .single();

  if (error) {
    // Откатываем списание из фонда при ошибке записи транзакции
    const { data: acc } = await supabase
      .from('accounts')
      .select('current_fund_balance')
      .eq('id', data.account_id)
      .single();

    if (acc) {
      await supabase
        .from('accounts')
        .update({ current_fund_balance: Number(acc.current_fund_balance) + Number(data.amount) })
        .eq('id', data.account_id);
    }
    throw error;
  }

  revalidatePath('/cashflow');
  revalidatePath('/');

  return transaction;
}

export async function createPayout(data: {
  user_id: string;
  earned_account_id: string;
  payment_account_id?: string; // Если не указан — платим с того же счёта, где заработано
  amount: number;
  description?: string;
}): Promise<{ data?: TransactionWithRelations; error?: string }> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Нет прав доступа' };
  }

  const supabase = await createClient();
  const earnedAccountId = data.earned_account_id;
  const paymentAccountId = data.payment_account_id || data.earned_account_id;

  if (!earnedAccountId) {
    return { error: 'Укажите филиал (счёт), с баланса которого производится выплата' };
  }

  // Проверяем остаток кассы на физическом счёте списания
  const { data: accountCash } = await supabase.rpc('get_total_balance', {
    p_account_id: paymentAccountId
  });

  if (accountCash === null || Number(accountCash) < data.amount) {
    return { error: `Недостаточно средств на счёте списания. Доступно: ${accountCash || 0} ₽` };
  }

  // Проверяем доступный баланс участника именно в том филиале, где он заработал
  const { data: balance } = await supabase
    .from('balances')
    .select('available_amount')
    .eq('user_id', data.user_id)
    .eq('account_id', earnedAccountId)
    .single();

  if (!balance || Number(balance.available_amount) < data.amount) {
    return { error: `Недостаточно средств у участника в этом филиале. Доступно: ${balance?.available_amount || 0} ₽` };
  }

  // Получаем имя участника для описания по умолчанию
  const { data: member } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', data.user_id)
    .single();

  const description = data.description || `Выплата: ${member?.full_name || 'участнику'}`;
  const date = new Date().toISOString().split('T')[0];

  // Атомарно проводим списание баланса, межфилиальный перевод (если счета разные) и выплату
  const { data: payoutTxId, error: rpcError } = await supabase.rpc('process_payout', {
    p_user_id: data.user_id,
    p_earned_account_id: earnedAccountId,
    p_payment_account_id: paymentAccountId,
    p_amount: data.amount,
    p_date: date,
    p_description: description,
    p_created_by: adminId
  });

  if (rpcError || !payoutTxId) {
    return { error: rpcError?.message || 'Ошибка при проведении выплаты' };
  }

  const { data: transaction } = await supabase
    .from('transactions')
    .select(`
      *,
      account:accounts!transactions_account_id_fkey(id, name),
      target_account:accounts!transactions_target_account_id_fkey(id, name),
      related_user:profiles!transactions_related_user_id_fkey(id, full_name)
    `)
    .eq('id', payoutTxId)
    .single();

  revalidatePath('/cashflow');
  revalidatePath('/');

  return { data: transaction };
}

export async function createTransfer(data: {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  date?: string;
  description?: string;
}): Promise<{ success?: boolean; error?: string }> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Нет прав доступа' };
  }

  if (!data.from_account_id || !data.to_account_id) {
    return { error: 'Выберите счёт отправителя и счёт получателя' };
  }
  if (data.from_account_id === data.to_account_id) {
    return { error: 'Счета отправителя и получателя должны различаться' };
  }
  if (data.amount <= 0) {
    return { error: 'Сумма перевода должна быть больше нуля' };
  }

  const supabase = await createClient();

  const { data: sourceBalance } = await supabase.rpc('get_total_balance', {
    p_account_id: data.from_account_id
  });

  if (sourceBalance === null || Number(sourceBalance) < data.amount) {
    return { error: `Недостаточно средств на счёте списания. Доступно: ${sourceBalance || 0} ₽` };
  }

  const { error } = await supabase.from('transactions').insert({
    date: data.date || new Date().toISOString().split('T')[0],
    type: 'transfer',
    account_id: data.from_account_id,
    target_account_id: data.to_account_id,
    amount: data.amount,
    description: data.description || 'Перевод между счетами',
    created_by: adminId
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/cashflow');
  revalidatePath('/');

  return { success: true };
}

export async function deleteTransaction(id: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: transaction } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single();

  if (!transaction) throw new Error('Транзакция не найдена');

  if (transaction.type === 'income') {
    throw new Error('Нельзя удалить доходную операцию');
  }

  // Если операция входит в межфилиальную связку (выплата за другой филиал) — откатываем всю группу
  if (transaction.transfer_group_id) {
    const { data: groupTxs } = await supabase
      .from('transactions')
      .select('*')
      .eq('transfer_group_id', transaction.transfer_group_id);

    const payoutTx = groupTxs?.find(t => t.type === 'payout');
    if (payoutTx && payoutTx.related_user_id) {
      const { error } = await supabase.rpc('increment_balance', {
        p_user_id: payoutTx.related_user_id,
        p_amount: payoutTx.amount,
        p_account_id: payoutTx.account_id
      });
      if (error) throw error;
    }

    const { error: delGroupError } = await supabase
      .from('transactions')
      .delete()
      .eq('transfer_group_id', transaction.transfer_group_id);

    if (delGroupError) throw delGroupError;

    revalidatePath('/cashflow');
    revalidatePath('/');
    return { success: true };
  }

  // Обычная выплата в рамках одного счёта
  if (transaction.type === 'payout' && transaction.related_user_id) {
    const { error } = await supabase.rpc('increment_balance', {
      p_user_id: transaction.related_user_id,
      p_amount: transaction.amount,
      p_account_id: transaction.account_id
    });
    if (error) throw error;
  } else if (transaction.type === 'expense') {
    // Возвращаем в фонд именно того счёта, с которого был расход
    const { data: account } = await supabase
      .from('accounts')
      .select('current_fund_balance')
      .eq('id', transaction.account_id)
      .single();

    const newBalance = Number(account?.current_fund_balance ?? 0) + Number(transaction.amount);
    const { error } = await supabase
      .from('accounts')
      .update({
        current_fund_balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', transaction.account_id);

    if (error) throw error;
  }

  // Удаляем транзакцию (для обычного transfer просто удаляется запись, остатки счетов пересчитаются автоматически)
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/cashflow');
  revalidatePath('/');

  return { success: true };
}