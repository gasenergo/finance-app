// src/components/features/cashflow/cashflow-list.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  Wallet,
  Trash2,
  Filter,
  Calendar,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { createExpense, createPayout, createTransfer, deleteTransaction, getTransactions } from '@/app/actions/cashflow';
import { formatCurrency } from '@/lib/engine/calculations';
import type { TransactionWithRelations } from '@/app/actions/cashflow';
import type { Profile, ExpenseCategory, Account } from '@/types/database';

interface TeamMember {
  id: string;
  full_name: string;
  participant_type: 'partner' | 'percentage' | null;
  percentage_rate: number | null;
  is_active: boolean;
}

interface CashFlowListProps {
  initialTransactions: TransactionWithRelations[];
  categories: ExpenseCategory[];
  members: TeamMember[];
  accounts: Account[];
  currentUser: Profile;
}

const typeConfig = {
  income: {
    label: 'Доход',
    variant: 'success' as const,
    icon: ArrowDownCircle,
    color: 'text-green-600'
  },
  expense: {
    label: 'Расход',
    variant: 'error' as const,
    icon: ArrowUpCircle,
    color: 'text-red-600'
  },
  payout: {
    label: 'Выплата',
    variant: 'info' as const,
    icon: Wallet,
    color: 'text-blue-600'
  },
  transfer: {
    label: 'Перевод',
    variant: 'default' as const,
    icon: ArrowLeftRight,
    color: 'text-amber-600'
  },
};

const months = [
  { value: '1', label: 'Январь' },
  { value: '2', label: 'Февраль' },
  { value: '3', label: 'Март' },
  { value: '4', label: 'Апрель' },
  { value: '5', label: 'Май' },
  { value: '6', label: 'Июнь' },
  { value: '7', label: 'Июль' },
  { value: '8', label: 'Август' },
  { value: '9', label: 'Сентябрь' },
  { value: '10', label: 'Октябрь' },
  { value: '11', label: 'Ноябрь' },
  { value: '12', label: 'Декабрь' },
];

export function CashFlowList({
  initialTransactions,
  categories,
  members,
  accounts,
  currentUser
}: CashFlowListProps) {
  const router = useRouter();
  const defaultAccountId = accounts[0]?.id || '';

  const [transactions, setTransactions] = useState(initialTransactions);
  const [accountFilter, setAccountFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Диалоги
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  // Форма расхода
  const [expenseAccountId, setExpenseAccountId] = useState(defaultAccountId);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  // Форма выплаты
  const [payoutUser, setPayoutUser] = useState('');
  const [payoutEarnedAccountId, setPayoutEarnedAccountId] = useState(defaultAccountId);
  const [payoutPaymentAccountId, setPayoutPaymentAccountId] = useState(defaultAccountId);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutDescription, setPayoutDescription] = useState('');

  // Форма перевода между счетами
  const [transferFromId, setTransferFromId] = useState(accounts[0]?.id || '');
  const [transferToId, setTransferToId] = useState(accounts[1]?.id || '');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDescription, setTransferDescription] = useState('');

  const isAdmin = currentUser.role === 'admin';

  // Перезагрузка транзакций с корректным running_balance при смене фильтра счёта
  useEffect(() => {
    let active = true;
    const load = async () => {
      const selectedAcc = accountFilter === 'all' ? undefined : accountFilter;
      const data = await getTransactions(undefined, undefined, selectedAcc);
      if (active) setTransactions(data);
    };
    load();
    return () => { active = false; };
  }, [accountFilter, initialTransactions]);

  // Фильтрация по типу и месяцу
  const filteredTransactions = transactions.filter(tx => {
    const matchType = typeFilter === 'all' || tx.type === typeFilter;
    const matchMonth = monthFilter === 'all' ||
      new Date(tx.date).getMonth() + 1 === parseInt(monthFilter);
    return matchType && matchMonth;
  });

  // Статистика
  const totals = transactions.reduce((acc, tx) => {
    if (tx.type === 'income') acc.income += Number(tx.amount);
    else if (tx.type === 'expense') acc.expense += Number(tx.amount);
    else if (tx.type === 'payout') acc.payout += Number(tx.amount);
    return acc;
  }, { income: 0, expense: 0, payout: 0 });

  const handleCreateExpense = async () => {
    if (!expenseAccountId || !expenseCategory || !expenseAmount) {
      setError('Заполните все поля');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createExpense({
        account_id: expenseAccountId,
        date: expenseDate,
        category_id: expenseCategory,
        description: expenseDescription,
        amount: parseFloat(expenseAmount)
      });

      setExpenseOpen(false);
      resetExpenseForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayout = async () => {
    if (!payoutUser || !payoutEarnedAccountId || !payoutPaymentAccountId || !payoutAmount) {
      setError('Заполните все поля');
      return;
    }

    setLoading(true);
    setError('');

    const result = await createPayout({
      user_id: payoutUser,
      earned_account_id: payoutEarnedAccountId,
      payment_account_id: payoutPaymentAccountId,
      amount: parseFloat(payoutAmount),
      description: payoutDescription || undefined
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (result.data) {
      setPayoutOpen(false);
      resetPayoutForm();
      router.refresh();
    }

    setLoading(false);
  };

  const handleCreateTransfer = async () => {
    if (!transferFromId || !transferToId || !transferAmount) {
      setError('Заполните все поля');
      return;
    }

    setLoading(true);
    setError('');

    const result = await createTransfer({
      from_account_id: transferFromId,
      to_account_id: transferToId,
      amount: parseFloat(transferAmount),
      date: transferDate,
      description: transferDescription || undefined
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setTransferOpen(false);
    resetTransferForm();
    router.refresh();
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить транзакцию? Если операция связана с межфилиальной выплатой, будут отменены обе проводки.')) return;

    setLoading(true);
    try {
      await deleteTransaction(id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const resetExpenseForm = () => {
    setExpenseAccountId(accountFilter !== 'all' ? accountFilter : defaultAccountId);
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setExpenseCategory('');
    setExpenseDescription('');
    setExpenseAmount('');
  };

  const resetPayoutForm = () => {
    const activeAcc = accountFilter !== 'all' ? accountFilter : defaultAccountId;
    setPayoutUser('');
    setPayoutEarnedAccountId(activeAcc);
    setPayoutPaymentAccountId(activeAcc);
    setPayoutAmount('');
    setPayoutDescription('');
  };

  const resetTransferForm = () => {
    setTransferFromId(accounts[0]?.id || '');
    setTransferToId(accounts[1]?.id || '');
    setTransferDate(new Date().toISOString().split('T')[0]);
    setTransferAmount('');
    setTransferDescription('');
  };

  const expenseCategories = categories.filter(c => !c.is_system);

  const getAmountPrefix = (tx: TransactionWithRelations) => {
    if (tx.type === 'income') return '+';
    if (tx.type === 'transfer') {
      if (accountFilter !== 'all') {
        return tx.target_account_id === accountFilter ? '+' : '-';
      }
      return '⇄ ';
    }
    return '-';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Движение денежных средств</h1>
          <p className="text-sm text-gray-500 mt-1">
            Доходы: {formatCurrency(totals.income)} •
            Расходы: {formatCurrency(totals.expense)} •
            Выплаты: {formatCurrency(totals.payout)}
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            {accounts.length > 1 && (
              <Button variant="outline" onClick={() => { setError(''); setTransferOpen(true); }}>
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                Перевод
              </Button>
            )}
            <Button variant="outline" onClick={() => { setError(''); resetExpenseForm(); setExpenseOpen(true); }}>
              <ArrowUpCircle className="h-4 w-4 mr-2" />
              Расход
            </Button>
            <Button onClick={() => { setError(''); resetPayoutForm(); setPayoutOpen(true); }}>
              <Wallet className="h-4 w-4 mr-2" />
              Выплата
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {accounts.length > 1 && (
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-[210px]">
              <Building2 className="h-4 w-4 mr-2 text-gray-400" />
              <SelectValue placeholder="Счёт" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все счета (студия)</SelectItem>
              {accounts.map(acc => (
                <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2 text-gray-400" />
            <SelectValue placeholder="Тип" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все типы</SelectItem>
            <SelectItem value="income">Доходы</SelectItem>
            <SelectItem value="expense">Расходы</SelectItem>
            <SelectItem value="payout">Выплаты</SelectItem>
            <SelectItem value="transfer">Переводы</SelectItem>
          </SelectContent>
        </Select>

        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-[160px]">
            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
            <SelectValue placeholder="Месяц" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все месяцы</SelectItem>
            {months.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Transactions List */}
      {filteredTransactions.length === 0 ? (
        <EmptyState
          icon={ArrowDownCircle}
          title="Нет транзакций"
          description="Транзакции появятся после оплаты актов"
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Дата</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Тип</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Счёт</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Описание</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Сумма</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Баланс</th>
                      {isAdmin && <th className="w-10"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((tx) => {
                      const config = typeConfig[tx.type];
                      const Icon = config.icon;

                      return (
                        <tr key={tx.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm">
                            {new Date(tx.date).toLocaleDateString('ru-RU')}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={config.variant}>
                              <Icon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-600">
                            {tx.type === 'transfer' && tx.target_account
                              ? `${tx.account?.name || 'Счёт'} → ${tx.target_account.name}`
                              : tx.account?.name || '—'}
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="text-sm font-medium">
                                {tx.description || tx.category?.name || '—'}
                              </p>
                              {tx.related_user && (
                                <p className="text-xs text-gray-500">
                                  {tx.related_user.full_name}
                                </p>
                              )}
                              {tx.invoice && (
                                <p className="text-xs text-gray-500">
                                  Акт №{tx.invoice.invoice_number}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className={`py-3 px-4 text-right font-medium ${config.color}`}>
                            {getAmountPrefix(tx)}{formatCurrency(tx.amount)}
                          </td>
                          <td className="py-3 px-4 text-right text-sm text-gray-600">
                            {tx.running_balance !== undefined && formatCurrency(tx.running_balance)}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4">
                              {!tx.related_invoice_id && (
                                <button
                                  onClick={() => handleDelete(tx.id)}
                                  className="p-1 text-gray-400 hover:text-red-500"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredTransactions.map((tx) => {
              const config = typeConfig[tx.type];
              const Icon = config.icon;

              return (
                <Card key={tx.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${
                          tx.type === 'income' ? 'bg-green-100' :
                          tx.type === 'expense' ? 'bg-red-100' :
                          tx.type === 'transfer' ? 'bg-amber-100' : 'bg-blue-100'
                        }`}>
                          <Icon className={`h-4 w-4 ${config.color}`} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {tx.description || tx.category?.name || config.label}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(tx.date).toLocaleDateString('ru-RU')} •{' '}
                            {tx.type === 'transfer' && tx.target_account
                              ? `${tx.account?.name} → ${tx.target_account.name}`
                              : tx.account?.name}
                          </p>
                        </div>
                      </div>
                      {isAdmin && !tx.related_invoice_id && (
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex justify-between items-end">
                      <div>
                        {tx.related_user && (
                          <p className="text-xs text-gray-500">{tx.related_user.full_name}</p>
                        )}
                        {tx.invoice && (
                          <p className="text-xs text-gray-500">Акт №{tx.invoice.invoice_number}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${config.color}`}>
                          {getAmountPrefix(tx)}{formatCurrency(tx.amount)}
                        </p>
                        {tx.running_balance !== undefined && (
                          <p className="text-xs text-gray-500">
                            Баланс: {formatCurrency(tx.running_balance)}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Expense Dialog */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый расход</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Счёт списания (фонд)</label>
              <Select value={expenseAccountId} onValueChange={setExpenseAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите счёт" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} (фонд: {formatCurrency(acc.current_fund_balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Дата</label>
              <Input
                type="date"
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Категория</label>
              <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Описание</label>
              <Input
                value={expenseDescription}
                onChange={e => setExpenseDescription(e.target.value)}
                placeholder="Подписка на Figma"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Сумма</label>
              <Input
                type="number"
                value={expenseAmount}
                onChange={e => setExpenseAmount(e.target.value)}
                placeholder="1000"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseOpen(false)}>Отмена</Button>
            <Button
              onClick={handleCreateExpense}
              loading={loading}
              disabled={!expenseAccountId || !expenseCategory || !expenseAmount}
            >
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payout Dialog */}
      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Выплата участнику</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5">Участник</label>
              <Select value={payoutUser} onValueChange={setPayoutUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите участника" />
                </SelectTrigger>
                <SelectContent>
                  {members.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Филиал начисления (откуда заработано)</label>
              <Select
                value={payoutEarnedAccountId}
                onValueChange={(val) => {
                  setPayoutEarnedAccountId(val);
                  setPayoutPaymentAccountId(val);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите филиал" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {accounts.length > 1 && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Счёт физического списания</label>
                <Select value={payoutPaymentAccountId} onValueChange={setPayoutPaymentAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите счёт списания" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {payoutEarnedAccountId !== payoutPaymentAccountId && (
                  <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded mt-1.5">
                    Счета различаются: система автоматически зафиксирует внутренний заём между филиалами.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5">Сумма</label>
              <Input
                type="number"
                value={payoutAmount}
                onChange={e => setPayoutAmount(e.target.value)}
                placeholder="50000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Комментарий (опционально)</label>
              <Input
                value={payoutDescription}
                onChange={e => setPayoutDescription(e.target.value)}
                placeholder="Аванс за май"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutOpen(false)}>Отмена</Button>
            <Button
              onClick={handleCreatePayout}
              loading={loading}
              disabled={!payoutUser || !payoutEarnedAccountId || !payoutPaymentAccountId || !payoutAmount}
            >
              Выплатить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Перевод между счетами</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5">Со счёта</label>
              <Select value={transferFromId} onValueChange={setTransferFromId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите счёт списания" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">На счёт</label>
              <Select value={transferToId} onValueChange={setTransferToId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите счёт зачисления" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Дата</label>
              <Input
                type="date"
                value={transferDate}
                onChange={e => setTransferDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Сумма</label>
              <Input
                type="number"
                value={transferAmount}
                onChange={e => setTransferAmount(e.target.value)}
                placeholder="30000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Комментарий</label>
              <Input
                value={transferDescription}
                onChange={e => setTransferDescription(e.target.value)}
                placeholder="Возврат межфилиального долга"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Отмена</Button>
            <Button
              onClick={handleCreateTransfer}
              loading={loading}
              disabled={!transferFromId || !transferToId || !transferAmount || transferFromId === transferToId}
            >
              Перевести
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}