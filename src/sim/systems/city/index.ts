// City life: the morning salutatio, visits, dinners, speeches, lending and borrowing.
// The same actions serve the player and the NPCs.

import { ISSUES, type IssueDef } from '../../../content/issues';
import { emit } from '../../bus';
import { registerAction, type SystemDef } from '../../core';
import { evalCond } from '../../dsl';
import { chance, rand } from '../../rng';
import type { Breakdown, Character, CharId, GameState } from '../../types';
import { ageOf, breakdown, byHistorical, clamp, fmtHS, menInRome, shortName, sigmoid } from '../../util';
import { playerCase } from '../courts/api';
import { cashOf, debtOf, netWorth, STANDARD_RATE } from '../money/api';
import { favorsOwed, memoriesAbout, opinion, willingness } from '../network/api';
import { candidacyOf } from '../offices/api';
import { repay } from '../money';
import { standingOf } from '../standing/api';
import { clientsOf } from '../news';

export type Ask = 'none' | 'patronage' | 'client' | 'endorse' | 'cocounsel' | 'loan';

export const ASK_LABELS: Record<Ask, string> = {
  none: 'Pay your respects',
  patronage: 'Ask him to be your patron',
  client: 'Offer him your protection',
  endorse: 'Ask for his endorsement',
  cocounsel: 'Ask him to join you as counsel',
  loan: 'Ask for a loan',
};

const ASK_COST: Record<Ask, number> = { none: 0, patronage: 1.6, client: 0.2, endorse: 1.2, cocounsel: 1.8, loan: 1.0 };

// Issue conditions depend only on date, flags, laws and offices, which change rarely; cached per day and flag count.
const issueCache = new WeakMap<GameState, { key: string; list: IssueDef[] }>();
export function availableIssues(s: GameState): IssueDef[] {
  const key = `${s.day}:${Object.keys(s.flags).length}:${s.offices.records.length}:${s.log.length}`;
  const c = issueCache.get(s);
  if (c && c.key === key) return c.list;
  const list = ISSUES.filter((i) => evalCond(s, i.when, { roles: {}, vars: {} }));
  issueCache.set(s, { key, list });
  return list;
}

/** Why `a` cannot make this request of `t`, or null. */
export function askBlocked(s: GameState, a: Character, t: Character, ask: Ask): string | null {
  switch (ask) {
    case 'none':
      return null;
    case 'patronage':
      if (t.rank !== 'senator') return 'Only a senator can be a patron worth having';
      if (a.patronId === t.id) return 'He is already your patron';
      return null;
    case 'client':
      if (t.rank !== 'plebs') return 'Only a plebeian will become your client';
      if (t.patronId === a.id) return 'Already your client';
      return null;
    case 'endorse':
      if (!candidacyOf(s, a.id)) return 'You are not a candidate';
      if (candidacyOf(s, a.id)!.endorsements.includes(t.id)) return 'He already supports you';
      if (candidacyOf(s, t.id)) return 'He is a candidate himself';
      return null;
    case 'cocounsel': {
      const c = a.id === s.playerId ? playerCase(s) : undefined;
      if (!c || c.status !== 'prep') return 'You have no case in preparation';
      if ([c.defendant, c.prosecutor, c.defender].includes(t.id)) return 'He is a party to the case';
      const prep = c.prosecutor === a.id ? c.prosecutionPrep : c.defensePrep;
      if (prep.coCounsel) return 'You already have co-counsel';
      if (ageOf(s, t) < 20) return 'Too young';
      return null;
    }
    case 'loan':
      if (cashOf(s, t.id) < 20000) return 'He has no money to spare';
      return null;
  }
}

export function askOdds(s: GameState, a: Character, t: Character, ask: Ask, amount = 0): Breakdown {
  if (ask === 'none') return { total: 1, parts: [] };
  const cost = ask === 'loan' ? ASK_COST.loan + amount / 40000 : ASK_COST[ask];
  const w = willingness(s, t.id, a.id, cost);
  const parts = [...w.parts];
  if (ask === 'patronage') {
    const gap = (standingOf(s, t.id, 'dignitas').total - standingOf(s, a.id, 'dignitas').total) / 200;
    parts.push({ label: 'A great man takes clients gladly', value: 0.15 - Math.max(0, gap - 0.3) });
  }
  if (ask === 'client') parts.push({ label: 'A protector is worth having', value: 0.25 });
  if (ask === 'endorse') parts.push({ label: 'Your chances in the election', value: (standingOf(s, a.id, 'dignitas').total - 20) / 200 });
  if (ask === 'cocounsel') parts.push({ label: 'Fame to be had in the case', value: 0.1 });
  return breakdown(parts, 0.02, 0.97);
}

function visitWeight(s: GameState, a: Character, t: Character): number {
  const prior = memoriesAbout(s, t.id, a.id).filter((m) => m.act === 'Called on me').reduce((x, m) => x + m.now, 0);
  const base = 3 + 4 * t.traits.sociability + (a.rank === 'senator' ? 1 : 0);
  return Math.max(0.5, base * (1 - clamp(prior / 20, 0, 0.9)));
}

function resolveAsk(s: GameState, a: Character, t: Character, ask: Ask, amount: number, success: boolean) {
  const mine = a.id === s.playerId;
  const say = (text: string) => mine && emit(s, 'log', { text, kind: 'player', about: [t.id] });
  const owed = favorsOwed(s, t.id, a.id);
  if (success && ask !== 'none' && ask !== 'client' && owed.length) {
    const f = [...owed].sort((x, y) => y.weight - x.weight)[0];
    emit(s, 'favor.spend', { id: f.id });
    say(`${shortName(t)} considers the favor he owed you repaid.`);
  }
  if (!success) {
    if (owed.length) emit(s, 'memory', { owner: a.id, about: t.id, act: 'Refused me though he owed me', weight: -12, halfLife: 1500 });
    say(`${shortName(t)} declines. (${ASK_LABELS[ask]})`);
    return;
  }
  switch (ask) {
    case 'patronage':
      emit(s, 'patron', { client: a.id, patron: t.id });
      say(`${shortName(t)} accepts you as his client.`);
      break;
    case 'client':
      emit(s, 'patron', { client: t.id, patron: a.id });
      say(`${shortName(t)} becomes your client.`);
      break;
    case 'endorse': {
      const cand = candidacyOf(s, a.id);
      if (cand) cand.endorsements.push(t.id);
      emit(s, 'favor', { debtor: a.id, creditor: t.id, weight: 1, reason: 'Endorsed my candidacy' });
      say(`${shortName(t)} will speak for you in the tribes.`);
      break;
    }
    case 'cocounsel': {
      const c = playerCase(s);
      if (c) {
        const prep = c.prosecutor === a.id ? c.prosecutionPrep : c.defensePrep;
        prep.coCounsel = t.id;
        c.jury = c.jury.filter((j) => j.charId !== t.id);
      }
      emit(s, 'favor', { debtor: a.id, creditor: t.id, weight: 2, reason: 'Joined me as counsel' });
      say(`${shortName(t)} agrees to speak with you in court.`);
      break;
    }
    case 'loan':
      emit(s, 'loan.make', { lender: t.id, borrower: a.id, amount, months: 12, monthlyRate: 0.0075 });
      emit(s, 'favor', { debtor: a.id, creditor: t.id, weight: 1, reason: `Lent me ${fmtHS(amount)}` });
      say(`${shortName(t)} lends you ${fmtHS(amount)} at three-quarters of a percent a month.`);
      break;
  }
}

export function speechOdds(s: GameState, a: Character, issue: IssueDef, stance: 'for' | 'against'): Breakdown {
  const withCrowd = stance === issue.popular;
  const parts = [
    { label: 'Your oratory', value: (a.oratory - 40) / 14 },
    { label: withCrowd ? 'The crowd is with you' : 'The crowd is against you', value: withCrowd ? 0.9 : -0.6 },
    { label: 'Your favor with the people', value: standingOf(s, a.id, 'people').total / 60 },
    { label: 'Your youth', value: ageOf(s, a) < 22 ? -0.4 : 0 },
  ];
  const b = breakdown(parts);
  return { total: sigmoid(b.total), parts: [{ label: 'Chance the speech goes well', value: sigmoid(b.total) }, ...b.parts.map((p) => ({ label: `${p.label} (log-odds)`, value: Math.round(p.value * 100) / 100 }))] };
}

export function bankers(s: GameState): Character[] {
  return Object.values(s.chars).filter((c) => c.alive && c.flags.banker);
}

/** How much a banker will lend `who` in all, given his family's means. */
export function creditLimit(s: GameState, who: CharId): number {
  const c = s.chars[who];
  const father = c.fatherId ? s.chars[c.fatherId] : undefined;
  const fam = father?.alive ? Math.max(0, netWorth(s, father.id)) * 0.03 : 0;
  const own = Math.max(0, netWorth(s, who)) * 0.12;
  return Math.max(0, Math.round((15000 + fam + own + standingOf(s, who, 'dignitas').total * 1000) / 1000) * 1000 - debtOf(s, who));
}

export const city: SystemDef = {
  id: 'city',
  register() {
    // --- the young man's education: open from sixteen, before speeches, service or prosecutions ---
    const youngUtility = (s: GameState, a: Character, base: number) => {
      const age = ageOf(s, a);
      return age >= 16 && age <= 24 && a.rank !== 'plebs' ? base + a.traits.ambition * 0.6 : 0;
    };
    const meetSomeone = (s: GameState, a: Character, filter: (c: Character) => boolean, act: string, weight: number) => {
      const pool = menInRome(s).filter((c) => c.id !== a.id && filter(c));
      if (!pool.length) return undefined;
      const c = pool[Math.floor(rand(s.rng) * pool.length)];
      emit(s, 'memory', { owner: c.id, about: a.id, act, weight, halfLife: 900 });
      return c;
    };

    registerAction({
      id: 'study',
      label: 'Take lessons from a Greek rhetor',
      blurb: 'Twenty days of declamation, gesture and memory with a master from Rhodes. Builds oratory; the young learn fastest.',
      place: 'palatine',
      duration: () => 20,
      cost: () => 1500,
      check: (s, a) => (ageOf(s, a) < 16 ? 'Too young' : a.oratory >= 60 ? 'There is little more a rhetor can teach you' : null),
      complete: (s, a) => {
        const young = ageOf(s, a) < 21 ? 1.3 : 1;
        emit(s, 'skill', { who: a.id, skill: 'oratory', add: 3.5 * young });
        emit(s, 'skill', { who: a.id, skill: 'law', add: 0.5 });
        if (a.id === s.playerId) emit(s, 'log', { text: 'You finish a course of lessons with the rhetor.', kind: 'player' });
      },
      npc: (s, a) => (a.oratory < 55 && cashOf(s, a.id) > 10000 ? [{ params: {}, utility: youngUtility(s, a, 0.9) }] : []),
    });

    registerAction({
      id: 'observe',
      label: 'Watch the courts and the Senate doors',
      blurb: 'Stand with the crowd at the tribunals and the open doors of the Curia. You learn the law, hear the talk, and are noticed.',
      place: 'forum',
      duration: () => 3,
      check: (s, a) => (ageOf(s, a) < 16 ? 'Too young' : null),
      complete: (s, a) => {
        emit(s, 'skill', { who: a.id, skill: 'law', add: 1.5 });
        emit(s, 'skill', { who: a.id, skill: 'oratory', add: 0.4 });
        const c = meetSomeone(s, a, (x) => x.rank === 'senator', 'A young man who watches the courts', 4);
        if (a.id === s.playerId) {
          emit(s, 'gossip.hear', {});
          emit(s, 'log', { text: c ? `You spend three days at the tribunals. ${shortName(c)} notices you and asks your name.` : 'You spend three days at the tribunals.', kind: 'player', about: c ? [c.id] : [] });
        }
      },
      npc: (s, a) => [{ params: {}, utility: youngUtility(s, a, 0.8) }],
    });

    registerAction({
      id: 'exercise',
      label: 'Ride and swim with young men on the Campus',
      blurb: 'Where the sons of the great houses exercise. Friendships made here last.',
      place: 'campus',
      duration: () => 2,
      check: (s, a) => (ageOf(s, a) < 16 || ageOf(s, a) > 32 ? 'For young men' : null),
      complete: (s, a) => {
        const peers: Character[] = [];
        for (let i = 0; i < 2; i++) {
          const c = meetSomeone(s, a, (x) => x.rank !== 'plebs' && ageOf(s, x) <= 30 && !peers.includes(x), 'Rode with me on the Campus', 5);
          if (c) {
            peers.push(c);
            emit(s, 'memory', { owner: a.id, about: c.id, act: 'Rode with me on the Campus', weight: 4, halfLife: 900 });
          }
        }
        if (a.id === s.playerId && peers.length) emit(s, 'log', { text: `You ride on the Campus with ${peers.map(shortName).join(' and ')}.`, kind: 'player', about: peers.map((p) => p.id) });
      },
      npc: (s, a) => [{ params: {}, utility: youngUtility(s, a, 0.7) + a.traits.sociability * 0.4 }],
    });

    registerAction({
      id: 'listen',
      label: 'Listen to the talk in the Forum',
      blurb: 'Stroll among the bankers’ stalls and the speakers’ platform and hear what is being said.',
      place: 'forum',
      duration: () => 0,
      check: () => null,
      complete: () => {},
    });

    registerAction({
      id: 'visit',
      label: 'Call on someone',
      blurb: 'A morning call at his house. Asking for something is easier when he owes you.',
      place: (s, _a, p) => s.chars[String(p.target)]?.home ?? 'palatine',
      duration: () => 1,
      check: (s, a, p) => {
        const t = s.chars[String(p.target)];
        if (!t || !t.alive || t.id === a.id) return 'Choose someone to visit';
        if (t.location !== 'rome') return `${shortName(t)} is not in Rome`;
        return askBlocked(s, a, t, (p.ask as Ask) ?? 'none');
      },
      odds: (s, a, p) => {
        const t = s.chars[String(p.target)];
        const ask = (p.ask as Ask) ?? 'none';
        return t && ask !== 'none' ? askOdds(s, a, t, ask, Number(p.amount ?? 0)) : null;
      },
      start: (s, a, p) => {
        const t = s.chars[String(p.target)];
        const ask = (p.ask as Ask) ?? 'none';
        if (t && ask !== 'none') p.success = rand(s.rng) < askOdds(s, a, t, ask, Number(p.amount ?? 0)).total;
      },
      complete: (s, a, p) => {
        const t = s.chars[String(p.target)];
        if (!t?.alive) return;
        emit(s, 'memory', { owner: t.id, about: a.id, act: 'Called on me', weight: visitWeight(s, a, t), halfLife: 240 });
        const ask = (p.ask as Ask) ?? 'none';
        if (ask !== 'none') resolveAsk(s, a, t, ask, Number(p.amount ?? 0), !!p.success);
        else if (a.id === s.playerId) emit(s, 'log', { text: `You call on ${shortName(t)}.`, kind: 'player', about: [t.id] });
      },
      npc: (s, a) => {
        const cands = menInRome(s);
        if (cands.length < 2) return [];
        const out = [];
        for (let i = 0; i < 2; i++) {
          const t = cands[Math.floor(rand(s.rng) * cands.length)];
          if (t.id === a.id || !t.alive) continue;
          const op = opinion(s, a.id, t.id).total;
          let ask: Ask = 'none';
          let amount = 0;
          if (candidacyOf(s, a.id) && !candidacyOf(s, t.id) && t.rank === 'senator' && op > 0) ask = 'endorse';
          else if (!a.patronId && t.rank === 'senator' && a.rank !== 'senator' && ageOf(s, a) < 35) ask = 'patronage';
          else if (a.rank !== 'plebs' && t.rank === 'plebs' && !t.patronId) ask = 'client';
          else if (cashOf(s, a.id) < 0 && cashOf(s, t.id) > 100000 && op > 10) {
            ask = 'loan';
            amount = Math.ceil(-cashOf(s, a.id) / 10000) * 10000 + 10000;
          }
          if (askBlocked(s, a, t, ask)) ask = 'none';
          const fam = t.familyId ? s.families[t.familyId] : undefined;
          const u = 0.3 + a.traits.sociability * 1.1 + (ask !== 'none' ? 0.9 : 0) + (t.rank === 'senator' ? 0.25 : 0) + (fam ? fam.consulAncestors / 40 : 0) + (t.id === s.playerId ? 0.2 : 0);
          out.push({ params: { target: t.id, ask, amount }, utility: u });
        }
        return out;
      },
    });

    registerAction({
      id: 'dinner',
      label: 'Host a dinner',
      blurb: 'Up to three guests at your table. Guests warm to you and to each other — or not.',
      place: (_s, a) => a.home,
      duration: () => 1,
      cost: (_s, _a, p) => (p.style === 'lavish' ? 6000 : p.style === 'fine' ? 2500 : 800),
      check: (s, a, p) => {
        const guests = (p.guests as string[] | undefined) ?? [];
        if (!guests.length || guests.length > 3) return 'Invite one to three guests';
        for (const g of guests) {
          const c = s.chars[g];
          if (!c?.alive || c.location !== 'rome' || g === a.id) return 'A guest is not available';
        }
        return null;
      },
      complete: (s, a, p) => {
        const guests = ((p.guests as string[]) ?? []).map((g) => s.chars[g]).filter((c) => c?.alive);
        const w = p.style === 'lavish' ? 12 : p.style === 'fine' ? 8 : 4;
        const came: Character[] = [];
        for (const g of guests) {
          if (opinion(s, g.id, a.id).total < -25) {
            if (a.id === s.playerId) emit(s, 'log', { text: `${shortName(g)} sends his regrets.`, kind: 'player', about: [g.id] });
            continue;
          }
          came.push(g);
          emit(s, 'memory', { owner: g.id, about: a.id, act: 'Dined at his table', weight: w * (0.6 + g.traits.sociability), halfLife: 360 });
        }
        for (let i = 0; i < came.length; i++)
          for (let j = 0; j < came.length; j++) {
            if (i === j) continue;
            const v = Math.abs(came[i].lean - came[j].lean) < 0.7 ? 3 : -3;
            emit(s, 'memory', { owner: came[i].id, about: came[j].id, act: v > 0 ? 'Good company at dinner' : 'Quarrelled over dinner', weight: v, halfLife: 360 });
          }
        if (p.style === 'lavish') emit(s, 'standing', { who: a.id, kind: 'boni', value: 1.5, label: 'Keeps a fine table' });
        if (a.id === s.playerId && came.length) {
          emit(s, 'log', { text: `You dine with ${came.map(shortName).join(', ')}.`, kind: 'player', about: came.map((c) => c.id) });
          emit(s, 'gossip.hear', {});
        }
      },
      npc: (s, a) => {
        if (cashOf(s, a.id) < 40000 || a.rank === 'plebs') return [];
        const pool = menInRome(s);
        if (pool.length < 3) return [];
        const g1 = pool[Math.floor(rand(s.rng) * pool.length)];
        const g2 = pool[Math.floor(rand(s.rng) * pool.length)];
        const guests = [...new Set([g1.id, g2.id])].filter((g) => g !== a.id && s.chars[g].alive && s.chars[g].rank !== 'plebs');
        if (!guests.length) return [];
        return [{ params: { guests, style: a.traits.pride > 0.6 ? 'fine' : 'modest' }, utility: 0.4 + a.traits.sociability * 1.5 }];
      },
    });

    registerAction({
      id: 'speak',
      label: 'Speak at a public meeting (contio)',
      blurb: 'Take the Rostra when a magistrate calls a meeting. Win the crowd or be shouted down.',
      place: 'forum',
      duration: () => 1,
      check: (s, a, p) => {
        if (ageOf(s, a) < 18) return 'Too young to address the people (18)';
        const issue = availableIssues(s).find((i) => i.id === p.issue);
        if (!issue) return 'Choose a question being debated';
        if (p.stance !== 'for' && p.stance !== 'against') return 'Choose a side';
        return null;
      },
      odds: (s, a, p) => {
        const issue = availableIssues(s).find((i) => i.id === p.issue);
        return issue ? speechOdds(s, a, issue, p.stance as 'for' | 'against') : null;
      },
      start: (s, a, p) => {
        const issue = availableIssues(s).find((i) => i.id === p.issue);
        if (issue) p.success = rand(s.rng) < speechOdds(s, a, issue, p.stance as 'for' | 'against').total;
      },
      complete: (s, a, p) => {
        const issue = ISSUES.find((i) => i.id === p.issue);
        if (!issue) return;
        const stance = p.stance as 'for' | 'against';
        const popular = stance === issue.popular;
        const ok = !!p.success;
        const k = ok ? 1 : 0.35;
        emit(s, 'standing', { who: a.id, kind: 'people', value: (popular ? 6 : -3) * k, label: popular ? 'Spoke for the people’s causes' : 'Spoke against the people’s causes' });
        emit(s, 'standing', { who: a.id, kind: 'boni', value: (popular ? -4 : 5) * k, label: popular ? 'Spoke against the boni' : 'Spoke for the boni' });
        emit(s, 'lean', { who: a.id, add: popular ? -0.06 : 0.06 });
        emit(s, 'skill', { who: a.id, skill: 'oratory', add: ok ? 0.8 : 0.4 });
        if (issue.pressure && ok) emit(s, 'pressure', { id: issue.pressure.id, add: issue.pressure[stance] });
        const sponsor = issue.sponsor ? byHistorical(s, issue.sponsor) : undefined;
        if (sponsor?.alive && sponsor.id !== a.id) emit(s, 'memory', { owner: sponsor.id, about: a.id, act: stance === 'for' ? `Spoke for my cause: ${issue.label}` : `Spoke against me: ${issue.label}`, weight: (stance === 'for' ? 8 : -10) * (ok ? 1 : 0.5), halfLife: 900 });
        // Men of strong views on either side take note.
        for (const c of menInRome(s)) {
          if (!c.alive || c.id === a.id || c.rank !== 'senator' || Math.abs(c.lean) < 0.6 || !chance(s.rng, 0.12)) continue;
          const agrees = (c.lean < 0) === popular;
          emit(s, 'memory', { owner: c.id, about: a.id, act: agrees ? 'Spoke on the right side' : 'Spoke on the wrong side', weight: agrees ? 3 : -3, halfLife: 700 });
        }
        if (a.id === s.playerId)
          emit(s, 'log', { text: ok ? `You speak at a contio (${issue.label}) and the crowd hears you out.` : `You speak at a contio (${issue.label}). They talk over you and drift away.`, kind: 'player' });
        else if (ok && a.rank === 'senator' && chance(s.rng, 0.08)) emit(s, 'news', { text: `${shortName(a)} spoke well at a contio. The question: ${issue.label}.`, about: [a.id] });
      },
      npc: (s, a) => {
        if (ageOf(s, a) < 22 || a.rank === 'plebs') return [];
        const issues = availableIssues(s);
        if (!issues.length) return [];
        const i = issues[Math.floor(rand(s.rng) * issues.length)];
        const stance = (a.lean < 0) === (i.popular === 'for') ? 'for' : 'against';
        return [{ params: { issue: i.id, stance }, utility: a.traits.boldness * a.traits.ambition * 1.4 + (a.oratory - 50) / 35 }];
      },
    });

    registerAction({
      id: 'borrow',
      label: 'Borrow from a banker',
      blurb: 'Bankers lend at a percent a month. A creditor is a man with a hold on you.',
      place: 'forum',
      duration: () => 0,
      check: (s, a, p) => {
        const l = s.chars[String(p.lender)];
        const amt = Number(p.amount);
        if (!l?.flags.banker) return 'Choose a banker';
        if (!(amt >= 1000)) return 'Name a sum';
        if (amt > creditLimit(s, a.id)) return `He will not lend you more than ${fmtHS(creditLimit(s, a.id))}`;
        if (cashOf(s, l.id) < amt) return 'He has not that much to lend';
        if (opinion(s, l.id, a.id).total < -20) return 'He will not lend to you';
        return null;
      },
      complete: (s, a, p) => {
        emit(s, 'loan.make', { lender: String(p.lender), borrower: a.id, amount: Number(p.amount), months: 12, monthlyRate: STANDARD_RATE });
        if (a.id === s.playerId) emit(s, 'log', { text: `You borrow ${fmtHS(Number(p.amount))} from ${shortName(s.chars[String(p.lender)])} for a year at a percent a month.`, kind: 'money' });
      },
    });

    registerAction({
      id: 'lend',
      label: 'Lend money',
      blurb: 'A loan earns interest and a favor owed. Collecting from a powerful man is another matter.',
      place: 'forum',
      duration: () => 0,
      check: (s, a, p) => {
        const b = s.chars[String(p.borrower)];
        const amt = Number(p.amount);
        if (!b?.alive || b.id === a.id) return 'Choose a borrower';
        if (!(amt >= 1000)) return 'Name a sum';
        if (cashOf(s, a.id) < amt) return 'Not enough money';
        if (cashOf(s, b.id) > amt * 4 && !candidacyOf(s, b.id)) return `${shortName(b)} has no need of it`;
        return null;
      },
      complete: (s, a, p) => {
        const b = s.chars[String(p.borrower)];
        const amt = Number(p.amount);
        emit(s, 'loan.make', { lender: a.id, borrower: b.id, amount: amt, months: 12, monthlyRate: 0.0075 });
        emit(s, 'favor', { debtor: b.id, creditor: a.id, weight: amt >= 50000 ? 2 : 1, reason: `Lent me ${fmtHS(amt)}` });
        emit(s, 'memory', { owner: b.id, about: a.id, act: 'Lent me money when I needed it', weight: 6 + amt / 10000, halfLife: 900 });
        if (a.id === s.playerId) emit(s, 'log', { text: `You lend ${fmtHS(amt)} to ${shortName(b)}.`, kind: 'money', about: [b.id] });
      },
      npc: (s, a) => {
        if (!a.flags.banker && (a.traits.greed < 0.5 || cashOf(s, a.id) < 150000)) return [];
        const men = menInRome(s);
        const b = men[Math.floor(rand(s.rng) * men.length)];
        if (!b || b.id === a.id || !b.alive || cashOf(s, b.id) >= 5000 || b.rank === 'plebs' || opinion(s, a.id, b.id).total <= -10) return [];
        return [{ params: { borrower: b.id, amount: 20000 }, utility: 0.8 + a.traits.greed }];
      },
    });

    registerAction({
      id: 'repay',
      label: 'Repay a loan',
      place: 'forum',
      duration: () => 0,
      check: (s, a, p) => {
        const l = s.money.loans.find((x) => x.id === Number(p.loanId));
        if (!l || l.borrower !== a.id) return 'Choose one of your loans';
        if (cashOf(s, a.id) <= 0) return 'You have no cash';
        return null;
      },
      complete: (s, _a, p) => {
        repay(s, Number(p.loanId), p.amount ? Number(p.amount) : undefined);
      },
    });
  },

  daily(s) {
    const pl = s.chars[s.playerId];
    if (!pl.alive || pl.location !== 'rome') return;
    if (s.routine === 'attend') {
      const pat = pl.patronId ? s.chars[pl.patronId] : undefined;
      if (pat?.alive && pat.location === 'rome') {
        emit(s, 'memory', { owner: pat.id, about: pl.id, act: 'Attends my salutatio', weight: 0.08, halfLife: 120 });
        emit(s, 'skill', { who: pl.id, skill: 'law', add: 0.015 });
        emit(s, 'skill', { who: pl.id, skill: 'oratory', add: 0.008 });
        if (pat.lean > 0.3) emit(s, 'standing', { who: pl.id, kind: 'boni', value: 0.03, label: `In the train of ${shortName(pat)}` });
        if (pat.lean < -0.3) emit(s, 'standing', { who: pl.id, kind: 'people', value: 0.03, label: `In the train of ${shortName(pat)}` });
      }
    } else if (s.routine === 'receive') {
      const cl = clientsOf(s, pl.id);
      for (const c of cl) emit(s, 'memory', { owner: c.id, about: pl.id, act: 'Receives me in the morning', weight: 0.2, halfLife: 120 });
      if (cl.length) emit(s, 'standing', { who: pl.id, kind: 'people', value: 0.012 * cl.length, label: 'A crowd of clients at your door' });
    }
  },

  monthly(s) {
    // NPC mornings, in aggregate: clients wait on their patrons.
    for (const c of Object.values(s.chars)) {
      if (!c.alive || c.id === s.playerId || !c.patronId || c.location !== 'rome') continue;
      const pat = s.chars[c.patronId];
      if (!pat?.alive || pat.id === s.playerId) continue;
      emit(s, 'memory', { owner: pat.id, about: c.id, act: 'Attends my salutatio', weight: 3, halfLife: 120 });
      emit(s, 'memory', { owner: c.id, about: pat.id, act: 'Receives me in the morning', weight: 2, halfLife: 120 });
    }
  },
};

