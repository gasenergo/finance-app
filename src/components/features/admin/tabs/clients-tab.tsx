'use client';

import { useState } from 'react';
import { Edit, Plus, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { Client } from '@/types/database';

export function ClientsTab({
  clients,
  onAdd,
  onUpdate,
  loading,
  defaultTaxRate
}: {
  clients: Client[];
  onAdd: (name: string, taxRate: number | null) => void;
  onUpdate: (id: string, data: { name: string; tax_rate: number | null; is_archived: boolean }) => void;
  loading: boolean;
  defaultTaxRate: number;
}) {
  const [newName, setNewName] = useState('');
  const [newTaxRate, setNewTaxRate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTaxRate, setEditTaxRate] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Клиенты (контрагенты)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Название клиента"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1"
          />
          <div className="relative w-32">
            <Input
              type="number"
              placeholder={`${defaultTaxRate}%`}
              value={newTaxRate}
              onChange={e => setNewTaxRate(e.target.value)}
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
          </div>
          <Button
            onClick={() => {
              if (newName.trim()) {
                onAdd(
                  newName.trim(),
                  newTaxRate ? parseFloat(newTaxRate) : null
                );
                setNewName('');
                setNewTaxRate('');
              }
            }}
            disabled={!newName.trim() || loading}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-gray-500">
          Если не указать ставку — будет использоваться {defaultTaxRate}% из настроек
        </p>

        <div className="space-y-2">
          {clients.map(client => (
            <div
              key={client.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                client.is_archived ? 'bg-gray-50 opacity-60' : ''
              }`}
            >
              {editingId === client.id ? (
                <div className="flex gap-2 flex-1">
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="flex-1"
                    placeholder="Название"
                  />
                  <div className="relative w-24">
                    <Input
                      type="number"
                      value={editTaxRate}
                      onChange={e => setEditTaxRate(e.target.value)}
                      className="pr-8"
                      placeholder={`${defaultTaxRate}`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      onUpdate(client.id, {
                        name: editName,
                        tax_rate: editTaxRate ? parseFloat(editTaxRate) : null,
                        is_archived: client.is_archived
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
                <>
                  <div className="flex items-center gap-3">
                    <span className={client.is_archived ? 'line-through' : ''}>
                      {client.name}
                    </span>
                    <Badge variant={client.tax_rate ? 'warning' : 'default'}>
                      {client.tax_rate ?? defaultTaxRate}%
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingId(client.id);
                        setEditName(client.name);
                        setEditTaxRate(client.tax_rate?.toString() || '');
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onUpdate(client.id, {
                        name: client.name,
                        tax_rate: client.tax_rate,
                        is_archived: !client.is_archived
                      })}
                    >
                      {client.is_archived ? '🔄' : '📦'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
