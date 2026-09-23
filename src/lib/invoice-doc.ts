import { createReport } from 'docx-templates/lib/browser.js';
import { invoiceConfig } from '@/lib/invoice-config';
import { numberToWords } from '@/lib/number-to-words';
import { formatCurrency } from '@/lib/engine/calculations';
import { downloadBlob } from '@/lib/csv';

export interface InvoiceDocItem {
  description: string;
  unit: string;
  qty: number;
  price: number;
  total: number;
}

export interface InvoiceDocData {
  number: string;
  dateLabel: string;
  clientName: string;
  items: InvoiceDocItem[];
  total: number;
}

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function formatRuDate(date: Date): string {
  return `«${date.getDate()}» ${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()} г.`;
}

function money(n: number): string {
  return formatCurrency(n).replace(/\u00A0/g, ' ').replace('₽', '').trim();
}

export function buildInvoiceDocData(data: {
  invoiceNumber: string;
  createdAt: string;
  clientName: string;
  items: Array<{ description: string; amount: number }>;
  total: number;
}): InvoiceDocData {
  return {
    number: data.invoiceNumber,
    dateLabel: formatRuDate(new Date(data.createdAt)),
    clientName: data.clientName || '—',
    items: data.items.map(item => ({
      description: item.description,
      unit: invoiceConfig.defaultUnit,
      qty: 1,
      price: item.amount,
      total: item.amount,
    })),
    total: data.total,
  };
}

interface TemplateData {
  number: string;
  date: string;
  city: string;
  provider_legal: string;
  provider_inn: string;
  director_role: string;
  director_name: string;
  legal_basis: string;
  client: string;
  tax_note: string;
  total: string;
  total_words: string;
  bank: string;
  bik: string;
  account: string;
  corr: string;
  inn: string;
  kpp: string;
  items: Array<{ index: string; description: string; unit: string; qty: string; price: string; sum: string }>;
}

function buildTemplateData(data: InvoiceDocData): TemplateData {
  const provider = invoiceConfig.provider;

  return {
    number: data.number,
    date: data.dateLabel,
    city: provider.city,
    provider_legal: provider.legalName,
    provider_inn: provider.inn,
    director_role: provider.directorRole,
    director_name: provider.directorName,
    legal_basis: provider.legalBasis,
    client: data.clientName,
    tax_note: invoiceConfig.taxNote,
    total: money(data.total),
    total_words: numberToWords(data.total),
    bank: provider.bank,
    bik: provider.bik,
    account: provider.account,
    corr: provider.corrAccount,
    inn: provider.inn,
    kpp: provider.kpp,
    items: data.items.map((item, index) => ({
      index: String(index + 1),
      description: item.description,
      unit: item.unit,
      qty: String(item.qty),
      price: money(item.price),
      sum: money(item.total),
    })),
  };
}

// ============ WORD (.docx) ============

let docxTemplatePromise: Promise<ArrayBuffer> | null = null;

function loadDocxTemplate(): Promise<ArrayBuffer> {
  if (!docxTemplatePromise) {
    docxTemplatePromise = fetch('/templates/invoice.docx').then(res => {
      if (!res.ok) throw new Error('Файл invoice.docx не найден');
      return res.arrayBuffer();
    });
  }
  return docxTemplatePromise;
}

export async function downloadInvoiceWord(data: InvoiceDocData): Promise<void> {
  const template = await loadDocxTemplate();

  // Синтаксис команд в шаблоне: {var}, цикл {FOR i IN items}..{END-FOR i}
  const report = await createReport({
    template,
    cmdDelimiter: ['{', '}'],
    data: buildTemplateData(data),
  });

  const blob = new Blob([report as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const sanitizedName = data.number.replace(/[^\w-]+/g, '_');
  downloadBlob(blob, `Счёт_${sanitizedName}.docx`);
}

// ============ PDF (печать из HTML-шаблона) ============

function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let htmlTemplatePromise: Promise<string> | null = null;

function loadHtmlTemplate(): Promise<string> {
  if (!htmlTemplatePromise) {
    htmlTemplatePromise = fetch('/templates/invoice.html').then(res => {
      if (!res.ok) throw new Error('Файл invoice.html не найден');
      return res.text();
    });
  }
  return htmlTemplatePromise;
}

function fillHtmlTemplate(template: string, data: TemplateData): string {
  const LOOP_REGEX = /\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/g;

  const withRows = template.replace(LOOP_REGEX, (_: string, rowTemplate: string) =>
    data.items
      .map(row => rowTemplate.replace(/\{\{(\w+)\}\}/g, (_, key: keyof typeof row) => row[key] ?? ''))
      .join('\n')
  );

  return withRows.replace(/\{\{(\w+)\}\}/g, (_, key: keyof TemplateData) => {
    const value = data[key];
    return typeof value === 'string' ? value : '';
  });
}

function escapeForHtml(data: TemplateData): TemplateData {
  return {
    ...data,
    client: escHtml(data.client),
    provider_legal: escHtml(data.provider_legal),
    director_name: escHtml(data.director_name),
    items: data.items.map(item => ({ ...item, description: escHtml(item.description) })),
  };
}

export async function buildInvoiceHtml(data: InvoiceDocData): Promise<string> {
  const template = await loadHtmlTemplate();
  const escaped = escapeForHtml(buildTemplateData(data));
  return fillHtmlTemplate(template, escaped as unknown as TemplateData);
}