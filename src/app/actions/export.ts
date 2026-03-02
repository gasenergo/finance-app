'use server';

import { createClient } from '@/lib/supabase/server';

export async function exportTransactionsCSV(): Promise<string> {
  const supabase = await createClient();

  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      *,
      category:expense_categories(name),
      related_user:profiles!transactions_related_user_id_fkey(full_name),
      invoice:invoices!transactions_related_invoice_id_fkey(invoice_number)
    `)
    .order('date', { ascending: false });

  if (!transactions || transactions.length === 0) {
    throw new Error('Нет данных для экспорта');
  }

  // Заголовки CSV
  const headers = [
    'Дата',
    'Тип',
    'Сумма',
    'Описание',
    'Категория',
    'Пользователь',
    'Номер счёта',
    'Создано'
  ];

  // Маппинг типов
  const typeLabels: Record<string, string> = {
    income: 'Доход',
    expense: 'Расход',
    payout: 'Выплата'
  };

  // Строки данных
  const rows = transactions.map(tx => [
    tx.date,
    typeLabels[tx.type] || tx.type,
    tx.amount,
    tx.description || '',
    tx.category?.name || '',
    tx.related_user?.full_name || '',
    tx.invoice?.invoice_number || '',
    new Date(tx.created_at).toLocaleString('ru-RU')
  ]);

  // Формируем CSV
  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
  ].join('\n');

  // Добавляем BOM для корректного отображения кириллицы в Excel
  return '\uFEFF' + csvContent;
}

export async function exportInvoicesCSV(): Promise<string> {
  const supabase = await createClient();

  const { data: invoices } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients(name),
      jobs(description, amount)
    `)
    .order('created_at', { ascending: false });

  if (!invoices || invoices.length === 0) {
    throw new Error('Нет данных для экспорта');
  }

  // Заголовки CSV
  const headers = [
    'Номер счёта',
    'Дата создания',
    'Клиент',
    'Сумма',
    'Статус',
    'Дата оплаты',
    'Работы'
  ];

  // Маппинг статусов
  const statusLabels: Record<string, string> = {
    draft: 'Черновик',
    sent: 'Отправлен',
    paid: 'Оплачен',
    cancelled: 'Отменён'
  };

  // Строки данных
  const rows = invoices.map(inv => {
    // Собираем работы в одну строку
    const jobsList = inv.jobs
      ?.map((j: { description: string; amount: number }) => `${j.description} (${j.amount} ₽)`)
      .join('; ') || '';

    return [
      inv.invoice_number,
      new Date(inv.created_at).toLocaleDateString('ru-RU'),
      inv.client?.name || '',
      inv.total_amount,
      statusLabels[inv.status] || inv.status,
      inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('ru-RU') : '',
      jobsList
    ];
  });

  // Формируем CSV
  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
  ].join('\n');

  return csvContent;
}