import { describe, expect, it } from 'vitest';
import { dateOf, dayOf, romanDate } from '../src/sim/calendar';
import { fork, makeRng, rand } from '../src/sim/rng';
import { majorityChance, MOOD_POINTS, MOOD_SIGMA, verdictChance } from '../src/sim/systems/courts/api';
import { sigmoid } from '../src/sim/util';

describe('rng', () => {
  it('is deterministic and fork does not advance the parent', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const xs = [rand(a), rand(a), rand(a)];
    expect([rand(b), rand(b), rand(b)]).toEqual(xs);
    const before = a.s;
    const f = fork(a, 7);
    rand(f);
    expect(a.s).toBe(before);
  });
});

describe('calendar', () => {
  it('names Roman dates', () => {
    expect(romanDate(dayOf(133, 0, 1))).toBe('Kal. Ian.');
    expect(romanDate(dayOf(133, 2, 15))).toBe('Id. Mart.');
    expect(romanDate(dayOf(133, 2, 14))).toBe('pridie Id. Mart.');
    expect(romanDate(dayOf(133, 2, 2))).toBe('a.d. VI Non. Mart.');
    expect(romanDate(dayOf(133, 2, 16))).toBe('a.d. XVII Kal. Apr.');
    expect(romanDate(dayOf(133, 0, 5))).toBe('Non. Ian.');
    expect(romanDate(dayOf(133, 1, 28))).toBe('pridie Kal. Mart.');
  });
  it('round-trips days', () => {
    for (const d of [0, 59, 364, 365, 4000, 5109]) {
      const p = dateOf(d);
      expect(dayOf(p.yearBC, p.month, p.dom)).toBe(d);
    }
  });
});

describe('jury odds', () => {
  it('majorityChance matches brute force', () => {
    const ps = [0.2, 0.7, 0.55, 0.9, 0.4];
    let brute = 0;
    for (let mask = 0; mask < 32; mask++) {
      let pr = 1;
      let k = 0;
      for (let i = 0; i < 5; i++) {
        const v = (mask >> i) & 1;
        pr *= v ? ps[i] : 1 - ps[i];
        k += v;
      }
      if (k > 2) brute += pr;
    }
    expect(majorityChance(ps)).toBeCloseTo(brute, 12);
  });
  it('ties acquit', () => {
    expect(majorityChance([1, 0])).toBe(0);
    expect(majorityChance([1, 1])).toBe(1);
  });
  it('the verdict draw reproduces the shown probability (honest odds)', () => {
    const logits = Array.from({ length: 32 }, (_, i) => -0.4 + (i % 7) * 0.1);
    const shown = verdictChance(logits);
    const r = makeRng(9);
    let convict = 0;
    const N = 20000;
    for (let n = 0; n < N; n++) {
      let x = rand(r);
      let mood = MOOD_POINTS[MOOD_POINTS.length - 1].x;
      for (const m of MOOD_POINTS) {
        x -= m.w;
        if (x < 0) {
          mood = m.x;
          break;
        }
      }
      let k = 0;
      for (const l of logits) if (rand(r) < sigmoid(l + MOOD_SIGMA * mood)) k++;
      if (k > 16) convict++;
    }
    expect(Math.abs(convict / N - shown)).toBeLessThan(0.015);
  });
});
