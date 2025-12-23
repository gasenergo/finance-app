'use client';

import { Wallet, Clock, PiggyBank, Users, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/engine/calculations';

interface DashboardData {
  totalBalance: number;
  receivables: number;
  fund: { current_balance: number };
  fundLimit: number;
  balances: Array<{
    user_id: string;
    available_amount: number;
    user: {
      full_name: string;
      participant_type: string;
      percentage_rate: number | null;
    };
  }>;
  recentTransactions: Array<{
    id: string;
    date: string;
    type: string;
    description: string;
    amount: number;
  }>;
}

export function DashboardContent({ data }: { data: DashboardData }) {
  const fundPercentage = Math.min((data.fund.current_balance / data.fundLimit) * 100, 100);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Дашборд</h1>

      {/* Виджеты */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Общий баланс</p>
                <p className="text-2xl font-bold">{formatCurrency(data.totalBalance)}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Wallet className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Дебиторка</p>
                <p className="text-2xl font-bold">{formatCurrency(data.receivables)}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <PiggyBank className="h-5 w-5 text-blue-600" />
                <span className="text-sm text-gray-500">Резервный фонд</span>
              </div>
              <span className="text-sm font-medium">
                {formatCurrency(data.fund.current_balance)} / {formatCurrency(data.fundLimit)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all" 
                style={{ width: `${fundPercentage}%` }} 
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Балансы команды */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Балансы команды
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.balances.map((balance) => (
              <div 
                key={balance.user_id} 
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium">
                      {balance.user.full_name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{balance.user.full_name}</p>
                    <Badge variant={balance.user.participant_type === 'partner' ? 'info' : 'default'}>
                      {balance.user.participant_type === 'partner'
                        ? 'Партнёр'
                        : `Процентник (${balance.user.percentage_rate}%)`}
                    </Badge>
                  </div>
                </div>
                <p className="text-lg font-semibold">{formatCurrency(balance.available_amount)}</p>
              </div>
            ))}
            {data.balances.length === 0 && (
              <p className="text-center text-gray-500 py-4">Нет участников</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Последние операции */}
      <Card>
        <CardHeader>
          <CardTitle>Последние операции</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    tx.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {tx.type === 'income' ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{tx.description}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(tx.date).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                </div>
                <p className={`font-semibold ${
                  tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                </p>
              </div>
            ))}
            {data.recentTransactions.length === 0 && (
              <p className="text-center text-gray-500 py-4">Нет операций</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}