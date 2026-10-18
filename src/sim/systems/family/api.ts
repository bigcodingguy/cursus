// Family queries (pure).

import type { Character, CharId, GameState, Marriage } from '../../types';
import { ageOf, allChars, charsKey } from '../../util';

// Children indexed by parent, rebuilt when the number of characters changes (and on adoption).
// Pure cache: derived from state, never stored in it.
const index = new WeakMap<GameState, { n: number; kids: Map<CharId, Character[]> }>();
function kidsOf(s: GameState, id: CharId): Character[] {
  const n = charsKey(s);
  let ix = index.get(s);
  if (!ix || ix.n !== n || n < 0) {
    const kids = new Map<CharId, Character[]>();
    for (const c of allChars(s)) {
      for (const p of [c.fatherId, c.motherId]) {
        if (!p) continue;
        const l = kids.get(p);
        if (l) l.push(c);
        else kids.set(p, [c]);
      }
    }
    for (const l of kids.values()) l.sort((a, b) => b.bornBC - a.bornBC);
    ix = { n, kids };
    index.set(s, ix);
  }
  return ix.kids.get(id) ?? [];
}
export function invalidateFamilyIndex(s: GameState): void {
  index.delete(s);
}

export function sonsOf(s: GameState, id: CharId): Character[] {
  return kidsOf(s, id).filter((c) => c.alive && !c.female && c.fatherId === id);
}

export function daughtersOf(s: GameState, id: CharId): Character[] {
  return kidsOf(s, id).filter((c) => c.alive && c.female && c.fatherId === id);
}

export function childrenOf(s: GameState, id: CharId): Character[] {
  return kidsOf(s, id).slice();
}

/** The man who inherits: the heir named in the testament if he still lives, else the eldest son (adopted sons count). */
export function heirOf(s: GameState, id: CharId): CharId | undefined {
  const named = s.family?.heirs[id];
  if (named && s.chars[named]?.alive && s.chars[named].fatherId === id) return named;
  return sonsOf(s, id)[0]?.id;
}

export function spouseOf(s: GameState, id: CharId): Character | undefined {
  const sp = s.chars[id]?.spouseId;
  return sp && s.chars[sp]?.alive ? s.chars[sp] : undefined;
}

export function marriageOf(s: GameState, id: CharId): Marriage | undefined {
  return s.family.marriages.find((m) => !m.ended && (m.husband === id || m.wife === id));
}

/** Who gives a woman in marriage: her father if alive, else the eldest man of her house. */
export function guardianOf(s: GameState, woman: Character): Character | undefined {
  const f = woman.fatherId ? s.chars[woman.fatherId] : undefined;
  if (f?.alive) return f;
  return allChars(s)
    .filter((c) => c.alive && !c.female && c.familyId === woman.familyId && c.id !== woman.id && ageOf(s, c) >= 20)
    .sort((a, b) => a.bornBC - b.bornBC)
    .reverse()[0];
}

export function marriageable(s: GameState, c: Character): boolean {
  if (!c.alive || c.spouseId) return false;
  const age = ageOf(s, c);
  return c.female ? age >= 14 && age <= 32 : age >= 18;
}

/** What a house can put up as a dowry. */
export function dowryFrom(s: GameState, guardian: Character | undefined): number {
  if (!guardian) return 20000;
  const a = s.money.accounts[guardian.id];
  const worth = a ? Math.max(0, a.cash) + a.income * 4 : 0;
  return Math.round(Math.min(400000, Math.max(20000, worth * 0.12)) / 1000) * 1000;
}

export function isNobilis(s: GameState, c: Character): boolean {
  const f = c.familyId ? s.families[c.familyId] : undefined;
  return !!f && f.consulAncestors > 0;
}
