'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createJobSchema, updateJobSchema, type CreateJobInput, type UpdateJobInput } from '@/lib/engine/validators';

export async function getJobs() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('jobs')
    .select(`
      *,
      client:clients(id, name),
      creator:profiles(id, full_name),
      work_type:work_types(id, name, default_price, unit)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data || [];
}

export async function createJob(input: CreateJobInput) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Не авторизован');

  const parsed = createJobSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || 'Неверные данные');
  }
  const { client_id, description, work_type_id, custom_work_name, quantity, unit, amount } = parsed.data;

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      client_id,
      description,
      work_type_id,
      custom_work_name,
      quantity: quantity ?? 1,
      unit: unit || 'шт',
      amount,
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

export async function updateJob(
  id: string,
  input: UpdateJobInput
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Не авторизован');

  const parsed = updateJobSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || 'Неверные данные');
  }
  const { client_id, description, work_type_id, custom_work_name, quantity, unit, amount } = parsed.data;

  // Проверяем, что работа существует и в статусе available
  const { data: existingJob } = await supabase
    .from('jobs')
    .select('status, created_by')
    .eq('id', id)
    .single();

  if (!existingJob) throw new Error('Работа не найдена');
  if (existingJob.status !== 'available') {
    throw new Error('Можно редактировать только свободные работы');
  }

  // Проверяем права: только создатель или админ
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (existingJob.created_by !== user.id && profile?.role !== 'admin') {
    throw new Error('Нет прав на редактирование этой работы');
  }

  const { data, error } = await supabase
    .from('jobs')
    .update({
      client_id,
      description,
      work_type_id,
      custom_work_name,
      quantity: quantity ?? 1,
      unit: unit || 'шт',
      amount,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Не авторизован');

  const { data: job } = await supabase
    .from('jobs')
    .select('status, created_by')
    .eq('id', id)
    .single();

  if (!job) throw new Error('Работа не найдена');
  if (job.status !== 'available') {
    throw new Error('Можно удалять только свободные работы');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (job.created_by !== user.id && profile?.role !== 'admin') {
    throw new Error('Нет прав на удаление этой работы');
  }

  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/jobs');
  revalidatePath('/');
  return { success: true };
}