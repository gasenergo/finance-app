// src/app/actions/adjustments.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';

// 1. Получить сумму "Свободных денег" по счёту или по всей студии
export async function getFreeCashAmount(accountId?: string) {
  const supabase = await createClient();

  let accountsQuery = supabase.from('accounts').select('fund_limit').eq('is_active', true);
  let balancesQuery = supabase.from('balances').select('available_amount');

  if (accountId) {
    accountsQuery = accountsQuery.eq('id', accountId);
    balancesQuery = balancesQuery.eq('account_id', accountId);
  }

  const [{ data: accounts }, { data: balances }] = await Promise.all([
    accountsQuery,
    balancesQuery
  ]);

  const totalFundLimit = accounts?.reduce((sum, a) => sum + Number(a.fund_limit), 0) ?? 500000;
  const totalUserBalances = balances?.reduce((sum, b) => sum + Number(b.available_amount), 0) || 0;

  return Math.max(0, totalFundLimit - totalUserBalances);
}

// 1.5. Получить текущий баланс фонда по счёту (или суммарно по всем счетам)
export async function getFundBalance(accountId?: string) {
  const supabase = await createClient();

  let query = supabase.from('accounts').select('current_fund_balance').eq('is_active', true);
  if (accountId) {
    query = query.eq('id', accountId);
  }

  const { data: accounts } = await query;
  return accounts?.reduce((sum, a) => sum + Number(a.current_fund_balance), 0) ?? 0;
}

// 2. Выписать премию (из фонда конкретного счёта)
export async function giveBonus(userId: string, amount: number, accountId: string) {
  const adminClient = createAdminClient();
  const adminId = await requireAdmin();

  if (!accountId) {
    throw new Error('Выберите расчётный счёт (филиал)');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Некорректная сумма');
  }

  // 1. Атомарно списываем средства с фонда выбранного счёта (RPC проверит остаток и заблокирует строку)
  const { error: fundError } = await adminClient.rpc('decrement_fund', {
    p_amount: amount,
    p_account_id: accountId
  });

  if (fundError) throw new Error(fundError.message);

  // 2. Начисляем баланс пользователю в разрезе этого счёта
  const { error: balanceError } = await adminClient.rpc('increment_balance', {
    p_user_id: userId,
    p_amount: amount,
    p_account_id: accountId
  });

  if (balanceError) throw balanceError;

  // 3. Создаём запись в cashflow
  const { error: transactionError } = await adminClient
    .from('transactions')
    .insert({
      account_id: accountId,
      date: new Date().toISOString().split('T')[0],
      type: 'income',
      description: 'Премия из фонда',
      amount: amount,
      related_user_id: userId,
      created_by: adminId
    });

  if (transactionError) throw transactionError;

  revalidatePath('/');
  revalidatePath('/admin');
  revalidatePath('/cashflow');

  return { success: true };
}

// 3. Вернуть деньги в фонд (с баланса участника в конкретном филиале)
export async function returnToCompanyPot(userId: string, amount: number, accountId: string) {
  const adminId = await requireAdmin();
  const adminClient = createAdminClient();

  if (!accountId) {
    throw new Error('Выберите расчётный счёт (филиал)');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Некорректная сумма');
  }

  // 1. Атомарно списываем с баланса участника по выбранному счёту
  const { error: decrementError } = await adminClient.rpc('decrement_balance', {
    p_user_id: userId,
    p_amount: amount,
    p_account_id: accountId
  });

  if (decrementError) throw new Error(decrementError.message);

  // 2. Получаем текущий баланс фонда этого счёта и пополняем его
  const { data: account } = await adminClient
    .from('accounts')
    .select('current_fund_balance')
    .eq('id', accountId)
    .single();

  if (!account) throw new Error('Расчётный счёт не найден');

  const { error: fundError } = await adminClient
    .from('accounts')
    .update({
      current_fund_balance: Number(account.current_fund_balance) + amount,
      updated_at: new Date().toISOString()
    })
    .eq('id', accountId);

  if (fundError) throw fundError;

  // 3. Создаём запись в cashflow
  const { error: transactionError } = await adminClient
    .from('transactions')
    .insert({
      account_id: accountId,
      date: new Date().toISOString().split('T')[0],
      type: 'income',
      description: 'Возврат в фонд',
      amount: amount,
      related_user_id: userId,
      created_by: adminId
    });

  if (transactionError) throw transactionError;

  revalidatePath('/');
  revalidatePath('/admin');
  revalidatePath('/cashflow');

  return { success: true };
}