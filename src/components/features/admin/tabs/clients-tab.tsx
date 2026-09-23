'use client';

import { useState } from 'react';
import { Edit, Plus, Save, X, Archive, RotateCcw } from 'lucide-react';
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
  onAdd: (name: string, taxRate: number | null, inn: string | null, directorName: string | null) => void;
  onUpdate: (id: string, data: { name: string; inn: string | null; director_name: string | null; tax_rate: number | null; is_archived: boolean }) => void;
  loading: boolean;
  defaultTaxRate: number;
}) {
  const [newName, setNewName] = useState('');
  const [newInn, setNewInn] = useState('');
  const [newDirector, setNewDirector] = useState('');
  const [newTaxRate, setNewTaxRate] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editInn, setEditInn] = useState('');
  const [editDirector, setEditDirector] = useState('');
  const [editTaxRate, setEditTaxRate] = useState('');

  const resetCreate = () => {
    setNewName('');
    setNewInn('');
    setNewDirector('');
    setNewTaxRate('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Клиенты (контрагенты)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Название клиента"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={() => {
                if (newName.trim()) {
                  onAdd(
                    newName.trim(),
                    newTaxRate ? parseFloat(newTaxRate) : null,
                    newInn.trim() || null,
                    newDirector.trim() || null
                  );
                  resetCreate();
                }
              }}
              disabled={!newName.trim() || loading}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="ИНН"
              value={newInn}
              onChange={e => setNewInn(e.target.value)}
              className="w-40"
            />
            <Input
              placeholder="Руководитель (ФИО)"
              value={newDirector}
              onChange={e => setNewDirector(e.target.value)}
              className="flex-1 min-w-[180px]"
            />
            <div className="relative w-24">
              <Input
                type="number"
                placeholder={`${defaultTaxRate}%`}
                value={newTaxRate}
                onChange={e => setNewTaxRate(e.target.value)}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Если не указать ставку — будет использоваться {defaultTaxRate}% из настроек
        </p>

        <div className="space-y-2">
          {clients.map(client => (
            <div
              key={client.id}
              className={`flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-lg border ${
                client.is_archived ? 'bg-gray-50 opacity-60' : ''
              }`}
            >
              {editingId === client.id ? (
                <div className="flex flex-wrap gap-2 w-full">
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="flex-1 min-w-[160px]"
                    placeholder="Название"
                  />
                  <Input
                    value={editInn}
                    onChange={e => setEditInn(e.target.value)}
                    className="w-36"
                    placeholder="ИНН"
                  />
                  <Input
                    value={editDirector}
                    onChange={e => setEditDirector(e.target.value)}
                    className="flex-1 min-w-[160px]"
                    placeholder="Руководитель"
                  />
                  <div className="relative w-20">
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
                        inn: editInn.trim() || null,
                        director_name: editDirector.trim() || null,
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
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={client.is_archived ? 'line-through' : ''}>
                      {client.name}
                    </span>
                    {client.inn && (
                      <Badge variant="info">ИНН {client.inn}</Badge>
                    )}
                    {client.director_name && (
                      <span className="text-sm text-gray-500">{client.director_name}</span>
                    )}
                    <Badge variant={client.tax_rate ? 'warning' : 'default'}>
                      {client.tax_rate ?? defaultTaxRate}%
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Редактировать"
                      onClick={() => {
                        setEditingId(client.id);
                        setEditName(client.name);
                        setEditInn(client.inn ?? '');
                        setEditDirector(client.director_name ?? '');
                        setEditTaxRate(client.tax_rate?.toString() || '');
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={client.is_archived ? 'Восстановить' : 'Архивировать'}
                      onClick={() => onUpdate(client.id, {
                        name: client.name,
                        inn: client.inn,
                        director_name: client.director_name,
                        tax_rate: client.tax_rate,
                        is_archived: !client.is_archived
                      })}
                    >
                      {client.is_archived
                        ? <RotateCcw className="h-4 w-4" />
                        : <Archive className="h-4 w-4" />}
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