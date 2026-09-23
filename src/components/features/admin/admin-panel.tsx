'use client';

import { useState } from 'react';
import {
  Settings as SettingsIcon,
  Users,
  Building2,
  Briefcase,
  FolderOpen,
  DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  deleteExpenseCategory,
  getTeamWithBalances
} from '@/app/actions/admin';
import type { Settings, Client, WorkType, ExpenseCategory, TeamMember } from '@/types/database';

import { SettingsTab } from './tabs/settings-tab';
import { TeamTab } from './tabs/team-tab';
import { ClientsTab } from './tabs/clients-tab';
import { WorkTypesTab } from './tabs/work-types-tab';
import { CategoriesTab } from './tabs/categories-tab';
import { FreeCashTab } from './tabs/free-cash-tab';
import { UserDialog, PasswordDialog } from './tabs/user-dialogs';

interface AdminPanelProps {
  settings: Settings | null;
  team: TeamMember[];
  clients: Client[];
  workTypes: WorkType[];
  categories: ExpenseCategory[];
}

type Tab = 'settings' | 'team' | 'clients' | 'workTypes' | 'categories' | 'freeCash';

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
              // @ts-expect-error email and password are required for new user
              await createUser(data);
              showSuccess('Пользователь создан');
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
