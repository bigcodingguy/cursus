// Offices: the annual magistrates and their elections, governors abroad, military service.

import { CAMPAIGNS, CANVASS_ZONES, ELECTION_DEFS, FASTI, HISTORICAL_GOVERNORS, OFFICES, PROVINCES, QUAESTOR_ELECTION, type CanvassZone, type ElectionDef } from '../../../content/offices';
import { OUTSIDE_NOMINA, PRAENOMINA } from '../../../content/cast';
import { TRIBES } from '../../../content/offices';
import { emit, on } from '../../bus';
import { dateOf, dayOf } from '../../calendar';
import { registerAction, registerCommand, type SystemDef } from '../../core';
import { chance, fork, gauss, pick, rand, randInt } from '../../rng';
import type { Character, CharId, Election, GameState, OfficeId } from '../../types';
import { allChars, ageOf, breakdown, byHistorical, clamp, fullName, shortName, yearBC } from '../../util';
import { cashOf } from '../money/api';
import { standingOf } from '../standing/api';
import { assemblyOf, candidacyOf, heldEver, waitsForHisYear, electionFor, electionOfCandidate, expectedBy, FORECAST_RUNS, forecastRuns, ineligibleFor, openElections, profiles, quaestorIneligible, voteOnce } from './api';


function record(s: GameState, who: CharId, office: OfficeId, y: number) {
  if (s.offices.records.some((r) => r.who === who && r.office === office && r.yearBC === y)) return;
  emit(s, 'office.won', { who, office, yearBC: y });
}

function eligibleFor(s: GameState, c: Character, office: OfficeId, y: number): boolean {
  if (!c.alive || c.female || c.flags.exiled || c.location === 'exile') return false;
  if (c.bornBC - y < OFFICES[office].minAge) return false;
  const held = (o: OfficeId) => s.offices.records.some((r) => r.who === c.id && r.office === o && r.yearBC > y);
  if (office === 'praetor') return held('quaestor') && !held('praetor') && !held('consul');
  if (office === 'consul') return held('praetor') && !s.offices.records.some((r) => r.who === c.id && r.office === 'consul' && r.yearBC > y && r.yearBC - y < 10);
  return true;
}

/** Senior elections are abstracted: the likeliest men by name and favor take the seats. */
function fillSeats(s: GameState, office: OfficeId, y: number, seats: number, preset: string[]) {
  const chosen: CharId[] = [];
  const busy = (id: CharId) => s.offices.records.some((r) => r.who === id && r.yearBC === y && r.office !== 'military_tribune');
  for (const key of preset) {
    const c = byHistorical(s, key);
    if (c && c.alive && !c.flags.exiled && c.location !== 'exile' && chosen.length < seats && !busy(c.id)) chosen.push(c.id);
  }
  const pool = allChars(s).filter((c) => !chosen.includes(c.id) && c.id !== s.playerId && !busy(c.id) && eligibleFor(s, c, office, y));
  while (chosen.length < seats && pool.length) {
    const score = (c: Character) => Math.exp(0.04 * standingOf(s, c.id, 'dignitas').total + 0.01 * standingOf(s, c.id, 'boni').total + c.traits.ambition);
    let total = 0;
    for (const c of pool) total += score(c);
    let x = rand(s.rng) * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      x -= score(pool[idx]);
      if (x < 0) break;
    }
    chosen.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  for (const id of chosen) record(s, id, office, y);
}

function newElection(s: GameState, def: ElectionDef): Election {
  const y = yearBC(s);
  const day = dayOf(y, def.month, def.dom);
  return {
    id: `${def.office}${y - 1}`,
    office: def.office,
    forYearBC: y - 1,
    seats: def.seats,
    day,
    professioDeadline: day - QUAESTOR_ELECTION.professioDays,
    candidates: [],
    status: 'open',
    postponements: 0,
  };
}

function declare(s: GameState, who: CharId, office: OfficeId) {
  const e = electionFor(s, office);
  if (!e || e.candidates.some((c) => c.who === who) || candidacyOf(s, who)) return;
  const groundwork = s.offices.groundwork[who] ?? {};
  e.candidates.push({ who, canvass: { ...groundwork }, bribes: {}, endorsements: [], declaredDay: s.day });
  delete s.offices.groundwork[who];
  if (who === s.playerId) emit(s, 'log', { text: `You give your name to the presiding consul as a candidate for ${OFFICES[office].label.toLowerCase()}.`, kind: 'player' });
}

/** How much a man wants an office this year. History's men want theirs badly. */
const RANK: Partial<Record<OfficeId, number>> = { quaestor: 1, tribune_pleb: 1, aedile: 2, praetor: 3, consul: 4, censor: 5 };

function urgeFor(s: GameState, a: Character, e: Election): number {
  if (expectedBy(s, a, e.office, e.forYearBC)) return 9;
  // No man who has sat in a curule chair stands for a lower one.
  const top = Math.max(0, ...s.offices.records.filter((r) => r.who === a.id).map((r) => RANK[r.office] ?? 0));
  if (top > (RANK[e.office] ?? 0) && e.office !== 'consul') return 0;
  if (waitsForHisYear(a, e.office, e.forYearBC)) return 0.2;
  const dig = standingOf(s, a.id, 'dignitas').total;
  const age = a.bornBC - e.forYearBC;
  switch (e.office) {
    case 'quaestor':
      return a.traits.ambition * (age >= 30 ? 1.5 : 1) + (a.historical ? 0.3 : 0) + 0.002 * dig;
    case 'tribune_pleb':
      // Standing again for the tribunate was legal but rare, and looked like a bid for tyranny.
      return (Math.abs(a.lean) > 0.4 ? a.traits.boldness * 0.9 + a.traits.ambition * 0.3 : 0.2) * (heldEver(s, a.id, 'tribune_pleb') ? 0.25 : 1);
    case 'aedile':
      return cashOf(s, a.id) > 60000 ? a.traits.ambition * 0.8 : 0.2;
    case 'praetor':
      return a.traits.ambition * 1.1 + dig / 120;
    case 'consul':
      return a.traits.ambition * 1.1 + dig / 90;
    case 'censor':
      return dig / 70;
    default:
      return 0;
  }
}

/** Men from houses outside the cast who come forward. They join the cast and play by its rules. */
function spawnOutsiders(s: GameState, e: Election) {
  if (e.office !== 'quaestor' && e.office !== 'tribune_pleb') return draftField(s, e);
  const [lo, hi] = e.office === 'quaestor' ? QUAESTOR_ELECTION.fieldMargin : [3, 5];
  const want = e.seats + randInt(s.rng, lo, hi);
  let n = 0;
  while (e.candidates.length < want && n++ < 20) {
    const id = `c${s.nextCharId++}`;
    let nomenFull = pick(s.rng, OUTSIDE_NOMINA).split(' ');
    let praenomen = pick(s.rng, PRAENOMINA);
    // Avoid two living men with the same name.
    for (let k = 0; k < 10 && allChars(s).some((c) => c.alive && c.praenomen === praenomen && c.nomen === nomenFull[0] && c.cognomen === nomenFull[1]); k++) {
      nomenFull = pick(s.rng, OUTSIDE_NOMINA).split(' ');
      praenomen = pick(s.rng, PRAENOMINA);
    }
    const anc = randInt(s.rng, 0, 3);
    const famId = `out_${id}`;
    s.families[famId] = { id: famId, name: nomenFull[0], patrician: false, consulAncestors: anc, praetorAncestors: randInt(s.rng, 0, 2), home: 'carinae' };
    const bornBC = e.forYearBC + randInt(s.rng, 27, e.office === 'quaestor' ? 33 : 38);
    const c: Character = {
      id, praenomen, nomen: nomenFull[0], cognomen: nomenFull[1], female: false, familyId: famId, bornBC, alive: true,
      rank: 'eques', traits: { ambition: 0.6 + 0.4 * rand(s.rng), greed: rand(s.rng), boldness: rand(s.rng), loyalty: rand(s.rng), sociability: rand(s.rng), pride: rand(s.rng) },
      lean: clamp(0.2 + 0.5 * gauss(s.rng), -1, 1), oratory: 25 + 30 * rand(s.rng), law: 20 + 30 * rand(s.rng), location: 'rome', home: 'carinae',
      tribe: pick(s.rng, TRIBES), servedAbroad: randInt(s.rng, 1, 4), busyUntil: 0, nextThink: s.day + randInt(s.rng, 1, 7), flags: { outsider: 1 },
      bio: 'A candidate from a house outside your acquaintance.',
    };
    s.chars[id] = c;
    s.money.accounts[id] = { cash: 0, income: 30000 + 40000 * rand(s.rng), upkeep: 30000 };
    emit(s, 'transfer', { from: null, to: id, amount: 20000 + Math.round(60000 * rand(s.rng)), reason: 'estates' });
    emit(s, 'standing', { who: id, kind: 'dignitas', value: Math.round(8 + 12 * rand(s.rng)), label: 'Military service', halfLife: 0 });
    emit(s, 'standing', { who: id, kind: 'people', value: Math.round(25 * gauss(s.rng) + 15), label: 'Reputation in the city' });
    emit(s, 'standing', { who: id, kind: 'boni', value: Math.round(25 * gauss(s.rng) + 18), label: 'Reputation among the boni' });
    const groundwork: Record<string, number> = {};
    for (const t of TRIBES) if (chance(s.rng, 0.6)) groundwork[t] = Math.round(rand(s.rng) * 6 * 10) / 10;
    s.offices.groundwork[id] = groundwork;
    declare(s, id, e.office);
  }
}

/** For the senior offices the field comes from the cast: eligible men are pressed by their friends to stand. */
function draftField(s: GameState, e: Election) {
  const want = e.seats + (e.office === 'consul' || e.office === 'censor' ? 2 : 3);
  if (e.candidates.length >= want) return;
  const pool = allChars(s)
    .filter((c) => c.id !== s.playerId && !candidacyOf(s, c.id) && !ineligibleFor(s, c, e.office, e.forYearBC) && urgeFor(s, c, e) > 0.2)
    .sort((a, b) => standingOf(s, b.id, 'dignitas').total + b.traits.ambition * 20 - (standingOf(s, a.id, 'dignitas').total + a.traits.ambition * 20));
  for (const c of pool) {
    if (e.candidates.length >= want) break;
    declare(s, c.id, e.office);
  }
}

function resolveElection(s: GameState, e: Election, playerSaw?: number) {
  // With the player standing, the vote is one of the forecast runs picked at random, so the odds he saw are exact.
  // Otherwise a single run with fresh luck.
  const playerStands = e.candidates.some((c) => c.who === s.playerId);
  const r = playerStands ? forecastRuns(s, e)[randInt(s.rng, 0, FORECAST_RUNS - 1)] : voteOnce(e, profiles(s, e), fork(s.rng, randInt(s.rng, 0, 1 << 30)));
  e.status = 'held';
  e.results = { ...r, forecastWin: playerSaw };
  for (const id of r.winners) record(s, id, e.office, e.forYearBC);
  for (const c of e.candidates) {
    if (!r.winners.includes(c.who)) emit(s, 'standing', { who: c.who, kind: 'dignitas', value: -2, label: 'Defeated at the polls (repulsa)', halfLife: 1500 });
  }
  // Winners who bought their votes may find themselves in the bribery court.
  for (const w of r.winners) {
    const c = s.chars[w];
    if ((c.flags.ambitus ?? 0) >= 40000 && chance(s.rng, 0.5)) emit(s, 'hook', { name: 'ambitus_case', roles: { defendant: w }, vars: { amount: c.flags.ambitus, office: e.office } });
  }
  for (const c of e.candidates) if (s.chars[c.who]?.flags.ambitus) emit(s, 'charFlag', { who: c.who, key: 'ambitus', value: 0 });
  const names = r.winners.map((w) => shortName(s.chars[w])).join(', ');
  const plural: Record<string, string> = { quaestor: 'quaestors', tribune_pleb: 'tribunes of the plebs', aedile: 'aediles', praetor: 'praetors', consul: 'consuls', censor: 'censors' };
  emit(s, 'log', { text: `The ${assemblyOf(e.office) === 'centuriate' ? 'centuries' : 'tribes'} elect the ${plural[e.office]} for ${e.forYearBC} BC: ${names}.`, kind: 'election', about: r.winners });
  emit(s, 'news', { text: `The new ${plural[e.office]} are ${names}.`, truth: 'true', delay: 0, about: r.winners });
  emit(s, 'election.held', { electionId: e.id, winners: r.winners });
  const pc = e.candidates.find((c) => c.who === s.playerId);
  if (pc) {
    const won = r.winners.includes(s.playerId);
    const t = r.tally[s.playerId];
    const total = assemblyOf(e.office) === 'centuriate' ? 193 : 35;
    emit(s, 'event.trigger', { eventId: won ? 'election_won' : 'election_lost', vars: { tribes: t?.tribes ?? 0, votes: t?.votes ?? 0, year: e.forYearBC, of: total, units: total === 193 ? 'centuries' : 'tribes', office: OFFICES[e.office].label.toLowerCase(), officeCap: OFFICES[e.office].label } });
  }
}

export const offices: SystemDef = {
  id: 'offices',
  register() {
    // The player's choices in office, made through content events.
    on('hook', (s, e) => {
      const pl = s.chars[s.playerId];
      const greed: Record<string, number> = { govern_light: 0.2, govern_usual: 0.5, govern_hard: 0.85, command_go: 0.35 };
      if (e.name in greed && e.vars?.province) {
        sendGovernor(s, pl, String(e.vars.province), 1, greed[e.name]);
        pl.flags.governing = 1;
        return;
      }
      if (e.name === 'governor_take') {
        const g = s.offices.governors.find((x) => x.who === pl.id && !x.returned);
        if (g) g.taken = (g.taken ?? 0) + Number(e.vars?.amount ?? 0);
        return;
      }
      if (e.name === 'censor_expel' && e.roles.enemy) {
        const c = s.chars[e.roles.enemy];
        if (!c?.alive || c.rank !== 'senator') return;
        c.rank = 'eques';
        c.flags.expelled = yearBC(s);
        emit(s, 'memory', { owner: c.id, about: pl.id, act: 'Struck me from the Senate', weight: -70, halfLife: 0 });
        emit(s, 'tie', { a: c.id, b: pl.id, kind: 'inimicus' });
        emit(s, 'log', { text: `The censors strike ${fullName(c)} from the roll of the Senate.`, kind: 'player', about: [c.id] });
        return;
      }
      if (e.name === 'censor_enroll' && e.roles.client) {
        const c = s.chars[e.roles.client];
        if (!c?.alive || c.rank === 'senator') return;
        c.rank = 'senator';
        emit(s, 'favor', { debtor: c.id, creditor: pl.id, weight: 4, reason: 'Enrolled me in the Senate' });
        emit(s, 'log', { text: `The censors enroll ${fullName(c)} in the Senate.`, kind: 'player', about: [c.id] });
      }
    });

    on('office.won', (s, e) => {
      s.offices.records.push({ who: e.who, office: e.office, yearBC: e.yearBC });
      const def = OFFICES[e.office];
      const label = `${def.label}, ${e.yearBC} BC`;
      emit(s, 'standing', { who: e.who, kind: 'dignitas', value: def.dignitas, label, halfLife: 0 });
    });
    on('election.postpone', (s, e) => {
      const el = e.office === 'mine' ? electionOfCandidate(s, s.playerId) : electionFor(s, e.office as OfficeId);
      if (!el) return;
      el.day += e.days;
      el.postponements += 1;
      emit(s, 'log', { text: `The elections are postponed ${e.days} days: ${e.reason}.`, kind: 'election' });
    });
    on('death', (s, e) => {
      for (const el of s.offices.elections) if (el.status === 'open') el.candidates = el.candidates.filter((c) => c.who !== e.who);
    });

    registerCommand('election.vote', (s) => {
      const e = electionOfCandidate(s, s.playerId);
      if (!e || e.day > s.day) return 'No vote today';
      const runs = forecastRuns(s, e);
      const p = runs.filter((r) => r.winners.includes(s.playerId)).length / runs.length;
      resolveElection(s, e, p);
      return null;
    });

    registerAction({
      id: 'declare',
      label: 'Declare your candidacy',
      blurb: 'Give your name to the presiding consul (professio). Canvassing done beforehand counts.',
      place: 'campus',
      duration: () => 0,
      check: (s, a, p) => {
        const office = (p.office as OfficeId) ?? 'quaestor';
        const e = electionFor(s, office);
        if (!e) return 'No election for that office is open (candidacies open on the Kalends of Iunius)';
        if (s.day > e.professioDeadline) return 'Too late to declare this year';
        if (candidacyOf(s, a.id)) return 'Already a candidate this year';
        return ineligibleFor(s, a, office, e.forYearBC);
      },
      complete: (s, a, p) => declare(s, a.id, (p.office as OfficeId) ?? 'quaestor'),
      npc: (s, a) => {
        if (a.id === s.playerId || candidacyOf(s, a.id)) return [];
        const out = [];
        for (const e of openElections(s)) {
          if (s.day > e.professioDeadline || ineligibleFor(s, a, e.office, e.forYearBC)) continue;
          // A man history marks for one office that year keeps himself free for it.
          if (a.historical && !expectedBy(s, a, e.office, e.forYearBC) && (['consul', 'tribune_pleb', 'praetor'] as OfficeId[]).some((o) => expectedBy(s, a, o, e.forYearBC))) continue;
          const urge = urgeFor(s, a, e);
          // A crowded field keeps all but history's men and the most eager out.
          const crowded = e.candidates.length >= e.seats * (e.office === 'quaestor' || e.office === 'tribune_pleb' ? 2.5 : 3);
          if (crowded && !expectedBy(s, a, e.office, e.forYearBC) && urge < 3) continue;
          out.push({ params: { office: e.office }, utility: urge > 0.75 ? 5 + Math.min(4, urge) : 0.5 });
        }
        return out;
      },
    });

    registerAction({
      id: 'canvass',
      label: 'Canvass for votes',
      blurb: 'Shake hands, learn names, make promises. Effort builds up in the tribes you reach.',
      place: (_s, _a, p) => (p.zone === 'subura' ? 'subura' : 'campus'),
      duration: (_s, _a, p) => CANVASS_ZONES[(p.zone as CanvassZone) ?? 'subura'].days,
      cost: (_s, _a, p) => CANVASS_ZONES[(p.zone as CanvassZone) ?? 'subura'].cost + Number(p.gifts ?? 0),
      check: (s, a, p) => {
        if (!CANVASS_ZONES[p.zone as CanvassZone]) return 'Choose where to canvass';
        if (candidacyOf(s, a.id)) return null;
        if (a.bornBC - (yearBC(s) - 1) < OFFICES.quaestor.minAge - 1) return 'Too young to be canvassing yet (wait until the year before you can stand)';
        return null;
      },
      start: (s, a, p) => {
        if (p.zone === 'arpinum') emit(s, 'travel', { who: a.id, to: 'arpinum', until: s.day + CANVASS_ZONES.arpinum.days });
      },
      complete: (s, a, p) => {
        const z = CANVASS_ZONES[p.zone as CanvassZone];
        const skill = 0.6 + a.oratory / 160 + a.traits.sociability * 0.3;
        const per = (p.zone === 'campus' ? 0.5 : p.zone === 'subura' ? 1.5 : 2.5) * skill;
        const cand = candidacyOf(s, a.id);
        const target = cand ? cand.canvass : (s.offices.groundwork[a.id] ??= {});
        for (const t of z.tribes) target[t] = (target[t] ?? 0) + per;
        const gifts = Number(p.gifts ?? 0);
        if (gifts > 0) {
          if (cand) for (const t of z.tribes) cand.bribes[t] = (cand.bribes[t] ?? 0) + gifts / z.tribes.length;
          emit(s, 'standing', { who: a.id, kind: 'boni', value: -Math.min(15, gifts / 3000), label: 'Talk of bribery (ambitus)' });
          emit(s, 'standing', { who: a.id, kind: 'people', value: Math.min(6, gifts / 6000), label: 'Generous to voters' });
          const before = a.flags.ambitus ?? 0;
          a.flags.ambitus = before + gifts;
          if (Math.floor(before / 20000) !== Math.floor(a.flags.ambitus / 20000) || a.id === s.playerId) emit(s, 'news', { text: `Money is changing hands in the tribes for ${shortName(a)}, they say.`, truth: 'true', delay: 3, about: [a.id] });
        }
        emit(s, 'standing', { who: a.id, kind: 'people', value: p.zone === 'subura' ? 1.5 : 0.8, label: 'Seen canvassing' });
      },
      npc: (s, a) => {
        if (a.id === s.playerId) return [];
        const cand = candidacyOf(s, a.id);
        const soon = !cand && a.traits.ambition > 0.5 && dateOf(s.day).month >= 2 && !openElections(s).length && !quaestorIneligible(s, a, yearBC(s) - 1);
        if (!cand && !soon) return [];
        const cash = cashOf(s, a.id);
        const opts = [];
        for (const zone of ['subura', 'campus'] as CanvassZone[]) {
          const z = CANVASS_ZONES[zone];
          if (cash < z.cost * 2) continue;
          const gifts = cand && a.traits.greed > 0.6 && cash > 60000 ? 10000 : 0;
          opts.push({ params: { zone, gifts }, utility: (cand ? 3.5 : 1.2) * a.traits.ambition + (zone === 'campus' ? 0.2 : 0) });
        }
        if (a.tribe === 'Cornelia' || a.tribe === 'Teretina') opts.push({ params: { zone: 'arpinum', gifts: 0 }, utility: cand ? 2 : 0.5 });
        return opts;
      },
    });

    registerAction({
      id: 'serve',
      label: 'Serve abroad as a military tribune',
      blurb: 'A campaign season with the legions. Required before standing for office.',
      place: 'campus',
      duration: () => 200,
      check: (s, a, p) => {
        if (ageOf(s, a) < (p.staff ? 16 : 17)) return p.staff ? 'Too young even for a commander’s staff (16)' : 'Too young to serve as a tribune (17); at 16 you can join a commander’s staff';
        const camp = CAMPAIGNS.find((c) => c.id === p.campaign);
        if (!camp) return 'Choose a campaign';
        if (!campaignOpen(s, camp.id)) return 'That campaign is not under way';
        return null;
      },
      odds: (_s, _a, p) => {
        const camp = CAMPAIGNS.find((c) => c.id === p.campaign);
        if (!camp) return null;
        const risk = camp.risk * (p.staff ? 0.5 : 1);
        return { total: 1 - risk, parts: [{ label: 'Return alive', value: 1 - risk }] };
      },
      start: (s, a, _p) => {
        emit(s, 'travel', { who: a.id, to: 'abroad', until: s.day + 200 });
        if (a.id === s.playerId) emit(s, 'log', { text: 'You leave Rome to join the army.', kind: 'player' });
      },
      complete: (s, a, p) => {
        const camp = CAMPAIGNS.find((c) => c.id === p.campaign)!;
        if (chance(s.rng, camp.risk * (p.staff ? 0.5 : 1))) {
          emit(s, 'death', { who: a.id, cause: `killed on campaign in ${camp.label}` });
          return;
        }
        a.servedAbroad += 1;
        record(s, a.id, 'military_tribune', yearBC(s));
        emit(s, 'standing', { who: a.id, kind: 'dignitas', value: camp.dignitas - (p.staff ? 1 : 0), label: `Served in ${camp.label}`, halfLife: 0 });
        const cmd = camp.commander ? byHistorical(s, camp.commander) : undefined;
        // A young man on a commander's own staff lives at his table and becomes his protégé.
        if (cmd?.alive) emit(s, 'memory', { owner: cmd.id, about: a.id, act: `Served under me in ${camp.label}`, weight: p.staff ? 20 : 12, halfLife: 2500 });
        emit(s, 'skill', { who: a.id, skill: 'oratory', add: 1 });
        if (a.id === s.playerId) {
          emit(s, 'event.trigger', { eventId: 'returned_from_service', vars: { campaign: camp.label } });
        }
      },
      npc: (s, a) => {
        if (a.id === s.playerId) return [];
        const age = ageOf(s, a);
        if (age < 17 || age > 34 || a.servedAbroad >= 3 || a.rank === 'plebs') return [];
        const open = CAMPAIGNS.filter((c) => campaignOpen(s, c.id));
        if (!open.length || dateOf(s.day).month > 4) return [];
        const camp = open[Math.floor(a.nextThink % open.length)];
        return [{ params: { campaign: camp.id }, utility: a.servedAbroad === 0 && age >= 18 ? 4 : 1.2 * a.traits.boldness }];
      },
    });
  },

  init(s) {
    const y = yearBC(s);
    fillSeats(s, 'consul', y, 2, FASTI[y]?.consuls ?? []);
    for (const key of FASTI[y]?.tribunes ?? []) {
      const c = byHistorical(s, key);
      if (c) record(s, c.id, 'tribune_pleb', y);
    }
    fillSeats(s, 'praetor', y, 6, FASTI[y]?.praetors ?? []);
  },

  yearly(s) {
    const y = yearBC(s);
    // Elections fill the seats; if one ever left a curule chair empty, the Senate's men fill it.
    const have = (o: OfficeId) => s.offices.records.filter((r) => r.office === o && r.yearBC === y).length;
    if (have('consul') < 2) fillSeats(s, 'consul', y, 2 - have('consul'), FASTI[y]?.consuls ?? []);
    if (have('praetor') < 6) fillSeats(s, 'praetor', y, 6 - have('praetor'), FASTI[y]?.praetors ?? []);
    for (const r of s.offices.records) {
      if (r.yearBC === y && OFFICES[r.office].makesSenator) {
        const c = s.chars[r.who];
        if (c?.alive && c.rank !== 'senator') {
          c.rank = 'senator';
          if (c.id === s.playerId) emit(s, 'log', { text: 'You take office and your name is entered among the senators.', kind: 'player' });
        }
      }
      if (r.yearBC === y && r.who === s.playerId && s.chars[r.who]?.alive) {
        emit(s, 'office.start', { who: r.who, office: r.office, yearBC: y });
        emit(s, 'hook', { name: `office_start_${r.office}`, roles: { holder: r.who }, vars: {} });
      }
    }
  },

  monthly(s) {
    const d = dateOf(s.day);
    const y = d.yearBC;
    if (d.month === 2) departGovernors(s, y);
    if (d.month === 1) offerService(s);
    if (d.month === QUAESTOR_ELECTION.openMonth && !openElections(s).length) {
      for (const def of ELECTION_DEFS) if (!def.years || def.years.includes(y)) s.offices.elections.push(newElection(s, def));
      emit(s, 'log', { text: `Candidates for the magistracies of ${y - 1} BC may now give in their names.`, kind: 'election' });
    }
    // Old results are kept a few years for the record.
    if (d.month === 0 && s.offices.elections.length > 60) s.offices.elections = s.offices.elections.slice(-40);
  },

  daily(s) {
    for (const g of s.offices.governors) {
      if (!g.returned && s.day >= g.returnDay) {
        g.returned = true;
        const c = s.chars[g.who];
        if (!c?.alive) continue;
        if (c.location === 'abroad') c.location = 'rome';
        emit(s, 'transfer', { from: null, to: g.who, amount: g.extorted, reason: 'provincial spoils' });
        if (c.id === s.playerId) delete c.flags.governing;
        emit(s, 'governor.returned', { who: g.who, province: g.province, extorted: g.extorted + (g.taken ?? 0) });
      }
    }
    for (const e of openElections(s)) {
      if (s.day === e.professioDeadline) spawnOutsiders(s, e);
      if (s.day < e.day) continue;
      const pc = e.candidates.find((c) => c.who === s.playerId);
      if (pc && s.chars[s.playerId].alive && s.chars[s.playerId].location === 'rome') {
        if (!s.flags[`vote_called_${e.id}_${e.postponements}`]) {
          s.flags[`vote_called_${e.id}_${e.postponements}`] = 1;
          emit(s, 'pause', { reason: 'election day' });
        }
      } else resolveElection(s, e);
    }
  },

  blocks(s) {
    const e = electionOfCandidate(s, s.playerId);
    if (e && s.day >= e.day && s.chars[s.playerId].location === 'rome') return 'election';
    return null;
  },
};

/** Each spring, until he has served, a young man is offered a place with an army leaving Rome. */
function offerService(s: GameState) {
  const pl = s.chars[s.playerId];
  const age = ageOf(s, pl);
  if (!pl.alive || pl.location !== 'rome' || age < 16 || pl.servedAbroad >= 1 || age > 30) return;
  const open = CAMPAIGNS.filter((c) => c.commander && campaignOpen(s, c.id)).map((c) => ({ c, cmd: byHistorical(s, c.commander)! }));
  if (!open.length) return;
  open.sort((x, y) => standingOf(s, y.cmd.id, 'dignitas').total - standingOf(s, x.cmd.id, 'dignitas').total);
  const { c, cmd } = open[0];
  const staff = age < 17 ? 1 : 0;
  emit(s, 'event.trigger', { eventId: 'legions', roles: { commander: cmd.id }, vars: { campaign: c.label, campaignId: c.id, risk: Math.round(c.risk * (staff ? 50 : 100)), staff, spainRisk: staff ? 2 : 3 } });
}

export function campaignOpen(s: GameState, id: string): boolean {
  const c = CAMPAIGNS.find((x) => x.id === id);
  if (!c) return false;
  const y = yearBC(s);
  if (y > c.years[0] || y < c.years[1]) return false;
  if (c.flag && !s.flags[c.flag]) return false;
  if (c.until && s.flags[c.until]) return false;
  if (!c.commander) return true;
  const cmd = byHistorical(s, c.commander);
  return !!cmd?.alive;
}

function departGovernors(s: GameState, y: number) {
  // Seeded historical governorships first.
  for (const h of HISTORICAL_GOVERNORS) {
    if (h.departBC !== y) continue;
    const c = byHistorical(s, h.who);
    if (!c?.alive || c.location !== 'rome') continue;
    const years = h.departBC - h.returnBC;
    sendGovernor(s, c, h.province, years, h.greed);
  }
  const busy = new Set(s.offices.governors.filter((g) => !g.returned).map((g) => g.province));
  const free = PROVINCES.filter((p) => !p.war && p.fromBC >= y && !busy.has(p.id));
  const pool = s.offices.records
    .filter((r) => r.yearBC === y + 1 && (r.office === 'praetor' || r.office === 'consul'))
    .map((r) => s.chars[r.who])
    .filter((c) => c?.alive && c.location === 'rome' && c.id !== s.playerId && !s.offices.governors.some((g) => g.who === c.id && !g.returned));
  // The player, if he held a praetorship or consulship last year, is offered a province.
  const pl = s.chars[s.playerId];
  const mine = s.offices.records.find((r) => r.who === pl.id && r.yearBC === y + 1 && (r.office === 'praetor' || r.office === 'consul'));
  if (mine && pl.alive && pl.location === 'rome' && free.length && !s.offices.governors.some((g) => g.who === pl.id && !g.returned)) {
    const war = mine.office === 'consul' ? warProvince(s) : undefined;
    const p = war ?? free.splice(Math.floor(rand(s.rng) * free.length), 1)[0];
    emit(s, 'event.trigger', { eventId: war ? 'command_offer' : 'province_offer', roles: {}, vars: { province: p.id, provinceLabel: p.label, war: war ? 1 : 0, winChance: war ? Math.round(commandOdds(s, pl) * 100) : 0 } });
  }
  for (const c of pool) {
    if (!free.length) break;
    const p = free.splice(Math.floor(rand(s.rng) * free.length), 1)[0];
    sendGovernor(s, c, p.id, chance(s.rng, 0.35) ? 2 : 1, c.traits.greed);
  }
}

/** A consul may be sent to the war that is going badly, if there is one. */
function warProvince(s: GameState) {
  if (s.flags.numidian_war && !s.flags.jugurtha_captured && !s.flags.marius_africa) return PROVINCES.find((p) => p.id === 'numidia');
  if (s.flags.cimbri && !s.flags.cimbri_beaten) return PROVINCES.find((p) => p.id === 'gallia');
  return undefined;
}

/** The chance a commander comes home victorious from a season's war. Shown to the player and used. */
export function commandOdds(s: GameState, c: Character): number {
  return commandBreakdown(s, c).total;
}
export function commandBreakdown(s: GameState, c: Character) {
  return breakdown(
    [
      { label: 'Base', value: 0.45 },
      { label: 'Campaigns served', value: Math.min(0.2, c.servedAbroad * 0.05) },
      { label: 'His name with the soldiers (dignitas)', value: standingOf(s, c.id, 'dignitas').total / 400 },
      { label: 'The new armies of the poor', value: s.flags.capite_censi ? 0.1 : 0 },
      { label: 'An enemy that has beaten consular armies', value: s.flags.arausio && !s.flags.cimbri_beaten ? -0.1 : 0 },
    ],
    0.1,
    0.9,
  );
}

function sendGovernor(s: GameState, c: Character, province: string, years: number, greed: number) {
  const p = PROVINCES.find((x) => x.id === province)!;
  const squeeze = Math.max(0, greed * greed * 900000 * p.richness * years * (0.7 + 0.6 * rand(s.rng)) - 120000);
  const depart = s.day;
  const ret = s.day + years * 365 - randInt(s.rng, 0, 40);
  s.offices.governors.push({ who: c.id, province, departDay: depart, returnDay: ret, extorted: Math.round(squeeze / 1000) * 1000, returned: false });
  emit(s, 'travel', { who: c.id, to: 'abroad', until: ret });
  emit(s, 'log', { text: `${fullName(c)} sets out to govern ${p.label}.`, kind: 'world', about: [c.id] });
}
