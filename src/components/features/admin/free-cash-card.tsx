'use client';

import { Card } from '@/components/ui/card';

interface FreeCashCardProps {
  amount: number;
}

export function FreeCashCard({ amount }: FreeCashCardProps) {
  return (
    <Card className="p-6 bg-emerald-50 border-emerald-200">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-emerald-800">
          Нераспределенная прибыль
        </span>
        <span className="text-2xl font-bold text-emerald-900">
          {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(amount)}
        </span>
        <p className="text-xs text-emerald-600 mt-2">
          Доступно для бонусов и развития
        </p>
      </div>
    </Card>
  );
}