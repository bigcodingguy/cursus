// Long pressures on the Republic. Drift is per month and may depend on the state of the world.
import type { NumExpr } from '../sim/dsl';

export interface PressureDef {
  id: string;
  label: string;
  blurb: string;
  start: number;
  drift: NumExpr;
}

export const PRESSURES: PressureDef[] = [
  {
    id: 'land',
    label: 'The land question',
    blurb: 'The rich hold the public land; the small farmers who filled the legions are gone from it.',
    start: 72,
    drift: { base: 0.25, label: 'Estates swallow small farms', mods: [{ label: 'The land commission at work', when: { flag: 'land_commission' }, add: -0.45 }, { label: 'The commission hamstrung', when: { flag: 'commission_curbed' }, add: 0.3 }] },
  },
  {
    id: 'allies',
    label: 'The Italian allies',
    blurb: 'Italians fight in Rome’s wars without a vote in Rome’s assemblies.',
    start: 38,
    drift: { base: 0.1, label: 'Resentment of Roman officials', mods: [{ label: 'The commission takes allied land', when: { flag: 'land_commission' }, add: 0.25 }, { label: 'Fregellae remembered', when: { flag: 'fregellae_destroyed' }, add: 0.1 }] },
  },
];

export const STABILITY = {
  start: 62,
  drift: {
    base: 0.15,
    label: 'Ordinary life resumes',
    mods: [
      { label: 'Land hunger', when: { num: { pressure: 'land' }, gte: 70 }, add: -0.25 },
      { label: 'Allied anger', when: { num: { pressure: 'allies' }, gte: 70 }, add: -0.2 },
      { label: 'Recovery from shock', when: { num: { stability: true }, lte: 40 }, add: 0.25 },
    ],
  } as NumExpr,
};
