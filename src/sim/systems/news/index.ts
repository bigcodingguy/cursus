// News: Forum gossip. It runs ahead of the facts and is sometimes wrong.
// The player hears it in the Forum, or from clients at the morning salutatio.

import { RUMORS } from '../../../content/rumors';
import { emit, on } from '../../bus';
import { getAction, type SystemDef } from '../../core';
import { evalCond, renderText } from '../../dsl';
import { chance, pick, randInt } from '../../rng';
import type { GameState } from '../../types';
import { allChars, isActiveMan } from '../../util';

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

function hear(s: GameState) {
  for (const g of s.news.items) if (!g.heard && g.day <= s.day) g.heard = true;
}
