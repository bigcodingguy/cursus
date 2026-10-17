// Calendar. Day 0 is the Kalends of January, 133 BC.
// Simplification: a 365-day year with Julian month lengths but the Republican month
// names (Quintilis, Sextilis). See docs/DECISIONS.md.

export const MONTHS = [
  'Ianuarius', 'Februarius', 'Martius', 'Aprilis', 'Maius', 'Iunius',
  'Quintilis', 'Sextilis', 'September', 'October', 'November', 'December',
] as const;
const ABBR = ['Ian.', 'Feb.', 'Mart.', 'Apr.', 'Mai.', 'Iun.', 'Quint.', 'Sext.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const MONTH_LEN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_START: number[] = [];
{
  let acc = 0;
  for (const l of MONTH_LEN) {
    MONTH_START.push(acc);
    acc += l;
  }
}
export const YEAR_DAYS = 365;
export const FIRST_YEAR_BC = 133;

export interface DateParts {
  yearBC: number;
  month: number; // 0-11
  dom: number; // 1-based
  doy: number; // 0-364
}

export function dateOf(day: number): DateParts {
  const y = Math.floor(day / YEAR_DAYS);
  const doy = day - y * YEAR_DAYS;
  let m = 11;
  while (MONTH_START[m] > doy) m--;
  return { yearBC: FIRST_YEAR_BC - y, month: m, dom: doy - MONTH_START[m] + 1, doy };
}

export function dayOf(yearBC: number, month: number, dom: number): number {
  return (FIRST_YEAR_BC - yearBC) * YEAR_DAYS + MONTH_START[month] + dom - 1;
}

export function yearBCOf(day: number): number {
  return dateOf(day).yearBC;
}

/** Age in years during the given year (Romans counted by year). */
export function ageIn(bornBC: number, yearBC: number): number {
  return bornBC - yearBC;
}

export function nonesOf(month: number): number {
  return [2, 4, 6, 9].includes(month) ? 7 : 5;
}
export function idesOf(month: number): number {
  return nonesOf(month) + 8;
}

const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];
export function roman(n: number): string {
  let out = '';
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
  return out;
}

/** e.g. "a.d. III Id. Mart." */
export function romanDate(day: number): string {
  const { month, dom } = dateOf(day);
  const nones = nonesOf(month);
  const ides = idesOf(month);
  const m = ABBR[month];
  if (dom === 1) return `Kal. ${m}`;
  if (dom === nones) return `Non. ${m}`;
  if (dom === ides) return `Id. ${m}`;
  if (dom < nones) return dom === nones - 1 ? `pridie Non. ${m}` : `a.d. ${roman(nones - dom + 1)} Non. ${m}`;
  if (dom < ides) return dom === ides - 1 ? `pridie Id. ${m}` : `a.d. ${roman(ides - dom + 1)} Id. ${m}`;
  const next = ABBR[(month + 1) % 12];
  const len = MONTH_LEN[month];
  if (dom === len) return `pridie Kal. ${next}`;
  return `a.d. ${roman(len - dom + 2)} Kal. ${next}`;
}

export function plainDate(day: number): string {
  const d = dateOf(day);
  return `${d.dom} ${MONTHS[d.month]} ${d.yearBC} BC`;
}

export function auc(yearBC: number): number {
  return 754 - yearBC;
}

export function monthName(month: number): string {
  return MONTHS[month];
}
