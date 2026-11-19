// src/app/actions/admin.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';

// ============ ACCOUNTS (СЧЕТА / ФИЛИАЛЫ) ============

export async function getAllAccounts() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: true });
  return data || [];
}

export async function createAccount(data: {
  name: string;
  bank_name?: string | null;
  account_number?: string | null;
  tax_rate: number;
  fund_contribution_rate: number;
  fund_limit: number;
}) {
  await requireAdmin();
  const supabase = await createClient();

  if (!data.name.trim()) throw new Error('Введите название счёта');

  const { data: account, error } = await supabase
    .from('accounts')
    .insert({
      name: data.name.trim(),
      bank_name: data.bank_name?.trim() || null,
      account_number: data.account_number?.trim() || null,
      tax_rate: data.tax_rate,
      fund_contribution_rate: data.fund_contribution_rate,
      fund_limit: data.fund_limit,
      current_fund_balance: 0,
      is_active: true
    })
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/admin');
  revalidatePath('/');
  return account;
}

export async function updateAccount(id: string, data: {
  name: string;
  bank_name?: string | null;
  account_number?: string | null;
  tax_rate: number;
  fund_contribution_rate: number;
  fund_limit: number;
  is_active: boolean;
}) {
  await requireAdmin();
  const supabase = await createClient();

  if (!Number.isFinite(data.tax_rate) || !Number.isFinite(data.fund_contribution_rate) || !Number.isFinite(data.fund_limit)) {
    throw new Error('Некорректные числовые параметры счёта');
  }

  const { error } = await supabase
    .from('accounts')
    .update({
      name: data.name.trim(),
      bank_name: data.bank_name?.trim() || null,
      account_number: data.account_number?.trim() || null,
      tax_rate: data.tax_rate,
      fund_contribution_rate: data.fund_contribution_rate,
      fund_limit: data.fund_limit,
      is_active: data.is_active,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/admin');
  revalidatePath('/');
  return { success: true };
}

// Совместимость со старым интерфейсом настроек (работает с первым счётом, если accountId не передан)
export async function getSettings(accountId?: string) {
  const supabase = await createClient();
  let query = supabase.from('accounts').select('*');
  if (accountId) {
    query = query.eq('id', accountId);
  } else {
    query = query.order('created_at', { ascending: true }).limit(1);
  }
  const { data } = await query.single();
  return data;
}

export async function updateSettings(data: {
  account_id?: string;
  tax_rate: number;
  fund_contribution_rate: number;
  fund_limit: number;
}) {
  await requireAdmin();
  const supabase = await createClient();

  if (!Number.isFinite(data.tax_rate) || !Number.isFinite(data.fund_contribution_rate) || !Number.isFinite(data.fund_limit)) {
    throw new Error('Некорректные значения настроек');
  }

  let targetId = data.account_id;
  if (!targetId) {
    const { data: firstAcc } = await supabase
      .from('accounts')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    targetId = firstAcc?.id;
  }

  if (!targetId) throw new Error('Счёт не найден');

  const { error } = await supabase
    .from('accounts')
    .update({
      tax_rate: data.tax_rate,
      fund_contribution_rate: data.fund_contribution_rate,
      fund_limit: data.fund_limit,
      updated_at: new Date().toISOString()
    })
    .eq('id', targetId);

  if (error) throw error;

  revalidatePath('/admin');
  revalidatePath('/');
  return { success: true };
}

// ============ TEAM ============

export async function getTeamWithBalances() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: profiles }, { data: balances }] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('balances').select('*, account:accounts(id, name)')
  ]);

  const team = (profiles || []).map(p => ({
    id: p.id,
    full_name: p.full_name,
    role: p.role,
    participant_type: p.participant_type,
    percentage_rate: p.percentage_rate,
    is_active: p.is_active,
    balance: (balances || [])
      .filter(b => b.user_id === p.id)
      .map(b => ({
        account_id: b.account_id,
        account_name: b.account?.name ?? 'Счёт',
        available_amount: Number(b.available_amount),
        total_earned: Number(b.total_earned),
        total_withdrawn: Number(b.total_withdrawn)
      }))
  }));

  return team;
}

export async function createUser(data: {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'user';
  participant_type: 'partner' | 'percentage' | null;
  percentage_rate: number | null;
}) {
  await requireAdmin();
  const adminClient = createAdminClient();

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('Не удалось создать пользователя');

  const { error: profileError } = await adminClient
    .from('profiles')
    .upsert({
      id: authData.user.id,
      full_name: data.full_name,
      role: data.role,
      participant_type: data.participant_type,
      percentage_rate: data.percentage_rate,
      is_active: true
    });

  if (profileError) throw profileError;

  // Создаём начальные балансы по всем активным счетам
  const { data: accounts } = await adminClient
    .from('accounts')
    .select('id')
    .eq('is_active', true);

  if (accounts && accounts.length > 0) {
    const { error: balanceError } = await adminClient
      .from('balances')
      .upsert(
        accounts.map(acc => ({
          user_id: authData.user.id,
          account_id: acc.id,
          available_amount: 0,
          total_earned: 0,
          total_withdrawn: 0
        }))
      );

    if (balanceError) throw balanceError;
  }

  revalidatePath('/admin');
  return { success: true };
}

export async function updateUser(userId: string, data: {
  full_name: string;
  role: 'admin' | 'user';
  participant_type: 'partner' | 'percentage' | null;
  percentage_rate: number | null;
  is_active: boolean;
}) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: data.full_name,
      role: data.role,
      participant_type: data.participant_type,
      percentage_rate: data.percentage_rate,
      is_active: data.is_active,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (error) throw error;

  revalidatePath('/admin');
  revalidatePath('/');
  return { success: true };
}

export async function resetUserPassword(userId: string, newPassword: string) {
  await requireAdmin();
  const adminClient = createAdminClient();

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword
  });

  if (error) throw error;

  return { success: true };
}

// ============ CLIENTS ============

export async function getAllClients() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('clients')
    .select('*')
    .order('name');
  return data || [];
}

export async function createClientAction(
  name: string,
  taxRate: number | null = null,
  inn: string | null = null,
  directorName: string | null = null
) {
  await requireAdmin();
  const supabase = await createClient();

  if (!name.trim()) throw new Error('Введите название клиента');

  const { data, error } = await supabase
    .from('clients')
    .insert({ name: name.trim(), tax_rate: taxRate, inn: inn?.trim() || null, director_name: directorName?.trim() || null })
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/admin');
  revalidatePath('/jobs');
  return data;
}

export async function updateClient(id: string, data: {
  name: string;
  inn: string | null;
  director_name: string | null;
  tax_rate: number | null;
  is_archived: boolean;
}) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from('clients')
    .update({
      name: data.name,
      inn: data.inn?.trim() || null,
      director_name: data.director_name?.trim() || null,
      tax_rate: data.tax_rate,
      is_archived: data.is_archived
    })
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/admin');
  return { success: true };
}

// ============ WORK TYPES ============

export async function getAllWorkTypes() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('work_types')
    .select('*')
    .order('name');
  return data || [];
}

export async function createWorkType(data: { name: string; default_price: number | null; unit?: string }) {
  await requireAdmin();
  const supabase = await createClient();

  if (!data.name.trim()) throw new Error('Введите название вида работы');

  const { data: workType, error } = await supabase
    .from('work_types')
    .insert({ name: data.name.trim(), default_price: data.default_price, unit: data.unit?.trim() || 'шт' })
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/admin');
  revalidatePath('/jobs');
  return workType;
}

export async function updateWorkType(id: string, data: {
  name: string;
  default_price: number | null;
  unit?: string;
  is_archived: boolean;
}) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from('work_types')
    .update({
      name: data.name,
      default_price: data.default_price,
      unit: data.unit?.trim() || 'шт',
      is_archived: data.is_archived
    })
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/admin');
  return { success: true };
}

// ============ EXPENSE CATEGORIES ============

export async function getAllExpenseCategories() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('expense_categories')
    .select('*')
    .order('is_system', { ascending: false })
    .order('name');
  return data || [];
}

export async function createExpenseCategory(name: string) {
  await requireAdmin();
  const supabase = await createClient();

  if (!name.trim()) throw new Error('Введите название категории');

  const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  const { data, error } = await supabase
    .from('expense_categories')
    .insert({ name: name.trim(), slug, is_system: false })
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/admin');
  revalidatePath('/cashflow');
  return data;
}

export async function deleteExpenseCategory(id: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: category } = await supabase
    .from('expense_categories')
    .select('is_system')
    .eq('id', id)
    .single();

  if (category?.is_system) {
    throw new Error('Нельзя удалить системную категорию');
  }

  const { error } = await supabase
    .from('expense_categories')
    .delete()
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/admin');
  return { success: true };
}