// Laws before the people: queries and odds (pure).

import { LAWS, type LawDef } from '../../../content/laws';
import { evalCond } from '../../dsl';
import type { Breakdown, Character, CharId, GameState, Proposal } from '../../types';
import { breakdown, shortName, sigmoid } from '../../util';
import { favorBalance, opinion } from '../network/api';
import { currentHolders, holdsOffice } from '../offices/api';
import { standingOf } from '../standing/api';

/** Days between posting a bill and the vote (a trinundinum, roughly). */
export const NOTICE_DAYS = 24;

export function lawDef(id: string): LawDef | undefined {
  return LAWS.find((l) => l.id === id);
}

export function pendingProposals(s: GameState): Proposal[] {
  return s.assembly.proposals.filter((p) => p.status === 'pending');
}

export function proposalOf(s: GameState, who: CharId): Proposal | undefined {
  return s.assembly.proposals.find((p) => p.status === 'pending' && p.proposer === who);
}

/** May this man put a law to the people now? */
export function canPropose(s: GameState, c: Character): string | null {
  if (!holdsOffice(s, c.id, 'tribune_pleb') && !holdsOffice(s, c.id, 'consul')) return 'Only a tribune of the plebs or a consul can put a law to the people';
  if (c.location !== 'rome') return 'Must be in Rome';
  if (proposalOf(s, c.id)) return 'You already have a bill posted';
  return null;
}

/** Laws open to be proposed now. */
export function availableLaws(s: GameState): LawDef[] {
  return LAWS.filter((l) => {
    const last = s.assembly.passed[l.id];
    if (last !== undefined && (l.again === undefined || s.day - last < l.again)) return false;
    // A bill that was just fought over waits a year before anyone tries again.
    if (s.assembly.proposals.some((p) => p.law === l.id && (p.status === 'pending' || s.day - p.voteDay < 365))) return false;
    return evalCond(s, l.when, { roles: {}, vars: {} });
  });
}

/** How hostile a man is to a law, from -1 (for it) to 1 (against it). */
function hostility(c: Character, law: LawDef): number {
  return law.side * -c.lean;
}

/** Chance that tribune `t` vetoes `p`. The same number the vote uses. */
export function vetoChance(s: GameState, p: Proposal, t: Character): Breakdown {
  const law = lawDef(p.law)!;
  const op = opinion(s, t.id, p.proposer).total;
  const client = t.patronId === p.proposer;
  const parts = [
    { label: 'Base', value: -3.2 },
    { label: 'His politics against the bill', value: 3.4 * Math.max(0, hostility(t, law)) },
    { label: 'His opinion of the proposer', value: -op / 35 },
    { label: 'Boldness', value: (t.traits.boldness - 0.5) * 1.2 },
    { label: 'A client does not lightly cross his patron', value: client ? -1.0 * (0.5 + t.traits.loyalty) : 0 },
    { label: 'Favors he owes the proposer', value: -0.3 * favorBalance(s, t.id, p.proposer) },
    { label: 'A veto is dangerous in violent times', value: s.crisis.stability < 45 ? -0.6 : 0 },
  ];
  const logit = parts.reduce((a, x) => a + x.value, 0);
  return { total: sigmoid(logit), parts: [{ label: `Logit ${logit.toFixed(1)}`, value: 0 }, ...parts] };
}

/** Tribunes who could veto, in the order they would be asked. */
export function vetoers(s: GameState, p: Proposal): Character[] {
  return currentHolders(s, 'tribune_pleb')
    .filter((id) => id !== p.proposer)
    .map((id) => s.chars[id])
    .filter((c) => c?.alive && c.location === 'rome')
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Chance the assembly passes the bill if it comes to a vote. */
export function voteChance(s: GameState, p: Proposal): Breakdown {
  const law = lawDef(p.law)!;
  const proposer = s.chars[p.proposer];
  const people = proposer ? standingOf(s, proposer.id, 'people').total : 0;
  const parts = [
    { label: 'How the bill sits with the voters', value: (law.appeal - 0.5) * 5 },
    { label: 'The proposer’s favor with the people', value: people / 45 },
    { label: 'Speeches for and against', value: p.swing },
    { label: 'Hard times make the crowd bolder', value: law.side < 0 && s.crisis.stability < 50 ? 0.4 : 0 },
  ];
  const logit = parts.reduce((a, x) => a + x.value, 0);
  return breakdown([{ label: 'Even odds', value: 0.5 }, { label: 'The case for and against', value: sigmoid(logit) - 0.5 }], 0.01, 0.99);
}

/** The honest chance the bill becomes law: no tribune vetoes, then the vote passes. Parts add up to the total. */
export function passChance(s: GameState, p: Proposal): Breakdown {
  const vote = voteChance(s, p).total;
  let alive = 1;
  const parts: { label: string; value: number }[] = [];
  for (const t of vetoers(s, p)) {
    const v = vetoChance(s, p, t).total;
    if (v < 0.005) continue;
    parts.push({ label: `${shortName(t)} may veto (${Math.round(v * 100)}%)`, value: -alive * v * vote });
    alive *= 1 - v;
  }
  return { total: alive * vote, parts: [{ label: 'The assembly votes it through', value: vote }, ...parts] };
}

/** Whose speech would help, for the UI and NPCs. */
export function speechWeight(c: Character): number {
  return 0.15 + c.oratory / 200;
}
