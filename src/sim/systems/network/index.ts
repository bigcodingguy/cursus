import { on } from '../../bus';
import type { SystemDef } from '../../core';
import type { GameState } from '../../types';
import { memoryValue } from './api';

const MAX_MEMORIES = 60;

export const network: SystemDef = {
  id: 'network',
  register() {
    on('memory', (s, e) => {
      if (e.owner === e.about || !s.chars[e.owner]?.alive) return;
      const list = (s.network.memories[e.owner] ??= []);
      const halfLife = e.halfLife ?? 720;
      // Same act about the same person in the same month stacks instead of piling up entries.
      const last = list.find((m) => m.about === e.about && m.act === e.act && s.day - m.day < 30);
      if (last) {
        last.weight = memoryValue(last, s.day) + e.weight;
        last.day = s.day;
      } else list.push({ about: e.about, act: e.act, day: s.day, weight: e.weight, halfLife });
      if (list.length > MAX_MEMORIES) prune(s, e.owner, true);
    });
    on('favor', (s, e) => {
      if (e.debtor === e.creditor) return;
      s.network.favors.push({ id: s.network.nextFavorId++, debtor: e.debtor, creditor: e.creditor, weight: e.weight, reason: e.reason, day: s.day });
    });
    on('favor.spend', (s, e) => {
      s.network.favors = s.network.favors.filter((f) => f.id !== e.id);
    });
    on('tie', (s, e) => {
      const t = s.network.ties;
      const opposite = e.kind === 'amicus' ? 'inimicus' : e.kind === 'inimicus' ? 'amicus' : null;
      s.network.ties = t.filter((x) => !(opposite && x.kind === opposite && ((x.a === e.a && x.b === e.b) || (x.a === e.b && x.b === e.a))));
      if (!s.network.ties.some((x) => x.kind === e.kind && ((x.a === e.a && x.b === e.b) || (x.a === e.b && x.b === e.a))))
        s.network.ties.push({ a: e.a, b: e.b, kind: e.kind, since: s.day });
    });
    on('death', (s, e) => {
      // The dead owe nothing and are owed nothing (heirs come in Phase 3).
      s.network.favors = s.network.favors.filter((f) => f.debtor !== e.who && f.creditor !== e.who);
      delete s.network.memories[e.who];
    });
  },
  monthly(s) {
    if (Math.floor(s.day / 30) % 3 !== 0) return;
    for (const id of Object.keys(s.network.memories)) prune(s, id, false);
  },
};

function prune(s: GameState, owner: string, hard: boolean) {
  const list = s.network.memories[owner];
  const vals = list.map((m) => ({ m, v: Math.abs(memoryValue(m, s.day)) }));
  let kept = vals.filter((x) => x.v >= 0.5 && s.chars[x.m.about]?.alive !== false);
  if (hard && kept.length > MAX_MEMORIES - 15) {
    kept.sort((a, b) => b.v - a.v);
    kept = kept.slice(0, MAX_MEMORIES - 15);
    kept.sort((a, b) => a.m.day - b.m.day);
  }
  s.network.memories[owner] = kept.map((x) => x.m);
}
