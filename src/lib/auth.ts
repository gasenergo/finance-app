import { createClient } from '@/lib/supabase/server';

export async function getCurrentUserId(): Promise<string> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Не авторизован');

  return user.id;
}

export async function requireAdmin(): Promise<string> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Не авторизован');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    throw new Error('Доступ запрещён');
  }

  return user.id;
}