// UI-side reading of the sim: why a person matters to you, how you are seen, what to do next.
// Pure functions over state; nothing here changes the game.

import { CAMPAIGNS, OFFICES } from '../content/offices';
import { dateOf, dayOf } from '../sim/calendar';
import { getAction } from '../sim/core';
import { playerCase } from '../sim/systems/courts/api';
import { loansHeldBy, loansOwedBy } from '../sim/systems/money/api';
import { favorBalance, hasTie, memoriesAbout, memoryValue, opinion } from '../sim/systems/network/api';
import { heirOf } from '../sim/systems/family/api';
import { campaignOpen } from '../sim/systems/offices';
import { candidacyOf, electionOfCandidate, heldEver, ineligibleFor, openElection, openElections } from '../sim/systems/offices/api';
import { standingOf } from '../sim/systems/standing/api';
import type { Character, CharId, GameState, OfficeId, PlaceId } from '../sim/types';
import { ageOf, allChars, fullName, shortName } from '../sim/util';

export interface Reason {
  text: string;
  weight: number;
  tone: 'good' | 'bad' | 'plain';
}

/** Why someone matters to the player, most important first. */
export function whyMatters(s: GameState, id: CharId): Reason[] {
  const me = s.chars[s.playerId];
  const c = s.chars[id];
  if (!c || id === me.id) return [];
  const out: Reason[] = [];
  const add = (text: string, weight: number, tone: Reason['tone'] = 'plain') => out.push({ text, weight, tone });
  if (me.fatherId === id) add('Your father', 10, 'good');
  if (me.motherId === id) add('Your mother', 6, 'good');
  if (me.spouseId === id) add('Your wife', 9, 'good');
  if (c.fatherId === me.id) add(heirOf(s, me.id) === id ? `Your heir, ${ageOf(s, c)}` : `Your ${c.female ? 'daughter' : 'son'}, ${ageOf(s, c)}`, heirOf(s, me.id) === id ? 9 : 7, 'good');
  if (!c.female && c.fatherId && c.fatherId === me.fatherId) add('Your brother', 6, 'good');
  // Anyone in a decision waiting for you.
  if (s.events.pending.some((p) => Object.values(p.roles).includes(id))) add('Waiting on your answer', 9);
  if (me.patronId === id) add('Your patron', 9, 'good');
  if (c.patronId === me.id) add('Your client', 6, 'good');
  if (me.patronId && c.patronId === me.patronId) add('Fellow client of your patron', 2);
  if (me.patronId && (hasTie(s, me.patronId, id, 'amicus') || hasTie(s, me.patronId, id, 'kin'))) add('In your patron’s circle', 3);
  if (hasTie(s, me.id, id, 'amicus')) add('Your friend', 5, 'good');
  if (hasTie(s, me.id, id, 'inimicus')) add('Your enemy', 7, 'bad');
  const owes = favorBalance(s, id, me.id);
  if (owes > 0) add(`Owes you ${owes > 1 ? `${owes} favors` : 'a favor'}`, 3 + Math.min(owes, 2), 'good');
  const owe = favorBalance(s, me.id, id);
  if (owe > 0) add(`You owe him ${owe > 1 ? `${owe} favors` : 'a favor'}`, 3 + Math.min(owe, 2), 'bad');
  if (loansOwedBy(s, me.id).some((l) => l.lender === id)) add('Your creditor', 6, 'bad');
  if (me.fatherId && loansOwedBy(s, me.fatherId).some((l) => l.lender === id)) add('Your father’s creditor', 6, 'bad');
  if (loansHeldBy(s, me.id).some((l) => l.borrower === id)) add('Owes you money', 3, 'good');
  const pc = playerCase(s);
  if (pc) {
    if (pc.defendant === id) add('Defendant in your case', 8, 'bad');
    if ((pc.prosecutor === id || pc.defender === id) && id !== pc.defendant) add('Opposing counsel', 6, 'bad');
    if (pc.jury.some((j) => j.charId === id && !j.rejected)) add('A juror in your case', 5);
  }
  const e = openElection(s);
  if (e && candidacyOf(s, id)) add(electionOfCandidate(s, id) && electionOfCandidate(s, id) === electionOfCandidate(s, me.id) ? 'Your rival in the election' : `Standing for ${OFFICES[electionOfCandidate(s, id)?.office ?? 'quaestor'].label.toLowerCase()}`, electionOfCandidate(s, id) === electionOfCandidate(s, me.id) ? 5 : 1);
  if (e && candidacyOf(s, me.id)?.endorsements.includes(id)) add('Endorses you', 4, 'good');
  if ((s.network.memories[id] ?? []).some((m) => m.about === me.id && m.act.startsWith('Served under me'))) add('You served under him', 4, 'good');
  const op = opinion(s, id, me.id).total;
  if (op >= 25) add('Thinks well of you', 2, 'good');
  if (op <= -25) add('Thinks ill of you', 2, 'bad');
  const dig = standingOf(s, id, 'dignitas').total;
  if (c.rank === 'senator' && dig >= 60) add('A great man of the Senate', 2);
  if (c.rank !== 'plebs' && !c.female && Math.abs(c.bornBC - me.bornBC) <= 4) add('A young man of your age', 1);
  if (c.flags.banker) add('A banker', 1);
  return out.sort((a, b) => b.weight - a.weight);
}

/** What you would call him in a sentence: Scaurus, Marius, Caecilia. */
export function callName(c: Character): string {
  if (c.female) return c.nomen;
  return c.cognomen ? c.cognomen.split(' ').slice(-1)[0] : c.nomen;
}

// Same-named men (fathers and sons share names) are told apart by age. Cached per state, refreshed monthly.
const nameCache = new WeakMap<GameState, { key: string; counts: Map<string, number> }>();
/** His short name, with his age added when another living man shares it. */
export function displayName(s: GameState, c: Character, full = false): string {
  const key = `${Math.floor(s.day / 30)}:${s.nextCharId}`;
  let nc = nameCache.get(s);
  if (!nc || nc.key !== key) {
    const counts = new Map<string, number>();
    for (const x of allChars(s)) if (x.alive) counts.set(shortName(x), (counts.get(shortName(x)) ?? 0) + 1);
    nc = { key, counts };
    nameCache.set(s, nc);
  }
  const base = full ? fullName(c) : shortName(c);
  return c.alive && (nc.counts.get(shortName(c)) ?? 0) > 1 ? `${base} (${ageOf(s, c)})` : base;
}

/** A plain-language line on where you stand with him: words, not numbers. */
export function stanceLine(s: GameState, id: CharId): string {
  const c = s.chars[id];
  const op = opinion(s, id, s.playerId).total;
  const verb = op >= 45 ? 'is devoted to you' : op >= 25 ? 'thinks highly of you' : op >= 10 ? 'likes you' : op > -10 ? 'has no strong feelings about you' : op > -25 ? 'is cool toward you' : op > -45 ? 'distrusts you' : 'hates you';
  const sign = Math.sign(op);
  const mems = memoriesAbout(s, id, s.playerId).filter((m) => Math.sign(m.now) === sign && Math.abs(m.now) >= 2).sort((a, b) => Math.abs(b.now) - Math.abs(a.now));
  const name = callName(c);
  if (!mems.length || Math.abs(op) < 10) return `${name} ${verb}.`;
  return `${name} ${verb} since ${youDid(mems[0].act)}.`;
}

/** "Prosecuted my kinsman" (his words about you) → "you prosecuted his kinsman". */
export function youDid(act: string): string {
  const father = act.startsWith('His father: ');
  const body = father ? act.slice('His father: '.length) : act;
  const swap: Record<string, string> = { me: 'him', my: 'his', i: 'he', myself: 'himself', his: 'your', him: 'you', himself: 'yourself', mine: 'his' };
  const words = body.split(' ').map((w, i) => {
    const m = /^([A-Za-z]+)(.*)$/.exec(w);
    if (!m) return w;
    const low = m[1].toLowerCase();
    // His present tense ("Writes to me", "Has Tiberius's blood") becomes yours ("write to him", "have").
    if (i === 0) {
      const irregular: Record<string, string> = { has: 'have', was: 'were', is: 'are' };
      if (irregular[low]) return irregular[low] + m[2];
      if (/[^s]s$/.test(low) && !/ed$/.test(low)) return low.slice(0, -1) + m[2];
    }
    const r = swap[low] ?? (i === 0 ? low : m[1]);
    return r + m[2];
  });
  return `${father ? 'your father' : 'you'} ${words.join(' ')}`;
}

export interface CircleEntry {
  id: CharId;
  role: string;
  tone: Reason['tone'];
  line: string;
  weight: number;
}

/** The handful of people who matter to you now: family, patron, rivals, allies, anyone who wants something. */
export function circle(s: GameState, max = 9): CircleEntry[] {
  const me = s.chars[s.playerId];
  const ids = new Set<CharId>();
  const add = (id: CharId | null | undefined) => {
    if (id && id !== me.id && s.chars[id]?.alive) ids.add(id);
  };
  add(me.patronId);
  add(me.spouseId);
  add(me.fatherId);
  for (const c of allChars(s)) if (c.alive && (c.fatherId === me.id || (c.patronId === me.id && c.rank !== 'plebs'))) add(c.id);
  for (const t of s.network.ties) if (t.a === me.id || t.b === me.id) add(t.a === me.id ? t.b : t.a);
  for (const f of s.network.favors) if (f.creditor === me.id || f.debtor === me.id) add(f.creditor === me.id ? f.debtor : f.creditor);
  for (const l of [...loansOwedBy(s, me.id), ...loansHeldBy(s, me.id)]) add(l.lender === me.id ? l.borrower : l.lender);
  const pc = playerCase(s);
  if (pc) [pc.defendant, pc.prosecutor, pc.defender].forEach(add);
  const myE = electionOfCandidate(s, me.id);
  if (myE) for (const c of myE.candidates) add(c.who);
  for (const p of s.events.pending) Object.values(p.roles).forEach(add);
  // And whoever has lately done something to you that he will remember.
  for (const [owner, list] of Object.entries(s.network.memories)) if (list.some((m) => m.about === me.id && s.day - m.day < 120 && Math.abs(m.weight) >= 12)) add(owner);
  const out: CircleEntry[] = [];
  for (const id of ids) {
    const why = whyMatters(s, id);
    if (!why.length) continue;
    const weight = why.reduce((a, r) => a + r.weight, 0) + Math.abs(opinion(s, id, me.id).total) / 20;
    // The headline is the relationship; favors and debts are a note on the line.
    const rel = why.find((r) => !/favor/.test(r.text)) ?? why[0];
    const fav = why.find((r) => r !== rel && /favor/.test(r.text));
    const line = stanceLine(s, id) + (fav ? ` ${fav.text.replace('Owes you', 'He owes you')}.` : '');
    out.push({ id, role: rel.text, tone: rel.tone, line, weight });
  }
  // Family and patron first (at most four), then whoever weighs most.
  const close = /^(Your (wife|father|mother|brother|son|daughter|heir|patron))/;
  const first = out.filter((e) => close.test(e.role)).sort((a, b) => b.weight - a.weight).slice(0, 4);
  const rest = out.filter((e) => !first.includes(e)).sort((a, b) => b.weight - a.weight);
  return [...first, ...rest].slice(0, max);
}

export function relevance(s: GameState, id: CharId): number {
  return whyMatters(s, id).reduce((a, r) => a + r.weight, 0) + Math.abs(opinion(s, id, s.playerId).total) / 25;
}

/** One line on how Rome sees you. */
export function seenAs(s: GameState): string {
  const me = s.chars[s.playerId];
  const dig = standingOf(s, me.id, 'dignitas').total;
  const people = standingOf(s, me.id, 'people').total;
  const boni = standingOf(s, me.id, 'boni').total;
  const fame = dig >= 30 ? 'a known man' : dig >= 15 ? 'a young man beginning to be noticed' : 'a young man nobody has heard of yet';
  const side = people - boni > 25 ? ', counted among the friends of the people' : boni - people > 25 ? ', counted among the boni' : people > 15 && boni > 15 ? ', liked on both sides' : '';
  const new_ = me.rank === 'senator' ? 'a senator' : 'a new man from Arpinum';
  return `To Rome you are ${new_}: ${fame}${side}.`;
}

export interface Ambition {
  title: string;
  step: string;
  place?: PlaceId;
  done?: boolean;
}

/** Two or three things to work toward, each with the next concrete step and where to take it. */
export function ambitions(s: GameState): Ambition[] {
  const me = s.chars[s.playerId];
  const age = ageOf(s, me);
  const y = dateOf(s.day).yearBC;
  const out: Ambition[] = [];
  const q = heldEver(s, me.id, 'quaestor') || s.offices.records.some((r) => r.who === me.id && r.office === 'quaestor');

  if (!me.patronId) out.push({ title: 'Find a patron', step: 'Call on a senator at his house and ask him to be your patron.', place: 'palatine' });

  if (me.servedAbroad < 1) {
    const open = CAMPAIGNS.some((c) => campaignOpen(s, c.id));
    out.push({
      title: 'Serve a campaign abroad',
      step: age < 16 ? 'At sixteen you can join a commander’s staff.' : open ? `${age < 17 ? 'Join a commander’s staff' : 'Enlist as a military tribune'} at the Campus Martius. Armies leave in spring.` : 'Wait for an army to be raised.',
      place: 'campus',
    });
  }

  const pc = playerCase(s);
  if (pc) out.push({ title: `Win your case against ${shortName(s.chars[pc.defendant])}`, step: pc.status === 'prep' ? 'Interview witnesses, search the records, learn the jurors — in the Forum.' : 'The trial is under way.', place: 'forum' });
  else if (!q) {
    if (age < 19) out.push({ title: 'Make a name', step: me.oratory < 35 ? 'Take lessons from a rhetor on the Palatine, and watch the courts in the Forum.' : 'Watch the courts and speak at a contio when you are eighteen.', place: me.oratory < 35 ? 'palatine' : 'forum' });
    else if (s.courts.cases.some((c) => c.status === 'open')) out.push({ title: 'Make a name', step: 'A returned governor is open to prosecution. Take the case in the Forum.', place: 'forum' });
    else out.push({ title: 'Make a name', step: 'Speak at a contio, and wait for a governor to come home to accuse.', place: 'forum' });
  }

  const mine = candidacyOf(s, me.id);
  const myElection = mine ? electionOfCandidate(s, me.id) : undefined;
  if (myElection) {
    out.push({ title: `Win the ${OFFICES[myElection.office].noun}`, step: `Canvass and gather endorsements. The vote is on ${dayLabel(myElection.day)}.`, place: 'campus' });
  } else {
    // The next rung: the highest office open to you this summer, else the next you will qualify for.
    const ladder: OfficeId[] = ['censor', 'consul', 'praetor', 'aedile', 'tribune_pleb', 'quaestor'];
    const open = openElections(s).filter((e) => s.day <= e.professioDeadline && !ineligibleFor(s, me, e.office, e.forYearBC));
    const best = ladder.map((o) => open.find((e) => e.office === o)).find(Boolean);
    if (best) out.push({ title: `Stand for ${OFFICES[best.office].label.toLowerCase()}`, step: `Declare at the Campus Martius by ${dayLabel(best.professioDeadline)}.`, place: 'campus' });
    else {
      const next = [...ladder].reverse().find((o) => o !== 'tribune_pleb' && !s.offices.records.some((r) => r.who === me.id && r.office === o));
      if (next && age >= OFFICES[next].minAge - 3) {
        const why = ineligibleFor(s, { ...me, location: 'rome' }, next, Math.min(y - 1, me.bornBC - OFFICES[next].minAge));
        out.push({ title: `Prepare for the ${OFFICES[next].noun}`, step: why ? `${why}.` : `You can stand in the summer of ${Math.min(y - 1, me.bornBC - OFFICES[next].minAge) + 1} BC. Build your name and your friendships first.`, place: 'campus' });
      } else if (!next) out.push({ title: 'The summit', step: 'You have held every office Rome gives. Your sons are the house’s future now.', done: true });
    }
  }
  void q;

  if (out.length < 3 && me.patronId) out.push({ title: 'Widen your friendships', step: 'Dine with men who matter, and take clients in the Subura.', place: me.home });
  void y;
  return out.slice(0, 3);
}

export function currentActivity(s: GameState): string {
  const me = s.chars[s.playerId];
  if (me.location === 'abroad') return `Away with the army until ${dayLabel(me.flags.returnDay ?? me.busyUntil)}.`;
  if (me.location === 'arpinum') return `At Arpinum until ${dayLabel(me.flags.returnDay ?? me.busyUntil)}.`;
  if (me.action) return `${getAction(me.action.id)?.label ?? 'Busy'} until ${dayLabel(me.action.endDay)}.`;
  if (me.busyUntil > s.day) return `Occupied until ${dayLabel(me.busyUntil)}.`;
  const morning = s.routine === 'attend' ? (me.patronId ? 'attending your patron.' : 'nobody to attend — you have no patron.') : s.routine === 'receive' ? 'receiving clients.' : 'at leisure.';
  return `Free. Mornings: ${morning}`;
}

export function keyDates(s: GameState): { day: number; text: string }[] {
  const out: { day: number; text: string }[] = [];
  const e = openElection(s);
  const y = dateOf(s.day).yearBC;
  if (e) {
    if (e.professioDeadline >= s.day) out.push({ day: e.professioDeadline, text: 'Last day to declare' });
    out.push({ day: e.day, text: `Elections for ${OFFICES[e.office].label.toLowerCase()}` });
  } else out.push({ day: dayOf(y, 5, 1), text: 'Candidacies open' });
  for (const p of s.assembly.proposals) if (p.status === 'pending' && p.proposer === s.playerId) out.push({ day: p.voteDay, text: 'The vote on your bill' });
  const pc = playerCase(s);
  if (pc?.trialDay) out.push({ day: pc.trialDay, text: 'Your trial' });
  for (const l of loansOwedBy(s, s.playerId)) out.push({ day: l.called ? l.callDeadline! : l.dueDay, text: `Loan from ${shortName(s.chars[l.lender])} ${l.called ? 'must be repaid' : 'falls due'}` });
  out.push({ day: dayOf(y - 1, 0, 1), text: 'New magistrates' });
  if (dateOf(s.day).month < 2) out.push({ day: dayOf(y, 2, 1), text: 'The armies march' });
  return out.filter((d) => d.day >= s.day).sort((a, b) => a.day - b.day).slice(0, 3);
}

export function dayLabel(day: number): string {
  const d = dateOf(day);
  return `${d.dom} ${['Ian.', 'Feb.', 'Mart.', 'Apr.', 'Mai.', 'Iun.', 'Quint.', 'Sext.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'][d.month]} ${d.yearBC}`;
}

/** Recent things others remember about you, newest first. */
export function recentlyRemembered(s: GameState, n = 6) {
  const out: { owner: CharId; act: string; day: number; value: number }[] = [];
  for (const [owner, list] of Object.entries(s.network.memories)) {
    if (owner === s.playerId) continue;
    for (const m of list) {
      if (m.about !== s.playerId) continue;
      if (m.act === 'Attends my salutatio' || m.act === 'Receives me in the morning') continue;
      out.push({ owner, act: m.act, day: m.day, value: memoryValue(m, s.day) });
    }
  }
  return out.sort((a, b) => b.day - a.day).slice(0, n);
}
