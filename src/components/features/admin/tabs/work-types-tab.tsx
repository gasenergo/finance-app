'use client';

import { useState } from 'react';
import { Plus, Pencil, Save, X, Archive, RotateCcw } from 'lucide-react';
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
  onAdd: (data: { name: string; default_price: number | null; unit?: string }) => void;
  onUpdate: (id: string, data: { name: string; default_price: number | null; unit?: string; is_archived: boolean }) => void;
  loading: boolean;
}) {
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newUnit, setNewUnit] = useState('шт');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editUnit, setEditUnit] = useState('');

  const resetCreate = () => {
    setNewName('');
    setNewPrice('');
    setNewUnit('шт');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Виды работ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Название"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1 min-w-[160px]"
          />
          <Input
            placeholder="Цена"
            type="number"
            value={newPrice}
            onChange={e => setNewPrice(e.target.value)}
            className="w-28"
          />
          <Input
            placeholder="Ед. изм."
            value={newUnit}
            onChange={e => setNewUnit(e.target.value)}
            className="w-24"
          />
          <Button
            onClick={() => {
              if (newName.trim()) {
                onAdd({
                  name: newName.trim(),
                  default_price: newPrice ? parseFloat(newPrice) : null,
                  unit: newUnit.trim() || 'шт'
                });
                resetCreate();
              }
            }}
            disabled={!newName.trim() || loading}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-gray-500">
          Единица измерения подставляется в акт автоматически (колонка «Ед. изм.») и в форму работы.
        </p>

        <div className="space-y-2">
          {workTypes.map(wt => (
            <div
              key={wt.id}
              className={`flex flex-col md:flex-row md:items-center justify-between gap-2 p-3 rounded-lg border ${
                wt.is_archived ? 'bg-gray-50 opacity-60' : ''
              }`}
            >
              {editingId === wt.id ? (
                <div className="flex flex-wrap items-center gap-2 w-full">
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="flex-1 min-w-[160px]"
                    placeholder="Название"
                  />
                  <Input
                    type="number"
                    value={editPrice}
                    onChange={e => setEditPrice(e.target.value)}
                    className="w-24"
                    placeholder="Цена"
                  />
                  <Input
                    value={editUnit}
                    onChange={e => setEditUnit(e.target.value)}
                    className="w-20"
                    placeholder="Ед. изм."
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      onUpdate(wt.id, {
                        name: editName.trim() || wt.name,
                        default_price: editPrice ? parseFloat(editPrice) : null,
                        unit: editUnit.trim() || 'шт',
                        is_archived: wt.is_archived
                      });
                      setEditingId(null);
                    }}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={wt.is_archived ? 'line-through' : ''}>{wt.name}</span>
                  {wt.default_price != null && (
                    <span className="text-sm text-gray-500">{formatCurrency(wt.default_price)}</span>
                  )}
                  <span className="text-sm text-gray-400">{wt.unit || 'шт'}</span>
                </div>
              )}
              {editingId !== wt.id && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Редактировать"
                    onClick={() => {
                      setEditingId(wt.id);
                      setEditName(wt.name);
                      setEditPrice(wt.default_price?.toString() || '');
                      setEditUnit(wt.unit || '');
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={wt.is_archived ? 'Восстановить' : 'Архивировать'}
                    onClick={() => onUpdate(wt.id, {
                      name: wt.name,
                      default_price: wt.default_price,
                      unit: wt.unit,
                      is_archived: !wt.is_archived
                    })}
                  >
                    {wt.is_archived
                      ? <RotateCcw className="h-4 w-4" />
                      : <Archive className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}