// Courts: pure computation of juror leanings and exact verdict odds.

import { OFFICES, PROVINCES } from '../../../content/offices';
import type { Breakdown, Case, CasePrep, Character, GameState, Juror, OfficeId, Strategy } from '../../types';
import { ageOf, breakdown, sigmoid } from '../../util';
import { opinion } from '../network/api';
import { standingOf } from '../standing/api';

export const STRATEGIES: { id: Strategy; label: string; blurb: string }[] = [
  { id: 'facts', label: 'The facts', blurb: 'Accounts, witnesses, sums. Strong when the evidence is.' },
  { id: 'character', label: 'Character', blurb: "Praise or blacken the defendant's life and name. Weighs with senators." },
  { id: 'pity', label: 'Pity', blurb: 'Tears, children, old wounds. The classic defense.' },
  { id: 'threat', label: 'Political threat', blurb: 'Warn the jury what the city will think. Depends on the mood outside.' },
];

/** Each strategy beats one other: facts > pity > threat > character > facts. */
const BEATS: Record<Strategy, Strategy> = { facts: 'pity', pity: 'threat', threat: 'character', character: 'facts' };

export const ROUND_NAMES = ['Opening speeches', 'The witnesses', 'Closing speeches'];

export function caseById(s: GameState, id: string): Case | undefined {
  return s.courts.cases.find((c) => c.id === id);
}

/** What the man is charged with, in plain words. */
export function chargeLabel(c: Case): string {
  if (c.charge === 'ambitus') return `bribery of the voters in his canvass for the ${OFFICES[c.province as OfficeId]?.label.toLowerCase() ?? 'magistracy'}`;
  return `extortion as governor of ${PROVINCES.find((p) => p.id === c.province)?.label ?? c.province}`;
}

export function playerCase(s: GameState): Case | undefined {
  return s.courts.cases.find((c) => c.status !== 'closed' && c.status !== 'open' && (c.prosecutor === s.playerId || c.defender === s.playerId));
}

export function prepScore(p: CasePrep, s: GameState): number {
  const co = p.coCounsel ? s.chars[p.coCounsel] : undefined;
  return 0.16 * p.witnesses + 0.2 * p.documents + 0.1 * p.research + (co?.alive ? co.oratory / 450 : 0);
}

export function evidenceTerm(s: GameState, c: Case): Breakdown {
  return breakdown([
    { label: 'Strength of the evidence', value: 2.2 * (c.evidence - 0.45) },
    { label: 'Prosecution preparation', value: prepScore(c.prosecutionPrep, s) },
    { label: 'Defense preparation', value: -prepScore(c.defensePrep, s) },
  ]);
}

/** Logit lean of one juror toward conviction, before the speeches. */
export function jurorLean(s: GameState, c: Case, j: Juror): Breakdown {
  const def = s.chars[c.defendant];
  const parts = [{ label: 'Juror', value: j.bias }];
  if (def.rank === 'senator') parts.push({ label: j.cls === 'senator' ? 'Senators protect their own' : 'Equites distrust senatorial governors', value: j.cls === 'senator' ? -0.55 : 0.25 });
  parts.push({ label: 'Politics', value: -0.5 * (1 - Math.abs(j.lean - def.lean)) + 0.2 });
  if (j.charId) {
    parts.push({ label: 'His view of the defendant', value: -0.014 * opinion(s, j.charId, c.defendant).total });
    if (c.prosecutor) parts.push({ label: 'His view of the prosecutor', value: 0.008 * opinion(s, j.charId, c.prosecutor).total });
    if (c.defender) parts.push({ label: 'His view of the defender', value: -0.008 * opinion(s, j.charId, c.defender).total });
  }
  if (j.bribedBy) parts.push({ label: 'Bribed', value: j.bribedBy === 'prosecution' ? 2.5 : -2.5 });
  return breakdown(parts);
}

/** Logit of each sitting juror toward conviction, before the jury's shared mood on the day. */
export function jurorLogits(s: GameState, c: Case, extraSway = 0): number[] {
  const e = evidenceTerm(s, c).total;
  return c.jury.filter((j) => !j.rejected).map((j) => jurorLean(s, c, j).total + e + c.sway + extraSway);
}

/**
 * The jury's shared mood on the day: a common shift to every juror, drawn from these
 * (Gauss–Hermite) points with these weights. The verdict draws from exactly this distribution.
 */
export const MOOD_SIGMA = 0.8;
export const MOOD_POINTS: { x: number; w: number }[] = [
  { x: -2.8570, w: 0.0113 }, { x: -1.3556, w: 0.2221 }, { x: 0, w: 0.5333 }, { x: 1.3556, w: 0.2221 }, { x: 2.8570, w: 0.0113 },
];

/** Exact probability of conviction: majority of votes (ties acquit), integrated over the jury's mood. */
export function verdictChance(logits: number[]): number {
  let p = 0;
  for (const m of MOOD_POINTS) p += m.w * majorityChance(logits.map((l) => sigmoid(l + MOOD_SIGMA * m.x)));
  return p;
}

export function jurorProbs(s: GameState, c: Case, extraSway = 0): number[] {
  return jurorLogits(s, c, extraSway).map(sigmoid);
}

export function convictionChance(s: GameState, c: Case, extraSway = 0): number {
  return verdictChance(jurorLogits(s, c, extraSway));
}

/** Exact probability that a majority votes to convict (ties acquit), from independent juror votes. */
export function majorityChance(probs: number[]): number {
  let dp = [1];
  for (const p of probs) {
    const next = new Array(dp.length + 1).fill(0);
    for (let k = 0; k < dp.length; k++) {
      next[k] += dp[k] * (1 - p);
      next[k + 1] += dp[k] * p;
    }
    dp = next;
  }
  const n = probs.length;
  let win = 0;
  for (let k = Math.floor(n / 2) + 1; k <= n; k++) win += dp[k];
  return win;
}

function advocate(s: GameState, c: Case, side: 'prosecution' | 'defense'): Character | undefined {
  const id = side === 'prosecution' ? c.prosecutor : c.defender ?? c.defendant;
  return id ? s.chars[id] : undefined;
}

/** How hard a strategy lands, before the opponent's choice. */
export function strategyStrength(s: GameState, c: Case, side: 'prosecution' | 'defense', st: Strategy): number {
  const def = s.chars[c.defendant];
  const senJury = c.juryClass === 'senator';
  const prep = side === 'prosecution' ? c.prosecutionPrep : c.defensePrep;
  const mood = (60 - s.crisis.stability) / 60; // hot city: threats bite
  const defDig = standingOf(s, def.id, 'dignitas').total;
  switch (st) {
    case 'facts':
      return side === 'prosecution' ? 0.25 + 0.9 * c.evidence + 0.12 * prep.documents : 0.2 + 0.7 * (1 - c.evidence) + 0.1 * prep.documents;
    case 'character':
      return (side === 'prosecution' ? 0.35 + 0.004 * Math.max(0, 60 - defDig) : 0.25 + 0.006 * defDig) * (senJury ? 1.25 : 0.85) + 0.08 * prep.witnesses;
    case 'pity':
      return side === 'prosecution' ? 0.3 + 0.1 * prep.witnesses : 0.45 + 0.006 * Math.max(0, ageOf(s, def) - 40) + (senJury ? 0.1 : 0);
    case 'threat':
      return side === 'prosecution' ? 0.15 + 0.7 * Math.max(0, mood) * (senJury ? 1.2 : 0.8) : 0.15 + 0.5 * Math.max(0, mood) * (def.lean > 0 ? 1 : 0.5);
  }
}


export function roundSwing(s: GameState, c: Case, pros: Strategy, def: Strategy): number {
  const used = (side: 'prosecution' | 'defense', st: Strategy) => c.rounds.filter((r) => (side === 'prosecution' ? r.prosecution : r.defense) === st).length;
  const skill = (side: 'prosecution' | 'defense') => {
    const a = advocate(s, c, side);
    const prep = side === 'prosecution' ? c.prosecutionPrep : c.defensePrep;
    const co = prep.coCounsel ? s.chars[prep.coCounsel] : undefined;
    return 0.4 + (a ? a.oratory / 100 : 0.3) + (co?.alive ? co.oratory / 400 : 0);
  };
  const mult = (mine: Strategy, theirs: Strategy) => (BEATS[mine] === theirs ? 1.3 : BEATS[theirs] === mine ? 0.6 : 1);
  const p = skill('prosecution') * strategyStrength(s, c, 'prosecution', pros) * mult(pros, def) * Math.pow(0.7, used('prosecution', pros));
  const d = skill('defense') * strategyStrength(s, c, 'defense', def) * mult(def, pros) * Math.pow(0.7, used('defense', def));
  return 0.5 * (p - d);
}

/**
 * For each strategy the player might choose: the exact chance of winning if the verdict were taken after this round,
 * averaged over the opposing advocate's mixed plan.
 */
export function optionOdds(s: GameState, c: Case, side: 'prosecution' | 'defense'): { strategy: Strategy; win: number }[] {
  const mix = c.npcMix ?? [0.25, 0.25, 0.25, 0.25];
  return STRATEGIES.map(({ id }) => {
    let p = 0;
    STRATEGIES.forEach(({ id: opp }, k) => {
      if (!mix[k]) return;
      const swing = side === 'prosecution' ? roundSwing(s, c, id, opp) : roundSwing(s, c, opp, id);
      p += mix[k] * convictionChance(s, c, swing);
    });
    return { strategy: id, win: side === 'prosecution' ? p : 1 - p };
  });
}

/** An NPC advocate's plan: how likely he is to use each strategy, given his strengths and what he expects. */
export function npcMix(s: GameState, c: Case, side: 'prosecution' | 'defense', expect: Strategy | null): number[] {
  const vals = STRATEGIES.map(({ id }) => {
    const opps = expect ? [expect] : STRATEGIES.map((x) => x.id);
    let v = 0;
    for (const o of opps) v += side === 'prosecution' ? roundSwing(s, c, id, o) : -roundSwing(s, c, o, id);
    return v / opps.length;
  });
  const max = Math.max(...vals);
  const w = vals.map((v) => Math.exp((v - max) / 0.12));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => Math.round((x / sum) * 1000) / 1000);
}

/** NPC advocates choose the strategy that serves them best against what they expect. */
export function npcStrategy(s: GameState, c: Case, side: 'prosecution' | 'defense', expectOther: Strategy): Strategy {
  let best: Strategy = 'facts';
  let bestV = -Infinity;
  for (const { id } of STRATEGIES) {
    const sw = side === 'prosecution' ? roundSwing(s, c, id, expectOther) : -roundSwing(s, c, expectOther, id);
    if (sw > bestV) {
      bestV = sw;
      best = id;
    }
  }
  return best;
}
