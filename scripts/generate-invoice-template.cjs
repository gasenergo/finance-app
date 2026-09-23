// Регенерирует public/templates/invoice.docx из вашего файла-заготовки
// public/templates/my_temp.docx (акт с плейсхолдерами).
// Что делает:
//   1) hard-coded «11 700» → {$i.sum} (на будущее; таблицу сейчас заполняет
//      собственный движок invoice-docx-patch.ts, он перезапишет ячейки целиком)
//   2) в шапке акта «в лице Генерального директора {director_name}»
//      подменяет плейсхолдер на {director_name_gen} (родительный падеж)
//   3) проверяет, что таблица с фиксированной раскладкой (tblLayout=fixed)
//
// Строку {FOR i IN items} оставляем как маркер-шаблон — движок экспорта
// клонирует её под количество работ сам, без docx-templates-циклов.
'use strict';

const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'public', 'templates', 'my_temp.docx');
const DST = path.join(ROOT, 'public', 'templates', 'invoice.docx');

(async () => {
  if (!fs.existsSync(SRC)) {
    console.error('Не найден ' + SRC + ' — добавьте свой шаблон акта в этот файл.');
    process.exit(1);
  }

  const zip = await JSZip.loadAsync(fs.readFileSync(SRC));
  let xml = await zip.file('word/document.xml').async('string');

  const count = s => (xml.match(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

  // 1) hard-coded сумма «11 700» → {$i.sum}
  const run11 = count('<w:t>11</w:t>');
  const run700 = count('<w:t xml:space="preserve"> 700</w:t>');
  let sumFixed = false;
  if (run11 === 1 && run700 === 1) {
    xml = xml.replace('<w:t>11</w:t>', '<w:t>{$i.sum}</w:t>');
    xml = xml.replace('<w:t xml:space="preserve"> 700</w:t>', '<w:t xml:space="preserve"></w:t>');
    sumFixed = true;
  }

  // 2) {director_name} → {director_name_gen} в фразе «Генерального директора»
  //    (в подписи {director_name} остаётся — там именительный падеж).
  let genFixed = false;
  const anchor = xml.indexOf('Генерального директора ');
  if (anchor !== -1) {
    const pStart = xml.indexOf('<w:t>{</w:t>', anchor);
    const pEnd = xml.indexOf('<w:t>}</w:t>', pStart);
    if (pStart !== -1 && pEnd !== -1) {
      const runStart = xml.lastIndexOf('<w:r', pStart);
      const runEnd = xml.indexOf('</w:r>', pEnd) + '</w:r>'.length;
      if (runEnd > runStart && runStart !== -1) {
        xml = xml.slice(0, runStart) +
          '<w:r><w:t xml:space="preserve">{director_name_gen}</w:t></w:r>' +
          xml.slice(runEnd);
        genFixed = true;
      }
    }
  }

  // 3) Фиксированная раскладка таблицы работ (обычно уже есть в шаблоне)
  const tblPos = xml.indexOf('<w:tbl>');
  const tblPrEnd = xml.indexOf('</w:tblPr>', tblPos);
  let layoutFixed = tblPrEnd !== -1 && xml.slice(tblPos, tblPrEnd).indexOf('tblLayout') !== -1;
  if (!layoutFixed && tblPrEnd !== -1) {
    xml = xml.slice(0, tblPrEnd) + '<w:tblLayout w:type="fixed"/>' + xml.slice(tblPrEnd);
    layoutFixed = true;
  }

  zip.file('word/document.xml', xml);
  const out = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(DST, out);

  console.log(JSON.stringify({ sumFixed, genFixed, layoutFixed, bytes: out.length }));
})();