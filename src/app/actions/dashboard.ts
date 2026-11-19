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
    by_account: Array<{
      account_id: string;
      account_name: string;
      available_amount: number;
    }>;
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
    type: 'income' | 'expense' | 'payout' | 'transfer';
    amount: number;
    description: string | null;
    account: { id: string; name: string } | null;
    target_account: { id: string; name: string } | null;
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

export async function getDashboardData(accountId?: string): Promise<DashboardData> {
  const supabase = await createClient();

  try {
    let accountsQuery = supabase.from('accounts').select('*').eq('is_active', true);
    let balancesQuery = supabase
      .from('balances')
      .select('*, account:accounts(id, name), user:profiles(id, full_name, participant_type, percentage_rate)');
    let recentTxQuery = supabase
      .from('transactions')
      .select(`
        *,
        account:accounts!transactions_account_id_fkey(id, name),
        target_account:accounts!transactions_target_account_id_fkey(id, name),
        category:expense_categories(name),
        related_user:profiles!transactions_related_user_id_fkey(full_name)
      `)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5);
    let allTxQuery = supabase.from('transactions').select('type, amount, account_id, target_account_id');
    let jobsQuery = supabase.from('jobs').select('status');
    let invoicesQuery = supabase.from('invoices').select('status');

    if (accountId) {
      accountsQuery = accountsQuery.eq('id', accountId);
      balancesQuery = balancesQuery.eq('account_id', accountId);
      recentTxQuery = recentTxQuery.or(`account_id.eq.${accountId},target_account_id.eq.${accountId}`);
      allTxQuery = allTxQuery.or(`account_id.eq.${accountId},target_account_id.eq.${accountId}`);
      jobsQuery = jobsQuery.eq('account_id', accountId);
      invoicesQuery = invoicesQuery.eq('account_id', accountId);
    }

    const [
      { data: totalBalance },
      { data: receivables },
      { data: accounts },
      { data: rawBalances },
      { data: recentTransactions },
      { data: allTransactions },
      { data: jobs },
      { data: invoices }
    ] = await Promise.all([
      supabase.rpc('get_total_balance', { p_account_id: accountId ?? null }),
      supabase.rpc('get_accounts_receivable', { p_account_id: accountId ?? null }),
      accountsQuery,
      balancesQuery,
      recentTxQuery,
      allTxQuery,
      jobsQuery,
      invoicesQuery
    ]);

    const currentFundBalance = accounts?.reduce((sum, a) => sum + Number(a.current_fund_balance), 0) ?? 0;
    const fundLimit = accounts?.reduce((sum, a) => sum + Number(a.fund_limit), 0) ?? 500000;
    const latestUpdatedAt = accounts?.[0]?.updated_at ?? new Date().toISOString();

    // Агрегируем балансы по пользователям (с сохранением разбивки по счетам)
    const userBalanceMap = new Map<string, DashboardData['balances'][number]>();
    for (const row of rawBalances || []) {
      const existing = userBalanceMap.get(row.user_id);
      const accountEntry = {
        account_id: row.account_id,
        account_name: row.account?.name ?? 'Счёт',
        available_amount: Number(row.available_amount),
      };

      if (!existing) {
        userBalanceMap.set(row.user_id, {
          user_id: row.user_id,
          available_amount: Number(row.available_amount),
          total_earned: Number(row.total_earned),
          total_withdrawn: Number(row.total_withdrawn),
          by_account: [accountEntry],
          user: row.user ?? null,
        });
      } else {
        existing.available_amount += Number(row.available_amount);
        existing.total_earned += Number(row.total_earned);
        existing.total_withdrawn += Number(row.total_withdrawn);
        existing.by_account.push(accountEntry);
      }
    }

    const balances = Array.from(userBalanceMap.values()).sort(
      (a, b) => b.available_amount - a.available_amount
    );

    const totalIncome = allTransactions
      ?.filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    const totalExpenses = allTransactions
      ?.filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    const totalPayouts = allTransactions
      ?.filter(t => t.type === 'payout')
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    const jobsCount = {
      available: jobs?.filter(j => j.status === 'available').length || 0,
      invoiced: jobs?.filter(j => j.status === 'invoiced').length || 0,
      paid: jobs?.filter(j => j.status === 'paid').length || 0,
    };

    const invoicesCount = {
      draft: invoices?.filter(i => i.status === 'draft').length || 0,
      sent: invoices?.filter(i => i.status === 'sent').length || 0,
      paid: invoices?.filter(i => i.status === 'paid').length || 0,
    };

    return {
      totalBalance: Number(totalBalance ?? 0),
      receivables: Number(receivables ?? 0),
      fund: { current_balance: currentFundBalance, updated_at: latestUpdatedAt },
      fundLimit,
      balances,
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