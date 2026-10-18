import { CENTURIES, ELECTION_DEFS, FASTI, OFFICES, TRIBES, URBAN_TRIBES, tribeTurnout } from '../../../content/offices';
import { fork, gauss, type RngState } from '../../rng';
import type { Candidate, Character, CharId, Election, GameState, OfficeId, TribeResult } from '../../types';
import { ageOf, yearBC } from '../../util';
import { standingOf } from '../standing/api';

export function holdsOffice(s: GameState, id: CharId, office: OfficeId): boolean {
  const y = yearBC(s);
  return s.offices.records.some((r) => r.who === id && r.office === office && r.yearBC === y);
}

/** Held now or before (not counting offices won for a future year). */
export function heldEver(s: GameState, id: CharId, office: OfficeId): boolean {
  const y = yearBC(s);
  return s.offices.records.some((r) => r.who === id && r.office === office && r.yearBC >= y);
}

function heldAny(s: GameState, id: CharId, office: OfficeId): boolean {
  return s.offices.records.some((r) => r.who === id && r.office === office);
}

export function officesOf(s: GameState, id: CharId) {
  return s.offices.records.filter((r) => r.who === id).sort((a, b) => b.yearBC - a.yearBC);
}

export function currentHolders(s: GameState, office: OfficeId): CharId[] {
  const y = yearBC(s);
  return s.offices.records.filter((r) => r.office === office && r.yearBC === y).map((r) => r.who);
}

export function governorNow(s: GameState, id: CharId) {
  return s.offices.governors.find((g) => g.who === id && !g.returned);
}

/** Why a man may not stand for an office in a given year, or null. The rules of the cursus. */
export function ineligibleFor(s: GameState, c: Character, office: OfficeId, forYearBC: number): string | null {
  if (!c.alive || c.female) return 'Not eligible';
  if (c.flags.exiled || c.location === 'exile') return 'In exile';
  if (c.flags.foreign) return 'Not a citizen';
  if (c.location !== 'rome') return 'Must be in Rome';
  const def = OFFICES[office];
  const age = c.bornBC - forYearBC;
  if (age < def.minAge) return `Too young: a ${def.label.toLowerCase()} must be ${def.minAge} in his year of office (you would be ${age})`;
  const recs = s.offices.records.filter((r) => r.who === c.id && r.office !== 'military_tribune');
  if (recs.some((r) => r.yearBC === forYearBC)) return 'Already elected to an office for that year';
  if ((c.flags.barredUntil ?? 0) > 0 && forYearBC > c.flags.barredUntil) return `Barred from office until ${c.flags.barredUntil} BC after a conviction`;
  const fam = c.familyId ? s.families[c.familyId] : undefined;
  switch (office) {
    case 'quaestor':
      if (heldAny(s, c.id, 'quaestor')) return 'Already held the quaestorship';
      if (c.servedAbroad < 1) return 'Must first have served at least one campaign abroad';
      return null;
    case 'tribune_pleb':
      if (fam?.patrician) return 'A patrician cannot be tribune of the plebs';
      if (c.servedAbroad < 1) return 'Must first have served at least one campaign abroad';
      return null;
    case 'aedile':
      if (!heldAny(s, c.id, 'quaestor')) return 'Must have been quaestor';
      if (heldAny(s, c.id, 'aedile')) return 'Already held the aedileship';
      return null;
    case 'praetor':
      if (!heldAny(s, c.id, 'quaestor')) return 'Must have been quaestor';
      if (heldAny(s, c.id, 'praetor')) return 'Already held the praetorship';
      if (recs.some((r) => r.yearBC === forYearBC + 1)) return 'The law requires a year out of office between magistracies';
      return null;
    case 'consul': {
      if (!heldAny(s, c.id, 'praetor')) return 'Must have been praetor';
      if (recs.some((r) => r.yearBC === forYearBC + 1) && !c.flags.iterationAllowed) return 'The law requires a year out of office between magistracies';
      const last = recs.filter((r) => r.office === 'consul').map((r) => r.yearBC).sort((a, b) => a - b)[0];
      if (last !== undefined && last - forYearBC < 10 && !c.flags.iterationAllowed) return 'Ten years must pass between consulships';
      return null;
    }
    case 'censor':
      if (!heldAny(s, c.id, 'consul')) return 'Must have been consul';
      if (heldAny(s, c.id, 'censor')) return 'Already held the censorship';
      return null;
    default:
      return 'Not an elected office';
  }
}

/** Kept for older callers. */
export function quaestorIneligible(s: GameState, c: Character, forYearBC: number): string | null {
  return ineligibleFor(s, c, 'quaestor', forYearBC);
}

export function openElections(s: GameState): Election[] {
  return s.offices.elections.filter((e) => e.status === 'open').sort((a, b) => a.day - b.day);
}

/** The election that concerns the player: the one he stands in, else the next to be held. */
export function openElection(s: GameState): Election | undefined {
  const open = openElections(s);
  return open.find((e) => e.candidates.some((c) => c.who === s.playerId)) ?? open[0];
}

export function electionFor(s: GameState, office: OfficeId): Election | undefined {
  return s.offices.elections.find((e) => e.status === 'open' && e.office === office);
}

export function candidacyOf(s: GameState, id: CharId): Candidate | undefined {
  for (const e of openElections(s)) {
    const c = e.candidates.find((x) => x.who === id);
    if (c) return c;
  }
  return undefined;
}

export function electionOfCandidate(s: GameState, id: CharId): Election | undefined {
  return openElections(s).find((e) => e.candidates.some((c) => c.who === id));
}

export function assemblyOf(office: OfficeId): 'tribal' | 'centuriate' {
  return ELECTION_DEFS.find((d) => d.office === office)?.assembly ?? 'tribal';
}

/** History's expectation: men the fasti name for this office and year carry the city's assumption with them. */
export const fastiList = (y: number, office: OfficeId) => {
  const f = FASTI[y];
  if (!f) return undefined;
  return office === 'consul' ? f.consuls : office === 'tribune_pleb' ? f.tribunes : office === 'praetor' ? f.praetors : office === 'quaestor' ? f.quaestors : undefined;
};

/** History marks this man for this office in a later year, and he has not had it: he waits for his year. */
export function waitsForHisYear(c: Character, office: OfficeId, forYearBC: number): boolean {
  if (!c.historical) return false;
  for (let y = forYearBC - 1; y >= Math.max(100, forYearBC - 8); y--) if (fastiList(y, office)?.includes(c.historical)) return forYearBC > 120 || forYearBC - y > 2;
  return false;
}

/** History marks this man for this office now. Up to 120 BC the record is exact; after it, within two years of the
 *  recorded year (a man listed more than once, like Marius, keeps to his years), provided he has not had it yet. */
export function expectedBy(s: GameState, c: Character, office: OfficeId, forYearBC: number): boolean {
  if (!c.historical) return false;
  const key = c.historical;
  if (fastiList(forYearBC, office)?.includes(key)) return true;
  if (forYearBC >= 120) return false;
  const listed: number[] = [];
  for (let y = 119; y >= 100; y--) if (fastiList(y, office)?.includes(key)) listed.push(y);
  if (listed.length !== 1) return false;
  const y = listed[0];
  if (Math.abs(y - forYearBC) > 2) return false;
  return !s.offices.records.some((r) => r.who === c.id && r.office === office && Math.abs(r.yearBC - y) <= 2);
}

// ---------------- the vote ----------------

export interface Unit {
  id: string;
  label: string;
  weight: number;
  voters: number;
  urban: boolean;
  wealth: number;
}

export const TRIBAL_UNITS: Unit[] = TRIBES.map((t) => ({ id: t, label: t, weight: 1, voters: tribeTurnout(t), urban: URBAN_TRIBES.includes(t), wealth: 0.5 }));
export const CENTURIATE_UNITS: Unit[] = CENTURIES.map((c) => ({ ...c, urban: false }));

export function unitsFor(e: Election): Unit[] {
  return assemblyOf(e.office) === 'centuriate' ? CENTURIATE_UNITS : TRIBAL_UNITS;
}

export interface Profile {
  who: CharId;
  dig: number;
  people: number;
  boni: number;
  tribe: string;
  canvass: Record<string, number>;
  bribes: Record<string, number>;
  endorsers: { tribe: string; dig: number }[];
  expected: boolean;
  assembly: 'tribal' | 'centuriate';
  /** Standing for the consulship with no consul among his ancestors. */
  newMan?: boolean;
}

export function profileOf(s: GameState, cand: Candidate, e?: Election): Profile {
  const c = s.chars[cand.who];
  return {
    who: c.id,
    dig: standingOf(s, c.id, 'dignitas').total,
    people: standingOf(s, c.id, 'people').total,
    boni: standingOf(s, c.id, 'boni').total,
    tribe: c.tribe,
    canvass: cand.canvass,
    bribes: cand.bribes,
    endorsers: cand.endorsements.filter((x) => s.chars[x]?.alive).map((x) => ({ tribe: s.chars[x].tribe, dig: standingOf(s, x, 'dignitas').total })),
    expected: !!e && expectedBy(s, c, e.office, e.forYearBC),
    assembly: e ? assemblyOf(e.office) : 'tribal',
    newMan: e?.office === 'consul' && !(c.familyId && (s.families[c.familyId]?.consulAncestors ?? 0) > 0),
  };
}

const avg = (r: Record<string, number>) => {
  const v = Object.values(r);
  return v.length ? v.reduce((a, b) => a + b, 0) / TRIBES.length : 0;
};

/** A candidate's pull in a voting unit, before luck. Each part explains itself. */
export function appealParts(p: Profile, unit: string | Unit): { label: string; value: number }[] {
  const u = typeof unit === 'string' ? (TRIBAL_UNITS.find((x) => x.id === unit) ?? CENTURIATE_UNITS.find((x) => x.id === unit))! : unit;
  const parts: { label: string; value: number }[] = [];
  if (p.assembly === 'centuriate') {
    // The rich vote first and weigh most: name and the boni count; the crowd counts in the lower classes.
    parts.push({ label: 'Dignitas and name', value: 0.045 * p.dig });
    parts.push({ label: 'Favor of the boni', value: 0.025 * u.wealth * p.boni });
    parts.push({ label: 'Favor of the people', value: 0.02 * (1 - u.wealth) * p.people });
    const effort = avg(p.canvass);
    if (effort) parts.push({ label: 'Canvassing', value: 0.55 * Math.log(1 + effort) });
    const bribe = avg(p.bribes);
    if (bribe) parts.push({ label: 'Gifts to voters', value: 0.4 * Math.log(1 + bribe / 1500) * (1 - u.wealth * 0.5) });
    let endorse = 0;
    for (const x of p.endorsers) endorse += (x.dig / 100) * 0.3;
    if (endorse) parts.push({ label: 'Endorsements', value: Math.min(1.2, endorse) });
  } else {
    parts.push({ label: 'Dignitas and name', value: 0.035 * p.dig });
    parts.push({ label: 'Favor of the people', value: (u.urban ? 0.022 : 0.013) * p.people });
    parts.push({ label: 'Favor of the boni', value: (u.urban ? 0.005 : 0.012) * p.boni });
    if (p.tribe === u.id) parts.push({ label: 'His own tribe', value: 1.0 });
    const effort = p.canvass[u.id] ?? 0;
    if (effort) parts.push({ label: 'Canvassing', value: 0.55 * Math.log(1 + effort) });
    const bribe = p.bribes[u.id] ?? 0;
    if (bribe) parts.push({ label: 'Gifts to voters', value: 0.4 * Math.log(1 + bribe / 1500) });
    let endorse = 0;
    for (const x of p.endorsers) endorse += (x.dig / 100) * (x.tribe === u.id ? 0.8 : 0.12);
    if (endorse) parts.push({ label: 'Endorsements', value: Math.min(1, endorse) });
  }
  if (p.expected) parts.push({ label: 'Everyone expects him to win', value: 2.8 });
  // The nobles guard the consulship: the centuries of the rich do not lightly elect a man without consular ancestors.
  if (p.newMan) parts.push({ label: 'A new man: no consul among his ancestors', value: -1.6 * u.wealth });
  return parts;
}

function appeal(p: Profile, u: Unit): number {
  let v = 0;
  for (const x of appealParts(p, u)) v += x.value;
  return v;
}

export function profiles(s: GameState, e: Election): Profile[] {
  return e.candidates.filter((c) => s.chars[c.who]?.alive && s.chars[c.who].location === 'rome').map((c) => profileOf(s, c, e));
}

/** Each candidate's pull in each unit, before luck. */
export function appealMatrix(e: Election, profs: Profile[]): number[][] {
  return unitsFor(e).map((u) => profs.map((p) => appeal(p, u)));
}

/** One vote. `tribes` in the tally counts the weight of the units a man carried (tribes, or centuries). */
export function voteOnce(e: Election, profs: Profile[], rng: RngState | null, matrix: number[][] = appealMatrix(e, profs)): { winners: CharId[]; tribes: TribeResult[]; tally: Record<CharId, { tribes: number; votes: number }> } {
  const tribes: TribeResult[] = [];
  const tally: Record<CharId, { tribes: number; votes: number }> = {};
  for (const p of profs) tally[p.who] = { tribes: 0, votes: 0 };
  const dayLuck = profs.map(() => (rng ? 0.4 * gauss(rng) : 0));
  unitsFor(e).forEach((u, ui) => {
    const row = matrix[ui];
    const w = profs.map((_p, i) => Math.exp(row[i] + dayLuck[i] + (rng ? 0.3 * gauss(rng) : 0)));
    let sum = 0;
    for (const x of w) sum += x;
    sum = sum || 1;
    const votes: Record<CharId, number> = {};
    const idx = profs.map((p, i) => {
      votes[p.who] = Math.round(u.voters * Math.min(1, (e.seats * w[i]) / sum) * 0.92);
      return i;
    });
    idx.sort((a, b) => votes[profs[b].who] - votes[profs[a].who] || (profs[a].who < profs[b].who ? -1 : 1));
    const carried = idx.slice(0, e.seats).map((i) => profs[i].who);
    for (const p of profs) tally[p.who].votes += votes[p.who];
    for (const id of carried) tally[id].tribes += u.weight;
    tribes.push({ tribe: u.label, voters: u.voters, votes, carried });
  });
  const ranked = [...profs].sort((a, b) => tally[b.who].tribes - tally[a.who].tribes || tally[b.who].votes - tally[a.who].votes);
  return { winners: ranked.slice(0, e.seats).map((p) => p.who), tribes, tally };
}

export const FORECAST_RUNS = 200;

/** The election run many times. The real vote picks one of these runs at random, so the shown odds are exact. */
export function forecastRuns(s: GameState, e: Election) {
  const base = fork({ s: s.seed }, e.day * 31 + e.postponements * 7 + e.candidates.length);
  const profs = profiles(s, e);
  const matrix = appealMatrix(e, profs);
  const runs = [];
  for (let i = 0; i < FORECAST_RUNS; i++) runs.push(voteOnce(e, profs, fork(base, i * 7919), matrix));
  return runs;
}

// Forecasts are costly; reuse them within a day while the field and the campaigns are unchanged.
const forecastCache = new WeakMap<GameState, { key: string; runs: ReturnType<typeof forecastRuns> }>();
export function winChance(s: GameState, e: Election, who: CharId): number {
  const key = `${s.day}|${e.office}|${e.day}|${e.postponements}|${JSON.stringify(e.candidates)}`;
  let c = forecastCache.get(s);
  if (!c || c.key !== key) {
    c = { key, runs: forecastRuns(s, e) };
    forecastCache.set(s, c);
  }
  return c.runs.filter((r) => r.winners.includes(who)).length / c.runs.length;
}

/** Votes `who` would need to win enough extra units to place among the winners (in the expected outcome). */
export function voteGap(s: GameState, e: Election, who: CharId): number {
  const r = voteOnce(e, profiles(s, e), null);
  if (r.winners.includes(who) || !r.tally[who]) return 0;
  const ranked = Object.entries(r.tally).sort((a, b) => b[1].tribes - a[1].tribes || b[1].votes - a[1].votes);
  const last = ranked[Math.min(e.seats, ranked.length) - 1][1].tribes;
  const units = unitsFor(e);
  let need = last - r.tally[who].tribes + 1;
  const deficits = r.tribes
    .map((t, i) => ({ t, w: units[i].weight }))
    .filter(({ t }) => !t.carried.includes(who))
    .map(({ t, w }) => ({ d: t.votes[t.carried[t.carried.length - 1]] - t.votes[who] + 1, w }))
    .sort((a, b) => a.d / a.w - b.d / b.w);
  let total = 0;
  for (const x of deficits) {
    if (need <= 0) break;
    total += x.d;
    need -= x.w;
  }
  return total;
}

export function eligibleAge(s: GameState, c: Character, office: OfficeId): boolean {
  return ageOf(s, c) >= OFFICES[office].minAge;
}
