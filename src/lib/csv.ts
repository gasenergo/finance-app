export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCSV(content: string, filename: string) {
  // Убираем BOM из content если он там есть
  const cleanContent = content.replace(/^\uFEFF/, '');

  // BOM в виде байтов для Excel
  const BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);

  // Кодируем контент в UTF-8
  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(cleanContent);

  // Склеиваем BOM + контент
  const blob = new Blob([BOM, contentBytes], { type: 'text/csv;charset=utf-8' });

  downloadBlob(blob, filename);
}