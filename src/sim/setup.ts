// Builds a new game from the content tables.

import { CITY_FOLK, HISTORICAL, HOUSES, MONEYMEN, PRAENOMINA } from '../content/cast';
import { emit } from './bus';
import { dayOf } from './calendar';
import { initSystems } from './core';
import { installAll } from './index';
import { CURRENT_VERSION } from './migrations';
import { gauss, makeRng, pick, rand, randInt, seedFrom, type RngState } from './rng';
import type { Character, CharId, Family, GameState, Traits } from './types';
import { byHistorical, clamp } from './util';

export interface NewGameOptions {
  seed: number | string;
  praenomen?: string;
  nomen?: string;
}

export const START_DAY = dayOf(133, 2, 1); // Kalends of March, 133 BC
export const END_DAY = dayOf(100, 11, 31) + 1;

function traits(r: RngState, over?: Partial<Traits>): Traits {
  const t = () => clamp(0.5 + 0.22 * gauss(r), 0, 1);
  return { ambition: t(), greed: t(), boldness: t(), loyalty: t(), sociability: t(), pride: t(), ...over };
}

export function emptyState(seed: number): GameState {
  return {
    version: CURRENT_VERSION,
    seed,
    rng: makeRng(seed),
    day: START_DAY,
    startDay: START_DAY,
    endDay: END_DAY,
    playerId: '',
    chars: {},
    families: {},
    nextCharId: 1,
    flags: {},
    laws: { repetundaeJury: 'senators', repetundaeMultiplier: 1 },
    routine: 'attend',
    network: { memories: {}, favors: [], ties: [], nextFavorId: 1 },
    money: { accounts: {}, loans: [], nextLoanId: 1, minted: 0, burned: 0, flows: {}, bankrupt: [], history: [] },
    standing: { entries: {} },
    offices: { records: [], governors: [], elections: [], groundwork: {} },
    courts: { cases: [], nextCaseId: 1 },
    crisis: { pressures: {}, stability: 60, history: [] },
    events: { fired: {}, pending: [], nextUid: 1, scheduled: [], lastPrompt: START_DAY },
    news: { items: [], nextId: 1 },
    family: { marriages: [], heirs: {}, elogia: [], line: [] },
    assembly: { proposals: [], nextId: 1, passed: {} },
    log: [],
    pauseRequests: [],
  };
}

export function newGame(opts: NewGameOptions): GameState {
  installAll();
  const seed = typeof opts.seed === 'number' ? opts.seed >>> 0 : seedFrom(opts.seed);
  const s = emptyState(seed);
  const r = s.rng;
  const newId = () => `c${s.nextCharId++}`;

  const add = (c: Omit<Character, 'id' | 'busyUntil' | 'nextThink' | 'flags' | 'servedAbroad' | 'alive'> & Partial<Character>, cash: number, income: number, upkeep: number): Character => {
    const id = c.id ?? newId();
    const full: Character = { alive: true, servedAbroad: 0, busyUntil: 0, nextThink: s.day + randInt(r, 1, 9), flags: {}, ...c, id } as Character;
    s.chars[id] = full;
    s.money.accounts[id] = { cash: 0, income, upkeep };
    if (cash > 0) emit(s, 'transfer', { from: null, to: id, amount: cash, reason: 'starting wealth' });
    return full;
  };
  const famOf = (id: string) => s.families[id];

  // Houses.
  for (const h of HOUSES) {
    s.families[h.id] = { id: h.id, name: h.name, patrician: h.patrician, consulAncestors: h.consulAncestors, praetorAncestors: h.praetorAncestors, home: h.home };
  }

  // Historical figures.
  for (const d of HISTORICAL) {
    let famId = d.house;
    if (!famId || d.consulAncestors !== undefined) {
      famId = `h_${d.key}`;
      const f: Family = { id: famId, name: d.nomen, patrician: d.patrician ?? (d.house ? famOf(d.house).patrician : false), consulAncestors: d.consulAncestors ?? 0, praetorAncestors: d.consulAncestors ? 1 : 0, home: d.home ?? 'carinae' };
      s.families[famId] = f;
    }
    const house = HOUSES.find((h) => h.id === d.house);
    const senior = d.rank === 'senator';
    const income = d.income ?? (senior ? 60000 + 80000 * rand(r) : d.female ? 0 : 25000 + 30000 * rand(r));
    const c = add(
      {
        praenomen: d.praenomen, nomen: d.nomen, cognomen: d.cognomen, female: !!d.female, familyId: famId, bornBC: d.bornBC, rank: d.rank,
        traits: traits(r, d.traits), lean: d.lean, oratory: d.oratory, law: d.law ?? 20 + 30 * rand(r), location: d.location ?? 'rome',
        home: d.home ?? house?.home ?? 'carinae', tribe: d.tribe ?? house?.tribe ?? 'Palatina', historical: d.key, bio: d.bio,
      },
      d.cash ?? (senior ? 80000 + 150000 * rand(r) : d.female ? 20000 : 30000 + 40000 * rand(r)),
      income,
      d.female ? 0 : income * (0.8 + 0.15 * rand(r)),
    );
    if (d.flags) Object.assign(c.flags, d.flags);
    if (!d.female && d.bornBC - 133 >= 18) c.servedAbroad = Math.min(6, Math.floor((d.bornBC - 133 - 17) / 2));
    if (d.location === 'abroad' && d.returnBC) emit(s, 'travel', { who: c.id, to: 'abroad', until: dayOf(d.returnBC, 3, 1) });
    for (const [office, y] of d.offices ?? []) emit(s, 'office.won', { who: c.id, office, yearBC: y });
  }
  for (const d of HISTORICAL) {
    if (d.father) {
      const c = byHistorical(s, d.key)!;
      c.fatherId = byHistorical(s, d.father)?.id;
    }
  }

  // Generated sons of the houses.
  for (const h of HOUSES) {
    const head = Object.values(s.chars).find((c) => c.familyId === h.id && !c.female && c.rank === 'senator');
    for (const [a, b] of h.sons) {
      const bornBC = randInt(r, b, a);
      const age = bornBC - 133;
      const c = add(
        {
          praenomen: pick(r, PRAENOMINA), nomen: h.nomen, cognomen: h.cognomen, female: false, familyId: h.id, bornBC, rank: 'eques',
          traits: traits(r), lean: clamp(h.lean + 0.3 * gauss(r), -1, 1), oratory: 15 + 30 * rand(r), law: 10 + 30 * rand(r), location: 'rome',
          home: h.home, tribe: h.tribe, fatherId: head?.id, bio: `A young man of the ${h.name}.`,
        },
        10000 + 30000 * rand(r),
        age >= 20 ? 20000 + 20000 * rand(r) : 0,
        age >= 20 ? 18000 : 6000,
      );
      if (age >= 18) c.servedAbroad = Math.max(0, Math.floor((age - 17) / 2) - randInt(r, 0, 1));
      if (head && age < 20) c.flags.allowance = 1000;
    }
  }

  // Moneymen.
  for (const m of MONEYMEN) {
    const c = add(
      { praenomen: m.praenomen, nomen: m.nomen, female: false, familyId: null, bornBC: 175 + randInt(r, 0, 15), rank: 'eques', traits: traits(r, { greed: m.greed, sociability: 0.6 }), lean: m.lean, oratory: 25, law: 40, location: 'rome', home: 'forum', tribe: pick(r, ['Palatina', 'Collina', 'Esquilina']), historical: m.key, bio: m.bio },
      m.cash, m.income, m.income * 0.6,
    );
    c.flags.banker = 1;
  }

  // City folk.
  const nobles = Object.values(s.chars).filter((c) => c.rank === 'senator' && !c.female);
  for (const f of CITY_FOLK) {
    const c = add(
      { praenomen: f.praenomen, nomen: f.nomen, cognomen: f.cognomen, female: false, familyId: null, bornBC: 133 + randInt(r, 22, 50), rank: 'plebs', traits: traits(r), lean: f.lean, oratory: 10 + 15 * rand(r), law: 5, location: 'rome', home: f.home, tribe: pick(r, ['Suburana', 'Esquilina', 'Collina', 'Palatina']), bio: `${f.trade.charAt(0).toUpperCase()}${f.trade.slice(1)}.` },
      2000 + 6000 * rand(r), 6000, 5800,
    );
    if (rand(r) < 0.5) c.patronId = pick(r, nobles).id;
  }

  // The player's family.
  const nomen = opts.nomen ?? 'Gratidius';
  const famId = 'player_house';
  s.families[famId] = { id: famId, name: `${nomen.replace(/us$/, 'i')} of Arpinum`, patrician: false, consulAncestors: 0, praetorAncestors: 0, home: 'carinae' };
  const father = add(
    { praenomen: pick(r, ['Marcus', 'Lucius', 'Gaius', 'Quintus'].filter((x) => x !== (opts.praenomen ?? 'Marcus'))), nomen, female: false, familyId: famId, bornBC: 183, rank: 'eques', traits: traits(r, { loyalty: 0.8 }), lean: 0.1, oratory: 30, law: 30, location: 'arpinum', home: 'carinae', tribe: 'Cornelia', bio: 'Your father: an equestrian of Arpinum with olive groves, a mill, and debts in Rome.' },
    30000, 60000, 25000,
  );
  add({ praenomen: '', nomen: `${nomen.replace(/us$/, 'a')}`, female: true, familyId: famId, bornBC: 172, rank: 'eques', traits: traits(r), lean: 0, oratory: 20, law: 10, location: 'arpinum', home: 'carinae', tribe: 'Cornelia', bio: 'Your mother, at home in Arpinum.' }, 0, 0, 0);
  const pl = add(
    { praenomen: opts.praenomen ?? 'Marcus', nomen, female: false, familyId: famId, bornBC: 149, rank: 'eques', traits: traits(r, { ambition: 0.9, sociability: 0.6, pride: 0.3, loyalty: 0.6, boldness: 0.6, greed: 0.4 }), lean: 0, oratory: 22, law: 12, location: 'rome', home: 'carinae', tribe: 'Cornelia', fatherId: father.id, patronId: null, bio: 'You. Of Arpinum, sent to Rome in 133 BC, newly in the toga of manhood, to make a name.' },
    15000, 0, 9000,
  );
  pl.flags.allowance = 1000;
  s.playerId = pl.id;
  const aufidius = byHistorical(s, 'aufidius')!;
  emit(s, 'loan.make', { lender: aufidius.id, borrower: father.id, amount: 150000, months: 24, monthlyRate: 0.01, preexisting: true });

  // Wives and daughters. Marriages in place in 133 BC are recorded without moving money now.
  const wed = (h: Character, w: Character, day = s.day - 365 * 5) => {
    h.spouseId = w.id;
    w.spouseId = h.id;
    s.family.marriages.push({ husband: h.id, wife: w.id, day, dowry: 0 });
  };
  const wedKeys = (a: string, b: string) => {
    const x = byHistorical(s, a);
    const y = byHistorical(s, b);
    if (x && y && !x.spouseId && !y.spouseId) wed(x, y);
  };
  wedKeys('ti_gracchus', 'claudia');
  wedKeys('aemilianus', 'sempronia');
  const houseNomina = HOUSES.map((h) => h.nomen);
  for (const c of Object.values(s.chars)) {
    if (c.female || c.spouseId || c.bornBC - 133 < 28 || c.rank === 'plebs' || c.id === pl.id || c.flags.banker) continue;
    if (!c.familyId || c.familyId === famId) continue;
    if (rand(r) < 0.25) continue; // widowers and bachelors
    const nomen = pick(r, houseNomina.filter((n) => n !== c.nomen));
    const house = HOUSES.find((h) => h.nomen === nomen)!;
    const w = add(
      { praenomen: '', nomen: nomen.replace(/us$/, 'a'), female: true, familyId: house.id, bornBC: c.bornBC - randInt(r, 5, 15), rank: c.rank, traits: traits(r), lean: c.lean, oratory: 10, law: 5, location: 'rome', home: c.home, tribe: c.tribe, bio: `Wife of ${[c.praenomen, c.nomen, c.cognomen].filter(Boolean).join(' ')}.` },
      0, 0, 0,
    );
    wed(c, w);
    // A daughter or two, for the marriages of the next twenty years.
    const n = randInt(r, 0, 2);
    for (let i = 0; i < n; i++) {
      const born = Math.min(w.bornBC - 16, 133 + randInt(r, 0, 18));
      if (born < 133) continue;
      add(
        { praenomen: '', nomen: c.nomen.replace(/us$/, 'a'), cognomen: ['Maior', 'Minor', 'Tertia'][i], female: true, familyId: c.familyId, bornBC: born, rank: c.rank, traits: traits(r), lean: c.lean, oratory: 5, law: 0, location: 'rome', home: c.home, tribe: c.tribe, fatherId: c.id, motherId: w.id, bio: `Daughter of ${[c.praenomen, c.nomen, c.cognomen].filter(Boolean).join(' ')}.` },
        0, 0, 0,
      );
    }
  }
  const mother = Object.values(s.chars).find((c) => c.female && c.familyId === famId)!;
  wed(father, mother, s.day - 365 * 18);
  pl.motherId = mother.id;

  // Ties already in place in 133 BC.
  const tie = (a: string, b: string, kind: 'amicus' | 'inimicus' | 'kin') => {
    const x = byHistorical(s, a);
    const y = byHistorical(s, b);
    if (x && y) emit(s, 'tie', { a: x.id, b: y.id, kind });
  };
  tie('ti_gracchus', 'claudia', 'kin');
  tie('ti_gracchus', 'appius', 'kin');
  tie('aemilianus', 'sempronia', 'kin');
  tie('aemilianus', 'ti_gracchus', 'kin');
  tie('c_gracchus', 'crassus', 'kin');
  tie('ti_gracchus', 'fulvius', 'amicus');
  tie('ti_gracchus', 'carbo', 'amicus');
  tie('ti_gracchus', 'octavius', 'amicus');
  tie('ti_gracchus', 'scaevola', 'amicus');
  tie('c_gracchus', 'fulvius', 'amicus');
  tie('nasica', 'laenas', 'amicus');
  tie('nasica', 'annius', 'amicus');
  tie('aemilianus', 'rupilius', 'amicus');
  tie('aemilianus', 'macedonicus', 'inimicus');
  tie('nasica', 'ti_gracchus', 'inimicus');
  tie('aufidius', 'aquillius', 'amicus');
  tie('aufidius', 'cotta', 'amicus');
  tie('aufidius', 'lentulus', 'amicus');
  tie('marius', 'aemilianus', 'amicus');

  // Feelings about the land bill.
  const ti = byHistorical(s, 'ti_gracchus')!;
  for (const c of Object.values(s.chars)) {
    if (c.id === ti.id || c.female) continue;
    if (c.rank === 'senator' && c.lean >= 0.45) emit(s, 'memory', { owner: c.id, about: ti.id, act: 'Wants my share of the public land', weight: -25 - 20 * c.lean, halfLife: 2000 });
    if (c.lean <= -0.4) emit(s, 'memory', { owner: c.id, about: ti.id, act: 'Fights for the land bill', weight: 20, halfLife: 2000 });
  }

  // Reputations.
  const rep = (key: string, people: number, boni: number, dignitas = 0, label = 'Deeds') => {
    const c = byHistorical(s, key);
    if (!c) return;
    emit(s, 'standing', { who: c.id, kind: 'people', value: people, label: 'Reputation in the city', halfLife: 2000 });
    emit(s, 'standing', { who: c.id, kind: 'boni', value: boni, label: 'Reputation among the boni', halfLife: 2000 });
    if (dignitas) emit(s, 'standing', { who: c.id, kind: 'dignitas', value: dignitas, label, halfLife: 0 });
  };
  for (const c of Object.values(s.chars)) {
    if (c.female || c.id === pl.id || c.historical) continue;
    if (c.rank === 'plebs') continue;
    emit(s, 'standing', { who: c.id, kind: 'people', value: Math.round(-c.lean * 10 + 6 * gauss(r)), label: 'Reputation in the city', halfLife: 2000 });
    emit(s, 'standing', { who: c.id, kind: 'boni', value: Math.round(c.lean * 10 + 6 * gauss(r)), label: 'Reputation among the boni', halfLife: 2000 });
  }
  for (const d of HISTORICAL) if (!d.female) rep(d.key, Math.round(-d.lean * 15), Math.round(d.lean * 15));
  rep('ti_gracchus', 45, -35, 5, 'Saved an army at Numantia');
  rep('aemilianus', 20, 20, 25, 'Destroyer of Carthage');
  rep('macedonicus', 0, 15, 15, 'Triumph over Macedonia');
  rep('nasica', -30, 25, 8, 'Pontifex maximus');
  rep('appius', 0, 10, 8, 'Princeps senatus');
  rep('c_gracchus', 15, -5);
  rep('scaurus', 0, 8);

  // Patrons of young nobles: their fathers' friends. The player has none yet.
  initSystems(s);
  emit(s, 'event.trigger', { eventId: 'intro' });
  s.pauseRequests = [];
  return s;
}

export function charIdByKey(s: GameState, key: string): CharId | undefined {
  return byHistorical(s, key)?.id;
}
