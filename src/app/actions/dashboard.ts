'use server';

import { createClient } from '@/lib/supabase/server';

export async function getDashboardData() {
  const supabase = await createClient();
  
  const [
    { data: totalBalance },
    { data: receivables },
    { data: fund },
    { data: settings },
    { data: balances },
    { data: recentTransactions }
  ] = await Promise.all([
    supabase.rpc('get_total_balance'),
    supabase.rpc('get_accounts_receivable'),
    supabase.from('fund').select('*').single(),
    supabase.from('settings').select('*').single(),
    supabase
      .from('balances')
      .select('*, user:profiles(id, full_name, participant_type, percentage_rate)')
      .order('available_amount', { ascending: false }),
    supabase
      .from('transactions')
      .select('*, category:expense_categories(name), related_user:profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(10)
  ]);
  
  return {
    totalBalance: totalBalance || 0,
    receivables: receivables || 0,
    fund: fund || { current_balance: 0 },
    fundLimit: settings?.fund_limit || 500000,
    balances: balances || [],
    recentTransactions: recentTransactions || []
  };
}