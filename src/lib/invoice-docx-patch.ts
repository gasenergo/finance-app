export interface TableRowValues {
  index: string;
  description: string;
  unit: string;
  qty: string;
  price: string;
  sum: string;
}

function escXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Полностью переписывает тексты ячейки: первый <w:t> → value, остальные → ''.
// Не трогает структуру (ширину, шрифты, абзацы) — важно для раскладки Word.
function setCellText(cellXml: string, value: string): string {
  const escaped = escXml(value);
  let first = true;
  let out = cellXml.replace(
    /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g,
    () => (first ? ((first = false), `<w:t xml:space="preserve">${escaped}</w:t>`) : `<w:t xml:space="preserve"></w:t>`)
  );
  if (first && escaped) {
    const pEnd = out.indexOf('</w:p>');
    if (pEnd !== -1) {
      out = out.slice(0, pEnd) + `<w:r><w:t xml:space="preserve">${escaped}</w:t></w:r>` + out.slice(pEnd);
    }
  }
  return out;
}

const COLUMNS: Array<(r: TableRowValues) => string> = [
  r => r.index,
  r => r.description,
  r => r.unit,
  r => r.qty,
  r => r.price,
  r => r.sum,
];

/**
 * Клонирует строку-маркер {FOR i IN items} под каждую работу и подставляет
 * значения в ячейки по порядку: №, наименование, ед. изм., кол-во, цена, сумма.
 * Удаляет служебную строку {END-FOR i}, если она есть.
 * Никаких docx-templates-циклов — только чистые строки XML.
 */
export function patchInvoiceTable(xml: string, rows: TableRowValues[]): string {
  const forIdx = xml.indexOf('{FOR i IN ');
  if (forIdx === -1) return xml;

  const rowStart = Math.max(xml.lastIndexOf('<w:tr ', forIdx), xml.lastIndexOf('<w:tr>', forIdx));
  if (rowStart === -1) return xml;
  const rowEndIdx = xml.indexOf('</w:tr>', forIdx);
  if (rowEndIdx === -1) return xml;
  const rowEnd = rowEndIdx + '</w:tr>'.length;

  const rowXml = xml.slice(rowStart, rowEnd);
  const headerEnd = rowXml.search(/<w:tc[ >]/);
  if (headerEnd === -1) return xml;
  const header = rowXml.slice(0, headerEnd);
  const cells = [...rowXml.matchAll(/<w:tc[ >][\s\S]*?<\/w:tc>/g)].map(m => m[0]);
  if (cells.length === 0) return xml;

  const generated = rows
    .map(r =>
      header +
      cells.map((cell, i) => setCellText(cell, i < COLUMNS.length ? COLUMNS[i](r) : '')).join('') +
      '</w:tr>'
    )
    .join('');

  // region замены: строка работ + (если идёт следом) служебная END-FOR строка
  let regionEnd = rowEnd;
  const endIdx = xml.indexOf('{END-FOR i}');
  if (endIdx !== -1 && endIdx > rowEnd) {
    const endRowStart = Math.max(xml.lastIndexOf('<w:tr ', endIdx), xml.lastIndexOf('<w:tr>', endIdx));
    const endRowEnd = xml.indexOf('</w:tr>', endIdx);
    if (endRowStart === rowEnd && endRowEnd !== -1) {
      regionEnd = endRowEnd + '</w:tr>'.length;
    }
  }

  return xml.slice(0, rowStart) + generated + xml.slice(regionEnd);
}