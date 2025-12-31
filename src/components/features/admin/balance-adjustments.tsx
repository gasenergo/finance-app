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
import { giveBonus, returnToCompanyPot } from '@/app/actions/adjustments';

interface UserAdjustmentProps {
  userId: string;
  userName: string;
  userType: 'partner' | 'percentage' | null;
  currentBalance: number;
  freeCash: number;
  fundBalance: number;
  onSuccess?: () => void;
}

export function UserBalanceAdjustments({
  userId,
  userName,
  userType,
  currentBalance,
  freeCash,
  fundBalance,
  onSuccess
}: UserAdjustmentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'bonus' | 'return' | null>(null);
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Расчет лимитов
  const maxLimit = mode === 'bonus' ? fundBalance : currentBalance;

  const handleAction = (actionMode: 'bonus' | 'return') => {
    setMode(actionMode);
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

    if (value > maxLimit) {
      setError(`Превышен лимит (${formatCurrency(maxLimit)})`);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (mode === 'bonus') {
        await giveBonus(userId, value);
      } else {
        await returnToCompanyPot(userId, value);
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

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(val);

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
            <div className="p-3 bg-muted rounded-md text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Доступно:</span>
                <span className="font-medium">{formatCurrency(maxLimit)}</span>
              </div>
              {mode === 'return' && (
                <p className="text-xs text-muted-foreground">
                  Средства будут переведены в фонд компании.
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
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? 'Обработка...' : 'Подтвердить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}