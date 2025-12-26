// src/components/features/dashboard/dashboard-content.tsx
'use client';

import { 
  Wallet, 
  Clock, 
  PiggyBank, 
  TrendingUp, 
  TrendingDown,
  ArrowRightLeft,
  Briefcase,
  FileText,
  Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/engine/calculations';
import type { DashboardData } from '@/app/actions/dashboard';
import type { Profile } from '@/types/database';

interface DashboardContentProps {
  data: DashboardData;
  currentUser: Profile;
}

export function DashboardContent({ data, currentUser }: DashboardContentProps) {
  const { 
    totalBalance, 
    receivables, 
    fund, 
    fundLimit, 
    balances, 
    recentTransactions,
    stats 
  } = data;

  const fundPercentage = Math.min((fund.current_balance / fundLimit) * 100, 100);
  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Дашборд</h1>
        <p className="text-gray-500 mt-1">Обзор финансов студии</p>
      </div>

      {/* Основные метрики */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Общий баланс"
          value={formatCurrency(totalBalance)}
          icon={Wallet}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        
        <MetricCard
          title="Ожидаем оплату"
          value={formatCurrency(receivables)}
          icon={Clock}
          iconColor="text-yellow-600"
          iconBg="bg-yellow-100"
          subtitle={`${stats.invoicesCount.sent} счетов`}
        />
        
        <MetricCard
          title="Доходы"
          value={formatCurrency(stats.totalIncome)}
          icon={TrendingUp}
          iconColor="text-green-600"
          iconBg="bg-green-100"
        />
        
        <MetricCard
          title="Расходы"
          value={formatCurrency(stats.totalExpenses + stats.totalPayouts)}
          icon={TrendingDown}
          iconColor="text-red-600"
          iconBg="bg-red-100"
        />
      </div>

      {/* Фонд */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <PiggyBank className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium">Резервный фонд</h3>
                <p className="text-sm text-gray-500">
                  Накопления на непредвиденные расходы
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{formatCurrency(fund.current_balance)}</p>
              <p className="text-sm text-gray-500">из {formatCurrency(fundLimit)}</p>
            </div>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                fundPercentage >= 100 
                  ? 'bg-green-500' 
                  : fundPercentage >= 50 
                    ? 'bg-blue-500' 
                    : 'bg-yellow-500'
              }`}
              style={{ width: `${fundPercentage}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {fundPercentage >= 100 
              ? '✓ Фонд заполнен' 
              : `${fundPercentage.toFixed(1)}% от лимита`}
          </p>
        </CardContent>
      </Card>

      {/* Статистика работ и счетов */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-gray-400" />
              Работы
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <StatRow 
                label="Свободные" 
                value={stats.jobsCount.available} 
                variant="success" 
              />
              <StatRow 
                label="В счетах" 
                value={stats.jobsCount.invoiced} 
                variant="warning" 
              />
              <StatRow 
                label="Оплаченные" 
                value={stats.jobsCount.paid} 
                variant="info" 
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-400" />
              Счета
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <StatRow 
                label="Черновики" 
                value={stats.invoicesCount.draft} 
                variant="default" 
              />
              <StatRow 
                label="Выставлены" 
                value={stats.invoicesCount.sent} 
                variant="warning" 
              />
              <StatRow 
                label="Оплачены" 
                value={stats.invoicesCount.paid} 
                variant="success" 
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Балансы команды */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-400" />
            Балансы команды
          </CardTitle>
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Нет данных о балансах
            </p>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                        Участник
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                        Роль
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                        Заработано
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                        Выведено
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                        Доступно
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((balance) => (
                      <tr 
                        key={balance.user_id} 
                        className={`border-b border-gray-100 ${
                          balance.user_id === currentUser.id ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {balance.user?.full_name}
                            </span>
                            {balance.user_id === currentUser.id && (
                              <Badge variant="info">Вы</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={balance.user?.participant_type === 'partner' ? 'default' : 'warning'}>
                            {balance.user?.participant_type === 'partner' 
                              ? 'Партнёр' 
                              : `${balance.user?.percentage_rate}%`}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {formatCurrency(balance.total_earned)}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {formatCurrency(balance.total_withdrawn)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-green-600">
                          {formatCurrency(balance.available_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {balances.map((balance) => (
                  <div
                    key={balance.user_id}
                    className={`p-4 rounded-lg border ${
                      balance.user_id === currentUser.id 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {balance.user?.full_name}
                        </span>
                        {balance.user_id === currentUser.id && (
                          <Badge variant="info">Вы</Badge>
                        )}
                      </div>
                      <Badge variant={balance.user?.participant_type === 'partner' ? 'default' : 'warning'}>
                        {balance.user?.participant_type === 'partner' 
                          ? 'Партнёр' 
                          : `${balance.user?.percentage_rate}%`}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-gray-500">Заработано</p>
                        <p className="font-medium">{formatCurrency(balance.total_earned)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Выведено</p>
                        <p className="font-medium">{formatCurrency(balance.total_withdrawn)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Доступно</p>
                        <p className="font-semibold text-green-600">
                          {formatCurrency(balance.available_amount)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Последние транзакции */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-gray-400" />
            Последние операции
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Нет операций
            </p>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((tx) => (
                <div 
                  key={tx.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      tx.type === 'income' 
                        ? 'bg-green-100' 
                        : tx.type === 'payout'
                          ? 'bg-blue-100'
                          : 'bg-red-100'
                    }`}>
                      {tx.type === 'income' ? (
                        <TrendingUp className={`h-4 w-4 text-green-600`} />
                      ) : tx.type === 'payout' ? (
                        <Wallet className={`h-4 w-4 text-blue-600`} />
                      ) : (
                        <TrendingDown className={`h-4 w-4 text-red-600`} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {tx.description || tx.category?.name || 'Без описания'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(tx.date).toLocaleDateString('ru-RU')}
                        {tx.related_user && ` • ${tx.related_user.full_name}`}
                      </p>
                    </div>
                  </div>
                  <span className={`font-semibold ${
                    tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Вспомогательные компоненты

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  subtitle?: string;
}

function MetricCard({ title, value, icon: Icon, iconColor, iconBg, subtitle }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-4 lg:p-6">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-500 truncate">{title}</p>
            <p className="text-xl lg:text-2xl font-bold mt-1 truncate">{value}</p>
            {subtitle && (
              <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`p-2 lg:p-3 rounded-lg ${iconBg} shrink-0 ml-2`}>
            <Icon className={`h-5 w-5 lg:h-6 lg:w-6 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatRowProps {
  label: string;
  value: number;
  variant: 'default' | 'success' | 'warning' | 'info' | 'error';
}

function StatRow({ label, value, variant }: StatRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <Badge variant={variant}>{value}</Badge>
    </div>
  );
}