// src/app/actions/dashboard.ts
'use server';

import { createClient } from '@/lib/supabase/server';

export interface DashboardData {
  totalBalance: number;
  receivables: number;
  fund: {
    current_balance: number;
    updated_at: string;
  };
  fundLimit: number;
  balances: Array<{
    user_id: string;
    available_amount: number;
    total_earned: number;
    total_withdrawn: number;
    user: {
      id: string;
      full_name: string;
      participant_type: 'partner' | 'percentage' | null;
      percentage_rate: number | null;
    } | null;
  }>;
  recentTransactions: Array<{
    id: string;
    date: string;
    type: 'income' | 'expense' | 'payout';
    amount: number;
    description: string | null;
    category: { name: string } | null;
    related_user: { full_name: string } | null;
    created_at: string;
  }>;
  stats: {
    totalIncome: number;
    totalExpenses: number;
    totalPayouts: number;
    jobsCount: {
      available: number;
      invoiced: number;
      paid: number;
    };
    invoicesCount: {
      draft: number;
      sent: number;
      paid: number;
    };
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  
  try {
    const [
      { data: totalBalance },
      { data: receivables },
      { data: fund },
      { data: settings },
      { data: balances },
      { data: recentTransactions },
      { data: allTransactions },
      { data: jobs },
      { data: invoices }
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
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('transactions')
        .select('type, amount'),
      supabase
        .from('jobs')
        .select('status'),
      supabase
        .from('invoices')
        .select('status')
    ]);

    // Считаем статистику по транзакциям
    const totalIncome = allTransactions
      ?.filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    
    const totalExpenses = allTransactions
      ?.filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    
    const totalPayouts = allTransactions
      ?.filter(t => t.type === 'payout')
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    // Считаем статистику по работам
    const jobsCount = {
      available: jobs?.filter(j => j.status === 'available').length || 0,
      invoiced: jobs?.filter(j => j.status === 'invoiced').length || 0,
      paid: jobs?.filter(j => j.status === 'paid').length || 0,
    };

    // Считаем статистику по счетам
    const invoicesCount = {
      draft: invoices?.filter(i => i.status === 'draft').length || 0,
      sent: invoices?.filter(i => i.status === 'sent').length || 0,
      paid: invoices?.filter(i => i.status === 'paid').length || 0,
    };

    return {
      totalBalance: totalBalance ?? 0,
      receivables: receivables ?? 0,
      fund: fund ?? { current_balance: 0, updated_at: new Date().toISOString() },
      fundLimit: settings?.fund_limit ?? 500000,
      balances: balances ?? [],
      recentTransactions: recentTransactions ?? [],
      stats: {
        totalIncome,
        totalExpenses,
        totalPayouts,
        jobsCount,
        invoicesCount,
      },
    };
  } catch (error) {
    console.error('getDashboardData error:', error);
    return {
      totalBalance: 0,
      receivables: 0,
      fund: { current_balance: 0, updated_at: new Date().toISOString() },
      fundLimit: 500000,
      balances: [],
      recentTransactions: [],
      stats: {
        totalIncome: 0,
        totalExpenses: 0,
        totalPayouts: 0,
        jobsCount: { available: 0, invoiced: 0, paid: 0 },
        invoicesCount: { draft: 0, sent: 0, paid: 0 },
      },
    };
  }
}