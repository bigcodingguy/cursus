// Family and dynasty: marriage as alliance, births, adoption, divorce, succession, elogia, ancestor masks.

import { OFFICES } from '../../../content/offices';
import { PRAENOMINA } from '../../../content/cast';
import { emit, on } from '../../bus';
import { registerAction, registerCommand, type SystemDef } from '../../core';
import { chance, gauss, pick, rand } from '../../rng';
import type { Character, CharId, GameState } from '../../types';
import { ageOf, allChars, clamp, fmtHS, fullName, shortName, yearBC } from '../../util';
import { opinion, willingness } from '../network/api';
import { officesOf } from '../offices/api';
import { entryValue } from '../standing/api';
import { dowryFrom, guardianOf, invalidateFamilyIndex, heirOf, marriageable, marriageOf, sonsOf } from './api';

const ORDINALS = ['Maior', 'Minor', 'Tertia', 'Quarta', 'Quinta'];

function feminine(nomen: string): string {
  return nomen.endsWith('us') ? nomen.slice(0, -2) + 'a' : nomen;
}

function marryOdds(s: GameState, groom: Character, bride: Character) {
  const g = guardianOf(s, bride);
  if (!g) return { total: 0.5, parts: [{ label: 'No one to refuse you', value: 0.5 }] };
  const w = willingness(s, g.id, groom.id, 1.2);
  const fam = (c: Character) => (c.familyId ? s.families[c.familyId] : undefined);
  const gap = (fam(bride)?.consulAncestors ?? 0) - (fam(groom)?.consulAncestors ?? 0);
  const parts = [...w.parts, { label: gap > 0 ? 'Her house is the grander' : 'A good match for her house', value: -0.04 * Math.max(0, gap) + 0.1 }];
  const total = clamp(parts.reduce((a, p) => a + p.value, 0), 0.03, 0.95);
  return { total, parts };
}

function bornName(s: GameState, father: Character, female: boolean): Pick<Character, 'praenomen' | 'nomen' | 'cognomen'> {
  if (female) {
    const sisters = allChars(s).filter((c) => c.female && c.fatherId === father.id).length;
    return { praenomen: '', nomen: feminine(father.nomen), cognomen: ORDINALS[Math.min(sisters, ORDINALS.length - 1)] };
  }
  const brothers = allChars(s).filter((c) => !c.female && c.fatherId === father.id).length;
  return { praenomen: brothers === 0 ? father.praenomen : pick(s.rng, PRAENOMINA.slice(0, 9)), nomen: father.nomen, cognomen: father.cognomen };
}

function birth(s: GameState, father: Character, mother: Character) {
  const id = `c${s.nextCharId++}`;
  const female = rand(s.rng) < 0.5;
  const t = () => clamp(0.5 + 0.22 * gauss(s.rng), 0, 1);
  const c: Character = {
    id, ...bornName(s, father, female), female, familyId: father.familyId, bornBC: yearBC(s), alive: true,
    rank: father.rank === 'plebs' ? 'plebs' : 'eques', traits: { ambition: t(), greed: t(), boldness: t(), loyalty: t(), sociability: t(), pride: t() },
    lean: clamp(father.lean + 0.3 * gauss(s.rng), -1, 1), oratory: 5, law: 0, location: father.location === 'abroad' ? 'rome' : father.location, home: father.home, tribe: father.tribe,
    fatherId: father.id, motherId: mother.id, servedAbroad: 0, busyUntil: 0, nextThink: s.day + 365 * 16, flags: {},
    bio: `${female ? 'Daughter' : 'Son'} of ${fullName(father)} and ${fullName(mother)}.`,
  };
  s.chars[id] = c;
  s.money.accounts[id] = { cash: 0, income: 0, upkeep: 0 };
  if (father.id === s.playerId) {
    emit(s, 'log', { text: `${fullName(mother)} gives you a ${female ? 'daughter' : 'son'}: ${female ? fullName(c) : c.praenomen}.`, kind: 'player', about: [id] });
    emit(s, 'pause', { reason: 'birth' });
  }
  // Childbirth killed women in every house.
  if (chance(s.rng, 0.012)) emit(s, 'death', { who: mother.id, cause: 'in childbirth' });
}

/** The inscription on a man's tomb, in the manner of the Scipios. */
export function composeElogium(s: GameState, c: Character): string[] {
  const father = c.fatherId ? s.chars[c.fatherId] : undefined;
  const abbr = (p: string) => (p ? p[0] : '');
  const lines = [`${[abbr(c.praenomen), c.nomen, c.cognomen].filter(Boolean).join(' · ')}${father ? ` · ${abbr(father.praenomen)} · F` : ''}`.toUpperCase()];
  const offs = officesOf(s, c.id).reverse();
  const names: Record<string, string> = { military_tribune: 'TRIBVNVS MILITVM', quaestor: 'QVAESTOR', tribune_pleb: 'TRIBVNVS PLEBIS', aedile: 'AEDILIS', praetor: 'PRAETOR', consul: 'CONSVL', censor: 'CENSOR' };
  const seen = new Set<string>();
  const titles = offs.filter((o) => (seen.has(o.office) ? false : (seen.add(o.office), true))).map((o) => names[o.office]);
  if (titles.length) lines.push(titles.join(' · '));
  const deeds = (s.standing.entries[c.id] ?? [])
    .filter((e) => e.kind === 'dignitas' && !e.halfLife && entryValue(e, s.day) > 0 && !OFFICES_LABEL.test(e.label))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((e) => deedLine(e.label));
  lines.push(...deeds);
  const age = ageOf(s, c);
  lines.push(`He lived ${age} years.${c.died ? ` He died of ${c.died.cause.replace(/^a |^an /, (m) => m)}.` : ''}`);
  return lines;
}
const OFFICES_LABEL = new RegExp(`^(${Object.values(OFFICES).map((o) => o.label).join('|')}),`);
function deedLine(label: string): string {
  if (label.startsWith('Served in')) return `He served in ${label.slice(10)}.`;
  if (label.startsWith('Convicted')) return `He ${label[0].toLowerCase()}${label.slice(1)}.`;
  if (label.startsWith('Won the acquittal')) return `He ${label[0].toLowerCase()}${label.slice(1)}.`;
  return `${label}.`;
}

export const family: SystemDef = {
  id: 'family',
  register() {
    on('marry', (s, e) => {
      const h = s.chars[e.husband];
      const w = s.chars[e.wife];
      if (!h?.alive || !w?.alive || h.spouseId || w.spouseId) return;
      h.spouseId = w.id;
      w.spouseId = h.id;
      const g = guardianOf(s, w);
      const dowry = Math.min(e.dowry ?? dowryFrom(s, g), Math.max(0, g ? s.money.accounts[g.id]?.cash ?? 0 : 0));
      s.family.marriages.push({ husband: h.id, wife: w.id, day: s.day, dowry });
      if (g && dowry > 0) emit(s, 'transfer', { from: g.id, to: h.id, amount: dowry, reason: 'dowry' });
      if (g) {
        emit(s, 'tie', { a: h.id, b: g.id, kind: 'kin' });
        emit(s, 'memory', { owner: g.id, about: h.id, act: 'Married my daughter', weight: 15, halfLife: 5000 });
        emit(s, 'memory', { owner: h.id, about: g.id, act: 'Gave me his daughter', weight: 10, halfLife: 5000 });
      }
      emit(s, 'log', { text: `${fullName(h)} marries ${fullName(w)}${dowry ? ` (dowry ${fmtHS(dowry)})` : ''}.`, kind: h.id === s.playerId || w.fatherId === s.playerId ? 'player' : 'world', about: [h.id, w.id] });
    });
    on('divorce', (s, e) => {
      const m = marriageOf(s, e.husband);
      if (!m) return;
      m.ended = s.day;
      const h = s.chars[m.husband];
      const w = s.chars[m.wife];
      h.spouseId = undefined;
      w.spouseId = undefined;
      const g = guardianOf(s, w);
      // The dowry goes back to her family.
      if (g && m.dowry) emit(s, 'transfer', { from: h.id, to: g.id, amount: Math.min(m.dowry, Math.max(0, s.money.accounts[h.id]?.cash ?? 0)), reason: 'dowry returned' });
      if (g) {
        emit(s, 'untie', { a: h.id, b: g.id, kind: 'kin' });
        emit(s, 'memory', { owner: g.id, about: h.id, act: 'Divorced my daughter', weight: -25, halfLife: 3000 });
      }
      emit(s, 'log', { text: `${fullName(h)} divorces ${fullName(w)}.`, kind: h.id === s.playerId ? 'player' : 'world', about: [h.id, w.id] });
    });
    on('adopt', (s, e) => {
      const f = s.chars[e.father];
      const son = s.chars[e.son];
      if (!f?.alive || !son?.alive) return;
      const oldFather = son.fatherId;
      const oldFam = son.familyId ? s.families[son.familyId] : undefined;
      son.adoptedFrom = son.familyId ?? undefined;
      son.fatherId = f.id;
      invalidateFamilyIndex(s);
      son.familyId = f.familyId;
      // He takes his new father's name and keeps his old one as a cognomen: Aemilius becomes Aemilianus.
      son.cognomen = `${son.nomen.replace(/us$/, '')}ianus`;
      son.nomen = f.nomen;
      son.tribe = f.tribe;
      if (oldFather) {
        emit(s, 'tie', { a: f.id, b: oldFather, kind: 'kin' });
        emit(s, 'memory', { owner: oldFather, about: f.id, act: 'Adopted my son', weight: 12, halfLife: 5000 });
      }
      emit(s, 'log', { text: `${fullName(f)} adopts ${fullName(son)}${oldFam ? `, born of the ${oldFam.name}` : ''}.`, kind: f.id === s.playerId ? 'player' : 'world', about: [f.id, son.id] });
    });
    on('office.won', (s, e) => {
      // Past consulships in the 133 BC cast are already counted in the houses' imagines.
      if (e.office !== 'consul' || !s.playerId) return;
      const c = s.chars[e.who];
      const fam = c?.familyId ? s.families[c.familyId] : undefined;
      if (!fam) return;
      const wasNoble = fam.consulAncestors > 0;
      fam.consulAncestors += 1;
      if (fam.id === s.chars[s.playerId]?.familyId) emit(s, 'hook', { name: 'family_consul', roles: { consul: c.id }, vars: { first: wasNoble ? 0 : 1 } });
    });
    on('death', (s, e) => {
      const c = s.chars[e.who];
      if (!c) return;
      if (c.spouseId && s.chars[c.spouseId]) s.chars[c.spouseId].spouseId = undefined;
      const m = marriageOf(s, c.id);
      if (m) m.ended = s.day;
      const inLine = c.familyId && c.familyId === s.chars[s.playerId]?.familyId && !c.female && ageOf(s, c) >= 16;
      const lines = c.id === s.playerId || inLine ? composeElogium(s, c) : [];
      if (lines.length) s.family.elogia.push({ who: c.id, day: s.day, lines });
      if (c.id !== s.playerId) return;
      const heir = heirOf(s, c.id);
      if (!heir) return; // the people system has ended the game: the house is extinct
      s.playerId = heir;
      s.family.line.push(heir);
      emit(s, 'event.trigger', { eventId: 'succession', roles: { dead: c.id, heir }, vars: { age: ageOf(s, c), cause: e.cause, elogium: lines.join('\n\n'), heirAge: ageOf(s, s.chars[heir]) } });
    });

    on('exile', (s, e) => {
      if (e.who !== s.playerId) return;
      const c = s.chars[e.who];
      const heir = heirOf(s, c.id);
      if (!heir || ageOf(s, s.chars[heir]) < 16) return;
      s.playerId = heir;
      s.family.line.push(heir);
      // He takes half of what his father could carry off; the house in Rome is his.
      const cash = s.money.accounts[c.id]?.cash ?? 0;
      if (cash > 0) emit(s, 'transfer', { from: c.id, to: heir, amount: Math.round(cash / 2), reason: 'left to his son on going into exile' });
      emit(s, 'event.trigger', { eventId: 'succession_exile', roles: { exile: c.id, heir }, vars: { reason: e.reason, heirAge: ageOf(s, s.chars[heir]) } });
    });

    registerCommand('family.setHeir', (s, cmd) => {
      const id = String(cmd.id);
      const c = s.chars[id];
      if (!c?.alive || c.fatherId !== s.playerId || c.female) return 'Only a son can be named heir';
      s.family.heirs[s.playerId] = id;
      emit(s, 'log', { text: `You name ${shortName(c)} your heir in your testament.`, kind: 'player', about: [id] });
      return null;
    });

    registerAction({
      id: 'propose_marriage',
      label: 'Ask for her hand',
      blurb: 'Marriage is an alliance between houses. Her family brings a dowry and becomes your kin.',
      place: (s, _a, p) => s.chars[String(p.bride)]?.home ?? 'palatine',
      duration: () => 1,
      check: (s, a, p) => {
        const b = s.chars[String(p.bride)];
        if (a.female) return 'Not possible';
        if (!marriageable(s, a)) return a.spouseId ? 'You are married' : 'Too young to marry (18)';
        if (!b || !b.female || !marriageable(s, b)) return 'She cannot be married now';
        if (b.familyId && b.familyId === a.familyId) return 'She is of your own house';
        return null;
      },
      odds: (s, a, p) => {
        const b = s.chars[String(p.bride)];
        return b ? marryOdds(s, a, b) : null;
      },
      start: (s, a, p) => {
        const b = s.chars[String(p.bride)];
        if (b) p.success = rand(s.rng) < marryOdds(s, a, b).total;
      },
      complete: (s, a, p) => {
        const b = s.chars[String(p.bride)];
        if (!b?.alive || b.spouseId || a.spouseId) return;
        const g = guardianOf(s, b);
        if (p.success) emit(s, 'marry', { husband: a.id, wife: b.id });
        else {
          if (g) emit(s, 'memory', { owner: a.id, about: g.id, act: 'Refused me his daughter', weight: -10, halfLife: 2000 });
          if (a.id === s.playerId) emit(s, 'log', { text: `${g ? shortName(g) : 'Her family'} declines your suit for ${fullName(b)}.`, kind: 'player', about: [b.id] });
        }
      },
      npc: (s, a) => {
        const age = ageOf(s, a);
        if (a.spouseId || age < 22 || age > 50 || a.rank === 'plebs') return [];
        // Look over a few households rather than the whole city.
        const all = allChars(s);
        let w: Character | undefined;
        for (let i = 0; i < 6 && !w; i++) {
          const c = all[Math.floor(rand(s.rng) * all.length)];
          if (c.female && marriageable(s, c) && c.familyId !== a.familyId) w = c;
        }
        if (!w) return [];
        return [{ params: { bride: w.id }, utility: 1.2 + (age - 22) / 15 + a.traits.ambition * 0.4 }];
      },
    });

    registerAction({
      id: 'divorce',
      label: 'Divorce your wife',
      blurb: 'A word before witnesses ends a Roman marriage. The dowry goes back, and so does the alliance.',
      place: (_s, a) => a.home,
      duration: () => 1,
      check: (s, a) => (marriageOf(s, a.id)?.husband === a.id ? null : 'You are not married'),
      complete: (s, a) => emit(s, 'divorce', { husband: a.id }),
      npc: (s, a) => {
        const m = marriageOf(s, a.id);
        if (!m || m.husband !== a.id) return [];
        const w = s.chars[m.wife];
        const g = w.fatherId ? s.chars[w.fatherId] : undefined;
        return g?.alive && opinion(s, a.id, g.id).total < -35 ? [{ params: {}, utility: 1.6 }] : [];
      },
    });

    registerAction({
      id: 'adopt',
      label: 'Adopt a son',
      blurb: 'A great house with too many sons may give one to a house with none. He takes your name and your line.',
      place: (s, _a, p) => s.chars[String(p.son)]?.home ?? 'palatine',
      duration: () => 1,
      check: (s, a, p) => {
        const son = s.chars[String(p.son)];
        if (ageOf(s, a) < 30) return 'A man adopts in his maturity (30)';
        if (sonsOf(s, a.id).length >= 2) return 'You have sons enough';
        if (!son?.alive || son.female || son.fatherId === a.id) return 'Choose a young man';
        if (a.id !== s.playerId && (son.id === s.playerId || son.fatherId === s.playerId)) return 'Not without his consent';
        const f = son.fatherId ? s.chars[son.fatherId] : undefined;
        if (!f?.alive || sonsOf(s, f.id).length < 2) return 'His father will not give up an only son';
        if (ageOf(s, son) > 35) return 'Too old to be adopted';
        return null;
      },
      odds: (s, a, p) => {
        const son = s.chars[String(p.son)];
        const f = son?.fatherId ? s.chars[son.fatherId] : undefined;
        return f ? willingness(s, f.id, a.id, 1.5) : null;
      },
      start: (s, a, p) => {
        const son = s.chars[String(p.son)];
        const f = son?.fatherId ? s.chars[son.fatherId] : undefined;
        if (f) p.success = rand(s.rng) < willingness(s, f.id, a.id, 1.5).total;
      },
      complete: (s, a, p) => {
        if (p.success) emit(s, 'adopt', { father: a.id, son: String(p.son) });
        else if (a.id === s.playerId) emit(s, 'log', { text: 'His father will not part with him.', kind: 'player' });
      },
      npc: (s, a) => {
        if (ageOf(s, a) < 45 || sonsOf(s, a.id).length || a.rank !== 'senator') return [];
        if (rand(s.rng) > 0.1) return [];
        // The player and his sons are his to give, never taken by an NPC's choice.
        const cands = allChars(s).filter((c) => !c.female && c.alive && c.id !== s.playerId && c.fatherId !== s.playerId && ageOf(s, c) >= 10 && ageOf(s, c) <= 25 && c.fatherId && sonsOf(s, c.fatherId).length >= 2);
        if (!cands.length) return [];
        return [{ params: { son: cands[Math.floor(rand(s.rng) * cands.length)].id }, utility: 1.7 }];
      },
    });
  },

  init(s) {
    s.family.line = [s.playerId];
  },

  monthly(s) {
    for (const m of s.family.marriages) {
      if (m.ended) continue;
      const h = s.chars[m.husband];
      const w = s.chars[m.wife];
      if (!h?.alive || !w?.alive) continue;
      const age = ageOf(s, w);
      if (age < 15 || age > 42) continue;
      // Not while the husband is away on campaign.
      if (h.location === 'abroad' || h.location === 'exile') continue;
      const recent = allChars(s).some((c) => c.motherId === w.id && c.bornBC === yearBC(s));
      if (!recent && rand(s.rng) < 0.024) birth(s, h, w);
    }
  },
};

export type { CharId };
