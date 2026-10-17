// Save-format migrations. Bump CURRENT_VERSION and add a step whenever the state shape changes.

export const CURRENT_VERSION = 1;

type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

/** migrations[n] upgrades a version-n state to version n+1. */
export const migrations: Record<number, Migration> = {};

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
