// People: the cast itself — life, death, exile, travel, skills, political lean.

import { emit, on } from '../../bus';
import type { SystemDef } from '../../core';
import { rand } from '../../rng';
import { ageOf, clamp, fullName } from '../../util';

export const people: SystemDef = {
  id: 'people',
  register() {
    on('death', (s, e) => {
      const c = s.chars[e.who];
      if (!c || !c.alive) return;
      c.alive = false;
      c.died = { day: s.day, cause: e.cause };
      c.action = undefined;
      emit(s, 'log', { text: `${fullName(c)} has died (${e.cause}).`, kind: 'death', about: [c.id] });
      emit(s, 'hook', { name: 'death', roles: { dead: c.id } });
      for (const o of Object.values(s.chars)) if (o.patronId === c.id) o.patronId = null;
      if (c.id === s.playerId) {
        s.ended = { day: s.day, reason: `You died: ${e.cause}.` };
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
        s.ended = { day: s.day, reason: `You went into exile: ${e.reason}.` };
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
  daily(s) {
    for (const c of Object.values(s.chars)) {
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
    for (const c of Object.values(s.chars)) {
      if (!c.alive) continue;
      // Slice rule: no natural death for the player until heirs exist (Phase 3). See DECISIONS.md.
      if (c.id === s.playerId) continue;
      const age = ageOf(s, c);
      const q = Math.min(0.5, 0.002 * Math.exp(0.085 * Math.max(0, age - 16)));
      const monthly = 1 - Math.pow(1 - q, 1 / 12);
      if (rand(s.rng) < monthly) emit(s, 'death', { who: c.id, cause: age > 55 ? 'old age and illness' : 'a fever' });
    }
  },
};
