'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { CreateJobInput } from '@/lib/engine/validators';

export async function getJobs() {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('jobs')
    .select(`
      *,
      client:clients(id, name),
      creator:profiles(id, full_name),
      work_type:work_types(id, name, default_price)
    `)
    .order('created_at', { ascending: false });
  
  return data || [];
}

export async function createJob(input: CreateJobInput) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Не авторизован');
  
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      client_id: input.client_id,
      description: input.description,
      work_type_id: input.work_type_id,
      custom_work_name: input.custom_work_name,
      amount: input.amount,
      created_by: user.id
    })
    .select(`
      *,
      client:clients(id, name),
      creator:profiles(id, full_name),
      work_type:work_types(id, name)
    `)
    .single();
  
  if (error) throw error;
  
  revalidatePath('/jobs');
  revalidatePath('/');
  return data;
}

export async function deleteJob(id: string) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  
  revalidatePath('/jobs');
}