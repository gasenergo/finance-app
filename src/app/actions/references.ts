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