// Core: system registry, action registry, daily tick, commands.

import { dateOf } from './calendar';
import { emit } from './bus';
import type { ActionParams, Breakdown, Character, CharId, GameState, PlaceId } from './types';

// ---------------- systems ----------------
export interface SystemDef {
  id: string;
  /** Called once at install: register bus handlers, actions, commands. */
  register?: () => void;
  /** Called once when a new game is created, after the cast exists. */
  init?: (s: GameState) => void;
  daily?: (s: GameState) => void;
  monthly?: (s: GameState) => void;
  yearly?: (s: GameState) => void;
  /** Return a reason if the world must not advance (e.g. a trial awaiting the player). */
  blocks?: (s: GameState) => string | null;
}

const systems: SystemDef[] = [];
let installed = false;

export function installSystems(defs: SystemDef[]): void {
  if (installed) return;
  installed = true;
  for (const d of defs) {
    systems.push(d);
    d.register?.();
  }
}

export function initSystems(s: GameState): void {
  for (const d of systems) d.init?.(s);
}

// ---------------- actions ----------------
export interface ActionDef {
  id: string;
  label: string;
  place: PlaceId | ((s: GameState, actor: Character, p: ActionParams) => PlaceId);
  /** Days the action occupies the actor. 0 = immediate. */
  duration: (s: GameState, actor: Character, p: ActionParams) => number;
  /** HS paid when the action starts. */
  cost?: (s: GameState, actor: Character, p: ActionParams) => number;
  /** null when allowed, otherwise the reason it is not. */
  check: (s: GameState, actor: Character, p: ActionParams) => string | null;
  start?: (s: GameState, actor: Character, p: ActionParams) => void;
  complete: (s: GameState, actor: Character, p: ActionParams) => void;
  /** Utility-scored options for NPCs. NPCs and the player share the same defs. */
  npc?: (s: GameState, actor: Character) => { params: ActionParams; utility: number }[];
  /** Probability of success shown to the player, when the action is a gamble. */
  odds?: (s: GameState, actor: Character, p: ActionParams) => Breakdown | null;
  blurb?: string;
}

const actions = new Map<string, ActionDef>();
export function registerAction(def: ActionDef): void {
  actions.set(def.id, def);
}
export function getAction(id: string): ActionDef | undefined {
  return actions.get(id);
}
export function allActions(): ActionDef[] {
  return [...actions.values()];
}

export function placeOf(def: ActionDef, s: GameState, actor: Character, p: ActionParams): PlaceId {
  return typeof def.place === 'function' ? def.place(s, actor, p) : def.place;
}

export function checkAction(s: GameState, actorId: CharId, actionId: string, p: ActionParams): string | null {
  const def = actions.get(actionId);
  const actor = s.chars[actorId];
  if (!def) return 'Unknown action';
  if (!actor || !actor.alive) return 'Not possible';
  if (actor.location !== 'rome') return 'You are not in Rome';
  if (actor.busyUntil > s.day) return 'Already occupied';
  const cost = def.cost?.(s, actor, p) ?? 0;
  if (cost > 0 && (s.money.accounts[actorId]?.cash ?? 0) < cost) return 'Not enough money';
  return def.check(s, actor, p);
}

export function startAction(s: GameState, actorId: CharId, actionId: string, p: ActionParams): string | null {
  const err = checkAction(s, actorId, actionId, p);
  if (err) return err;
  const def = actions.get(actionId)!;
  const actor = s.chars[actorId];
  const cost = def.cost?.(s, actor, p) ?? 0;
  if (cost > 0) emit(s, 'transfer', { from: actorId, to: null, amount: cost, reason: def.label });
  const dur = Math.max(0, Math.round(def.duration(s, actor, p)));
  def.start?.(s, actor, p);
  if (dur === 0) {
    finish(s, actor, def, p);
  } else {
    actor.action = { id: actionId, params: p, startDay: s.day, endDay: s.day + dur };
    actor.busyUntil = s.day + dur;
  }
  return null;
}

function finish(s: GameState, actor: Character, def: ActionDef, p: ActionParams) {
  actor.action = undefined;
  if (actor.busyUntil > s.day) actor.busyUntil = s.day;
  if (!actor.alive) return;
  def.complete(s, actor, p);
  emit(s, 'action.done', { actor: actor.id, action: def.id });
}

// ---------------- commands ----------------
/** e.g. {type:'act', action, params}, {type:'routine', value}, {type:'choose', uid, choice}. */
export type Command = { type: string; [k: string]: unknown };

type CommandHandler = (s: GameState, cmd: Command) => string | null;
const commands = new Map<string, CommandHandler>();
export function registerCommand(type: string, h: CommandHandler): void {
  commands.set(type, h);
}

registerCommand('act', (s, cmd) => {
  const c = cmd as unknown as { action: string; params: ActionParams };
  return startAction(s, s.playerId, c.action, c.params ?? {});
});
registerCommand('routine', (s, cmd) => {
  s.routine = (cmd as unknown as { value: GameState['routine'] }).value;
  return null;
});

/** Apply a player command. Returns an error string or null. */
export function command(s: GameState, cmd: Command): string | null {
  if (s.ended) return 'The game has ended';
  const h = commands.get(cmd.type);
  if (!h) return `Unknown command ${cmd.type}`;
  return h(s, cmd);
}

// ---------------- tick ----------------
export function blockedBy(s: GameState): string | null {
  if (s.ended) return 'ended';
  if (s.events.pending.length) return 'event';
  for (const d of systems) {
    const r = d.blocks?.(s);
    if (r) return r;
  }
  return null;
}

/** Advance one day. Returns false if the world is waiting on the player. */
export function tick(s: GameState): boolean {
  if (blockedBy(s)) return false;
  s.day += 1;
  const d = dateOf(s.day);
  for (const c of Object.values(s.chars)) {
    if (c.action && c.action.endDay <= s.day) {
      const def = actions.get(c.action.id);
      const p = c.action.params;
      if (def) finish(s, c, def, p);
      else c.action = undefined;
    }
  }
  if (d.doy === 0) for (const sys of systems) sys.yearly?.(s);
  if (d.dom === 1) for (const sys of systems) sys.monthly?.(s);
  for (const sys of systems) sys.daily?.(s);
  if (s.day >= s.endDay && !s.ended) {
    s.ended = { day: s.day, reason: 'The slice ends at the close of 120 BC.' };
    emit(s, 'pause', { reason: 'end' });
  }
  return true;
}

/** Run until blocked or n days pass. Returns days advanced. */
export function advance(s: GameState, n: number): number {
  let i = 0;
  while (i < n && tick(s)) i++;
  return i;
}
