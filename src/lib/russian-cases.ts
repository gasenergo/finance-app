export type Gender = 'm' | 'f';

const MALE_NAMES_ON_A = new Set([
  'никита', 'илья', 'фома', 'лука', 'кузьма', 'игорь', 'данила', 'савва',
  'григорий', 'михаил', 'гаврила', 'виталия', 'миля', 'андроп',
]);

export function detectGender(parts: string[]): Gender {
  // Лучший индикатор — отчество (3-е слово)
  if (parts.length >= 3) {
    const patr = parts[2].toLowerCase();
    if (/(вна|евна|чна)$/.test(patr)) return 'f';
    if (/ич$/.test(patr)) return 'm';
  }

  // Фамилия
  const surname = (parts[0] || '').toLowerCase();
  if (/(ова|ева|ёва|ина|ына|ая|ская|цкая)$/.test(surname)) return 'f';
  if (/(ов|ев|ёв|ин|ын|ый|ой|ий)$/.test(surname)) return 'm';

  // Имя
  const name = (parts[1] || parts[0] || '').toLowerCase();
  if (name && !MALE_NAMES_ON_A.has(name) && /(а|я)$/.test(name)) return 'f';

  return 'm';
}

function afterHard(x: string): boolean {
  return /[гкхжчшщц]$/.test(x);
}

function declineSurname(w: string, g: Gender): string {
  const s = w.toLowerCase();
  if (g === 'f') {
    if (/(ова|ева|ёва|ина|ына)$/.test(s)) return w.slice(0, -1) + 'ой';
    if (/ская$/.test(s) || /цкая$/.test(s)) return w.slice(0, -2) + 'ой';
    if (/ая$/.test(s)) return w.slice(0, -2) + 'ой';
    if (/я$/.test(s)) return w.slice(0, -1) + 'и';
    if (/а$/.test(s)) return w.slice(0, -1) + (afterHard(s.slice(0, -1)) ? 'и' : 'ы');
    return w;
  }

  if (/(ов|ев|ёв|ин|ын)$/.test(s)) return w + 'а';
  if (/(ский|цкий|кий|ший|чий|щий|жий)$/.test(s)) return w.slice(0, -2) + 'ого';
  if (/ый$/.test(s)) return w.slice(0, -2) + 'ого';
  if (/ой$/.test(s)) return w.slice(0, -2) + 'ого';
  if (/ий$/.test(s)) return w.slice(0, -2) + 'его';
  if (/я$/.test(s)) return w.slice(0, -1) + 'и';
  if (/а$/.test(s)) return w.slice(0, -1) + (afterHard(s.slice(0, -1)) ? 'и' : 'ы');
  if (/ь$/.test(s)) return w.slice(0, -1) + 'я';
  return w;
}

const IRREGULAR_MALE_GEN = new Map<string, string>([
  ['павел', 'павла'],
]);

function declineFirstName(w: string, g: Gender): string {
  const s = w.toLowerCase();
  const irregular = IRREGULAR_MALE_GEN.get(s);
  if (g === 'm' && irregular) {
    const upper = w.charAt(0) === w.charAt(0).toUpperCase();
    return upper ? irregular.charAt(0).toUpperCase() + irregular.slice(1) : irregular;
  }
  if (/(ей|ий|ай|й)$/.test(s)) return w.slice(0, -1) + 'я';
  if (/я$/.test(s)) return w.slice(0, -1) + 'и';
  if (/а$/.test(s)) return w.slice(0, -1) + (afterHard(s.slice(0, -1)) ? 'и' : 'ы');
  if (/ь$/.test(s)) return g === 'm' ? w.slice(0, -1) + 'я' : w.slice(0, -1) + 'и';
  if (g === 'm' && /[бвгдйжзклмнпрстфхцчшщ]$/.test(s)) return w + 'а';
  return w;
}

function declinePatronymic(w: string, g: Gender): string {
  const s = w.toLowerCase();
  if (g === 'f') {
    if (/на$/.test(s)) return w.slice(0, -1) + 'ы';
    return w;
  }
  if (/ич$/.test(s)) return w + 'а';
  return w;
}

export function toGenitive(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fullName;

  const gender = detectGender(parts);
  const declined = parts.map((p, i) => {
    if (i === 0) return declineSurname(p, gender);
    if (i === 1) return declineFirstName(p, gender);
    if (i === 2) return declinePatronymic(p, gender);
    return p;
  });

  return declined.join(' ');
}