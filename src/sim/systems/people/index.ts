// People: the cast itself — life, death, exile, travel, skills, political lean.

import { emit, on } from '../../bus';
import type { SystemDef } from '../../core';
import { pick, rand } from '../../rng';
import { heirOf } from '../family/api';
import { allChars, ageOf, clamp, fullName } from '../../util';

const YOUNG_CAUSES = ['a fever caught in the summer heat', 'a fall from his horse on the Campus', 'a wound that turned bad', 'drowning while swimming in the Tiber', 'a sudden fever'];
const MIDDLE_CAUSES = ['a fever of the marshes', 'a wasting illness', 'a stroke at dinner', 'an illness of the lungs', 'a sickness of the bowels'];
const OLD_CAUSES = ['old age', 'a long illness', 'a stroke', 'a failing heart', 'old age, in his sleep'];

export const people: SystemDef = {
  id: 'people',
  register() {
    on('death', (s, e) => {
      const c = s.chars[e.who];
      if (!c || !c.alive) return;
      c.alive = false;
      c.died = { day: s.day, cause: e.cause };
      c.action = undefined;
      // Deaths far from Rome, or while the player is away, reach him by letter (see the news system).
      const far = c.location === 'abroad' || s.chars[s.playerId]?.location === 'abroad';
      if (!far || c.id === s.playerId) emit(s, 'log', { text: `${fullName(c)} has died (${e.cause}).`, kind: 'death', about: [c.id] });
      emit(s, 'hook', { name: 'death', roles: { dead: c.id } });
      for (const o of allChars(s)) if (o.patronId === c.id) o.patronId = null;
      if (c.id === s.playerId) {
        // With an heir the family goes on (see the family system); without one, the house is extinct.
        if (!heirOf(s, c.id)) s.ended = { day: s.day, reason: `You died (${e.cause}), leaving no son to carry on the family. The house is extinct.` };
        emit(s, 'pause', { reason: 'player died' });
      }
    });
    on('exile', (s, e) => {
      const c = s.chars[e.who];
      if (!c || !c.alive) return;
      c.location = 'exile';
      c.action = undefined;
      c.busyUntil = s.day;
      c.flags.exiled = s.day;
      emit(s, 'log', { text: `${fullName(c)} goes into exile (${e.reason}).`, kind: 'world', about: [c.id] });
      if (c.id === s.playerId) {
        // A grown son carries on in Rome (see the family system); otherwise the story ends here.
        const h = heirOf(s, c.id);
        if (!h || ageOf(s, s.chars[h]) < 16) s.ended = { day: s.day, reason: `You went into exile: ${e.reason}.` };
        emit(s, 'pause', { reason: 'player exiled' });
      }
    });
    on('lean', (s, e) => {
      const c = s.chars[e.who];
      if (c) c.lean = clamp(c.lean + e.add, -1, 1);
    });
    on('skill', (s, e) => {
      const c = s.chars[e.who];
      if (c) c[e.skill] = clamp(c[e.skill] + e.add * (e.add > 0 ? (1 - c[e.skill] / 100) ** 2 * 1.6 : 1), 0, 100);
    });
    on('travel', (s, e) => {
      const c = s.chars[e.who];
      if (!c || !c.alive) return;
      c.location = e.to;
      if (e.until !== undefined) {
        c.flags.returnDay = e.until;
        c.busyUntil = Math.max(c.busyUntil, e.until);
      } else delete c.flags.returnDay;
    });
    on('occupy', (s, e) => {
      const c = s.chars[e.who];
      if (c?.alive) c.busyUntil = Math.max(c.busyUntil, s.day + e.days);
    });
    on('charFlag', (s, e) => {
      const c = s.chars[e.who];
      if (c) c.flags[e.key] = e.value;
    });
    on('patron', (s, e) => {
      const c = s.chars[e.client];
      if (!c) return;
      const old = c.patronId;
      if (old && old !== e.patron && e.patron) emit(s, 'memory', { owner: old, about: c.id, act: 'Left me for another patron', weight: -20, halfLife: 2000 });
      c.patronId = e.patron;
      if (e.patron) emit(s, 'memory', { owner: e.patron, about: c.id, act: 'Became my client', weight: 10, halfLife: 2000 });
    });
    on('flag', (s, e) => {
      s.flags[e.key] = e.value;
    });
    on('law', (s, e) => {
      s.laws[e.key] = e.value;
    });
    on('log', (s, e) => {
      s.log.push({ day: s.day, ...e });
      if (s.log.length > 600) s.log.splice(0, s.log.length - 600);
    });
    on('pause', (s, e) => {
      s.pauseRequests.push(e.reason);
    });
  },
  yearly(s) {
    // Archive the long dead who are nobody's ancestors in the player's house: keep name, dates and family links only.
    const pl = s.chars[s.playerId];
    for (const c of allChars(s)) {
      if (c.alive || c.historical || !c.died || s.day - c.died.day < 1825) continue;
      if (c.familyId && c.familyId === pl?.familyId) continue;
      c.bio = '';
      c.flags = {};
      const a = s.money.accounts[c.id];
      if (a && Math.abs(a.cash) < 1) delete s.money.accounts[c.id];
    }
  },
  daily(s) {
    for (const c of allChars(s)) {
      if (c.alive && c.flags.returnDay !== undefined && s.day >= c.flags.returnDay && c.location !== 'exile') {
        c.location = 'rome';
        delete c.flags.returnDay;
        if (c.id === s.playerId) {
          emit(s, 'log', { text: 'You are back in Rome.', kind: 'player' });
          emit(s, 'pause', { reason: 'returned' });
        }
      }
    }
  },
  monthly(s) {
    for (const c of allChars(s)) {
      if (!c.alive) continue;
      const age = ageOf(s, c);
      // Children die easily.
      if (age < 5) {
        if (rand(s.rng) < 0.006) emit(s, 'death', { who: c.id, cause: pick(s.rng, ['a childhood fever', 'a sickness of the summer', 'a cough that would not leave him']) });
        continue;
      }
      // Gompertz: about 0.2% a year at 20, 0.7% at 35, 2.6% at 50, 7% at 62, 16% at 72.
      const q = Math.min(0.5, 0.0035 * Math.exp(0.083 * Math.max(0, age - 26)));
      const monthly = 1 - Math.pow(1 - q, 1 / 12);
      if (rand(s.rng) < monthly) emit(s, 'death', { who: c.id, cause: pick(s.rng, age >= 60 ? OLD_CAUSES : age >= 40 ? MIDDLE_CAUSES : YOUNG_CAUSES) });
    }
  },
};
