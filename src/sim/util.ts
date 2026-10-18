import { dateOf } from './calendar';
import type { Breakdown, Character, CharId, GameState } from './types';

export const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export const logit = (p: number) => Math.log(p / (1 - p));
export const round = (x: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(x * f) / f;
};

export function breakdown(parts: { label: string; value: number }[], lo = -Infinity, hi = Infinity): Breakdown {
  const kept = parts.filter((p) => p.value !== 0);
  const sum = kept.reduce((a, p) => a + p.value, 0);
  return { total: clamp(sum, lo, hi), parts: kept };
}

export function yearBC(s: GameState): number {
  return dateOf(s.day).yearBC;
}

export function ageOf(s: GameState, c: Character): number {
  return c.bornBC - yearBC(s);
}

export function player(s: GameState): Character {
  return s.chars[s.playerId];
}

export function ch(s: GameState, id: CharId | undefined | null): Character | undefined {
  return id ? s.chars[id] : undefined;
}

export function fullName(c: Character): string {
  if (c.female) return [c.nomen, c.cognomen].filter(Boolean).join(' ');
  return [c.praenomen, c.nomen, c.cognomen].filter(Boolean).join(' ');
}

const ABBR: Record<string, string> = {
  Gaius: 'C.', Lucius: 'L.', Marcus: 'M.', Publius: 'P.', Quintus: 'Q.', Gnaeus: 'Cn.', Titus: 'T.',
  Sextus: 'Sex.', Aulus: 'A.', Decimus: 'D.', Tiberius: 'Ti.', Manius: "M'.", Servius: 'Ser.', Appius: 'Ap.', Spurius: 'Sp.',
};
export function shortName(c: Character): string {
  if (c.female) return c.cognomen ? `${c.nomen} ${c.cognomen}` : c.nomen;
  const p = ABBR[c.praenomen] ?? c.praenomen;
  return [p, c.nomen, c.cognomen].filter(Boolean).join(' ');
}

export function isActiveMan(s: GameState, c: Character): boolean {
  return c.alive && !c.female && ageOf(s, c) >= 16;
}

export function inRome(c: Character): boolean {
  return c.alive && c.location === 'rome';
}

export function living(s: GameState): Character[] {
  return Object.values(s.chars).filter((c) => c.alive);
}

// Lookup caches. Not part of the state: they are rebuilt from it on demand.
const histCache = new WeakMap<GameState, { n: number; map: Map<string, string> }>();
export function byHistorical(s: GameState, key: string): Character | undefined {
  let c = histCache.get(s);
  if (!c || c.n !== s.nextCharId) {
    c = { n: s.nextCharId, map: new Map() };
    for (const x of Object.values(s.chars)) if (x.historical) c.map.set(x.historical, x.id);
    histCache.set(s, c);
  }
  const id = c.map.get(key);
  return id ? s.chars[id] : undefined;
}

/** A key for caches over the set of characters: changes when one is added. -1 while an id is
 *  reserved but the character not yet stored (do not cache then). */
export function charsKey(s: GameState): number {
  return s.nextCharId <= 1 || s.chars[`c${s.nextCharId - 1}`] ? s.nextCharId : -1;
}

const allCache = new WeakMap<GameState, { n: number; list: Character[] }>();
/** Every character, living or dead (cached until a new one is added). Do not mutate the array. */
export function allChars(s: GameState): Character[] {
  const n = charsKey(s);
  if (n < 0) return Object.values(s.chars);
  let c = allCache.get(s);
  if (!c || c.n !== n) {
    c = { n, list: Object.values(s.chars) };
    allCache.set(s, c);
  }
  return c.list;
}

const romeCache = new WeakMap<GameState, { day: number; n: number; men: Character[] }>();
/** Living adult men in Rome today (cached per day). */
export function menInRome(s: GameState): Character[] {
  let c = romeCache.get(s);
  if (!c || c.day !== s.day || c.n !== s.nextCharId) {
    c = { day: s.day, n: s.nextCharId, men: Object.values(s.chars).filter((x) => x.alive && !x.female && x.location === 'rome' && ageOf(s, x) >= 16) };
    romeCache.set(s, c);
  }
  return c.men;
}

export function fmtHS(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}HS ${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
}

export function pct(p: number): string {
  if (p > 0 && p < 0.01) return '<1%';
  if (p < 1 && p > 0.99) return '>99%';
  return `${Math.round(p * 100)}%`;
}
