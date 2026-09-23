'use client';

import { useState } from 'react';
import { Save, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { exportTransactionsCSV, exportInvoicesCSV } from '@/app/actions/export';
import type { Settings } from '@/types/database';

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

export function SettingsTab({
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
