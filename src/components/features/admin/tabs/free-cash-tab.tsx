// src/components/features/admin/tabs/free-cash-tab.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/engine/calculations';
import { UserBalanceAdjustments } from '../balance-adjustments';
import { FreeCashCard } from '../free-cash-card';
import { getFreeCashAmount, getFundBalance } from '@/app/actions/adjustments';
import type { TeamMember, Account } from '@/types/database';

export function FreeCashTab({
  team,
  accounts,
  onSuccess
}: {
  team: TeamMember[];
  accounts: Account[];
  onSuccess: () => void;
}) {
  const [freeCash, setFreeCash] = useState(0);
  const [fundBalance, setFundBalance] = useState(0);

  const fetchData = async () => {
    try {
      const [freeCashAmount, fundAmount] = await Promise.all([
        getFreeCashAmount(),
        getFundBalance()
      ]);
      setFreeCash(freeCashAmount);
      setFundBalance(fundAmount);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const handleAdjustmentSuccess = () => {
    fetchData();
    onSuccess();
  };

  useEffect(() => {
    fetchData();
  }, [accounts]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FreeCashCard amount={freeCash} />

        {accounts.map(acc => (
          <Card key={acc.id} className="bg-blue-50 border-blue-200">
            <CardContent className="p-6 flex flex-col gap-1">
              <span className="text-sm font-medium text-blue-800">
                Фонд: {acc.name}
              </span>
              <span className="text-2xl font-bold text-blue-900">
                {formatCurrency(acc.current_fund_balance)}
              </span>
              <p className="text-xs text-blue-600 mt-2">
                Лимит: {formatCurrency(acc.fund_limit)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Корректировка балансов участников</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {team
              .filter(user => user.is_active)
              .map(user => {
                const userBalances = user.balance || [];
                const totalAvailable = userBalances.reduce((s, b) => s + Number(b.available_amount), 0);

                const accountInfos = accounts.map(acc => {
                  const found = userBalances.find(b => b.account_id === acc.id);
                  return {
                    account_id: acc.id,
                    account_name: acc.name,
                    available_amount: Number(found?.available_amount ?? 0),
                    fund_balance: Number(acc.current_fund_balance),
                  };
                });

                return (
                  <div
                    key={user.id}
                    className="p-4 rounded-lg border bg-white"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.full_name}</span>
                          <Badge variant={user.role === 'admin' ? 'info' : 'default'}>
                            {user.role === 'admin' ? 'Админ' : 'Юзер'}
                          </Badge>
                          {user.participant_type && (
                            <Badge variant={user.participant_type === 'partner' ? 'success' : 'warning'}>
                              {user.participant_type === 'partner' ? 'Партнёр' : `${user.percentage_rate}%`}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 font-medium mt-1">
                          Общий баланс: {formatCurrency(totalAvailable)}
                        </p>
                        {accountInfos.length > 1 && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {accountInfos
                              .map(a => `${a.account_name}: ${formatCurrency(a.available_amount)}`)
                              .join(' • ')}
                          </p>
                        )}
                      </div>
                      <UserBalanceAdjustments
                        userId={user.id}
                        userName={user.full_name}
                        currentBalance={totalAvailable}
                        fundBalance={fundBalance}
                        accounts={accountInfos}
                        onSuccess={handleAdjustmentSuccess}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}