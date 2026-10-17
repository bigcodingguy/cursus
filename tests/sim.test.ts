import { describe, expect, it } from 'vitest';
import { runLifetime } from '../src/sim/bots';
import { command, tick } from '../src/sim/core';
import { deserialize, serialize } from '../src/sim/save';
import { newGame } from '../src/sim/setup';
import { totalCash } from '../src/sim/systems/money/api';
import { forecastRuns, openElection, winChance } from '../src/sim/systems/offices/api';
import { standingOf } from '../src/sim/systems/standing/api';
import type { GameState } from '../src/sim/types';

/** JSON with sorted keys: equal states compare equal regardless of property insertion order. */
function canon(s: GameState): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined).map((k) => [k, sort((v as Record<string, unknown>)[k])]));
    return v;
  };
  return JSON.stringify(sort(JSON.parse(serialize(s))));
}

function checkInvariants(s: GameState) {
  // Money is conserved: every sesterce in the world came from a defined source and left by a defined sink.
  expect(Math.abs(totalCash(s) - (s.money.minted - s.money.burned))).toBeLessThan(1);
  for (const c of Object.values(s.chars)) {
    expect(Number.isFinite(c.oratory) && Number.isFinite(c.law) && Number.isFinite(c.lean)).toBe(true);
    expect(c.lean).toBeGreaterThanOrEqual(-1);
    expect(c.lean).toBeLessThanOrEqual(1);
    if (!c.alive) expect(c.died).toBeDefined();
    expect(Number.isFinite(s.money.accounts[c.id]?.cash ?? 0)).toBe(true);
  }
  // No man holds two magistracies in one year.
  const seen = new Set<string>();
  for (const r of s.offices.records) {
    if (r.office === 'military_tribune') continue;
    const k = `${r.who}:${r.yearBC}`;
    expect(seen.has(k), `two offices: ${k} ${r.office}`).toBe(false);
    seen.add(k);
  }
  for (const k of Object.keys(s.crisis.pressures)) {
    expect(s.crisis.pressures[k]).toBeGreaterThanOrEqual(0);
    expect(s.crisis.pressures[k]).toBeLessThanOrEqual(100);
  }
  const p = s.chars[s.playerId];
  for (const kind of ['dignitas', 'people', 'boni'] as const) {
    const v = standingOf(s, p.id, kind).total;
    expect(v).toBeGreaterThanOrEqual(-100);
    expect(v).toBeLessThanOrEqual(100);
  }
}

describe('a whole lifetime', () => {
  for (const strat of ['orator', 'populist', 'establishment'] as const) {
    it(`${strat}: runs 133→120 BC and keeps its invariants`, () => {
      const { state, metrics } = runLifetime(77, strat);
      checkInvariants(state);
      expect(state.ended).toBeDefined();
      expect(metrics.firedDay.intro).toBeDefined();
      // The Gracchan crisis ripens in every run (likely, not scripted — but likely).
      expect(state.flags.land_commission).toBe(1);
    });
  }

  it('same seed + same commands = same game', () => {
    const a = runLifetime(5, 'orator').state;
    const b = runLifetime(5, 'orator').state;
    expect(canon(a)).toBe(canon(b));
  });

  it('a save loaded mid-game continues exactly as the original', () => {
    const until = 365 * 4 + 100;
    const a = runLifetime(11, 'populist', { untilDay: until }).state;
    const b = deserialize(serialize(a));
    for (let i = 0; i < 400; i++) {
      for (const g of [a, b]) {
        for (const p of [...g.events.pending]) {
          command(g, { type: 'choose', uid: p.uid, choice: 0 });
          command(g, { type: 'dismiss', uid: p.uid });
        }
        if (!tick(g) && g.events.pending.length === 0) command(g, { type: 'election.vote' });
      }
    }
    expect(canon(b)).toBe(canon(a));
  });

  it('checks invariants monthly through a run', () => {
    const s = newGame({ seed: 3 });
    for (let d = 0; d < 365 * 5; d++) {
      for (const p of [...s.events.pending]) {
        command(s, { type: 'choose', uid: p.uid, choice: 0 });
        command(s, { type: 'dismiss', uid: p.uid });
      }
      tick(s);
      if (d % 30 === 0) checkInvariants(s);
    }
  });
});

describe('elections', () => {
  it('the shown chance is the share of forecast runs, and the vote picks one of them', () => {
    const { state: s } = runLifetime(21, 'establishment', { untilDay: 365 * 11 + 200 });
    const e = openElection(s);
    if (!e || !e.candidates.some((c) => c.who === s.playerId)) return; // not standing this seed at that moment
    const p = winChance(s, e, s.playerId);
    const runs = forecastRuns(s, e);
    expect(runs.filter((r) => r.winners.includes(s.playerId)).length / runs.length).toBe(p);
  });
});
