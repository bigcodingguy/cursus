// News: Forum gossip. It runs ahead of the facts and is sometimes wrong.
// The player hears it in the Forum, or from clients at the morning salutatio.

import { RUMORS } from '../../../content/rumors';
import { emit, on } from '../../bus';
import { getAction, type SystemDef } from '../../core';
import { evalCond, renderText } from '../../dsl';
import { chance, pick, randInt } from '../../rng';
import type { GameState } from '../../types';
import { allChars, isActiveMan, shortName } from '../../util';
import { favorBalance, hasTie } from '../network/api';
import { PROVINCES } from '../../../content/offices';

export function clientsOf(s: GameState, id: string) {
  return allChars(s).filter((c) => c.alive && c.patronId === id);
}

export function playerHearsToday(s: GameState): boolean {
  const p = s.chars[s.playerId];
  if (!p.alive || p.location !== 'rome') return false;
  if (s.routine === 'receive' && clientsOf(s, p.id).length > 0) return true;
  // Following your patron down to the Forum each morning, you hear what is said there.
  const pat = p.patronId ? s.chars[p.patronId] : undefined;
  if (s.routine === 'attend' && pat?.alive && pat.location === 'rome') return true;
  const act = p.action ? getAction(p.action.id) : undefined;
  return !!act && typeof act.place === 'string' && act.place === 'forum';
}

export const news: SystemDef = {
  id: 'news',
  register() {
    on('news', (s, e) => {
      s.news.items.push({
        id: s.news.nextId++,
        day: s.day + (e.delay ?? randInt(s.rng, 0, 3)),
        text: e.text,
        truth: e.truth ?? 'true',
        heard: false,
        about: e.about ?? [],
      });
      if (s.news.items.length > 300) s.news.items.splice(0, s.news.items.length - 300);
    });
    on('death', (s, e) => {
      const c = s.chars[e.who];
      const pl = s.chars[s.playerId];
      if (!c || c.id === s.playerId || !pl) return;
      const there = c.location === 'abroad' ? awayDays(s, c.id) : 0;
      const here = pl.location === 'abroad' ? awayDays(s, pl.id) : 0;
      if (!there && !here) return;
      const where = c.location === 'abroad' ? placeOf(s, c.id) : 'Rome';
      // Gossip runs ahead of the letter: traders and soldiers on leave.
      if (there) emit(s, 'news', { text: `Men off a ship from ${where} say ${shortName(c)} is dead.`, truth: 'unconfirmed', delay: Math.round(there * 0.6), about: [c.id] });
      if (cares(s, pl.id, c.id)) {
        const days = there + here;
        emit(s, 'event.trigger', { eventId: 'letter_death', roles: { dead: c.id }, vars: { from: where, days, cause: e.cause }, delay: days });
      } else if (there) emit(s, 'news', { text: `A letter from ${where}: ${shortName(c)} has died (${e.cause}).`, truth: 'true', delay: there, about: [c.id] });
    });
    on('gossip.hear', (s) => hear(s));
    on('hook', (s, e) => {
      if (e.name === 'hear_gossip') hear(s);
    });
    on('action.done', (s, e) => {
      if (e.actor !== s.playerId) return;
      const a = getAction(e.action);
      if (a && a.place === 'forum') hear(s);
    });
  },
  daily(s) {
    if (playerHearsToday(s)) hear(s);
    // Abroad, Rome's news comes in the letters of friends, weeks late.
    const pl = s.chars[s.playerId];
    if (pl.alive && pl.location === 'abroad') {
      const lag = awayDays(s, pl.id);
      for (const g of s.news.items) if (!g.heard && g.day + lag <= s.day) g.heard = true;
    }
  },
  monthly(s) {
    // Idle talk: a rumor or two each month, true or not.
    if (!chance(s.rng, 0.7)) return;
    const r = pick(s.rng, RUMORS);
    const men = allChars(s).filter((c) => isActiveMan(s, c) && c.location === 'rome' && c.rank === 'senator');
    if (!men.length) return;
    const a = pick(s.rng, men);
    const sc = { roles: { a: a.id }, vars: {} };
    if (r.when && !evalCond(s, r.when, sc)) return;
    const isTrue = evalCond(s, r.truth, sc);
    emit(s, 'news', { text: renderText(s, r.text, sc), truth: isTrue ? 'true' : 'false', about: [a.id] });
  },
};

/** Where a man abroad is, in words. */
function placeOf(s: GameState, id: string): string {
  const g = s.offices.governors.find((x) => x.who === id && !x.returned);
  return g ? PROVINCES.find((p) => p.id === g.province)?.label ?? 'abroad' : 'the army';
}

/** Days a letter takes between Rome and where this man is. */
export function awayDays(s: GameState, id: string): number {
  const g = s.offices.governors.find((x) => x.who === id && !x.returned);
  return g ? PROVINCES.find((p) => p.id === g.province)?.letterDays ?? 20 : 20;
}

/** Does the player care enough about this man to be written to when he dies? */
function cares(s: GameState, me: string, other: string): boolean {
  const a = s.chars[me];
  const b = s.chars[other];
  if (!a || !b) return false;
  if (a.patronId === b.id || b.patronId === a.id) return true;
  if (a.familyId && a.familyId === b.familyId) return true;
  if (b.fatherId === a.id || a.fatherId === b.id || a.spouseId === b.id) return true;
  return hasTie(s, me, other, 'amicus') || hasTie(s, me, other, 'kin') || favorBalance(s, other, me) > 0;
}

function hear(s: GameState) {
  for (const g of s.news.items) if (!g.heard && g.day <= s.day) g.heard = true;
}
