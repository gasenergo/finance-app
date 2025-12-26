// src/app/actions/admin.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

// ============ SETTINGS ============

export async function getSettings() {
  const supabase = await createClient();
  const { data } = await supabase.from('settings').select('*').single();
  return data;
}

export async function updateSettings(data: {
  tax_rate: number;
  fund_contribution_rate: number;
  fund_limit: number;
}) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('settings')
    .update({
      tax_rate: data.tax_rate,
      fund_contribution_rate: data.fund_contribution_rate,
      fund_limit: data.fund_limit,
      updated_at: new Date().toISOString()
    })
    .eq('id', 1);
  
  if (error) throw error;
  
  revalidatePath('/admin');
  revalidatePath('/');
  return { success: true };
}

// ============ TEAM ============

export async function getTeamWithBalances() {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('profiles')
    .select(`
      *,
      balance:balances(available_amount, total_earned, total_withdrawn)
    `)
    .order('full_name');
  
  return data || [];
}

export async function createUser(data: {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'user';
  participant_type: 'partner' | 'percentage' | null;
  percentage_rate: number | null;
}) {
  const adminClient = createAdminClient();
  
  // Создаём пользователя в Auth
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true
  });
  
  if (authError) throw authError;
  if (!authData.user) throw new Error('Не удалось создать пользователя');
  
  // Создаём профиль
  const { error: profileError } = await adminClient
    .from('profiles')
    .insert({
      id: authData.user.id,
      full_name: data.full_name,
      role: data.role,
      participant_type: data.participant_type,
      percentage_rate: data.percentage_rate,
      is_active: true
    });
  
  if (profileError) throw profileError;
  
  // Создаём начальный баланс
  await adminClient
    .from('balances')
    .insert({
      user_id: authData.user.id,
      available_amount: 0,
      total_earned: 0,
      total_withdrawn: 0
    });
  
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
  const adminClient = createAdminClient();
  
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword
  });
  
  if (error) throw error;
  
  return { success: true };
}

// ============ CLIENTS ============

export async function getClients() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('clients')
    .select('*')
    .order('name');
  return data || [];
}

export async function createClientAction(name: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('clients')
    .insert({ name })
    .select()
    .single();
  
  if (error) throw error;
  
  revalidatePath('/admin');
  revalidatePath('/jobs');
  return data;
}

export async function updateClient(id: string, data: { name: string; is_archived: boolean }) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('clients')
    .update(data)
    .eq('id', id);
  
  if (error) throw error;
  
  revalidatePath('/admin');
  return { success: true };
}

// ============ WORK TYPES ============

export async function getWorkTypes() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('work_types')
    .select('*')
    .order('name');
  return data || [];
}

export async function createWorkType(data: { name: string; default_price: number | null }) {
  const supabase = await createClient();
  
  const { data: workType, error } = await supabase
    .from('work_types')
    .insert(data)
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
  is_archived: boolean;
}) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('work_types')
    .update(data)
    .eq('id', id);
  
  if (error) throw error;
  
  revalidatePath('/admin');
  return { success: true };
}

// ============ EXPENSE CATEGORIES ============

export async function getExpenseCategories() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('expense_categories')
    .select('*')
    .order('is_system', { ascending: false })
    .order('name');
  return data || [];
}

export async function createExpenseCategory(name: string) {
  const supabase = await createClient();
  
  const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  
  const { data, error } = await supabase
    .from('expense_categories')
    .insert({ name, slug, is_system: false })
    .select()
    .single();
  
  if (error) throw error;
  
  revalidatePath('/admin');
  revalidatePath('/cashflow');
  return data;
}

export async function deleteExpenseCategory(id: string) {
  const supabase = await createClient();
  
  // Проверяем что категория не системная
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