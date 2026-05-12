'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/engine/calculations';
import type { WorkType } from '@/types/database';

export function WorkTypesTab({
  workTypes,
  onAdd,
  onUpdate,
  loading
}: {
  workTypes: WorkType[];
  onAdd: (data: { name: string; default_price: number | null }) => void;
  onUpdate: (id: string, data: { name: string; default_price: number | null; is_archived: boolean }) => void;
  loading: boolean;
}) {
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Виды работ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Название"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1"
          />
          <div className="relative w-32">
            <Input
              placeholder="Цена"
              type="number"
              value={newPrice}
              onChange={e => setNewPrice(e.target.value)}
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₽</span>
          </div>
          <Button
            onClick={() => {
              if (newName.trim()) {
                onAdd({
                  name: newName.trim(),
                  default_price: newPrice ? parseFloat(newPrice) : null
                });
                setNewName('');
                setNewPrice('');
              }
            }}
            disabled={!newName.trim() || loading}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {workTypes.map(wt => (
            <div
              key={wt.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                wt.is_archived ? 'bg-gray-50 opacity-60' : ''
              }`}
            >
              <div>
                <span className={wt.is_archived ? 'line-through' : ''}>{wt.name}</span>
                {wt.default_price && (
                  <span className="text-sm text-gray-500 ml-2">
                    {formatCurrency(wt.default_price)}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onUpdate(wt.id, {
                  name: wt.name,
                  default_price: wt.default_price,
                  is_archived: !wt.is_archived
                })}
              >
                {wt.is_archived ? '🔄' : '📦'}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
