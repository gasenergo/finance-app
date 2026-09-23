'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/engine/calculations';
import { UserBalanceAdjustments } from '../balance-adjustments';
import { FreeCashCard } from '../free-cash-card';
import { getFreeCashAmount, getFundBalance } from '@/app/actions/adjustments';
import type { TeamMember } from '@/types/database';

export function FreeCashTab({
  team,
  onSuccess
}: {
  team: TeamMember[];
  onSuccess: () => void;
}) {
  const [freeCash, setFreeCash] = useState(0);
  const [fundBalance, setFundBalance] = useState(0);
  const [, setLoading] = useState(true);

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
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustmentSuccess = () => {
    fetchData();
    onSuccess();
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FreeCashCard amount={freeCash} />

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6 flex flex-col gap-1">
            <span className="text-sm font-medium text-blue-800">
              Баланс фонда
            </span>
            <span className="text-2xl font-bold text-blue-900">
              {formatCurrency(fundBalance)}
            </span>
            <p className="text-xs text-blue-600 mt-2">
              Резерв на развитие и налоги
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Корректировка балансов участников</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {team
              .filter(user => user.is_active)
              .map(user => (
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
                      {user.balance && user.balance[0] && (
                        <p className="text-sm text-gray-500 mt-1">
                          Баланс: {formatCurrency(user.balance[0].available_amount)}
                        </p>
                      )}
                    </div>
                    <UserBalanceAdjustments
                      userId={user.id}
                      userName={user.full_name}
                      currentBalance={user.balance?.[0]?.available_amount || 0}
                      fundBalance={fundBalance}
                      onSuccess={handleAdjustmentSuccess}
                    />
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
