// NPC minds: every few days each free NPC scores the same actions the player has and picks one.

import { on } from '../../bus';
import { allActions, checkAction, startAction, type SystemDef } from '../../core';
import { gauss, randInt } from '../../rng';
import type { ActionParams } from '../../types';
import { allChars, ageOf } from '../../util';

export const agents: SystemDef = {
  id: 'agents',
  register() {
    // Content may start an action for someone (e.g. enlisting from an event).
    on('act', (s, e) => {
      startAction(s, e.who, e.action, e.params);
    });
  },
  daily(s) {
    const acts = allActions().filter((a) => a.npc);
    for (const c of allChars(s)) {
      if (c.id === s.playerId || !c.alive || c.female || c.location !== 'rome' || c.busyUntil > s.day || c.nextThink > s.day) continue;
      if (ageOf(s, c) < 17) {
        c.nextThink = s.day + 60;
        continue;
      }
      c.nextThink = s.day + (c.rank === 'plebs' ? randInt(s.rng, 20, 40) : randInt(s.rng, 5, 14));
      let best: { id: string; params: ActionParams; u: number } | null = null;
      for (const a of acts) {
        for (const opt of a.npc!(s, c)) {
          const u = opt.utility + 0.5 * gauss(s.rng);
          if (!best || u > best.u) best = { id: a.id, params: opt.params, u };
        }
      }
      if (best && best.u > 1.5 && !checkAction(s, c.id, best.id, best.params)) startAction(s, c.id, best.id, best.params);
    }
  },
};
