// Runs content events: daily conditions, hooks from other systems, delayed triggers, player choices.

import { applyEffects, evalCond, evalNum, renderSegs } from '../../dsl';
import { emit, on } from '../../bus';
import { registerCommand, type SystemDef } from '../../core';
import { rand } from '../../rng';
import type { CharId, GameState } from '../../types';
import { allEvents, choiceChance, eventDef, resolveRoles, scopeOf, segs, visibleChoices, type EventDef } from './api';

function fire(s: GameState, def: EventDef, baseRoles: Record<string, CharId>, vars: Record<string, string | number>): boolean {
  const roles = resolveRoles(s, def, baseRoles);
  if (!roles) return false;
  s.events.fired[def.id] = s.day;
  vars = { ...vars };
  for (const [k, ex] of Object.entries(def.vars ?? {})) vars[k] = Math.round(evalNum(s, ex, { roles, vars }).total);
  const sc = { roles, vars };
  if (def.immediate) applyEffects(s, def.immediate, sc);
  if (def.player) {
    if (s.ended) return true;
    s.events.pending.push({ uid: s.events.nextUid++, eventId: def.id, day: s.day, roles, vars });
    s.events.lastPrompt = s.day;
    emit(s, 'pause', { reason: def.title });
  }
  return true;
}

function eligible(s: GameState, def: EventDef): boolean {
  const last = s.events.fired[def.id];
  if (last !== undefined && (def.cooldown === undefined || s.day - last < def.cooldown)) return false;
  return true;
}

/** The world comes to the player: after a quiet spell, one opportunity from the pool, if any fits. */
const QUIET_DAYS = 24;
const PACE_HAZARD = 0.07;
function pace(s: GameState) {
  const pl = s.chars[s.playerId];
  if (s.events.pending.length || !pl.alive || pl.location !== 'rome' || s.ended) return;
  if (s.day - s.events.lastPrompt < QUIET_DAYS || rand(s.rng) >= PACE_HAZARD) return;
  const options: { def: EventDef; roles: Record<string, CharId> }[] = [];
  for (const def of allEvents()) {
    if (def.pool !== 'opportunity' || !eligible(s, def)) continue;
    const simple = resolveRoles(s, def, {}, true)!;
    if (def.when && !evalCond(s, def.when, { roles: simple, vars: {} })) continue;
    const roles = resolveRoles(s, def, simple);
    if (roles) options.push({ def, roles });
  }
  if (!options.length) return;
  const o = options[Math.floor(rand(s.rng) * options.length)];
  fire(s, o.def, o.roles, {});
}

export const events: SystemDef = {
  id: 'events',
  register() {
    on('event.trigger', (s, e) => {
      const def = eventDef(e.eventId);
      if (!def) return;
      if (e.delay) s.events.scheduled.push({ day: s.day + e.delay, eventId: e.eventId, roles: e.roles ?? {}, vars: e.vars });
      else fire(s, def, e.roles ?? {}, e.vars ?? {});
    });
    on('hook', (s, e) => {
      for (const def of allEvents()) {
        if (def.hook !== e.name || !eligible(s, def)) continue;
        const roles = resolveRoles(s, def, e.roles);
        if (!roles) continue;
        if (def.when && !evalCond(s, def.when, { roles, vars: e.vars ?? {} })) continue;
        fire(s, def, roles, e.vars ?? {});
      }
    });

    registerCommand('choose', (s, cmd) => {
      const p = s.events.pending.find((x) => x.uid === cmd.uid);
      if (!p || p.outcome) return 'No such choice';
      const def = eventDef(p.eventId)!;
      const vis = visibleChoices(s, p);
      if (!vis.some((v) => v.index === cmd.choice)) return 'That choice is not open to you';
      const c = def.choices![cmd.choice as number];
      const sc = scopeOf(p);
      let text = c.text ? renderSegs(s, segs(c.text), sc) : '';
      if (c.risk) {
        const chance = choiceChance(s, p, c)!.total;
        const success = rand(s.rng) < chance;
        applyEffects(s, c.effects ?? [], sc);
        applyEffects(s, success ? c.risk.success : c.risk.failure, sc);
        text = renderSegs(s, segs(success ? c.risk.successText : c.risk.failureText), sc);
        p.outcome = { text, roll: { chance, success } };
      } else {
        applyEffects(s, c.effects ?? [], sc);
        if (text) p.outcome = { text };
      }
      emit(s, 'log', { text: `${def.title}: ${renderSegs(s, [c.label], sc)}`, kind: 'player' });
      if (!p.outcome) s.events.pending = s.events.pending.filter((x) => x.uid !== p.uid);
      return null;
    });
    registerCommand('dismiss', (s, cmd) => {
      const p = s.events.pending.find((x) => x.uid === cmd.uid);
      if (!p) return 'Nothing to dismiss';
      const def = eventDef(p.eventId);
      if (def?.choices?.length && !p.outcome) return 'Choose first';
      s.events.pending = s.events.pending.filter((x) => x.uid !== p.uid);
      return null;
    });
  },
  daily(s) {
    if (s.events.scheduled.length) {
      const due = s.events.scheduled.filter((x) => x.day <= s.day);
      s.events.scheduled = s.events.scheduled.filter((x) => x.day > s.day);
      for (const d of due) {
        const def = eventDef(d.eventId);
        if (def) fire(s, def, d.roles, d.vars ?? {});
      }
    }
    pace(s);
    for (const def of allEvents()) {
      if (!def.when || def.hook || def.pool || !eligible(s, def)) continue;
      // `when` may use only simple roles; group-picked roles are resolved when the event fires.
      const simple = resolveRoles(s, def, {}, true)!;
      if (!evalCond(s, def.when, { roles: simple, vars: {} })) continue;
      if (def.hazard !== undefined && def.hazard < 1 && rand(s.rng) >= def.hazard) continue;
      fire(s, def, simple, {});
    }
  },
};
