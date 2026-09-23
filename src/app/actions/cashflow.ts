// src/app/actions/cashflow.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';

export interface TransactionWithRelations {
  id: string;
  date: string;
  type: 'income' | 'expense' | 'payout';
  category_id: string | null;
  description: string | null;
  amount: number;
  related_invoice_id: string | null;
  related_user_id: string | null;
  created_by: string;
  created_at: string;
  category: { id: string; name: string } | null;
  related_user: { id: string; full_name: string } | null;
  invoice: { invoice_number: string } | null;
  running_balance?: number;
}

export async function getTransactions(year?: number, month?: number) {
  const supabase = await createClient();

  // Тянем все транзакции (без фильтра), чтобы running balance был корректным
  const { data } = await supabase
    .from('transactions')
    .select(`
      *,
      category:expense_categories(id, name),
      related_user:profiles!transactions_related_user_id_fkey(id, full_name),
      invoice:invoices!transactions_related_invoice_id_fkey(invoice_number)
    `)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });

  if (!data || data.length === 0) return [];

  // Рассчитываем running balance по всем записям в хронологическом порядке
  let balance = 0;
  const transactions = data.map(tx => {
    if (tx.type === 'income') {
      balance += Number(tx.amount);
    } else {
      balance -= Number(tx.amount);
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
  date: string;
  category_id: string;
  description: string;
  amount: number;
}) {
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
    throw new Error('Только админ может добавлять расходы');
  }
  
  const { data: transaction, error } = await supabase
    .from('transactions')
    .insert({
      date: data.date,
      type: 'expense',
      category_id: data.category_id,
      description: data.description,
      amount: data.amount,
      created_by: user.id
    })
    .select(`
      *,
      category:expense_categories(id, name)
    `)
    .single();
  
  if (error) throw error;
  
  // Уменьшаем баланс фонда
  await supabase.rpc('decrement_fund', { p_amount: data.amount });
  
  revalidatePath('/cashflow');
  revalidatePath('/');
  
  return transaction;
}

export async function createPayout(data: {
  user_id: string;
  amount: number;
  description?: string;
}): Promise<{ data?: TransactionWithRelations; error?: string }> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Не авторизован' };
  
  // Проверяем права админа
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
    
  if (profile?.role !== 'admin') {
    return { error: 'Только админ может проводить выплаты' };
  }
  
  // Проверяем общий баланс (кассу)
  const { data: totalBalance } = await supabase.rpc('get_total_balance');
  
  if (totalBalance === null || totalBalance < data.amount) {
    return { error: `Недостаточно средств в кассе. Доступно: ${totalBalance || 0} ₽` };
  }
  
  // Проверяем баланс участника
  const { data: balance } = await supabase
    .from('balances')
    .select('available_amount')
    .eq('user_id', data.user_id)
    .single();
  
  if (!balance || balance.available_amount < data.amount) {
    return { error: `Недостаточно средств у участника. Доступно: ${balance?.available_amount || 0} ₽` };
  }
  
  // Получаем имя участника
  const { data: member } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', data.user_id)
    .single();
  
  // Создаём транзакцию
  const { data: transaction, error } = await supabase
    .from('transactions')
    .insert({
      date: new Date().toISOString().split('T')[0],
      type: 'payout',
      description: data.description || `Выплата: ${member?.full_name}`,
      amount: data.amount,
      related_user_id: data.user_id,
      created_by: user.id
    })
    .select(`
      *,
      related_user:profiles!transactions_related_user_id_fkey(id, full_name)
    `)
    .single();
  
  if (error) return { error: error.message };
  
  // Уменьшаем баланс участника
  await supabase.rpc('decrement_balance', {
    p_user_id: data.user_id,
    p_amount: data.amount
  });
  
  revalidatePath('/cashflow');
  revalidatePath('/');
  
  return { data: transaction };
}

export async function deleteTransaction(id: string) {
  await requireAdmin();
  const supabase = await createClient();

  // Получаем транзакцию для отката
  const { data: transaction } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single();

  if (!transaction) throw new Error('Транзакция не найдена');

  // Доходные операции создаются системой (оплата счетов, премии, возвраты).
  // Однозначно откатить их невозможно, поэтому удаление запрещаем.
  if (transaction.type === 'income') {
    throw new Error('Нельзя удалить доходную операцию');
  }

  // Откатываем изменения балансов
  if (transaction.type === 'payout' && transaction.related_user_id) {
    // Возвращаем деньги на баланс участника
    const { error } = await supabase.rpc('increment_balance', {
      p_user_id: transaction.related_user_id,
      p_amount: transaction.amount
    });
    if (error) throw error;
  } else if (transaction.type === 'expense') {
    // Возвращаем в фонд (расход всегда списывался из фонда)
    const { data: fund } = await supabase
      .from('fund')
      .select('current_balance')
      .eq('id', 1)
      .single();

    const newBalance = (fund?.current_balance ?? 0) + Number(transaction.amount);
    const { error } = await supabase
      .from('fund')
      .update({
        current_balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);

    if (error) throw error;
  }

  // Удаляем транзакцию
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/cashflow');
  revalidatePath('/');

  return { success: true };
}