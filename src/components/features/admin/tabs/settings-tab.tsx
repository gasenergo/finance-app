// src/components/features/admin/tabs/settings-tab.tsx
'use client';

import { useState } from 'react';
import { Save, Download, Plus, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { exportTransactionsCSV, exportInvoicesCSV } from '@/app/actions/export';
import { formatCurrency } from '@/lib/engine/calculations';
import type { Account } from '@/types/database';

function downloadCSV(content: string, filename: string) {
  const cleanContent = content.replace(/^\uFEFF/, '');
  const BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(cleanContent);
  const blob = new Blob([BOM, contentBytes], { type: 'text/csv;charset=utf-8' });
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

interface SettingsTabProps {
  accounts: Account[];
  onSaveAccount: (
    id: string,
    data: {
      name: string;
      bank_name: string | null;
      account_number: string | null;
      tax_rate: number;
      fund_contribution_rate: number;
      fund_limit: number;
      is_active: boolean;
    }
  ) => Promise<void>;
  onCreateAccount: (data: {
    name: string;
    bank_name: string | null;
    account_number: string | null;
    tax_rate: number;
    fund_contribution_rate: number;
    fund_limit: number;
  }) => Promise<void>;
  loading: boolean;
}

function AccountCard({
  account,
  onSave,
  loading
}: {
  account: Account;
  onSave: SettingsTabProps['onSaveAccount'];
  loading: boolean;
}) {
  const [name, setName] = useState(account.name);
  const [bankName, setBankName] = useState(account.bank_name || '');
  const [accountNumber, setAccountNumber] = useState(account.account_number || '');
  const [taxRate, setTaxRate] = useState(String(account.tax_rate));
  const [fundRate, setFundRate] = useState(String(account.fund_contribution_rate));
  const [fundLimit, setFundLimit] = useState(String(account.fund_limit));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            {account.name}
          </CardTitle>
          <Badge variant="info">
            Фонд: {formatCurrency(account.current_fund_balance)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Название счёта / филиала</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Основной счёт (Филиал 1)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Банк</label>
            <Input
              value={bankName}
              onChange={e => setBankName(e.target.value)}
              placeholder="Т-Банк / Точка / Сбер"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Номер счёта (опционально)</label>
            <Input
              value={accountNumber}
              onChange={e => setAccountNumber(e.target.value)}
              placeholder="40802..."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Налоговая ставка (%)</label>
            <Input
              type="number"
              step="0.1"
              value={taxRate}
              onChange={e => setTaxRate(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">Если у клиента не задана своя</p>
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
            <p className="text-xs text-gray-500 mt-1">Отчисления стоп при достижении</p>
          </div>
        </div>

        <Button
          onClick={() => onSave(account.id, {
            name: name.trim() || account.name,
            bank_name: bankName.trim() || null,
            account_number: accountNumber.trim() || null,
            tax_rate: parseFloat(taxRate) || 0,
            fund_contribution_rate: parseFloat(fundRate) || 0,
            fund_limit: parseFloat(fundLimit) || 0,
            is_active: account.is_active
          })}
          loading={loading}
        >
          <Save className="h-4 w-4 mr-2" />
          Сохранить настройки счёта
        </Button>
      </CardContent>
    </Card>
  );
}

export function SettingsTab({
  accounts,
  onSaveAccount,
  onCreateAccount,
  loading
}: SettingsTabProps) {
  const [exportLoading, setExportLoading] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const [newName, setNewName] = useState('');

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
      downloadCSV(csv, `akty_${formatDate(new Date())}.csv`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка экспорта');
    } finally {
      setExportLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreateAccount({
      name: newName.trim(),
      bank_name: null,
      account_number: null,
      tax_rate: 6,
      fund_contribution_rate: 10,
      fund_limit: 100000
    });
    setNewName('');
    setAddingAccount(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Расчётные счета и филиалы</h2>
        {!addingAccount && (
          <Button variant="outline" size="sm" onClick={() => setAddingAccount(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить счёт
          </Button>
        )}
      </div>

      {addingAccount && (
        <Card className="border-dashed border-2">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium mb-1">Название нового счёта</label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Например: Филиал 3 (ИП Петров)"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAddingAccount(false)}>Отмена</Button>
              <Button onClick={handleCreate} loading={loading} disabled={!newName.trim()}>Создать</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {accounts.map(account => (
        <AccountCard
          key={account.id}
          account={account}
          onSave={onSaveAccount}
          loading={loading}
        />
      ))}

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
              Скачать акты
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