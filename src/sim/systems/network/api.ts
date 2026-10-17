// Network queries (pure). Mutation happens only through bus events handled in ./index.ts.

import type { Breakdown, CharId, Favor, GameState, Memory } from '../../types';
import { breakdown, clamp } from '../../util';

export function memoryValue(m: Memory, day: number): number {
  if (!m.halfLife) return m.weight;
  return m.weight * Math.pow(0.5, (day - m.day) / m.halfLife);
}

export function hasTie(s: GameState, a: CharId, b: CharId, kind: 'amicus' | 'inimicus' | 'kin'): boolean {
  return s.network.ties.some((t) => t.kind === kind && ((t.a === a && t.b === b) || (t.a === b && t.b === a)));
}

export function tiesOf(s: GameState, a: CharId) {
  return s.network.ties.filter((t) => t.a === a || t.b === a).map((t) => ({ other: t.a === a ? t.b : t.a, kind: t.kind, since: t.since }));
}

/** What `owner` thinks of `about`, with the reasons. */
export function opinion(s: GameState, owner: CharId, about: CharId): Breakdown {
  const o = s.chars[owner];
  const a = s.chars[about];
  if (!o || !a || owner === about) return { total: 0, parts: [] };
  const parts: { label: string; value: number }[] = [];
  if (o.familyId && o.familyId === a.familyId) parts.push({ label: 'Same family', value: 30 });
  else if (hasTie(s, owner, about, 'kin')) parts.push({ label: 'Kin by marriage', value: 20 });
  const dl = Math.abs(o.lean - a.lean);
  parts.push({ label: dl < 0.5 ? 'Shares his politics' : 'Differs in politics', value: Math.round(12 - 18 * dl) });
  const fam = a.familyId ? s.families[a.familyId] : undefined;
  if (o.rank === 'senator' && (!fam || fam.consulAncestors === 0) && a.rank !== 'senator') {
    const v = -Math.round(o.traits.pride * 12);
    if (v) parts.push({ label: 'A new man', value: v });
  }
  if (a.patronId === owner) parts.push({ label: 'His client', value: 15 });
  if (o.patronId === about) parts.push({ label: 'His patron', value: 15 });
  if (hasTie(s, owner, about, 'amicus')) parts.push({ label: 'Friendship (amicitia)', value: 15 });
  if (hasTie(s, owner, about, 'inimicus')) parts.push({ label: 'Declared enmity', value: -30 });
  const grouped = new Map<string, number>();
  for (const m of s.network.memories[owner] ?? []) {
    if (m.about !== about) continue;
    grouped.set(m.act, (grouped.get(m.act) ?? 0) + memoryValue(m, s.day));
  }
  for (const [act, v] of grouped) parts.push({ label: act, value: Math.round(v) });
  return breakdown(parts, -100, 100);
}

export function memoriesAbout(s: GameState, owner: CharId, about: CharId): (Memory & { now: number })[] {
  return (s.network.memories[owner] ?? []).filter((m) => m.about === about).map((m) => ({ ...m, now: memoryValue(m, s.day) }));
}

export function favorsOwed(s: GameState, debtor: CharId, creditor: CharId): Favor[] {
  return s.network.favors.filter((f) => f.debtor === debtor && f.creditor === creditor);
}

export function favorBalance(s: GameState, debtor: CharId, creditor: CharId): number {
  return favorsOwed(s, debtor, creditor).reduce((a, f) => a + f.weight, 0);
}

/** Likelihood (0..1) that `who` grants a request of difficulty `cost` from `asker`. */
export function willingness(s: GameState, who: CharId, asker: CharId, cost: number): Breakdown {
  const op = opinion(s, who, asker).total;
  const owed = favorBalance(s, who, asker);
  const loyal = s.chars[who]?.traits.loyalty ?? 0.5;
  const parts = [
    { label: 'Base', value: 0.35 },
    { label: 'His opinion of you', value: op / 140 },
    { label: 'Favors he owes you', value: owed * (0.12 + 0.12 * loyal) },
    { label: 'Size of the request', value: -cost * 0.12 },
  ];
  return breakdown(parts, 0.02, 0.97);
}

export function clampOpinion(v: number) {
  return clamp(v, -100, 100);
}
