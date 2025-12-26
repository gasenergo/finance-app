'use server';

import { createClient } from '@/lib/supabase/server';

export async function getClients() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('is_archived', false)
    .order('name');
  return data || [];
}

export async function getWorkTypes() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('work_types')
    .select('*')
    .eq('is_archived', false)
    .order('name');
  return data || [];
}

export async function getExpenseCategories() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('expense_categories')
    .select('*')
    .order('is_system', { ascending: false })
    .order('name');
  return data || [];
}

export async function getTeamMembers() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, participant_type, percentage_rate, is_active')
    .eq('is_active', true)
    .not('participant_type', 'is', null)
    .order('full_name');
  return data || [];
}