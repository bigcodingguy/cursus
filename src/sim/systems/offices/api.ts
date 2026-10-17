import { OFFICES, QUAESTOR_ELECTION, TRIBES, URBAN_TRIBES, tribeTurnout } from '../../../content/offices';
import { dayOf } from '../../calendar';
import { fork, gauss, type RngState } from '../../rng';
import type { Candidate, Character, CharId, Election, GameState, OfficeId, TribeResult } from '../../types';
import { ageOf, yearBC } from '../../util';
import { standingOf } from '../standing/api';

export function holdsOffice(s: GameState, id: CharId, office: OfficeId): boolean {
  const y = yearBC(s);
  return s.offices.records.some((r) => r.who === id && r.office === office && r.yearBC === y);
}

export function heldEver(s: GameState, id: CharId, office: OfficeId): boolean {
  const y = yearBC(s);
  return s.offices.records.some((r) => r.who === id && r.office === office && r.yearBC >= y);
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

/** Why a man may not stand for the quaestorship, or null. */
export function quaestorIneligible(s: GameState, c: Character, forYearBC: number): string | null {
  if (!c.alive || c.female) return 'Not eligible';
  if (heldEver(s, c.id, 'quaestor') || s.offices.records.some((r) => r.who === c.id && r.office === 'quaestor')) return 'Already held the quaestorship';
  if (c.bornBC - forYearBC < OFFICES.quaestor.minAge) return `Too young: a quaestor must be ${OFFICES.quaestor.minAge} in his year of office (you will be ${c.bornBC - forYearBC})`;
  if (c.servedAbroad < 1) return 'Must first have served at least one campaign abroad';
  if (c.location !== 'rome') return 'Must be in Rome';
  if (c.flags.exiled) return 'In exile';
  return null;
}

export function openElection(s: GameState): Election | undefined {
  return s.offices.elections.find((e) => e.status === 'open');
}

export function candidacyOf(s: GameState, id: CharId): Candidate | undefined {
  return openElection(s)?.candidates.find((c) => c.who === id);
}

export function electionDayFor(yearBC: number): number {
  return dayOf(yearBC, QUAESTOR_ELECTION.month, QUAESTOR_ELECTION.dom);
}

// ---------------- the vote ----------------

export interface Profile {
  who: CharId;
  dig: number;
  people: number;
  boni: number;
  tribe: string;
  canvass: Record<string, number>;
  bribes: Record<string, number>;
  endorsers: { tribe: string; dig: number }[];
}

export function profileOf(s: GameState, cand: Candidate): Profile {
  const c = s.chars[cand.who];
  return {
    who: c.id,
    dig: standingOf(s, c.id, 'dignitas').total,
    people: standingOf(s, c.id, 'people').total,
    boni: standingOf(s, c.id, 'boni').total,
    tribe: c.tribe,
    canvass: cand.canvass,
    bribes: cand.bribes,
    endorsers: cand.endorsements.filter((e) => s.chars[e]?.alive).map((e) => ({ tribe: s.chars[e].tribe, dig: standingOf(s, e, 'dignitas').total })),
  };
}

/** A candidate's pull in a tribe, before luck. Each part explains itself. */
export function appealParts(p: Profile, tribe: string): { label: string; value: number }[] {
  const urban = URBAN_TRIBES.includes(tribe);
  const parts = [
    { label: 'Dignitas and name', value: 0.035 * p.dig },
    { label: 'Favor of the people', value: (urban ? 0.022 : 0.01) * p.people },
    { label: 'Favor of the boni', value: (urban ? 0.005 : 0.016) * p.boni },
  ];
  if (p.tribe === tribe) parts.push({ label: 'His own tribe', value: 1.0 });
  const effort = p.canvass[tribe] ?? 0;
  if (effort) parts.push({ label: 'Canvassing', value: 0.55 * Math.log(1 + effort) });
  const bribe = p.bribes[tribe] ?? 0;
  if (bribe) parts.push({ label: 'Gifts to voters', value: 0.4 * Math.log(1 + bribe / 1500) });
  let endorse = 0;
  for (const e of p.endorsers) endorse += (e.dig / 100) * (e.tribe === tribe ? 0.8 : 0.12);
  if (endorse) parts.push({ label: 'Endorsements', value: Math.min(1, endorse) });
  return parts;
}

function appeal(p: Profile, tribe: string): number {
  let v = 0;
  for (const x of appealParts(p, tribe)) v += x.value;
  return v;
}

export function profiles(s: GameState, e: Election): Profile[] {
  return e.candidates.filter((c) => s.chars[c.who]?.alive && s.chars[c.who].location === 'rome').map((c) => profileOf(s, c));
}

/** Each candidate's pull in each tribe, before luck. */
export function appealMatrix(profs: Profile[]): number[][] {
  return TRIBES.map((t) => profs.map((p) => appeal(p, t)));
}

export function voteOnce(e: Election, profs: Profile[], rng: RngState | null, matrix: number[][] = appealMatrix(profs)): { winners: CharId[]; tribes: TribeResult[]; tally: Record<CharId, { tribes: number; votes: number }> } {
  const tribes: TribeResult[] = [];
  const tally: Record<CharId, { tribes: number; votes: number }> = {};
  for (const p of profs) tally[p.who] = { tribes: 0, votes: 0 };
  // A candidate's luck on the day (one draw each), plus the mood of each tribe.
  const dayLuck = profs.map(() => (rng ? 0.4 * gauss(rng) : 0));
  TRIBES.forEach((t, ti) => {
    const voters = tribeTurnout(t);
    const row = matrix[ti];
    const w = profs.map((_p, i) => Math.exp(row[i] + dayLuck[i] + (rng ? 0.3 * gauss(rng) : 0)));
    let sum = 0;
    for (const x of w) sum += x;
    sum = sum || 1;
    const votes: Record<CharId, number> = {};
    const idx = profs.map((p, i) => {
      votes[p.who] = Math.round(voters * Math.min(1, (e.seats * w[i]) / sum) * 0.92);
      return i;
    });
    idx.sort((a, b) => votes[profs[b].who] - votes[profs[a].who] || (profs[a].who < profs[b].who ? -1 : 1));
    const carried = idx.slice(0, e.seats).map((i) => profs[i].who);
    for (const p of profs) tally[p.who].votes += votes[p.who];
    for (const id of carried) tally[id].tribes += 1;
    tribes.push({ tribe: t, voters, votes, carried });
  });
  const ranked = [...profs].sort((a, b) => tally[b.who].tribes - tally[a.who].tribes || tally[b.who].votes - tally[a.who].votes);
  return { winners: ranked.slice(0, e.seats).map((p) => p.who), tribes, tally };
}

export const FORECAST_RUNS = 200;

/** The election run many times. The real vote picks one of these runs at random, so the shown odds are exact. */
export function forecastRuns(s: GameState, e: Election) {
  const base = fork({ s: s.seed }, e.day * 31 + e.postponements * 7 + e.candidates.length);
  const profs = profiles(s, e);
  const matrix = appealMatrix(profs);
  const runs = [];
  for (let i = 0; i < FORECAST_RUNS; i++) runs.push(voteOnce(e, profs, fork(base, i * 7919), matrix));
  return runs;
}

export function winChance(s: GameState, e: Election, who: CharId): number {
  const runs = forecastRuns(s, e);
  return runs.filter((r) => r.winners.includes(who)).length / runs.length;
}

/** Votes `who` would need to win enough extra tribes to place among the winners (in the expected outcome). */
export function voteGap(s: GameState, e: Election, who: CharId): number {
  const r = voteOnce(e, profiles(s, e), null);
  if (r.winners.includes(who) || !r.tally[who]) return 0;
  const ranked = Object.entries(r.tally).sort((a, b) => b[1].tribes - a[1].tribes || b[1].votes - a[1].votes);
  const last = ranked[e.seats - 1][1].tribes;
  const need = last - r.tally[who].tribes + 1;
  const deficits = r.tribes
    .filter((t) => !t.carried.includes(who))
    .map((t) => t.votes[t.carried[t.carried.length - 1]] - t.votes[who] + 1)
    .sort((a, b) => a - b);
  return deficits.slice(0, Math.max(1, need)).reduce((a, b) => a + b, 0);
}

export function eligibleAge(s: GameState, c: Character, office: OfficeId): boolean {
  return ageOf(s, c) >= OFFICES[office].minAge;
}
