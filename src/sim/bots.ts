// Bot players. They act only through commands, exactly as the UI does.

import { CAMPAIGNS, CANVASS_ZONES } from '../content/offices';
import { dateOf } from './calendar';
import { blockedBy, checkAction, command, tick, type Command } from './core';
import { newGame } from './setup';
import { optionOdds, playerCase } from './systems/courts/api';
import { visibleChoices } from './systems/events/api';
import { cashOf, debtOf } from './systems/money/api';
import { opinion } from './systems/network/api';
import { campaignOpen } from './systems/offices';
import { candidacyOf, heldEver, ineligibleFor, openElections } from './systems/offices/api';
import { standingOf } from './systems/standing/api';
import { availableIssues, bankers, creditLimit } from './systems/city';
import { clientsOf } from './systems/news';
import type { ActionParams, GameState } from './types';
import { allChars, ageOf, byHistorical, player } from './util';

export type StrategyId = 'orator' | 'populist' | 'establishment';

interface Strategy {
  id: StrategyId;
  label: string;
  routine: GameState['routine'];
  prefs: Record<string, string[]>;
  stance: (s: GameState, popular: 'for' | 'against') => 'for' | 'against';
  speakEvery: number;
  prosecuteFromAge: number;
  gifts: number;
}

/** How every bot answers the opportunities the world brings: sensibly, not greedily. */
const OPP_PREFS: Record<string, string[]> = {
  opp_patron_task: ['Do it gladly'],
  opp_patron_candidate: ['Canvass for'],
  opp_junior_counsel: ['Accept'],
  opp_client_trouble: ['Go before the praetor'],
  opp_dinner_invitation: ['Accept'],
  opp_banker: ['Neither'],
  opp_peer_support: ['Stand with him'],
  opp_slight: ['Let it pass'],
  opp_father_letter: ['Write back'],
  opp_elder_notice: ['Go, and listen'],
  legions: ['Join'],
};

export const STRATEGIES: Record<StrategyId, Strategy> = {
  orator: {
    id: 'orator',
    label: 'Orator (courts and speeches)',
    routine: 'attend',
    prefs: { intro: ['Scaevola'], capitol: ['Get off'], aventine: ['Bar your door'], popillian_court: ['Face'], creditor_warning: ['Press on'], creditor_warning_own: ['Press on'], asked_to_defend: ['Accept'], father_loan_called: ['Send him'] },
    stance: (_s, popular) => popular,
    speakEvery: 14,
    prosecuteFromAge: 20,
    gifts: 0,
  },
  populist: {
    id: 'populist',
    label: 'Populist (the people and the Gracchi)',
    routine: 'receive',
    prefs: { intro: ['Appius'], octavius_veto: ['Stand in the Forum'], octavius_deposed: ['Vote to depose'], capitol: ['Stand with Tiberius'], popillian_court: ['Leave'], scipio_italians: ['must go on'], gaius_laws: ['Throw yourself'], aventine: ['Bar your door'], creditor_warning: ['Press on'], creditor_warning_own: ['Press on'], asked_to_defend: ['Decline'], father_loan_called: ['Send him'] },
    stance: (_s, popular) => popular,
    speakEvery: 18,
    prosecuteFromAge: 23,
    gifts: 6000,
  },
  establishment: {
    id: 'establishment',
    label: 'Establishment climber (the boni)',
    routine: 'attend',
    prefs: { intro: ['Nasica'], octavius_veto: ['sacred'], octavius_deposed: ['Vote against'], capitol: ['Go with the senators', 'Get off'], scipio_italians: ['Scipio is right'], scipio_death: ['Keep'], gaius_laws: ['Join those'], aventine: ['Arm yourself'], creditor_warning: ['Drop'], creditor_warning_own: ['Drop'], asked_to_defend: ['Accept'], father_loan_called: ['drop the case'] },
    stance: (_s, popular) => (popular === 'for' ? 'against' : 'for'),
    speakEvery: 30,
    prosecuteFromAge: 99,
    gifts: 0,
  },
};

function act(s: GameState, action: string, params: ActionParams = {}): boolean {
  if (checkAction(s, s.playerId, action, params)) return false;
  return command(s, { type: 'act', action, params }) === null;
}

function handlePending(s: GameState, st: Strategy) {
  for (const p of [...s.events.pending]) {
    if (p.outcome) {
      command(s, { type: 'dismiss', uid: p.uid });
      continue;
    }
    const vis = visibleChoices(s, p);
    if (!vis.length) {
      command(s, { type: 'dismiss', uid: p.uid });
      continue;
    }
    const prefs = st.prefs[p.eventId] ?? OPP_PREFS[p.eventId] ?? [];
    let pick = vis[0];
    for (const pref of prefs) {
      const m = vis.find((v) => v.label.includes(pref));
      if (m) {
        pick = m;
        break;
      }
    }
    command(s, { type: 'choose', uid: p.uid, choice: pick.index });
    const after = s.events.pending.find((x) => x.uid === p.uid);
    if (after) command(s, { type: 'dismiss', uid: p.uid });
  }
}

const memo: Record<string, number> = {};
function every(s: GameState, key: string, days: number): boolean {
  const last = memo[key];
  if (last !== undefined && s.day - last < days && last <= s.day) return false;
  memo[key] = s.day;
  return true;
}

function decide(s: GameState, st: Strategy): void {
  const me = player(s);
  if (me.location !== 'rome' || me.busyUntil > s.day) return;
  const age = ageOf(s, me);
  const month = dateOf(s.day).month;

  // Money first: never sit in arrears if a banker will lend.
  if (cashOf(s, me.id) < 1500) {
    const b = bankers(s).sort((x, y) => opinion(s, y.id, me.id).total - opinion(s, x.id, me.id).total)[0];
    const lim = creditLimit(s, me.id);
    if (b && lim >= 10000 && act(s, 'borrow', { lender: b.id, amount: 10000 })) return;
  }
  for (const l of s.money.loans.filter((x) => x.borrower === me.id && (x.called || cashOf(s, me.id) > x.principal + 8000))) act(s, 'repay', { loanId: l.id });

  // Serve abroad once, in spring.
  if (age >= 17 && me.servedAbroad < 1 && month >= 2 && month <= 4) {
    const camp = CAMPAIGNS.filter((c) => campaignOpen(s, c.id)).sort((a, b) => a.risk - b.risk)[0];
    if (camp && act(s, 'serve', { campaign: camp.id })) return;
  }

  // A case in hand.
  const c = playerCase(s);
  if (c && c.status === 'prep') {
    for (const a of ['case.research', 'case.witnesses', 'case.documents', 'case.witnesses', 'case.documents']) if (act(s, a, { caseId: c.id })) return;
    const prep = c.prosecutor === me.id ? c.prosecutionPrep : c.defensePrep;
    if (!prep.coCounsel && every(s, 'cocounsel', 10)) {
      const best = allChars(s).filter((x) => x.alive && x.location === 'rome' && x.id !== me.id && opinion(s, x.id, me.id).total > 5 && x.oratory > 40).sort((a, b) => b.oratory - a.oratory)[0];
      if (best && act(s, 'visit', { target: best.id, ask: 'cocounsel' })) return;
    }
  }

  // Elections.
  // Stand for the highest office open to you (populists like the tribunate).
  if (!candidacyOf(s, me.id)) {
    const order = st.id === 'populist' ? ['censor', 'consul', 'praetor', 'tribune_pleb', 'aedile', 'quaestor'] : ['censor', 'consul', 'praetor', 'aedile', 'tribune_pleb', 'quaestor'];
    for (const office of order) {
      const e = openElections(s).find((x) => x.office === office);
      if (e && s.day <= e.professioDeadline && !ineligibleFor(s, me, e.office, e.forYearBC) && act(s, 'declare', { office })) return;
    }
  }
  if (candidacyOf(s, me.id)) {
    const cand = candidacyOf(s, me.id)!;
    if (every(s, 'endorse', 6)) {
      const t = allChars(s).filter((x) => x.alive && x.location === 'rome' && x.rank === 'senator' && !cand.endorsements.includes(x.id) && !candidacyOf(s, x.id) && opinion(s, x.id, me.id).total > 5).sort((a, b) => opinion(s, b.id, me.id).total - opinion(s, a.id, me.id).total)[0];
      if (t && act(s, 'visit', { target: t.id, ask: 'endorse' })) return;
    }
    const zones = ['campus', 'subura', 'campus', 'arpinum'] as (keyof typeof CANVASS_ZONES)[];
    const z = zones[Math.floor(s.day / 6) % zones.length];
    const gifts = st.gifts && cashOf(s, me.id) > st.gifts + 5000 ? st.gifts : 0;
    if (act(s, 'canvass', { zone: z, gifts })) return;
  } else if (age >= 26 && !heldEver(s, me.id, 'quaestor') && every(s, 'groundwork', 20)) {
    if (act(s, 'canvass', { zone: s.day % 2 ? 'subura' : 'campus' })) return;
  }

  // Prosecutions.
  if (!c && age >= st.prosecuteFromAge) {
    const open = s.courts.cases.filter((x) => x.status === 'open').sort((a, b) => b.evidence - a.evidence)[0];
    if (open && open.evidence > 0.4 && act(s, 'prosecute', { caseId: open.id })) return;
  }

  // The young man's education.
  if (age < 19 && every(s, 'youth', 12)) {
    const opts = ['study', 'observe', 'exercise'];
    if (act(s, opts[Math.floor(s.day / 12) % 3])) return;
  }

  // Speeches.
  if (age >= 18 && every(s, 'speak', st.speakEvery)) {
    const issues = availableIssues(s);
    const i = issues[0];
    if (i && act(s, 'speak', { issue: i.id, stance: st.stance(s, i.popular) })) return;
  }

  // Patron and friends.
  if (!me.patronId && every(s, 'patron', 25)) {
    const want = st.id === 'populist' ? ['appius', 'fulvius', 'carbo', 'c_gracchus'] : st.id === 'orator' ? ['scaevola', 'crassus', 'augur'] : ['nasica', 'macedonicus', 'laenas', 'opimius'];
    for (const k of want) {
      const t = byHistorical(s, k);
      if (t?.alive && t.location === 'rome' && t.rank === 'senator' && act(s, 'visit', { target: t.id, ask: 'patronage' })) return;
    }
  }
  if (st.id === 'populist' && clientsOf(s, me.id).length < 6 && every(s, 'client', 9)) {
    const t = allChars(s).find((x) => x.alive && x.rank === 'plebs' && x.patronId !== me.id && x.location === 'rome');
    if (t && act(s, 'visit', { target: t.id, ask: 'client' })) return;
  }
  if (every(s, 'dinner', st.id === 'establishment' ? 30 : 60) && cashOf(s, me.id) > 6000) {
    const guests = allChars(s)
      .filter((x) => x.alive && x.location === 'rome' && x.rank === 'senator' && !x.female && opinion(s, x.id, me.id).total > -20)
      .sort((a, b) => standingOf(s, b.id, 'dignitas').total - standingOf(s, a.id, 'dignitas').total)
      .slice(Math.floor(s.day / 7) % 5, (Math.floor(s.day / 7) % 5) + 2)
      .map((x) => x.id);
    if (guests.length && act(s, 'dinner', { guests, style: 'modest' })) return;
  }
  if (every(s, 'visit', 7)) {
    const pool = allChars(s).filter((x) => x.alive && x.location === 'rome' && x.rank === 'senator' && x.id !== me.id);
    const t = me.patronId && s.day % 3 === 0 ? s.chars[me.patronId] : pool[s.day % Math.max(1, pool.length)];
    if (t && act(s, 'visit', { target: t.id, ask: 'none' })) return;
  }
  if (every(s, 'listen', 5)) act(s, 'listen');
}

export interface RunMetrics {
  strategy: StrategyId;
  seed: number;
  highest: 'none' | 'military_tribune' | 'quaestor';
  quaestorAge?: number;
  died: boolean;
  deathCause?: string;
  exiled: boolean;
  bankrupt: boolean;
  fatherBankrupt: boolean;
  fatherSoldLand: boolean;
  cashByYear: Record<number, number>;
  debtEnd: number;
  stabilityByYear: Record<number, number>;
  firedDay: Record<string, number>;
  moments: { capitolPatron: boolean; creditorCase: boolean; creditorCaseAge?: number; omen: boolean };
  trials: number;
  trialsWon: number;
  electionsContested: number;
  dignitasEnd: number;
  endDay: number;
}

export function runLifetime(seed: number, strategyId: StrategyId, opts: { untilDay?: number } = {}): { state: GameState; metrics: RunMetrics } {
  for (const k of Object.keys(memo)) delete memo[k];
  const st = STRATEGIES[strategyId];
  const s = newGame({ seed, praenomen: 'Marcus', nomen: 'Gratidius' });
  command(s, { type: 'routine', value: st.routine });
  const cashByYear: Record<number, number> = {};
  const stabilityByYear: Record<number, number> = {};
  let trials = 0;
  let trialsWon = 0;
  let creditorCaseAge: number | undefined;
  let guard = 0;
  const until = opts.untilDay ?? s.endDay;
  while (!s.ended && s.day < until) {
    if (guard++ > 200000) throw new Error('bot loop stuck');
    handlePending(s, st);
    const b = blockedBy(s);
    if (b === 'election') {
      command(s, { type: 'election.vote' } as Command);
      continue;
    }
    if (b === 'trial') {
      const c = playerCase(s)!;
      const side = c.prosecutor === s.playerId ? 'prosecution' : 'defense';
      const best = optionOdds(s, c, side).sort((a, z) => z.win - a.win)[0];
      command(s, { type: 'trial.move', strategy: best.strategy });
      if (c.status === 'closed') {
        trials++;
        if ((side === 'prosecution') === (c.verdict === 'convicted')) trialsWon++;
      }
      continue;
    }
    if (b === 'event') continue;
    if (b) throw new Error(`blocked: ${b}`);
    decide(s, st);
    handlePending(s, st);
    if (blockedBy(s)) continue;
    if ((s.events.fired.creditor_warning !== undefined || s.events.fired.creditor_warning_own !== undefined) && creditorCaseAge === undefined) creditorCaseAge = ageOf(s, player(s));
    const d = dateOf(s.day);
    if (d.doy === 0 || s.day === s.startDay) {
      cashByYear[d.yearBC] = cashOf(s, s.playerId);
      stabilityByYear[d.yearBC] = Math.round(s.crisis.stability);
    }
    tick(s);
  }
  handlePending(s, st);
  const me = player(s);
  const recs = s.offices.records.filter((r) => r.who === me.id);
  const q = recs.find((r) => r.office === 'quaestor');
  const father = me.fatherId ? s.chars[me.fatherId] : undefined;
  const metrics: RunMetrics = {
    strategy: strategyId,
    seed,
    highest: q ? 'quaestor' : recs.some((r) => r.office === 'military_tribune') ? 'military_tribune' : 'none',
    quaestorAge: q ? me.bornBC - q.yearBC : undefined,
    died: !me.alive,
    deathCause: me.died?.cause,
    exiled: !!me.flags.exiled,
    bankrupt: s.money.bankrupt.includes(me.id),
    fatherBankrupt: !!father && s.money.bankrupt.includes(father.id),
    fatherSoldLand: !!father?.flags.soldLand,
    cashByYear,
    debtEnd: debtOf(s, me.id),
    stabilityByYear,
    firedDay: { ...s.events.fired },
    moments: { capitolPatron: !!s.flags.moment_capitol_patron, creditorCase: creditorCaseAge !== undefined, creditorCaseAge, omen: s.events.fired.omen !== undefined },
    trials,
    trialsWon,
    electionsContested: s.offices.elections.filter((e) => e.candidates.some((c) => c.who === me.id)).length,
    dignitasEnd: standingOf(s, me.id, 'dignitas').total,
    endDay: s.day,
  };
  return { state: s, metrics };
}
