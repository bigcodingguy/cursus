// Seeded RNG (mulberry32). The only source of randomness in the sim.
// State is a plain object so it serializes with the rest of the game.

export interface RngState {
  s: number;
}

export function seedFrom(input: number | string): number {
  const str = String(input);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function makeRng(seed: number): RngState {
  return { s: seed >>> 0 };
}

export function nextU32(r: RngState): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/** Uniform in [0, 1). */
export function rand(r: RngState): number {
  return nextU32(r) / 4294967296;
}

export function randInt(r: RngState, lo: number, hi: number): number {
  return lo + Math.floor(rand(r) * (hi - lo + 1));
}

export function chance(r: RngState, p: number): boolean {
  return rand(r) < p;
}

export function pick<T>(r: RngState, arr: readonly T[]): T {
  return arr[Math.floor(rand(r) * arr.length)];
}

export function gauss(r: RngState): number {
  const u = Math.max(rand(r), 1e-12);
  const v = rand(r);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function weightedPick<T>(r: RngState, items: readonly T[], weight: (t: T) => number): T | undefined {
  let total = 0;
  for (const it of items) total += Math.max(0, weight(it));
  if (total <= 0) return undefined;
  let x = rand(r) * total;
  for (const it of items) {
    x -= Math.max(0, weight(it));
    if (x < 0) return it;
  }
  return items[items.length - 1];
}

/** A derived RNG that does not advance the parent (for previews such as election forecasts). */
export function fork(r: RngState, salt: number): RngState {
  return { s: (Math.imul(r.s ^ 0x9e3779b9, 2654435761) + salt) >>> 0 };
}
