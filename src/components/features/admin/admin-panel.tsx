// src/components/features/admin/admin-panel.tsx
// Замени импорты в начале файла:

'use client';

import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,  // ← переименовали
  Users,
  Building2,
  Briefcase,
  FolderOpen,
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Key,
  Save,
  X,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  updateSettings,
  createUser,
  updateUser,
  resetUserPassword,
  createClientAction,
  updateClient,
  createWorkType,
  updateWorkType,
  createExpenseCategory,
  deleteExpenseCategory
} from '@/app/actions/admin';
import { formatCurrency } from '@/lib/engine/calculations';
import { UserBalanceAdjustments } from './balance-adjustments';
import { getFreeCashAmount, getFundBalance } from '@/app/actions/adjustments';
import type { Settings, Client, WorkType, ExpenseCategory } from '@/types/database';
import { exportTransactionsCSV, exportInvoicesCSV } from '@/app/actions/export';

interface TeamMember {
  id: string;
  full_name: string;
  role: 'admin' | 'user';
  participant_type: 'partner' | 'percentage' | null;
  percentage_rate: number | null;
  is_active: boolean;
  balance: Array<{
    available_amount: number;
    total_earned: number;
    total_withdrawn: number;
  }> | null;
}

interface AdminPanelProps {
  settings: Settings | null;
  team: TeamMember[];
  clients: Client[];
  workTypes: WorkType[];
  categories: ExpenseCategory[];
}

type Tab = 'settings' | 'team' | 'clients' | 'workTypes' | 'categories' | 'freeCash';



import { getTeamWithBalances } from '@/app/actions/admin';

export function AdminPanel({
  settings: initialSettings,
  team: initialTeam,
  clients: initialClients,
  workTypes: initialWorkTypes,
  categories: initialCategories
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('settings');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // State
  const [settings, setSettings] = useState(initialSettings);
  const [team, setTeam] = useState(initialTeam);
  const [clients, setClients] = useState(initialClients);
  const [workTypes, setWorkTypes] = useState(initialWorkTypes);
  const [categories, setCategories] = useState(initialCategories);

  const handleTeamUpdate = async () => {
    const updatedTeam = await getTeamWithBalances();
    setTeam(updatedTeam);
  };

  // Dialogs
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<TeamMember | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const tabs = [
    { id: 'settings' as Tab, label: 'Настройки', icon: SettingsIcon },
    { id: 'team' as Tab, label: 'Команда', icon: Users },
    { id: 'clients' as Tab, label: 'Клиенты', icon: Building2 },
    { id: 'workTypes' as Tab, label: 'Виды работ', icon: Briefcase },
    { id: 'categories' as Tab, label: 'Категории', icon: FolderOpen },
    { id: 'freeCash' as Tab, label: 'Свободные средства', icon: DollarSign },
  ];

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Настройки</h1>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon className="h-4 w-4 mr-2" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && settings && (
        <SettingsTab 
          settings={settings}
          onSave={async (data) => {
            setLoading(true);
            try {
              await updateSettings(data);
              setSettings({ ...settings, ...data });
              showSuccess('Настройки сохранены');
            } catch (err) {
              showError(err instanceof Error ? err.message : 'Ошибка');
            } finally {
              setLoading(false);
            }
          }}
          loading={loading}
        />
      )}

      {/* Team Tab */}
      {activeTab === 'team' && (
        <TeamTab
          team={team}
          onAddUser={() => {
            setEditingUser(null);
            setUserDialogOpen(true);
          }}
          onEditUser={(user) => {
            setEditingUser(user);
            setUserDialogOpen(true);
          }}
          onResetPassword={(userId) => {
            setSelectedUserId(userId);
            setPasswordDialogOpen(true);
          }}
        />
      )}

      {/* Clients Tab */}
      {activeTab === 'clients' && (
        <ClientsTab
          clients={clients}
          defaultTaxRate={settings?.tax_rate || 6}
          onAdd={async (name, taxRate) => {
            setLoading(true);
            try {
              const newClient = await createClientAction(name, taxRate);
              setClients(prev => [...prev, newClient]);
              showSuccess('Клиент добавлен');
            } catch (err) {
              showError(err instanceof Error ? err.message : 'Ошибка');
            } finally {
              setLoading(false);
            }
          }}
          onUpdate={async (id, data) => {
            setLoading(true);
            try {
              await updateClient(id, data);
              setClients(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
              showSuccess('Клиент обновлён');
            } catch (err) {
              showError(err instanceof Error ? err.message : 'Ошибка');
            } finally {
              setLoading(false);
            }
          }}
          loading={loading}
        />
      )}


      {/* Work Types Tab */}
      {activeTab === 'workTypes' && (
        <WorkTypesTab
          workTypes={workTypes}
          onAdd={async (data) => {
            setLoading(true);
            try {
              const newType = await createWorkType(data);
              setWorkTypes(prev => [...prev, newType]);
              showSuccess('Вид работы добавлен');
            } catch (err) {
              showError(err instanceof Error ? err.message : 'Ошибка');
            } finally {
              setLoading(false);
            }
          }}
          onUpdate={async (id, data) => {
            setLoading(true);
            try {
              await updateWorkType(id, data);
              setWorkTypes(prev => prev.map(w => w.id === id ? { ...w, ...data } : w));
              showSuccess('Вид работы обновлён');
            } catch (err) {
              showError(err instanceof Error ? err.message : 'Ошибка');
            } finally {
              setLoading(false);
            }
          }}
          loading={loading}
        />
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <CategoriesTab
          categories={categories}
          onAdd={async (name) => {
            setLoading(true);
            try {
              const newCat = await createExpenseCategory(name);
              setCategories(prev => [...prev, newCat]);
              showSuccess('Категория добавлена');
            } catch (err) {
              showError(err instanceof Error ? err.message : 'Ошибка');
            } finally {
              setLoading(false);
            }
          }}
          onDelete={async (id) => {
            setLoading(true);
            try {
              await deleteExpenseCategory(id);
              setCategories(prev => prev.filter(c => c.id !== id));
              showSuccess('Категория удалена');
            } catch (err) {
              showError(err instanceof Error ? err.message : 'Ошибка');
            } finally {
              setLoading(false);
            }
          }}
          loading={loading}
        />
      )}

      {/* Free Cash Tab */}
      {activeTab === 'freeCash' && (
        <FreeCashTab
          team={team}
          onSuccess={async () => {
            // Refresh team balances and free cash
            await handleTeamUpdate();
          }}
        />
      )}

      {/* User Dialog */}
      <UserDialog
        open={userDialogOpen}
        onClose={() => setUserDialogOpen(false)}
        user={editingUser}
        onSave={async (data) => {
          setLoading(true);
          try {
            if (editingUser) {
              await updateUser(editingUser.id, data);
              setTeam(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...data } : u));
              showSuccess('Пользователь обновлён');
            } else {
              await createUser(data as any);
              showSuccess('Пользователь создан');
              // Перезагрузим страницу для получения нового пользователя
              window.location.reload();
            }
            setUserDialogOpen(false);
          } catch (err) {
            showError(err instanceof Error ? err.message : 'Ошибка');
          } finally {
            setLoading(false);
          }
        }}
        loading={loading}
      />

      {/* Password Dialog */}
      <PasswordDialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
        onSave={async (password) => {
          if (!selectedUserId) return;
          setLoading(true);
          try {
            await resetUserPassword(selectedUserId, password);
            showSuccess('Пароль изменён');
            setPasswordDialogOpen(false);
          } catch (err) {
            showError(err instanceof Error ? err.message : 'Ошибка');
          } finally {
            setLoading(false);
          }
        }}
        loading={loading}
      />
    </div>
  );
}


// ============ Settings Tab ============
// Вспомогательные функции (добавь перед SettingsTab или в конец файла)
function downloadCSV(content: string, filename: string) {
  // Убираем BOM из content если он там есть
  const cleanContent = content.replace(/^\uFEFF/, '');
  
  // BOM в виде байтов для Excel
  const BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);
  
  // Кодируем контент в UTF-8
  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(cleanContent);
  
  // Склеиваем BOM + контент
  const blob = new Blob([BOM, contentBytes], { type: 'text/csv;charset=utf-8' });
  
  // Создаём ссылку и скачиваем
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function SettingsTab({ 
  settings, 
  onSave, 
  loading 
}: { 
  settings: Settings;
  onSave: (data: { tax_rate: number; fund_contribution_rate: number; fund_limit: number }) => void;
  loading: boolean;
}) {
  const [taxRate, setTaxRate] = useState(String(settings.tax_rate));
  const [fundRate, setFundRate] = useState(String(settings.fund_contribution_rate));
  const [fundLimit, setFundLimit] = useState(String(settings.fund_limit));
  const [exportLoading, setExportLoading] = useState(false);

  const handleExportTransactions = async () => {
    setExportLoading(true);
    try {
      const csv = await exportTransactionsCSV();
      downloadCSV(csv, `dds_${formatDate(new Date())}.csv`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка экспорта');
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportInvoices = async () => {
    setExportLoading(true);
    try {
      const csv = await exportInvoicesCSV();
      downloadCSV(csv, `invoices_${formatDate(new Date())}.csv`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка экспорта');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Финансовые настройки */}
      <Card>
        <CardHeader>
          <CardTitle>Финансовые настройки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Налоговая ставка (%)</label>
            <Input
              type="number"
              step="0.1"
              value={taxRate}
              onChange={e => setTaxRate(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">Вычитается из каждого платежа</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Отчисление в фонд (%)</label>
            <Input
              type="number"
              step="0.1"
              value={fundRate}
              onChange={e => setFundRate(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">От суммы после налогов</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Лимит фонда (₽)</label>
            <Input
              type="number"
              value={fundLimit}
              onChange={e => setFundLimit(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">Отчисления прекратятся при достижении лимита</p>
          </div>

          <Button
            onClick={() => onSave({
              tax_rate: parseFloat(taxRate),
              fund_contribution_rate: parseFloat(fundRate),
              fund_limit: parseFloat(fundLimit)
            })}
            loading={loading}
          >
            <Save className="h-4 w-4 mr-2" />
            Сохранить
          </Button>
        </CardContent>
      </Card>

      {/* Бэкап данных */}
      <Card>
        <CardHeader>
          <CardTitle>Бэкап данных</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Скачайте копию финансовых данных в формате CSV. 
            Файлы можно открыть в Excel или Google Sheets.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={handleExportTransactions}
              disabled={exportLoading}
            >
              <Download className="h-4 w-4 mr-2" />
              Скачать ДДС
            </Button>
            
            <Button
              variant="outline"
              onClick={handleExportInvoices}
              disabled={exportLoading}
            >
              <Download className="h-4 w-4 mr-2" />
              Скачать счета
            </Button>
          </div>

          <p className="text-xs text-gray-400">
            Рекомендуем делать бэкап раз в неделю
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ Team Tab ============
function TeamTab({ 
  team, 
  onAddUser, 
  onEditUser,
  onResetPassword
}: { 
  team: TeamMember[];
  onAddUser: () => void;
  onEditUser: (user: TeamMember) => void;
  onResetPassword: (userId: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Команда</CardTitle>
        <Button size="sm" onClick={onAddUser}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {team.map(user => (
            <div 
              key={user.id}
              className={`p-4 rounded-lg border ${user.is_active ? 'bg-white' : 'bg-gray-50 opacity-60'}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{user.full_name}</span>
                    <Badge variant={user.role === 'admin' ? 'info' : 'default'}>
                      {user.role === 'admin' ? 'Админ' : 'Юзер'}
                    </Badge>
                    {user.participant_type && (
                      <Badge variant={user.participant_type === 'partner' ? 'success' : 'warning'}>
                        {user.participant_type === 'partner' ? 'Партнёр' : `${user.percentage_rate}%`}
                      </Badge>
                    )}
                    {!user.is_active && (
                      <Badge variant="error">Неактивен</Badge>
                    )}
                  </div>
                  {user.balance && user.balance[0] && (
                    <p className="text-sm text-gray-500 mt-1">
                      Баланс: {formatCurrency(user.balance[0].available_amount)} • 
                      Заработано: {formatCurrency(user.balance[0].total_earned)}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => onEditUser(user)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onResetPassword(user.id)}>
                    <Key className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ Clients Tab ============
function ClientsTab({ 
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

// ============ Work Types Tab ============
function WorkTypesTab({ 
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
          <Input
            placeholder="Цена"
            type="number"
            value={newPrice}
            onChange={e => setNewPrice(e.target.value)}
            className="w-32"
          />
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

// ============ Categories Tab ============
function CategoriesTab({ 
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

/// ============ User Dialog ============
function UserDialog({ 
  open, 
  onClose, 
  user, 
  onSave,
  loading 
}: { 
  open: boolean;
  onClose: () => void;
  user: TeamMember | null;
  onSave: (data: any) => void;
  loading: boolean;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [participantType, setParticipantType] = useState<'partner' | 'percentage' | 'none'>('none');
  const [percentageRate, setPercentageRate] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Сброс формы при открытии/закрытии или смене пользователя
  useEffect(() => {
    if (open) {
      if (user) {
        setFullName(user.full_name);
        setRole(user.role);
        setParticipantType(user.participant_type || 'none');
        setPercentageRate(String(user.percentage_rate || ''));
        setIsActive(user.is_active);
        setEmail('');
        setPassword('');
      } else {
        setEmail('');
        setPassword('');
        setFullName('');
        setRole('user');
        setParticipantType('none');
        setPercentageRate('');
        setIsActive(true);
      }
    }
  }, [open, user]);

  const handleSave = () => {
    onSave({
      email,
      password,
      full_name: fullName,
      role,
      participant_type: participantType === 'none' ? null : participantType,
      percentage_rate: participantType === 'percentage' ? parseFloat(percentageRate) : null,
      is_active: isActive
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? 'Редактировать' : 'Новый'} участник</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!user && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Пароль</label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </>
          )}
          
          <div>
            <label className="block text-sm font-medium mb-1.5">Имя</label>
            <Input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Иван Иванов"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1.5">Роль в системе</label>
            <Select value={role} onValueChange={(v: 'admin' | 'user') => setRole(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Пользователь</SelectItem>
                <SelectItem value="admin">Администратор</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1.5">Тип участника</label>
            <Select 
              value={participantType} 
              onValueChange={(v: 'partner' | 'percentage' | 'none') => setParticipantType(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Не участвует в распределении</SelectItem>
                <SelectItem value="partner">Партнёр (равная доля)</SelectItem>
                <SelectItem value="percentage">Процентник</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {participantType === 'percentage' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Процент (%)</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={percentageRate}
                onChange={e => setPercentageRate(e.target.value)}
                placeholder="15"
              />
            </div>
          )}

          {user && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="isActive" className="text-sm">Активен</label>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button
            onClick={handleSave}
            loading={loading}
            disabled={!fullName || (!user && (!email || !password))}
          >
            {user ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Password Dialog ============
function PasswordDialog({
  open,
  onClose,
  onSave,
  loading
}: {
  open: boolean;
  onClose: () => void;
  onSave: (password: string) => void;
  loading: boolean;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Сменить пароль</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Новый пароль</label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Подтверждение</label>
            <Input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {password && confirm && password !== confirm && (
            <p className="text-sm text-red-500">Пароли не совпадают</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button
            onClick={() => {
              onSave(password);
              setPassword('');
              setConfirm('');
            }}
            loading={loading}
            disabled={!password || password !== confirm || password.length < 6}
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Free Cash Tab ============
function FreeCashTab({
  team,
  onSuccess
}: {
  team: TeamMember[];
  onSuccess: () => void;
}) {
  const [freeCash, setFreeCash] = useState(0);
  const [fundBalance, setFundBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [freeCashAmount, fundAmount] = await Promise.all([
        getFreeCashAmount(),
        getFundBalance()
      ]);
      setFreeCash(freeCashAmount);
      setFundBalance(fundAmount);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustmentSuccess = () => {
    fetchData();
    onSuccess();
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Корректировка балансов участников</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {team
              .filter(user => user.is_active)
              .map(user => (
                <div
                  key={user.id}
                  className="p-4 rounded-lg border bg-white"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.full_name}</span>
                        <Badge variant={user.role === 'admin' ? 'info' : 'default'}>
                          {user.role === 'admin' ? 'Админ' : 'Юзер'}
                        </Badge>
                        {user.participant_type && (
                          <Badge variant={user.participant_type === 'partner' ? 'success' : 'warning'}>
                            {user.participant_type === 'partner' ? 'Партнёр' : `${user.percentage_rate}%`}
                          </Badge>
                        )}
                      </div>
                      {user.balance && user.balance[0] && (
                        <p className="text-sm text-gray-500 mt-1">
                          Баланс: {formatCurrency(user.balance[0].available_amount)}
                        </p>
                      )}
                    </div>
                    <UserBalanceAdjustments
                      userId={user.id}
                      userName={user.full_name}
                      userType={user.participant_type}
                      currentBalance={user.balance?.[0]?.available_amount || 0}
                      freeCash={freeCash}
                      fundBalance={fundBalance}
                      onSuccess={handleAdjustmentSuccess}
                    />
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
