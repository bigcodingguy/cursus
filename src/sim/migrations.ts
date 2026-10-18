// Save-format migrations. Bump CURRENT_VERSION and add a step whenever the state shape changes.

export const CURRENT_VERSION = 3;

type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

/** migrations[n] upgrades a version-n state to version n+1. */
export const migrations: Record<number, Migration> = {
  // v2: opportunities are paced from the last time the player faced an event.
  1: (s) => {
    const ev = s.events as Record<string, unknown>;
    ev.lastPrompt = s.day;
    return s;
  },
  // v3: family and dynasty; laws before the assembly.
  2: (s) => {
    s.family = { marriages: [], heirs: {}, elogia: [], line: [s.playerId] };
    s.assembly = { proposals: [], nextId: 1, passed: {} };
    return s;
  },
};

export function migrate(state: Record<string, unknown>, from: number): Record<string, unknown> {
  let v = from;
  let s = state;
  while (v < CURRENT_VERSION) {
    const m = migrations[v];
    if (!m) throw new Error(`No migration from save version ${v}`);
    s = m(s);
    v += 1;
    s.version = v;
  }
  return s;
}
