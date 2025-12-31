// src/app/actions/adjustments.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin'; // Нужны админ права для списаний
import { revalidatePath } from 'next/cache';

// 1. Получить сумму "Свободных денег"
export async function getFreeCashAmount() {
  const supabase = await createClient();

  // Получаем настройки для fund_limit
  const { data: settings } = await supabase.from('settings').select('fund_limit').single();

  // Получаем сумму всех балансов пользователей
  const { data: balances } = await supabase.from('balances').select('available_amount');
  const totalUserBalances = balances?.reduce((sum, b) => sum + b.available_amount, 0) || 0;

  // Формула: Фонд лимит - Обязательства перед людьми (свободные деньги для возврата)
  const fundLimit = settings?.fund_limit ?? 500000;
  const freeCash = fundLimit - totalUserBalances;



  return Math.max(0, freeCash); // Не показываем минус, если вдруг что-то не сошлось
}

// 1.5. Получить текущий баланс фонда
export async function getFundBalance() {
  const supabase = await createClient();

  const { data: fund } = await supabase
    .from('fund')
    .select('current_balance')
    .eq('id', 1)
    .single();

  return fund?.current_balance ?? 0;
}

// 2. Выписать премию (из фонда)
export async function giveBonus(userId: string, amount: number) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Проверка прав (только админ может давать премии)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Не авторизован');

  // 1. Получаем текущий баланс фонда
  const fundBalance = await getFundBalance();

  if (amount > fundBalance) {
    throw new Error('Недостаточно средств в фонде');
  }

  // 2. Списываем средства с фонда
  const { error: fundError } = await adminClient
    .from('fund')
    .update({
      current_balance: fundBalance - amount,
      updated_at: new Date().toISOString()
    })
    .eq('id', 1);

  if (fundError) throw fundError;

  // 3. Начисляем баланс пользователю
  const { error: balanceError } = await adminClient.rpc('increment_balance', {
    p_user_id: userId,
    p_amount: amount
  });

  if (balanceError) throw balanceError;

  revalidatePath('/');
  revalidatePath('/admin');

  return { success: true };
}

// 3. Вернуть деньги в фонд (с баланса партнера)
export async function returnToCompanyPot(userId: string, amount: number) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Проверяем баланс пользователя
  const { data: balance } = await supabase
    .from('balances')
    .select('available_amount')
    .eq('user_id', userId)
    .single();

  if (!balance || balance.available_amount < amount) {
    throw new Error('Недостаточно средств на балансе пользователя');
  }

  // Списываем средства с баланса пользователя
  const { error: decrementError } = await adminClient.rpc('decrement_balance', {
    p_user_id: userId,
    p_amount: amount
  });

  if (decrementError) throw decrementError;

  // Получаем текущий баланс фонда
  const { data: currentFund } = await adminClient
    .from('fund')
    .select('current_balance')
    .eq('id', 1)
    .single();

  if (!currentFund) throw new Error('Фонд не найден');

  // Начисляем средства в фонд
  const { error: fundError } = await adminClient
    .from('fund')
    .update({
      current_balance: currentFund.current_balance + amount,
      updated_at: new Date().toISOString()
    })
    .eq('id', 1);

  if (fundError) throw fundError;

  // Логика:
  // Мы уменьшили долг компании перед юзером и увеличили фонд.
  // Это правильно отражает возврат денег в компанию.

  revalidatePath('/');
  revalidatePath('/admin');

  return { success: true };
}
