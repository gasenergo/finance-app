// src/components/features/cashflow/cashflow-list.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Wallet,
  Plus,
  Trash2,
  Filter,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { createExpense, createPayout, deleteTransaction } from '@/app/actions/cashflow';
import { formatCurrency } from '@/lib/engine/calculations';
import type { TransactionWithRelations } from '@/app/actions/cashflow';
import type { Profile, ExpenseCategory } from '@/types/database';

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
  currentUser 
}: CashFlowListProps) {
  const router = useRouter();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [typeFilter, setTypeFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Диалоги
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  
  // Форма расхода
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  
  // Форма выплаты
  const [payoutUser, setPayoutUser] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutDescription, setPayoutDescription] = useState('');

  const isAdmin = currentUser.role === 'admin';

  // Фильтрация
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
    else acc.payout += Number(tx.amount);
    return acc;
  }, { income: 0, expense: 0, payout: 0 });

  const handleCreateExpense = async () => {
    if (!expenseCategory || !expenseAmount) {
      setError('Заполните все поля');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const newTx = await createExpense({
        date: expenseDate,
        category_id: expenseCategory,
        description: expenseDescription,
        amount: parseFloat(expenseAmount)
      });
      
      setTransactions(prev => [newTx, ...prev]);
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
    if (!payoutUser || !payoutAmount) {
      setError('Заполните все поля');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const newTx = await createPayout({
        user_id: payoutUser,
        amount: parseFloat(payoutAmount),
        description: payoutDescription || undefined
      });
      
      setTransactions(prev => [newTx, ...prev]);
      setPayoutOpen(false);
      resetPayoutForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить транзакцию? Это действие нельзя отменить.')) return;
    
    setLoading(true);
    try {
      await deleteTransaction(id);
      setTransactions(prev => prev.filter(tx => tx.id !== id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const resetExpenseForm = () => {
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setExpenseCategory('');
    setExpenseDescription('');
    setExpenseAmount('');
  };

  const resetPayoutForm = () => {
    setPayoutUser('');
    setPayoutAmount('');
    setPayoutDescription('');
  };

  // Не-системные категории для расходов
  const expenseCategories = categories.filter(c => !c.is_system);

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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setExpenseOpen(true)}>
              <ArrowUpCircle className="h-4 w-4 mr-2" />
              Расход
            </Button>
            <Button onClick={() => setPayoutOpen(true)}>
              <Wallet className="h-4 w-4 mr-2" />
              Выплата
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
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
          description="Транзакции появятся после оплаты счетов"
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
                                  {tx.invoice.invoice_number}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className={`py-3 px-4 text-right font-medium ${config.color}`}>
                            {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
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
                          tx.type === 'expense' ? 'bg-red-100' : 'bg-blue-100'
                        }`}>
                          <Icon className={`h-4 w-4 ${config.color}`} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {tx.description || tx.category?.name || config.label}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(tx.date).toLocaleDateString('ru-RU')}
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
                          <p className="text-xs text-gray-500">{tx.invoice.invoice_number}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${config.color}`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
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
              disabled={!expenseCategory || !expenseAmount}
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
              disabled={!payoutUser || !payoutAmount}
            >
              Выплатить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}