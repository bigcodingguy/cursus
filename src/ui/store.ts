// Holds the game outside React and drives the clock. All changes go through sim commands.

import { useSyncExternalStore } from 'react';
import { installAll } from '../sim';
import { blockedBy, command as simCommand, tick, type Command } from '../sim/core';
import { deserialize, serialize } from '../sim/save';
import { newGame, type NewGameOptions } from '../sim/setup';
import type { GameState } from '../sim/types';

installAll();

export const SPEEDS = [0, 1, 3, 8, 20]; // days per real second

interface Store {
  s: GameState | null;
  speed: number;
  version: number;
  toast: string | null;
  lastPause: string | null;
}

const store: Store = { s: null, speed: 0, version: 0, toast: null, lastPause: null };
const listeners = new Set<() => void>();
let snapshot = { ...store };

function notify() {
  store.version++;
  snapshot = { ...store };
  for (const l of listeners) l();
}

export function useStore(): Store {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
  );
}

export function startNew(opts: NewGameOptions) {
  store.s = newGame(opts);
  store.speed = 0;
  notify();
}

export function setSpeed(i: number) {
  store.speed = i;
  notify();
}

export function toast(msg: string | null) {
  store.toast = msg;
  notify();
  if (msg) setTimeout(() => store.toast === msg && toast(null), 3500);
}

/** Send a command to the sim. Returns the error, if any. */
export function run(cmd: Command): string | null {
  if (!store.s) return 'No game';
  const err = simCommand(store.s, cmd);
  if (err) toast(err);
  autoPause();
  notify();
  return err;
}

export function quit() {
  store.s = null;
  store.speed = 0;
  notify();
}

function autoPause() {
  const s = store.s;
  if (!s) return;
  if (s.pauseRequests.length) {
    store.lastPause = s.pauseRequests[s.pauseRequests.length - 1];
    s.pauseRequests = [];
    store.speed = 0;
  }
}

// ---------------- clock ----------------
let acc = 0;
let last = performance.now();
let sinceSave = 0;
function frame(now: number) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  const s = store.s;
  if (s && store.speed > 0) {
    acc += dt * SPEEDS[store.speed];
    let n = 0;
    while (acc >= 1 && n < 30) {
      acc -= 1;
      n++;
      if (!tick(s)) {
        store.speed = 0;
        break;
      }
      sinceSave++;
      if (s.pauseRequests.length) {
        autoPause();
        break;
      }
    }
    if (blockedBy(s)) store.speed = 0;
    if (n) {
      if (sinceSave >= 30) {
        sinceSave = 0;
        saveSlot('auto');
      }
      notify();
    }
  } else acc = 0;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------- saves ----------------
const KEY = (slot: string) => `cursus.save.${slot}`;

export function saveSlot(slot: string): boolean {
  if (!store.s) return false;
  try {
    localStorage.setItem(KEY(slot), serialize(store.s));
    return true;
  } catch {
    return false;
  }
}

export function loadSlot(slot: string): string | null {
  try {
    const t = localStorage.getItem(KEY(slot));
    if (!t) return 'Nothing saved there';
    store.s = deserialize(t);
    store.speed = 0;
    notify();
    return null;
  } catch (e) {
    return String((e as Error).message ?? e);
  }
}

export function slotInfo(slot: string): string | null {
  try {
    const t = localStorage.getItem(KEY(slot));
    if (!t) return null;
    const s = (JSON.parse(t) as { state: GameState }).state;
    return `${s.day}`;
  } catch {
    return null;
  }
}

export function exportSave(): string | null {
  return store.s ? serialize(store.s) : null;
}

export function importSave(text: string): string | null {
  try {
    store.s = deserialize(text);
    store.speed = 0;
    notify();
    return null;
  } catch (e) {
    return String((e as Error).message ?? e);
  }
}

/** For the browser console and automated playtests. */
(globalThis as unknown as { cursus: unknown }).cursus = { store, run, setSpeed, saveSlot, tick: () => store.s && tick(store.s) };
