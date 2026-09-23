const HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

const TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];

const ONE_TO_NINETEEN = [
  '', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять',
  'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать',
  'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать',
];

function tripleToWords(n: number, feminine: boolean): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;

  if (hundreds > 0) parts.push(HUNDREDS[hundreds]);

  if (rest > 0) {
    if (rest < 20) {
      let word = ONE_TO_NINETEEN[rest];
      if (feminine && rest === 1) word = 'одна';
      if (feminine && rest === 2) word = 'две';
      parts.push(word);
    } else {
      const tens = Math.floor(rest / 10);
      const ones = rest % 10;
      parts.push(TENS[tens]);
      if (ones > 0) {
        let word = ONE_TO_NINETEEN[ones];
        if (feminine && ones === 1) word = 'одна';
        if (feminine && ones === 2) word = 'две';
        parts.push(word);
      }
    }
  }

  return parts.join(' ');
}

function pluralCase(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod100 > 10 && mod100 < 20) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

const SCALES: Array<{ base: number; feminine: boolean; forms: [string, string, string] }> = [
  { base: 1_000_000_000, feminine: false, forms: ['миллиард', 'миллиарда', 'миллиардов'] },
  { base: 1_000_000, feminine: false, forms: ['миллион', 'миллиона', 'миллионов'] },
  { base: 1_000, feminine: true, forms: ['тысяча', 'тысячи', 'тысяч'] },
];

function integerToWords(n: number): string {
  if (n === 0) return 'ноль';

  const words: string[] = [];
  let rest = n;

  for (const scale of SCALES) {
    const group = Math.floor(rest / scale.base);
    if (group > 0) {
      words.push(tripleToWords(group, scale.feminine));
      words.push(pluralCase(group, scale.forms));
      rest -= group * scale.base;
    }
  }

  if (rest > 0) {
    words.push(tripleToWords(rest, false));
  }

  return words.join(' ');
}

export function rublesWords(amount: number): string {
  const abs = Math.abs(amount);
  const rubles = Math.floor(abs);
  const kopecks = Math.round((abs - rubles) * 100);

  const rubForm = pluralCase(rubles, ['рубль', 'рубля', 'рублей']);
  let result = `${integerToWords(rubles)} ${rubForm}`;

  if (kopecks > 0) {
    const kopForm = pluralCase(kopecks, ['копейка', 'копейки', 'копеек']);
    result += ` ${tripleToWords(kopecks, true)} ${kopForm}`;
  }

  return result;
}

export function numberToWords(n: number): string {
  const words = integerToWords(Math.floor(Math.abs(n)));
  return words.charAt(0).toUpperCase() + words.slice(1);
}