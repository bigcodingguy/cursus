// Content event definitions and pure helpers for presenting them.

import { EVENTS as HISTORY } from '../../../content/events';
import { OPPORTUNITIES } from '../../../content/opportunities';

const EVENTS = [...HISTORY, ...OPPORTUNITIES];
import { evalCond, evalNum, groupMembers, renderSegs, resolve, withRole, type Cond, type Effect, type Group, type NumExpr, type Ref, type Scope, type TextSeg } from '../../dsl';
import type { Breakdown, CharId, GameState, PendingEvent } from '../../types';
import { clamp } from '../../util';
import { rand } from '../../rng';

export interface RiskDef {
  chance: NumExpr;
  success: Effect[];
  failure: Effect[];
  successText: TextSeg[] | string;
  failureText: TextSeg[] | string;
}

export interface ChoiceDef {
  label: string;
  /** Only offered when this holds. */
  when?: Cond;
  effects?: Effect[];
  risk?: RiskDef;
  /** Outcome text shown after choosing (for choices without risk). */
  text?: TextSeg[] | string;
}

export type RoleDef = Ref | { pick: Group; best?: NumExpr; worst?: NumExpr; random?: boolean };

export interface EventDef {
  id: string;
  title: string;
  /** Checked daily. Leave out for events that only fire by hook or trigger. */
  when?: Cond;
  /** Daily chance once `when` holds. Default 1. */
  hazard?: number;
  /** Fire when a system emits this hook. */
  hook?: string;
  /** Repeatable events give a cooldown in days. Otherwise they fire once. */
  cooldown?: number;
  roles?: Record<string, RoleDef>;
  /** Roles that must resolve to a living character for the event to fire. */
  needs?: string[];
  text: TextSeg[] | string;
  /** Shown to the player as a modal (pauses the game). World events are silent apart from their effects. */
  player?: boolean;
  immediate?: Effect[];
  choices?: ChoiceDef[];
  /** 'opportunity': not checked daily; the pacer offers one when the player has been left alone a while. */
  pool?: 'opportunity';
  /** Numbers computed when the event fires, available to text as {var:name}. */
  vars?: Record<string, NumExpr>;
}

const byId = new Map<string, EventDef>();
for (const e of EVENTS) {
  if (byId.has(e.id)) throw new Error(`Duplicate event id ${e.id}`);
  byId.set(e.id, e);
}
export function eventDef(id: string): EventDef | undefined {
  return byId.get(id);
}
export function allEvents(): EventDef[] {
  return EVENTS;
}

export function scopeOf(p: PendingEvent): Scope {
  return { roles: p.roles, vars: p.vars };
}

export function resolveRoles(s: GameState, def: EventDef, base: Record<string, CharId>, simpleOnly = false): Record<string, CharId> | null {
  let sc: Scope = { roles: { ...base }, vars: {} };
  for (const [name, r] of Object.entries(def.roles ?? {})) {
    if (sc.roles[name]) continue;
    if (typeof r === 'string') {
      const c = resolve(s, r, sc);
      if (c) sc = withRole(sc, name, c.id);
    } else {
      if (simpleOnly) continue;
      const members = groupMembers(s, r.pick, sc);
      if (!members.length) continue;
      const key = r.best ?? r.worst;
      let chosen = r.random ? members[Math.floor(rand(s.rng) * members.length)] : members[0];
      if (key) {
        let bestV = -Infinity;
        for (const m of members) {
          const v = evalNum(s, key, withRole(sc, 'it', m.id)).total * (r.best ? 1 : -1);
          if (v > bestV) {
            bestV = v;
            chosen = m;
          }
        }
      }
      sc = withRole(sc, name, chosen.id);
    }
  }
  if (simpleOnly) return sc.roles;
  for (const n of def.needs ?? []) {
    const id = sc.roles[n];
    if (!id || !s.chars[id]?.alive) return null;
  }
  return sc.roles;
}

export function segs(t: TextSeg[] | string): TextSeg[] {
  return typeof t === 'string' ? [t] : t;
}

export function eventText(s: GameState, p: PendingEvent): string {
  const def = eventDef(p.eventId);
  return def ? renderSegs(s, segs(def.text), scopeOf(p)) : '';
}

export function choiceChance(s: GameState, p: PendingEvent, c: ChoiceDef): Breakdown | null {
  if (!c.risk) return null;
  const b = evalNum(s, c.risk.chance, scopeOf(p));
  return { total: clamp(b.total, 0, 1), parts: b.parts };
}

export function visibleChoices(s: GameState, p: PendingEvent): { index: number; label: string; chance: Breakdown | null }[] {
  const def = eventDef(p.eventId);
  if (!def?.choices) return [];
  const sc = scopeOf(p);
  return def.choices
    .map((c, index) => ({ c, index }))
    .filter(({ c }) => !c.when || evalCond(s, c.when, sc))
    .map(({ c, index }) => ({ index, label: renderSegs(s, [c.label], sc), chance: choiceChance(s, p, c) }));
}
