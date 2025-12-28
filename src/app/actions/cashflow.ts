// src/app/actions/cashflow.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

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
  
  let query = supabase
    .from('transactions')
    .select(`
      *,
      category:expense_categories(id, name),
      related_user:profiles!transactions_related_user_id_fkey(id, full_name),
      invoice:invoices!transactions_related_invoice_id_fkey(invoice_number)
    `)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  
  // Фильтр по году/месяцу
  if (year && month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    query = query.gte('date', startDate).lte('date', endDate);
  }
  
  const { data } = await query;
  
  // Рассчитываем running balance
  if (data) {
    let balance = 0;
    const sorted = [...data].sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    
    sorted.forEach(tx => {
      if (tx.type === 'income') {
        balance += Number(tx.amount);
      } else {
        balance -= Number(tx.amount);
      }
      tx.running_balance = balance;
    });
    
    // Возвращаем в обратном порядке (новые сверху)
    return sorted.reverse();
  }
  
  return [];
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
    throw new Error('Только админ может проводить выплаты');
  }

  // Проверяем общий баланс (кассу)
  const { data: totalBalance } = await supabase.rpc('get_total_balance');
  
  if (!totalBalance || totalBalance < data.amount) {
    throw new Error(`Недостаточно средств в кассе. Доступно: ${totalBalance || 0} ₽`);
  }
  // Проверяем баланс участника
  const { data: balance } = await supabase
    .from('balances')
    .select('available_amount')
    .eq('user_id', data.user_id)
    .single();
  
  if (!balance || balance.available_amount < data.amount) {
    throw new Error('Недостаточно средств на балансе участника');
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
  
  if (error) throw error;
  
  // Уменьшаем баланс участника
  await supabase.rpc('decrement_balance', {
    p_user_id: data.user_id,
    p_amount: data.amount
  });
  
  revalidatePath('/cashflow');
  revalidatePath('/');
  
  return transaction;
}

export async function deleteTransaction(id: string) {
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
    throw new Error('Только админ может удалять транзакции');
  }
  
  // Получаем транзакцию для отката
  const { data: transaction } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single();
  
  if (!transaction) throw new Error('Транзакция не найдена');
  
  // Откатываем изменения балансов
  if (transaction.type === 'payout' && transaction.related_user_id) {
    // Возвращаем деньги на баланс участника
    await supabase.rpc('increment_balance', {
      p_user_id: transaction.related_user_id,
      p_amount: transaction.amount
    });
  } else if (transaction.type === 'expense') {
    // Возвращаем в фонд
    await supabase
      .from('fund')
      .update({ 
        current_balance: supabase.rpc('get_fund_balance') + transaction.amount 
      })
      .eq('id', 1);
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