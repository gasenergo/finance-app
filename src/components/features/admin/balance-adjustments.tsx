// src/components/features/admin/balance-adjustments.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { giveBonus, returnToCompanyPot } from '@/app/actions/adjustments';
import { formatCurrency } from '@/lib/engine/calculations';

interface AccountBalanceInfo {
  account_id: string;
  account_name: string;
  available_amount: number;
  fund_balance: number;
}

interface UserAdjustmentProps {
  userId: string;
  userName: string;
  currentBalance: number;
  fundBalance: number;
  accounts?: AccountBalanceInfo[];
  onSuccess?: () => void;
}

export function UserBalanceAdjustments({
  userId,
  userName,
  currentBalance,
  fundBalance,
  accounts = [],
  onSuccess
}: UserAdjustmentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'bonus' | 'return' | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.account_id || '');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const activeAccount = accounts.find(a => a.account_id === selectedAccountId);
  const effectiveFundBalance = activeAccount ? activeAccount.fund_balance : fundBalance;
  const effectiveUserBalance = activeAccount ? activeAccount.available_amount : currentBalance;

  const maxLimit = mode === 'bonus' ? effectiveFundBalance : effectiveUserBalance;

  const handleAction = (actionMode: 'bonus' | 'return') => {
    setMode(actionMode);
    if (!selectedAccountId && accounts.length > 0) {
      setSelectedAccountId(accounts[0].account_id);
    }
    setAmount('');
    setError('');
    setIsOpen(true);
  };

  const handleSubmit = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      setError('Введите сумму');
      return;
    }

    if (!selectedAccountId) {
      setError('Выберите счёт (филиал)');
      return;
    }

    if (value > maxLimit) {
      setError(`Превышен лимит (${formatCurrency(maxLimit)})`);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (mode === 'bonus') {
        await giveBonus(userId, value, selectedAccountId);
      } else {
        await returnToCompanyPot(userId, value, selectedAccountId);
      }
      onSuccess?.();
      setIsOpen(false);
      setMode(null);
    } catch (e) {
      setError((e as Error).message || 'Произошла ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex gap-2 mt-2">
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
          onClick={() => handleAction('bonus')}
        >
          + Премия
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7 border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
          onClick={() => handleAction('return')}
        >
          - В фонд
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === 'bonus' ? `Выписать премию: ${userName}` : `Вернуть в фонд: ${userName}`}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {accounts.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Расчётный счёт (филиал)</label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите счёт" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(acc => (
                      <SelectItem key={acc.account_id} value={acc.account_id}>
                        {acc.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="p-3 bg-muted rounded-md text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Доступно:</span>
                <span className="font-medium">{formatCurrency(maxLimit)}</span>
              </div>
              {mode === 'return' && (
                <p className="text-xs text-muted-foreground">
                  Средства будут переведены в фонд выбранного счёта.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Сумма</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                autoFocus
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Отмена</Button>
            <Button onClick={handleSubmit} disabled={isLoading || !selectedAccountId}>
              {isLoading ? 'Обработка...' : 'Подтвердить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}