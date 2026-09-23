// Генерирует public/templates/invoice.docx — редактируемый в Word шаблон счёта.
// Плейсхолдеры: {number}, {date}, {city}, {provider_legal}, {provider_inn},
// {director_role}, {director_name}, {legal_basis}, {client}, {tax_note},
// {total}, {total_words}, {bank}, {bik}, {account}, {corr}, {kpp},
// цикл по таблице: {FOR i IN items} ... {END-FOR i}, поля {$i.index}..{$i.sum}.
'use strict';

const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
} = require('docx');

const OUT = path.join(__dirname, '..', 'public', 'templates', 'invoice.docx');

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: '000000' };

function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    indent: opts.indent ? { firstLine: 500 } : undefined,
    spacing: { after: opts.after ?? 120 },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        size: (opts.size ?? 22) * 2,
        font: 'Times New Roman',
      }),
    ],
  });
}

function cell(text, opts = {}) {
  return new TableCell({
    shading: opts.fill ? { fill: opts.fill } : undefined,
    borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
    children: [
      new Paragraph({
        alignment: opts.align,
        children: [
          new TextRun({ text, bold: opts.bold, size: 22, font: 'Times New Roman' }),
        ],
      }),
    ],
  });
}

const header = (text, align) => cell(text, { bold: true, align, fill: 'F2F2F2' });

const doc = new Document({
  sections: [
    {
      properties: {},
      children: [
        p('СЧЁТ НА ОПЛАТУ № {number}', { bold: true, size: 26, center: true, after: 0 }),
        p('от {date}', { center: true, after: 0 }),
        p('{city}', { center: true, after: 240 }),
        p('{provider_legal} (ИНН {provider_inn}), именуемый в дальнейшем «Исполнитель», в лице {director_role} {director_name}, действующего на основании {legal_basis}, с одной стороны, и'),
        p('{client}, именуемый в дальнейшем «Заказчик», с другой стороны, составил настоящий счёт на оплату о нижеследующем:'),
        p('1. Исполнитель оказал, а Заказчик принял следующие услуги:', { bold: true }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                header('№ п/п', AlignmentType.CENTER),
                header('Наименование работ, услуг'),
                header('Ед. изм.', AlignmentType.CENTER),
                header('Кол-во', AlignmentType.CENTER),
                header('Цена за ед., руб. (без НДС)', AlignmentType.RIGHT),
                header('Стоимость, руб. (без НДС)', AlignmentType.RIGHT),
              ],
            }),
            new TableRow({
              children: [
                cell('{FOR i IN items}', { align: AlignmentType.CENTER }),
                cell('{$i.description}'),
                cell('{$i.unit}', { align: AlignmentType.CENTER }),
                cell('{$i.qty}', { align: AlignmentType.CENTER }),
                cell('{$i.price}', { align: AlignmentType.RIGHT }),
                cell('{$i.sum}', { align: AlignmentType.RIGHT }),
              ],
            }),
            new TableRow({
              children: [
                cell('{END-FOR i}', { align: AlignmentType.CENTER }),
                cell('ИТОГО:', { bold: true }),
                cell(''),
                cell(''),
                cell(''),
                cell('{total}', { bold: true, align: AlignmentType.RIGHT }),
              ],
            }),
          ],
        }),
        new Paragraph({ spacing: { after: 160 } }),
        p('2. Общая стоимость оказанных услуг составила: {total} ({total_words}) рублей, {tax_note}.', { indent: true }),
        p('3. Оплата производится по реквизитам Исполнителя банковским переводом с расчётного счёта Заказчика:', { indent: true }),
        p('Банк: {bank}', { indent: true }),
        p('БИК: {bik}', { indent: true }),
        p('Расчётный счёт: {account}', { indent: true }),
        p('Корреспондентский счёт: {corr}', { indent: true }),
        p('ИНН/КПП: {inn} / {kpp}', { indent: true }),
        new Paragraph({ spacing: { after: 240 } }),
        p('ПОДПИСИ СТОРОН:', { bold: true, center: true }),
        new Paragraph({ spacing: { after: 200 } }),
        p('Исполнитель:', { bold: true }),
        new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: '____________________', font: 'Times New Roman', size: 22 })] }),
        p('_______________ /{director_name}/', { after: 160 }),
        p('Заказчик:', { bold: true }),
        new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: '____________________', font: 'Times New Roman', size: 22 })] }),
        p('_______________ /_______________/', { after: 160 }),
        p('М.П.', { indent: true }),
      ],
    },
  ],
});

(async () => {
  const buffer = await Packer.toBuffer(doc);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buffer);
  console.log('OK: ' + OUT + ' (' + buffer.length + ' bytes)');
})();