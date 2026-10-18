// Courts: the extortion court (quaestio de repetundis). Cases open when governors come home.

import { PROVINCES } from '../../../content/offices';
import { emit, on } from '../../bus';
import { registerAction, registerCommand, type SystemDef } from '../../core';
import { chance, gauss, rand } from '../../rng';
import type { Case, CasePrep, Character, CharId, GameState, Juror, Strategy } from '../../types';
import { allChars, ageOf, clamp, fmtHS, fullName, shortName, sigmoid } from '../../util';
import { cashOf } from '../money/api';
import { hasTie, opinion, tiesOf } from '../network/api';
import { standingOf } from '../standing/api';
import { caseById, jurorLogits, MOOD_POINTS, MOOD_SIGMA, npcMix, playerCase, roundSwing, STRATEGIES } from './api';

const JURY_SIZE = 32;
const NAMED_JURORS = 14;
const PREP_DAYS = 40;

const emptyPrep = (): CasePrep => ({ witnesses: 0, documents: 0, research: 0, tampering: 0, exposed: false });

function provinceLabel(id: string) {
  return PROVINCES.find((p) => p.id === id)?.label ?? id;
}

function sideOf(c: Case, who: CharId): 'prosecution' | 'defense' | null {
  if (c.prosecutor === who || c.prosecutionPrep.coCounsel === who) return 'prosecution';
  if (c.defender === who || c.defensePrep.coCounsel === who) return 'defense';
  return null;
}

function drawJury(s: GameState, c: Case): Juror[] {
  const cls = c.juryClass;
  const involved = new Set([c.defendant, c.prosecutor, c.defender].filter(Boolean) as CharId[]);
  const defFam = s.chars[c.defendant].familyId;
  const pool = allChars(s).filter(
    (x) => x.alive && !x.female && x.location === 'rome' && !involved.has(x.id) && x.id !== s.playerId && ageOf(s, x) >= 30 && (cls === 'senator' ? x.rank === 'senator' : x.rank === 'eques') && x.familyId !== defFam,
  );
  const jury: Juror[] = [];
  while (jury.length < NAMED_JURORS && pool.length) {
    const x = pool.splice(Math.floor(rand(s.rng) * pool.length), 1)[0];
    jury.push({ id: `j${jury.length}`, charId: x.id, label: fullName(x), cls, bias: 0.15 * gauss(s.rng) + (x.historical === 'ravilla' ? 0.6 : 0), lean: x.lean, known: false });
  }
  const ranks = cls === 'senator' ? ['a senator of praetorian rank', 'a senator, formerly quaestor', 'an elderly senator', 'a senator from a minor house'] : ['an equestrian banker', 'an equestrian landowner', 'a contractor for the state', 'an equestrian from a country town'];
  while (jury.length < JURY_SIZE) {
    const n = jury.length;
    jury.push({ id: `j${n}`, label: ranks[n % ranks.length], cls, bias: 0.3 * gauss(s.rng), lean: clamp((cls === 'senator' ? 0.4 : 0.1) + 0.45 * gauss(s.rng), -1, 1), known: false });
  }
  return jury;
}

function openCase(s: GameState, who: CharId, province: string, extorted: number) {
  const id = `case${s.courts.nextCaseId++}`;
  const evidence = clamp(0.3 + 0.45 * Math.min(1, extorted / 1500000) + 0.12 * gauss(s.rng), 0.1, 0.95);
  s.courts.cases.push({
    id, defendant: who, province, extorted, evidence, openedDay: s.day, expiresDay: s.day + 365, status: 'open',
    prosecutionPrep: emptyPrep(), defensePrep: emptyPrep(), jury: [], rounds: [], sway: 0,
    juryClass: s.laws.repetundaeJury === 'equites' ? 'eques' : 'senator',
  });
  emit(s, 'news', { text: `Envoys from ${provinceLabel(province)} have come to Rome. They say ${shortName(s.chars[who])} robbed them, and they are looking for a patron to prosecute.`, truth: 'true', delay: 2, about: [who] });
}

function beginProsecution(s: GameState, c: Case, prosecutor: Character) {
  c.status = 'prep';
  c.prosecutor = prosecutor.id;
  c.trialDay = s.day + PREP_DAYS;
  const def = s.chars[c.defendant];
  emit(s, 'memory', { owner: def.id, about: prosecutor.id, act: 'Prosecuted me', weight: -45, halfLife: 5000 });
  emit(s, 'tie', { a: def.id, b: prosecutor.id, kind: 'inimicus' });
  for (const x of allChars(s)) {
    if (!x.alive || x.id === def.id || x.id === prosecutor.id) continue;
    if (x.familyId && x.familyId === def.familyId) emit(s, 'memory', { owner: x.id, about: prosecutor.id, act: 'Prosecuted my kinsman', weight: -20, halfLife: 3000 });
  }
  for (const t of tiesOf(s, def.id)) if (t.kind === 'amicus' && t.other !== prosecutor.id) emit(s, 'memory', { owner: t.other, about: prosecutor.id, act: 'Prosecuted my friend', weight: -15, halfLife: 2000 });
  emit(s, 'log', { text: `${fullName(prosecutor)} brings a charge of extortion against ${fullName(def)}, late governor of ${provinceLabel(c.province)}.`, kind: 'court', about: [prosecutor.id, def.id] });
  emit(s, 'news', { text: `${shortName(prosecutor)} is prosecuting ${shortName(def)} for extortion. The trial is set for forty days from now.`, truth: 'true', delay: 0, about: [prosecutor.id, def.id] });
  emit(s, 'trial.opened', { caseId: c.id, prosecutor: prosecutor.id, defendant: def.id });
  emit(s, 'hook', { name: 'case_opened', roles: { prosecutor: prosecutor.id, defendant: def.id }, vars: { province: provinceLabel(c.province), caseId: c.id } });
}

function chooseDefender(s: GameState, c: Case) {
  const def = s.chars[c.defendant];
  const pros = c.prosecutor!;
  const cands = allChars(s).filter((x) => x.alive && !x.female && x.location === 'rome' && x.id !== pros && x.id !== def.id && ageOf(s, x) >= 20 && !hasTie(s, x.id, pros, 'kin'));
  let best: Character | undefined;
  let bestV = -Infinity;
  for (const x of cands) {
    const willing = opinion(s, x.id, def.id).total;
    if (willing < 5 && x.familyId !== def.familyId) continue;
    const v = x.oratory + willing * 0.4 + (x.id === s.playerId ? -10 : 0);
    if (v > bestV) {
      bestV = v;
      best = x;
    }
  }
  if (best?.id === s.playerId && !c.askedPlayer) {
    c.askedPlayer = true;
    emit(s, 'hook', { name: 'asked_to_defend', roles: { defendant: def.id, prosecutor: pros }, vars: { caseId: c.id, province: provinceLabel(c.province) } });
    return;
  }
  c.defender = best?.id ?? def.id; // a man with no advocate speaks for himself
  c.jury = c.jury.filter((j) => j.charId !== c.defender);
  if (c.defender !== def.id) {
    emit(s, 'favor', { debtor: def.id, creditor: c.defender, weight: 2, reason: `Defended him on the extortion charge` });
    emit(s, 'log', { text: `${fullName(s.chars[c.defender])} will defend ${fullName(def)}.`, kind: 'court', about: [c.defender, def.id] });
  }
}

function npcPrep(s: GameState, c: Case) {
  const fill = (p: CasePrep, adv: Character | undefined, payer: Character, side: 'prosecution' | 'defense') => {
    if (!adv || adv.id === s.playerId) return;
    p.witnesses = Math.max(p.witnesses, Math.min(3, Math.round(adv.law / 35 + rand(s.rng))));
    p.documents = Math.max(p.documents, Math.min(3, Math.round(adv.law / 40 + rand(s.rng))));
    if (side === 'defense' && payer.traits.greed > 0.55 && cashOf(s, payer.id) > 80000 && chance(s.rng, payer.traits.greed)) tamper(s, c, payer, side, Math.min(cashOf(s, payer.id) * 0.25, 120000), undefined);
  };
  fill(c.prosecutionPrep, s.chars[c.prosecutor!], s.chars[c.prosecutor!], 'prosecution');
  fill(c.defensePrep, s.chars[c.defender ?? c.defendant], s.chars[c.defendant], 'defense');
}

/** Bribe jurors. Each juror bought risks exposure. Returns whether it was exposed. */
function tamper(s: GameState, c: Case, payer: Character, side: 'prosecution' | 'defense', amount: number, jurorId: string | undefined): boolean {
  const prep = side === 'prosecution' ? c.prosecutionPrep : c.defensePrep;
  const per = 8000;
  let n = jurorId ? 1 : Math.floor(amount / per);
  const pay = jurorId ? amount : n * per;
  if (pay <= 0) return false;
  emit(s, 'transfer', { from: payer.id, to: null, amount: pay, reason: 'bribes to jurors' });
  prep.tampering += pay;
  const targets = c.jury.filter((j) => !j.rejected && !j.bribedBy && (!jurorId || j.id === jurorId));
  for (const j of targets) {
    if (n-- <= 0) break;
    const honest = j.charId ? 1 - s.chars[j.charId].traits.greed : 0.5;
    if (chance(s.rng, 1 - honest * 0.6)) j.bribedBy = side;
  }
  if (chance(s.rng, exposureChance(prep.tampering))) {
    prep.exposed = true;
    emit(s, 'standing', { who: payer.id, kind: 'dignitas', value: -10, label: 'Caught bribing a jury', halfLife: 3000 });
    emit(s, 'standing', { who: payer.id, kind: 'boni', value: -15, label: 'Caught bribing a jury' });
    for (const j of c.jury) if (j.bribedBy === side) j.bribedBy = undefined;
    c.sway += side === 'prosecution' ? -0.6 : 0.6;
    emit(s, 'news', { text: `There is a scandal: ${shortName(payer)}'s agents were seen paying jurors.`, truth: 'true', delay: 1, about: [payer.id] });
    return true;
  }
  return false;
}

export function exposureChance(totalSpent: number): number {
  return clamp(0.08 + totalSpent / 400000, 0.08, 0.7);
}

function verdict(s: GameState, c: Case) {
  // Draw the jury's mood from the same points the odds integrate over, then each juror's vote.
  let x = rand(s.rng);
  let mood = MOOD_POINTS[MOOD_POINTS.length - 1].x;
  for (const m of MOOD_POINTS) {
    x -= m.w;
    if (x < 0) {
      mood = m.x;
      break;
    }
  }
  const logits = jurorLogits(s, c);
  let convict = 0;
  for (const l of logits) if (rand(s.rng) < sigmoid(l + MOOD_SIGMA * mood)) convict++;
  const acquit = logits.length - convict;
  c.votes = { convict, acquit };
  c.verdict = convict > acquit ? 'convicted' : 'acquitted';
  c.verdictDay = s.day;
  c.status = 'closed';
  const def = s.chars[c.defendant];
  const pros = s.chars[c.prosecutor!];
  const defender = c.defender && c.defender !== def.id ? s.chars[c.defender] : undefined;
  if (c.verdict === 'convicted') {
    const mult = Number(s.laws.repetundaeMultiplier ?? 1);
    const owed = c.extorted * mult;
    const paid = Math.min(owed, Math.max(0, cashOf(s, def.id)));
    emit(s, 'transfer', { from: def.id, to: null, amount: paid, reason: 'restitution to provincials' });
    emit(s, 'standing', { who: def.id, kind: 'dignitas', value: -20, label: 'Convicted of extortion', halfLife: 0 });
    emit(s, 'standing', { who: def.id, kind: 'boni', value: -10, label: 'Convicted of extortion' });
    // The first great conviction makes a name; later ones add less.
    const prior = pros.flags.convictions ?? 0;
    emit(s, 'charFlag', { who: pros.id, key: 'convictions', value: prior + 1 });
    emit(s, 'standing', { who: pros.id, kind: 'dignitas', value: prior === 0 ? 7 : prior < 3 ? 3 : 1, label: `Convicted ${shortName(def)} of extortion`, halfLife: 0 });
    emit(s, 'standing', { who: pros.id, kind: 'people', value: 12, label: 'Won a famous prosecution' });
    if (def.lean > 0.3) emit(s, 'standing', { who: pros.id, kind: 'boni', value: -4, label: 'Brought down one of the boni' });
    emit(s, 'memory', { owner: def.id, about: pros.id, act: 'Had me convicted', weight: -30, halfLife: 0 });
    if (defender) emit(s, 'standing', { who: defender.id, kind: 'dignitas', value: -2, label: 'Lost a defense', halfLife: 1500 });
    const exile = paid < owed || chance(s.rng, 0.4);
    emit(s, 'log', { text: `${fullName(def)} is convicted, ${convict} votes to ${acquit}, and ordered to repay ${fmtHS(owed)}.`, kind: 'court', about: [def.id, pros.id] });
    if (exile) emit(s, 'exile', { who: def.id, reason: 'after his conviction for extortion' });
  } else {
    emit(s, 'standing', { who: pros.id, kind: 'dignitas', value: -1, label: 'Lost a prosecution', halfLife: 1500 });
    emit(s, 'standing', { who: pros.id, kind: 'people', value: 2, label: 'Took on a powerful man' });
    if (defender) {
      emit(s, 'standing', { who: defender.id, kind: 'dignitas', value: 5, label: `Won the acquittal of ${shortName(def)}`, halfLife: 0 });
      emit(s, 'memory', { owner: def.id, about: defender.id, act: 'Saved me in court', weight: 35, halfLife: 5000 });
      emit(s, 'standing', { who: defender.id, kind: 'boni', value: 4, label: 'Defended one of the boni' });
    }
    emit(s, 'log', { text: `${fullName(def)} is acquitted, ${acquit} votes to ${convict}.`, kind: 'court', about: [def.id, pros.id] });
  }
  for (const who of [pros, defender].filter(Boolean) as Character[]) emit(s, 'skill', { who: who.id, skill: 'oratory', add: 2.5 });
  // Junior counsel share a little of the credit and learn a great deal.
  for (const side of ['prosecution', 'defense'] as const) {
    const co = (side === 'prosecution' ? c.prosecutionPrep : c.defensePrep).coCounsel;
    if (!co || !s.chars[co]?.alive) continue;
    const won = (side === 'prosecution') === (c.verdict === 'convicted');
    emit(s, 'skill', { who: co, skill: 'oratory', add: 2 });
    emit(s, 'skill', { who: co, skill: 'law', add: 2 });
    if (won) emit(s, 'standing', { who: co, kind: 'dignitas', value: 2, label: `Junior counsel in the case of ${shortName(def)}`, halfLife: 0 });
    emit(s, 'standing', { who: co, kind: 'people', value: won ? 3 : 1, label: 'Spoke in a famous case' });
  }
  emit(s, 'news', { text: c.verdict === 'convicted' ? `${shortName(def)} has been convicted of extortion. ${shortName(pros)} is the man of the hour.` : `${shortName(def)} walked out of court acquitted.`, truth: 'true', delay: 0, about: [def.id, pros.id] });
  emit(s, 'trial.verdict', { caseId: c.id, verdict: c.verdict, prosecutor: pros.id, defender: c.defender, defendant: def.id });
  const side = sideOf(c, s.playerId);
  if (side) {
    const won = (side === 'prosecution') === (c.verdict === 'convicted');
    emit(s, 'event.trigger', { eventId: won ? 'trial_won' : 'trial_lost', roles: { defendant: def.id, prosecutor: pros.id }, vars: { convict, acquit, verdict: c.verdict } });
  }
}

function playerSideCheck(s: GameState, a: Character, p: { caseId?: unknown }): string | null {
  const c = caseById(s, String(p.caseId));
  if (!c || c.status !== 'prep') return 'No case in preparation';
  if (!sideOf(c, a.id)) return 'You are not counsel in this case';
  return null;
}

function prepAction(id: string, label: string, blurb: string, days: number, cost: number, field: 'witnesses' | 'documents' | 'research') {
  registerAction({
    id,
    label,
    blurb,
    place: 'forum',
    duration: () => days,
    cost: () => cost,
    check: (s, a, p) => {
      const err = playerSideCheck(s, a, p);
      if (err) return err;
      const c = caseById(s, String(p.caseId))!;
      const prep = sideOf(c, a.id) === 'prosecution' ? c.prosecutionPrep : c.defensePrep;
      if (field !== 'research' && prep[field] >= 3) return 'Nothing more to be gained there';
      if (field === 'research' && prep.research >= 1) return 'You already know the jury';
      if (s.day + days > (c.trialDay ?? 0)) return 'Not enough time before the trial';
      return null;
    },
    complete: (s, a, p) => {
      const c = caseById(s, String(p.caseId));
      if (!c) return;
      const prep = sideOf(c, a.id) === 'prosecution' ? c.prosecutionPrep : c.defensePrep;
      prep[field] += 1;
      if (field === 'research') for (const j of c.jury) j.known = true;
      emit(s, 'skill', { who: a.id, skill: 'law', add: 1 });
    },
  });
}

export const courts: SystemDef = {
  id: 'courts',
  register() {
    on('governor.returned', (s, e) => {
      if (e.extorted >= 100000) openCase(s, e.who, e.province, e.extorted);
    });
    on('death', (s, e) => {
      for (const c of s.courts.cases) if (c.status !== 'closed' && c.defendant === e.who) c.status = 'closed';
    });
    on('exile', (s, e) => {
      for (const c of s.courts.cases) if (c.status === 'open' && c.defendant === e.who) c.status = 'closed';
    });
    on('hook', (s, e) => {
      if (e.name === 'join_counsel') {
        const lead = e.roles.lead;
        const c = s.courts.cases.find((x) => x.status === 'prep' && (x.prosecutor === lead || x.defender === lead));
        if (!c) return;
        const prep = c.prosecutor === lead ? c.prosecutionPrep : c.defensePrep;
        if (prep.coCounsel) return;
        prep.coCounsel = s.playerId;
        c.jury = c.jury.filter((j) => j.charId !== s.playerId);
        emit(s, 'memory', { owner: lead, about: s.playerId, act: 'Joined me as junior counsel', weight: 10, halfLife: 2000 });
        emit(s, 'memory', { owner: c.prosecutor === lead ? c.defendant : c.prosecutor!, about: s.playerId, act: 'Spoke against me in court', weight: -12, halfLife: 2000 });
        return;
      }
      if (e.name === 'drop_case') {
        const c = s.courts.cases.find((x) => x.defendant === e.roles.defendant && x.prosecutor === s.playerId && x.status === 'prep');
        if (!c) return;
        c.status = 'closed';
        emit(s, 'standing', { who: s.playerId, kind: 'dignitas', value: -3, label: 'Abandoned a prosecution', halfLife: 1500 });
        emit(s, 'memory', { owner: c.defendant, about: s.playerId, act: 'Dropped his charge against me', weight: 15, halfLife: 2000 });
        emit(s, 'news', { text: `${shortName(s.chars[s.playerId])} has dropped his prosecution of ${shortName(s.chars[c.defendant])}. Nobody believes it was for lack of evidence.`, about: [s.playerId, c.defendant] });
        return;
      }
      if (e.name === 'accept_defense' || e.name === 'decline_defense') {
        const c = s.courts.cases.find((x) => x.defendant === e.roles.defendant && x.status === 'prep' && !x.defender);
        if (!c) return;
        if (e.name === 'accept_defense') {
          c.defender = s.playerId;
          c.jury = c.jury.filter((j) => j.charId !== s.playerId);
          emit(s, 'favor', { debtor: c.defendant, creditor: s.playerId, weight: 2, reason: 'Defended him on the extortion charge' });
          emit(s, 'memory', { owner: c.defendant, about: s.playerId, act: 'Agreed to defend me', weight: 15, halfLife: 2000 });
          emit(s, 'memory', { owner: c.prosecutor!, about: s.playerId, act: 'Defends my enemy', weight: -10, halfLife: 1500 });
        } else {
          emit(s, 'memory', { owner: c.defendant, about: s.playerId, act: 'Refused to defend me', weight: -12, halfLife: 1500 });
          chooseDefenderExcluding(s, c, s.playerId);
        }
      }
    });

    registerAction({
      id: 'prosecute',
      label: 'Bring a prosecution',
      blurb: 'Accuse a returned governor before the extortion court. A young man’s road to fame — and to enemies.',
      place: 'forum',
      duration: () => 1,
      check: (s, a, p) => {
        const c = caseById(s, String(p.caseId));
        if (!c || c.status !== 'open') return 'Choose an open case';
        if (ageOf(s, a) < 19) return 'Too young to prosecute (19)';
        if (c.defendant === a.id) return 'You cannot prosecute yourself';
        const d = s.chars[c.defendant];
        if (d.familyId && d.familyId === a.familyId) return 'He is your kinsman';
        if (playerCase(s) && a.id === s.playerId) return 'You already have a case in hand';
        return null;
      },
      complete: (s, a, p) => {
        const c = caseById(s, String(p.caseId));
        if (!c || c.status !== 'open') return;
        c.jury = [];
        beginProsecution(s, c, a);
        c.jury = drawJury(s, c);
      },
      npc: (s, a) => {
        if (a.id === s.playerId) return [];
        const age = ageOf(s, a);
        if (age < 20 || age > 45 || a.oratory < 35) return [];
        const out = [];
        for (const c of s.courts.cases) {
          if (c.status !== 'open' || s.day - c.openedDay < 20) continue; // give the city time to hear of it
          const d = s.chars[c.defendant];
          if (d.familyId === a.familyId || hasTie(s, a.id, d.id, 'amicus')) continue;
          const op = opinion(s, a.id, d.id).total;
          if (op > 15) continue;
          const u = 1.5 * a.traits.ambition + a.traits.boldness + c.evidence - standingOf(s, d.id, 'dignitas').total / 80 - op / 40 - 0.6;
          out.push({ params: { caseId: c.id }, utility: u });
        }
        return out;
      },
    });

    prepAction('case.witnesses', 'Interview witnesses', 'Take statements from envoys and witnesses, and keep them fed and willing.', 6, 2000, 'witnesses');
    prepAction('case.documents', 'Search the records', 'Copy the accounts at the treasury, letters, the ledgers of the tax-farmers.', 8, 1500, 'documents');
    prepAction('case.research', 'Learn the jurors', 'Find out who sits on the jury and where each man leans.', 3, 500, 'research');

    registerAction({
      id: 'case.tamper',
      label: 'Approach a juror privately',
      blurb: 'Money in the right hand. It works — until someone talks.',
      place: 'forum',
      duration: () => 1,
      check: (s, a, p) => {
        const err = playerSideCheck(s, a, p);
        if (err) return err;
        if (!(Number(p.amount) > 0)) return 'Name a sum';
        if (cashOf(s, a.id) < Number(p.amount)) return 'Not enough money';
        const c = caseById(s, String(p.caseId))!;
        const j = c.jury.find((x) => x.id === p.jurorId);
        if (!j || j.rejected) return 'Choose a juror';
        if (j.bribedBy) return 'Already approached';
        return null;
      },
      odds: (s, a, p) => {
        const c = caseById(s, String(p.caseId));
        if (!c) return null;
        const prep = sideOf(c, a.id) === 'prosecution' ? c.prosecutionPrep : c.defensePrep;
        const risk = exposureChance(prep.tampering + Number(p.amount ?? 0));
        return { total: 1 - risk, parts: [{ label: 'Not found out', value: 1 - risk }] };
      },
      complete: (s, a, p) => {
        const c = caseById(s, String(p.caseId));
        if (!c) return;
        const side = sideOf(c, a.id)!;
        const exposed = tamper(s, c, a, side, Number(p.amount), String(p.jurorId));
        if (a.id === s.playerId) emit(s, 'log', { text: exposed ? 'Your approach to the juror has been discovered.' : 'The juror takes your money and says nothing.', kind: 'court' });
      },
    });

    registerCommand('case.reject', (s, cmd) => {
      const c = playerCase(s);
      if (!c || c.status !== 'prep') return 'No case in preparation';
      const side = sideOf(c, s.playerId)!;
      const prep = side === 'prosecution' ? c.prosecutionPrep : c.defensePrep;
      if (!prep.research) return 'Learn the jurors first';
      const mine = c.jury.filter((j) => j.rejected && j.bribedBy === undefined && (j as Juror & { rejectedBy?: string }).rejectedBy === side).length;
      if (mine >= 4) return 'You may reject no more than four';
      const j = c.jury.find((x) => x.id === cmd.jurorId);
      if (!j || j.rejected) return 'No such juror';
      j.rejected = true;
      (j as Juror & { rejectedBy?: string }).rejectedBy = side;
      if (j.charId) emit(s, 'memory', { owner: j.charId, about: s.playerId, act: 'Rejected me from a jury', weight: -6, halfLife: 900 });
      return null;
    });

    registerCommand('trial.move', (s, cmd) => {
      const c = playerCase(s);
      if (!c || c.status !== 'trial') return 'No trial under way';
      const st = cmd.strategy as Strategy;
      if (!STRATEGIES.some((x) => x.id === st)) return 'Unknown strategy';
      const side = sideOf(c, s.playerId)!;
      const opp = drawFromMix(s, c.npcMix ?? [0.25, 0.25, 0.25, 0.25]);
      const pros = side === 'prosecution' ? st : opp;
      const def = side === 'defense' ? st : opp;
      const swing = roundSwing(s, c, pros, def);
      c.rounds.push({ prosecution: pros, defense: def, swing });
      c.sway += swing;
      if (c.rounds.length >= 3) verdict(s, c);
      else planNpcRound(s, c, side, st);
      return null;
    });
  },

  daily(s) {
    for (const c of s.courts.cases) {
      if (c.status === 'open' && s.day >= c.expiresDay) c.status = 'closed';
      if (c.status === 'prep') {
        if (!c.defender && s.day - (c.trialDay! - PREP_DAYS) >= 3 && !c.askedPlayer) chooseDefender(s, c);
        if (s.day >= c.trialDay!) {
          if (!c.defender) c.defender = c.defendant;
          npcPrep(s, c);
          const side = sideOf(c, s.playerId);
          if (side && s.chars[s.playerId].location === 'rome' && s.chars[s.playerId].alive) {
            c.status = 'trial';
            c.rounds = [];
            planNpcRound(s, c, side, null);
            emit(s, 'pause', { reason: 'trial' });
          } else {
            c.status = 'trial';
            autoTrial(s, c);
          }
        }
      }
    }
    if (s.courts.cases.length > 80) s.courts.cases = s.courts.cases.filter((c) => c.status !== 'closed' || s.day - (c.verdictDay ?? c.expiresDay) < 1500);
  },

  blocks(s) {
    const c = playerCase(s);
    return c && c.status === 'trial' ? 'trial' : null;
  },
};

function chooseDefenderExcluding(s: GameState, c: Case, excl: CharId) {
  const def = s.chars[c.defendant];
  const cands = allChars(s).filter((x) => x.alive && !x.female && x.location === 'rome' && x.id !== excl && x.id !== c.prosecutor && x.id !== def.id && ageOf(s, x) >= 20);
  cands.sort((a, b) => b.oratory + opinion(s, b.id, def.id).total * 0.4 - (a.oratory + opinion(s, a.id, def.id).total * 0.4));
  c.defender = cands.find((x) => opinion(s, x.id, def.id).total >= 5 || x.familyId === def.familyId)?.id ?? def.id;
  c.jury = c.jury.filter((j) => j.charId !== c.defender);
}

function planNpcRound(s: GameState, c: Case, playerSide: 'prosecution' | 'defense', lastPlayer: Strategy | null) {
  c.npcMix = npcMix(s, c, playerSide === 'prosecution' ? 'defense' : 'prosecution', lastPlayer);
}

function drawFromMix(s: GameState, mix: number[]): Strategy {
  let x = rand(s.rng) * mix.reduce((a, b) => a + b, 0);
  for (let k = 0; k < STRATEGIES.length; k++) {
    x -= mix[k];
    if (x < 0) return STRATEGIES[k].id;
  }
  return STRATEGIES[STRATEGIES.length - 1].id;
}

function autoTrial(s: GameState, c: Case) {
  let lastP: Strategy | null = null;
  let lastD: Strategy | null = null;
  for (let r = 0; r < 3; r++) {
    const p = drawFromMix(s, npcMix(s, c, 'prosecution', lastD));
    const d = drawFromMix(s, npcMix(s, c, 'defense', lastP));
    const swing = roundSwing(s, c, p, d);
    c.rounds.push({ prosecution: p, defense: d, swing });
    c.sway += swing;
    lastP = p;
    lastD = d;
  }
  verdict(s, c);
}

