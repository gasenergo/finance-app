import { createReport } from 'docx-templates/lib/browser.js';
import JSZip from 'jszip';
import { invoiceConfig } from '@/lib/invoice-config';
import { numberToWords } from '@/lib/number-to-words';
import { toGenitive } from '@/lib/russian-cases';
import { aggregateInvoiceItems } from '@/lib/invoice-doc-items';
import { patchInvoiceTable } from '@/lib/invoice-docx-patch';
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
  createdAt: string;
  clientName: string;
  clientInn: string | null;
  clientDirector: string | null;
  templateSuffix?: string | null;
  items: InvoiceDocItem[];
  total: number;
}

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function parseDocDate(createdAt: string): Date {
  return new Date(createdAt);
}

function money(n: number): string {
  return formatCurrency(n).replace(/\u00A0/g, ' ').replace('₽', '').trim();
}

function money2(n: number): string {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(n).replace(/\u00A0/g, ' ');
}

export function buildInvoiceDocData(data: {
  invoiceNumber: string;
  createdAt: string;
  clientName: string;
  clientInn?: string | null;
  clientDirector?: string | null;
  accountName?: string | null;
  items: Array<{ description: string; amount: number; quantity?: number; unit?: string; unitPrice?: number | null }>;
  total: number;
}): InvoiceDocData {
  const isSaratov = (data.accountName || '').toLowerCase().includes('саратов');

  return {
    number: data.invoiceNumber,
    createdAt: data.createdAt,
    clientName: data.clientName || '—',
    clientInn: data.clientInn || null,
    clientDirector: data.clientDirector || null,
    templateSuffix: isSaratov ? '-saratov' : '',
    items: aggregateInvoiceItems(data.items).map(group => ({ ...group, unit: group.unit || invoiceConfig.defaultUnit })),
    total: data.total,
  };
}

interface TemplateData {
  number: string;
  date_day: string;
  date_month: string;
  date_year: string;
  client: string;
  client_inn: string;
  director_name: string;
  director_name_gen: string;
  total: string;
  total_words: string;
  items: Array<{ index: string; description: string; unit: string; qty: string; price: string; sum: string }>;
}

function buildTemplateData(data: InvoiceDocData): TemplateData {
  const provider = invoiceConfig.provider;
  const date = parseDocDate(data.createdAt);
  const directorName = data.clientDirector || provider.directorName;

  return {
    number: data.number,
    date_day: String(date.getDate()),
    date_month: MONTHS_GENITIVE[date.getMonth()],
    date_year: String(date.getFullYear()),
    client: data.clientName,
    client_inn: data.clientInn || '',
    director_name: directorName,
    director_name_gen: toGenitive(directorName),
    total: money(data.total),
    total_words: numberToWords(data.total),
    items: data.items.map((item, index) => ({
      index: String(index + 1),
      description: item.description,
      unit: item.unit,
      qty: String(item.qty),
      price: money2(item.price),
      sum: money(item.total),
    })),
  };
}

// ============ WORD (.docx) ============

const docxTemplateCache = new Map<string, Promise<ArrayBuffer>>();

function loadDocxTemplate(suffix = ''): Promise<ArrayBuffer> {
  const path = `/templates/invoice${suffix}.docx`;
  let promise = docxTemplateCache.get(path);
  if (!promise) {
    promise = fetch(path).then(res => {
      if (!res.ok) throw new Error(`Файл ${path} не найден`);
      return res.arrayBuffer();
    });
    docxTemplateCache.set(path, promise);
  }
  return promise;
}

export async function downloadInvoiceWord(data: InvoiceDocData): Promise<void> {
  const template = await loadDocxTemplate(data.templateSuffix || '');
  const scalars = buildTemplateData(data);

  const zip = await JSZip.loadAsync(template);
  const docPath = 'word/document.xml';
  const xml = await zip.file(docPath)!.async('string');
  zip.file(docPath, patchInvoiceTable(xml, scalars.items));
  const patched = await zip.generateAsync({ type: 'uint8array' });

  const report = await createReport({
    template: patched,
    cmdDelimiter: ['{', '}'],
    data: scalars,
  });

  const blob = new Blob([report as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const sanitizedName = data.number.replace(/[^\w-]+/g, '_');
  downloadBlob(blob, `Акт_${sanitizedName}.docx`);
}

// ============ PDF (печать из HTML-шаблона) ============

function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const htmlTemplateCache = new Map<string, Promise<string>>();

function loadHtmlTemplate(suffix = ''): Promise<string> {
  const path = `/templates/invoice${suffix}.html`;
  let promise = htmlTemplateCache.get(path);
  if (!promise) {
    promise = fetch(path).then(res => {
      if (!res.ok) throw new Error(`Файл ${path} не найден`);
      return res.text();
    });
    htmlTemplateCache.set(path, promise);
  }
  return promise;
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
    client_inn: escHtml(data.client_inn),
    director_name: escHtml(data.director_name),
    director_name_gen: escHtml(data.director_name_gen),
    items: data.items.map(item => ({ ...item, description: escHtml(item.description) })),
  };
}

export async function buildInvoiceHtml(data: InvoiceDocData): Promise<string> {
  const template = await loadHtmlTemplate(data.templateSuffix || '');
  const escaped = escapeForHtml(buildTemplateData(data));
  return fillHtmlTemplate(template, escaped as unknown as TemplateData);
}