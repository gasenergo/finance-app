'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { ExpenseCategory } from '@/types/database';

export function CategoriesTab({
  categories,
  onAdd,
  onDelete,
  loading
}: {
  categories: ExpenseCategory[];
  onAdd: (name: string) => void;
  onDelete: (id: string) => void;
  loading: boolean;
}) {
  const [newName, setNewName] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Категории расходов</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Название категории"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <Button
            onClick={() => {
              if (newName.trim()) {
                onAdd(newName.trim());
                setNewName('');
              }
            }}
            disabled={!newName.trim() || loading}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {categories.map(cat => (
            <div
              key={cat.id}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div className="flex items-center gap-2">
                <span>{cat.name}</span>
                {cat.is_system && (
                  <Badge variant="default">Системная</Badge>
                )}
              </div>
              {!cat.is_system && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm('Удалить категорию?')) {
                      onDelete(cat.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
