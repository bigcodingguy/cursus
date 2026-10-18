// Condition / number / effect DSL used by content (events, pressures).
// Content is plain data; this module interprets it. Effects only emit bus events.

import { emit } from '../bus';
import { dayOf } from '../calendar';
import { hasTie, opinion } from '../systems/network/api';
import { standingOf } from '../systems/standing/api';
import { cashOf } from '../systems/money/api';
import { heldEver, holdsOffice, openElection, voteGap, winChance } from '../systems/offices/api';
import type { Breakdown, Character, CharId, GameState, OfficeId, StandingKind } from '../types';
import { allChars, ageOf, breakdown, byHistorical, ch, clamp, shortName, yearBC } from '../util';

/** A character reference: 'player', 'player.patron', 'player.father', '@historicalKey', a role name, or 'it'. */
export type Ref = string;

export interface Scope {
  roles: Record<string, CharId>;
  vars: Record<string, string | number>;
}

export type NumExpr =
  | number
  | { pressure: string }
  | { stability: true }
  | { flag: string }
  | { lean: Ref }
  | { opinion: [Ref, Ref] }
  | { age: Ref }
  | { standing: [Ref, StandingKind] }
  | { oratory: Ref }
  | { served: Ref }
  | { law: Ref }
  | { ancestors: Ref }
  | { cash: Ref }
  | { var: string }
  | { election: 'daysLeft' | 'postponements' | 'chance' | 'gap' }
  | { debtTo: [Ref, Ref] } // what [borrower] owes [lender]
  | { sum: NumExpr[] }
  | { mul: [NumExpr, number] }
  | { base: number; label?: string; mods: { label: string; add: NumExpr; when?: Cond }[]; min?: number; max?: number };

export type Cond =
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond }
  | { year: [number, number] } // BC, inclusive, e.g. [133, 131]
  | { after: [number, number, number] } // [yearBC, month0, dom]
  | { before: [number, number, number] }
  | { alive: Ref }
  | { dead: Ref }
  | { inRome: Ref }
  | { flag: string }
  | { noFlag: string }
  | { num: NumExpr; gte?: number; lte?: number }
  | { holds: Ref; office: OfficeId }
  | { heldEver: Ref; office: OfficeId }
  | { law: string; eq: string | number }
  | { same: [Ref, Ref] }
  | { senator: Ref }
  | { exists: Ref }
  | { tie: [Ref, Ref]; kind: 'amicus' | 'inimicus' | 'kin' }
  | { charFlag: Ref; key: string }
  | { patronOf: [Ref, Ref] } // [patron, client]
  | { candidate: Ref }
  | { inHouse: Ref; house: string }
  | { female: Ref }
  | { someone: Group }
  /** Leads a case in preparation and has no co-counsel yet. */
  | { leadsCase: Ref }
  /** Has a close tie: patron, client, kin or friend. */
  | { connected: [Ref, Ref] };

export interface Group {
  select: 'senators' | 'adultMen' | 'all';
  where?: Cond; // evaluated with 'it' bound
  inRome?: boolean;
}

export type Effect =
  | { memory: { owner: Ref | Group; about: Ref; act: string; weight: number; halfLife?: number } }
  | { standing: { who: Ref; kind: StandingKind; value: number; label: string; halfLife?: number } }
  | { money: { who: Ref; amount: number; reason: string } }
  | { kill: Ref; cause: string }
  | { exile: Ref; reason: string }
  | { flag: string; value?: number }
  | { addFlag: string; value: number }
  | { charFlag: Ref; key: string; value?: number }
  | { pressure: string; add: number }
  | { stability: number; label: string }
  | { law: string; value: string | number }
  | { news: string; truth?: 'true' | 'false' | 'unconfirmed'; delay?: number; about?: Ref[] }
  | { log: string; kind?: 'world' | 'player' | 'death' }
  | { lean: Ref; add: number }
  | { train: Ref; skill: 'oratory' | 'law'; add: number }
  | { trigger: string; delay?: number; roles?: Record<string, Ref> }
  | { travel: Ref; to: 'rome' | 'abroad' | 'arpinum' | 'exile'; days?: number }
  | { favor: { debtor: Ref; creditor: Ref; weight: number; reason: string } }
  | { tie: { a: Ref; b: Ref; kind: 'amicus' | 'inimicus' | 'kin' } }
  | { postpone: { office: OfficeId | 'mine'; days: number; reason: string } }
  | { signal: string }
  | { occupy: Ref; days: number }
  | { marry: [Ref, Ref] } // [husband, wife]
  | { lend: { lender: Ref; borrower: Ref; amount: NumExpr; months: number; monthlyRate?: number } }
  /** Start an action for a character; string params of the form 'var:x' read event variables. */
  | { act: string; who?: Ref; params?: Record<string, string | number> }
  | { callLoans: { lender: Ref; borrower: Ref } }
  | { forgiveCall: { lender: Ref; borrower: Ref } }
  | { give: { from: Ref; to: Ref; amount: number | 'all'; reason: string } }
  | { setPatron: [Ref, Ref] } // [client, patron]
  | { if: Cond; then: Effect[]; else?: Effect[] }
  | { forEach: Group; do: Effect[] };

export type TextSeg = string | { when: Cond; text: string };

// ---------------- refs ----------------
export function resolve(s: GameState, ref: Ref, sc: Scope): Character | undefined {
  const [head, ...rest] = ref.split('.');
  let c: Character | undefined;
  if (head === 'player') c = s.chars[s.playerId];
  else if (head.startsWith('@')) c = byHistorical(s, head.slice(1));
  else c = ch(s, sc.roles[head]);
  for (const r of rest) {
    if (!c) return undefined;
    if (r === 'patron') c = ch(s, c.patronId);
    else if (r === 'father') c = ch(s, c.fatherId);
    else if (r === 'mother') c = ch(s, c.motherId);
    else if (r === 'spouse') c = c.spouseId && s.chars[c.spouseId]?.alive ? s.chars[c.spouseId] : undefined;
    else return undefined;
  }
  return c;
}

export function groupMembers(s: GameState, g: Group, sc: Scope): Character[] {
  const out: Character[] = [];
  for (const c of allChars(s)) {
    if (!c.alive) continue;
    if (g.select !== 'all' && (c.female || ageOf(s, c) < 16)) continue;
    if (g.select === 'senators' && c.rank !== 'senator') continue;
    if (g.inRome && c.location !== 'rome') continue;
    if (g.where && !evalCond(s, g.where, withRole(sc, 'it', c.id))) continue;
    out.push(c);
  }
  return out;
}

export function withRole(sc: Scope, name: string, id: CharId): Scope {
  return { roles: { ...sc.roles, [name]: id }, vars: sc.vars };
}

// ---------------- numbers ----------------
export function evalNum(s: GameState, e: NumExpr, sc: Scope): Breakdown {
  const one = (label: string, value: number): Breakdown => ({ total: value, parts: [{ label, value }] });
  if (typeof e === 'number') return one('Base', e);
  if ('pressure' in e) return one(`Pressure: ${e.pressure}`, s.crisis.pressures[e.pressure] ?? 0);
  if ('stability' in e) return one('Stability', s.crisis.stability);
  if ('flag' in e) return one(e.flag, s.flags[e.flag] ?? 0);
  if ('var' in e) return one(e.var, Number(sc.vars[e.var] ?? 0));
  if ('election' in e) {
    const el = openElection(s);
    if (!el) return one('No election', e.election === 'daysLeft' ? 9999 : 0);
    if (e.election === 'daysLeft') return one('Days to the vote', el.day - s.day);
    if (e.election === 'postponements') return one('Postponements', el.postponements);
    if (!el.candidates.some((c) => c.who === s.playerId)) return one('Not a candidate', 0);
    if (e.election === 'chance') return one('Your chance', winChance(s, el, s.playerId));
    return one('Votes short', voteGap(s, el, s.playerId));
  }
  if ('debtTo' in e) {
    const b = resolve(s, e.debtTo[0], sc);
    const l = resolve(s, e.debtTo[1], sc);
    return one('Debt', b && l ? s.money.loans.filter((x) => x.borrower === b.id && x.lender === l.id).reduce((a, x) => a + x.principal, 0) : 0);
  }
  if ('lean' in e) return one('Lean', resolve(s, e.lean, sc)?.lean ?? 0);
  if ('opinion' in e) {
    const a = resolve(s, e.opinion[0], sc);
    const b = resolve(s, e.opinion[1], sc);
    return one('Opinion', a && b ? opinion(s, a.id, b.id).total : 0);
  }
  if ('age' in e) {
    const c = resolve(s, e.age, sc);
    return one('Age', c ? ageOf(s, c) : 0);
  }
  if ('standing' in e) {
    const c = resolve(s, e.standing[0], sc);
    return one(e.standing[1], c ? standingOf(s, c.id, e.standing[1]).total : 0);
  }
  if ('oratory' in e) return one('Oratory', resolve(s, e.oratory, sc)?.oratory ?? 0);
  if ('ancestors' in e) {
    const c = resolve(s, e.ancestors, sc);
    const f = c?.familyId ? s.families[c.familyId] : undefined;
    return one('Consuls among his ancestors', f?.consulAncestors ?? 0);
  }
  if ('law' in e) return one('Knowledge of the law', resolve(s, e.law, sc)?.law ?? 0);
  if ('served' in e) return one('Campaigns served', resolve(s, e.served, sc)?.servedAbroad ?? 0);
  if ('cash' in e) {
    const c = resolve(s, e.cash, sc);
    return one('Cash', c ? cashOf(s, c.id) : 0);
  }
  if ('sum' in e) {
    const parts = e.sum.flatMap((x) => evalNum(s, x, sc).parts);
    return breakdown(parts);
  }
  if ('mul' in e) {
    const b = evalNum(s, e.mul[0], sc);
    return { total: b.total * e.mul[1], parts: b.parts.map((p) => ({ label: p.label, value: p.value * e.mul[1] })) };
  }
  // base + mods
  const parts = [{ label: e.label ?? 'Base', value: e.base }];
  for (const m of e.mods) {
    if (m.when && !evalCond(s, m.when, sc)) continue;
    const v = evalNum(s, m.add, sc).total;
    if (v !== 0) parts.push({ label: m.label, value: v });
  }
  return breakdown(parts, e.min ?? -Infinity, e.max ?? Infinity);
}

// ---------------- conditions ----------------
export function evalCond(s: GameState, c: Cond, sc: Scope): boolean {
  if ('all' in c) return c.all.every((x) => evalCond(s, x, sc));
  if ('any' in c) return c.any.some((x) => evalCond(s, x, sc));
  if ('not' in c) return !evalCond(s, c.not, sc);
  if ('year' in c) {
    const y = yearBC(s);
    return y <= c.year[0] && y >= c.year[1];
  }
  if ('after' in c) return s.day >= dayOf(c.after[0], c.after[1], c.after[2]);
  if ('before' in c) return s.day < dayOf(c.before[0], c.before[1], c.before[2]);
  if ('alive' in c) return !!resolve(s, c.alive, sc)?.alive;
  if ('dead' in c) {
    const x = resolve(s, c.dead, sc);
    return !!x && !x.alive;
  }
  if ('exists' in c) return !!resolve(s, c.exists, sc);
  if ('inRome' in c) {
    const x = resolve(s, c.inRome, sc);
    return !!x && x.alive && x.location === 'rome';
  }
  if ('flag' in c) return (s.flags[c.flag] ?? 0) !== 0;
  if ('noFlag' in c) return (s.flags[c.noFlag] ?? 0) === 0;
  if ('num' in c) {
    const v = evalNum(s, c.num, sc).total;
    return (c.gte === undefined || v >= c.gte) && (c.lte === undefined || v <= c.lte);
  }
  if ('holds' in c) {
    const x = resolve(s, c.holds, sc);
    return !!x && holdsOffice(s, x.id, c.office);
  }
  if ('heldEver' in c) {
    const x = resolve(s, c.heldEver, sc);
    return !!x && heldEver(s, x.id, c.office);
  }
  if ('law' in c) return s.laws[c.law] === c.eq;
  if ('same' in c) {
    const a = resolve(s, c.same[0], sc);
    const b = resolve(s, c.same[1], sc);
    return !!a && !!b && a.id === b.id;
  }
  if ('senator' in c) return resolve(s, c.senator, sc)?.rank === 'senator';
  if ('tie' in c) {
    const a = resolve(s, c.tie[0], sc);
    const b = resolve(s, c.tie[1], sc);
    return !!a && !!b && hasTie(s, a.id, b.id, c.kind);
  }
  if ('charFlag' in c) return (resolve(s, c.charFlag, sc)?.flags[c.key] ?? 0) !== 0;
  if ('candidate' in c) {
    const x = resolve(s, c.candidate, sc);
    return !!x && !!openElection(s)?.candidates.some((k) => k.who === x.id);
  }
  if ('inHouse' in c) return resolve(s, c.inHouse, sc)?.familyId === c.house;
  if ('female' in c) return !!resolve(s, c.female, sc)?.female;
  if ('someone' in c) return groupMembers(s, c.someone, sc).length > 0;
  if ('leadsCase' in c) {
    const x = resolve(s, c.leadsCase, sc);
    return !!x && s.courts.cases.some((k) => k.status === 'prep' && ((k.prosecutor === x.id && !k.prosecutionPrep.coCounsel) || (k.defender === x.id && k.defender !== k.defendant && !k.defensePrep.coCounsel)));
  }
  if ('connected' in c) {
    const a = resolve(s, c.connected[0], sc);
    const b = resolve(s, c.connected[1], sc);
    if (!a || !b) return false;
    return a.patronId === b.id || b.patronId === a.id || hasTie(s, a.id, b.id, 'amicus') || hasTie(s, a.id, b.id, 'kin') || (!!a.familyId && a.familyId === b.familyId);
  }
  if ('patronOf' in c) {
    const a = resolve(s, c.patronOf[0], sc);
    const b = resolve(s, c.patronOf[1], sc);
    return !!a && !!b && b.patronId === a.id;
  }
  return false;
}

// ---------------- effects ----------------
export function applyEffects(s: GameState, effects: Effect[], sc: Scope): void {
  for (const e of effects) applyEffect(s, e, sc);
}

function idOf(s: GameState, r: Ref, sc: Scope): CharId | undefined {
  return resolve(s, r, sc)?.id;
}

function applyEffect(s: GameState, e: Effect, sc: Scope): void {
  if ('if' in e) return applyEffects(s, evalCond(s, e.if, sc) ? e.then : e.else ?? [], sc);
  if ('forEach' in e) {
    for (const m of groupMembers(s, e.forEach, sc)) applyEffects(s, e.do, withRole(sc, 'it', m.id));
    return;
  }
  if ('memory' in e) {
    const about = idOf(s, e.memory.about, sc);
    if (!about) return;
    const owners = typeof e.memory.owner === 'string' ? [resolve(s, e.memory.owner, sc)].filter(Boolean) as Character[] : groupMembers(s, e.memory.owner, sc);
    for (const o of owners) {
      if (o.id === about) continue;
      emit(s, 'memory', { owner: o.id, about, act: e.memory.act, weight: e.memory.weight, halfLife: e.memory.halfLife });
    }
    return;
  }
  if ('standing' in e) {
    const who = idOf(s, e.standing.who, sc);
    if (who) emit(s, 'standing', { who, kind: e.standing.kind, value: e.standing.value, label: e.standing.label, halfLife: e.standing.halfLife });
    return;
  }
  if ('money' in e) {
    const who = idOf(s, e.money.who, sc);
    if (!who) return;
    if (e.money.amount >= 0) emit(s, 'transfer', { from: null, to: who, amount: e.money.amount, reason: e.money.reason });
    else emit(s, 'transfer', { from: who, to: null, amount: Math.min(-e.money.amount, Math.max(0, cashOf(s, who))), reason: e.money.reason });
    return;
  }
  if ('kill' in e) {
    const who = idOf(s, e.kill, sc);
    if (who && s.chars[who].alive) emit(s, 'death', { who, cause: e.cause });
    return;
  }
  if ('exile' in e) {
    const who = idOf(s, e.exile, sc);
    if (who) emit(s, 'exile', { who, reason: e.reason });
    return;
  }
  if ('flag' in e) return emit(s, 'flag', { key: e.flag, value: e.value ?? 1 });
  if ('addFlag' in e) return emit(s, 'flag', { key: e.addFlag, value: (s.flags[e.addFlag] ?? 0) + e.value });
  if ('charFlag' in e) {
    const c = resolve(s, e.charFlag, sc);
    if (c) emit(s, 'charFlag', { who: c.id, key: e.key, value: e.value ?? 1 });
    return;
  }
  if ('pressure' in e) return emit(s, 'pressure', { id: e.pressure, add: e.add });
  if ('stability' in e) return emit(s, 'stability', { add: e.stability, label: e.label });
  if ('law' in e) return emit(s, 'law', { key: e.law, value: e.value });
  if ('news' in e) {
    const about = (e.about ?? []).map((r) => idOf(s, r, sc)).filter(Boolean) as CharId[];
    return emit(s, 'news', { text: renderText(s, e.news, sc), truth: e.truth, delay: e.delay, about });
  }
  if ('log' in e) return emit(s, 'log', { text: renderText(s, e.log, sc), kind: e.kind ?? 'world' });
  if ('lean' in e) {
    const who = idOf(s, e.lean, sc);
    if (who) emit(s, 'lean', { who, add: e.add });
    return;
  }
  if ('train' in e) {
    const who = idOf(s, e.train, sc);
    if (who) emit(s, 'skill', { who, skill: e.skill === 'law' ? 'law' : 'oratory', add: e.add });
    return;
  }
  if ('trigger' in e) {
    const roles: Record<string, CharId> = { ...sc.roles };
    for (const [k, r] of Object.entries(e.roles ?? {})) {
      const id = idOf(s, r, sc);
      if (id) roles[k] = id;
    }
    return emit(s, 'event.trigger', { eventId: e.trigger, delay: e.delay, roles, vars: sc.vars });
  }
  if ('travel' in e) {
    const who = idOf(s, e.travel, sc);
    if (who) emit(s, 'travel', { who, to: e.to, until: e.days ? s.day + e.days : undefined });
    return;
  }
  if ('favor' in e) {
    const d = idOf(s, e.favor.debtor, sc);
    const c = idOf(s, e.favor.creditor, sc);
    if (d && c) emit(s, 'favor', { debtor: d, creditor: c, weight: e.favor.weight, reason: e.favor.reason });
    return;
  }
  if ('tie' in e) {
    const a = idOf(s, e.tie.a, sc);
    const b = idOf(s, e.tie.b, sc);
    if (a && b) emit(s, 'tie', { a, b, kind: e.tie.kind });
    return;
  }
  if ('postpone' in e) return emit(s, 'election.postpone', e.postpone);
  if ('signal' in e) return emit(s, 'hook', { name: e.signal, roles: sc.roles, vars: sc.vars });
  if ('lend' in e) {
    const l = idOf(s, e.lend.lender, sc);
    const b = idOf(s, e.lend.borrower, sc);
    const amount = Math.round(evalNum(s, e.lend.amount, sc).total);
    if (l && b && amount > 0) emit(s, 'loan.make', { lender: l, borrower: b, amount, months: e.lend.months, monthlyRate: e.lend.monthlyRate });
    return;
  }
  if ('marry' in e) {
    const h = idOf(s, e.marry[0], sc);
    const w = idOf(s, e.marry[1], sc);
    if (h && w) emit(s, 'marry', { husband: h, wife: w });
    return;
  }
  if ('occupy' in e) {
    const who = idOf(s, e.occupy, sc);
    if (who) emit(s, 'occupy', { who, days: e.days });
    return;
  }
  if ('act' in e) {
    const who = idOf(s, e.who ?? 'player', sc);
    if (!who) return;
    const params: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(e.params ?? {})) params[k] = typeof v === 'string' && v.startsWith('var:') ? sc.vars[v.slice(4)] ?? '' : v;
    emit(s, 'act', { who, action: e.act, params });
    return;
  }
  if ('callLoans' in e || 'forgiveCall' in e) {
    const spec = 'callLoans' in e ? e.callLoans : e.forgiveCall;
    const l = idOf(s, spec.lender, sc);
    const b = idOf(s, spec.borrower, sc);
    for (const loan of s.money.loans) {
      if (loan.lender !== l || loan.borrower !== b) continue;
      if ('callLoans' in e) emit(s, 'loan.call', { loanId: loan.id });
      else emit(s, 'loan.forgiveCall', { loanId: loan.id });
    }
    return;
  }
  if ('give' in e) {
    const from = idOf(s, e.give.from, sc);
    const to = idOf(s, e.give.to, sc);
    if (!from || !to) return;
    const amt = e.give.amount === 'all' ? Math.max(0, cashOf(s, from)) : Math.min(e.give.amount, Math.max(0, cashOf(s, from)));
    if (amt > 0) emit(s, 'transfer', { from, to, amount: amt, reason: e.give.reason });
    return;
  }
  if ('setPatron' in e) {
    const cl = resolve(s, e.setPatron[0], sc);
    const pa = resolve(s, e.setPatron[1], sc);
    if (cl && pa) emit(s, 'patron', { client: cl.id, patron: pa.id });
    return;
  }
}

// ---------------- text ----------------
/** Replaces {ref} with a short name and {var:x} with a variable. */
export function renderText(s: GameState, t: string, sc: Scope): string {
  return t.replace(/\{([^}]+)\}/g, (_m, key: string) => {
    if (key.startsWith('var:')) {
      const v = sc.vars[key.slice(4)];
      return typeof v === 'number' && Math.abs(v) >= 10000 ? v.toLocaleString('en-US') : String(v ?? '');
    }
    const c = resolve(s, key, sc);
    return c ? shortName(c) : 'someone';
  });
}

export function renderSegs(s: GameState, segs: TextSeg[], sc: Scope): string {
  return segs
    .filter((x) => typeof x === 'string' || evalCond(s, x.when, sc))
    .map((x) => renderText(s, typeof x === 'string' ? x : x.text, sc))
    .join('\n\n');
}

export function probability(b: Breakdown): number {
  return clamp(b.total, 0, 1);
}
