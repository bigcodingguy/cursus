import type { Breakdown, CharId, GameState, StandingEntry, StandingKind } from '../../types';
import { breakdown } from '../../util';

export function entryValue(e: StandingEntry, day: number): number {
  if (!e.halfLife) return e.value;
  return e.value * Math.pow(0.5, (day - e.day) / e.halfLife);
}

/** Dignitas, favor of the people, favor of the boni — each with its reasons. */
export function standingOf(s: GameState, id: CharId, kind: StandingKind): Breakdown {
  const c = s.chars[id];
  if (!c) return { total: 0, parts: [] };
  const parts: { label: string; value: number }[] = [];
  if (kind === 'dignitas') {
    const fam = c.familyId ? s.families[c.familyId] : undefined;
    if (fam?.patrician) parts.push({ label: 'Patrician birth', value: 5 });
    if (fam && fam.consulAncestors) parts.push({ label: `${fam.consulAncestors} consuls among his ancestors`, value: Math.min(20, fam.consulAncestors * 4) });
    if (fam && fam.praetorAncestors) parts.push({ label: 'Praetorian ancestors', value: Math.min(9, fam.praetorAncestors * 3) });
    if (c.rank === 'senator') parts.push({ label: 'Member of the Senate', value: 10 });
    if (c.rank === 'eques') parts.push({ label: 'Equestrian rank', value: 3 });
  }
  const grouped = new Map<string, number>();
  for (const e of s.standing.entries[id] ?? []) {
    if (e.kind !== kind) continue;
    grouped.set(e.label, (grouped.get(e.label) ?? 0) + entryValue(e, s.day));
  }
  for (const [label, v] of grouped) parts.push({ label, value: Math.round(v * 10) / 10 });
  const b = breakdown(parts, kind === 'dignitas' ? 0 : -100, 100);
  b.total = Math.round(b.total);
  return b;
}
