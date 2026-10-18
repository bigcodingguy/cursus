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
  {
    id: 'numidia',
    label: 'The Numidian affair',
    blurb: 'A client king’s heirs fight over Numidia, and Roman senators take money from the winner.',
    start: 0,
    drift: {
      base: 0,
      label: 'Quiet in Africa',
      mods: [
        { label: 'Micipsa’s heirs at war', when: { all: [{ flag: 'numidia_split' }, { noFlag: 'jugurtha_captured' }] }, add: 0.9 },
        { label: 'Roman blood at Cirta', when: { all: [{ flag: 'cirta' }, { noFlag: 'jugurtha_captured' }] }, add: 0.6 },
        { label: 'A peace that was bought', when: { all: [{ flag: 'bestia_peace' }, { noFlag: 'metellus_africa' }] }, add: 1.2 },
        { label: 'Metellus restores discipline', when: { all: [{ flag: 'metellus_africa' }, { noFlag: 'jugurtha_captured' }] }, add: -0.6 },
        { label: 'Jugurtha in chains', when: { flag: 'jugurtha_captured' }, add: -6 },
      ],
    },
  },
  {
    id: 'north',
    label: 'The northern peoples',
    blurb: 'Whole nations on the move beyond the Alps — the Cimbri, the Teutones — looking for land.',
    start: 0,
    drift: {
      base: 0,
      label: 'The Alps hold',
      mods: [
        { label: 'The Cimbri on the move', when: { all: [{ flag: 'cimbri' }, { noFlag: 'cimbri_beaten' }] }, add: 0.8 },
        { label: 'Roman armies beaten', when: { all: [{ flag: 'arausio' }, { noFlag: 'cimbri_beaten' }] }, add: 0.6 },
        { label: 'Marius trains the new legions', when: { all: [{ flag: 'arausio' }, { holds: '@marius', office: 'consul' }] }, add: -1.2 },
        { label: 'The Cimbri destroyed', when: { flag: 'cimbri_beaten' }, add: -8 },
      ],
    },
  },
];

export const STABILITY = {
  start: 68,
  drift: {
    base: 0.25,
    label: 'Ordinary life resumes',
    mods: [
      { label: 'Land hunger', when: { num: { pressure: 'land' }, gte: 75 }, add: -0.2 },
      { label: 'Allied anger', when: { num: { pressure: 'allies' }, gte: 70 }, add: -0.2 },
      { label: 'Anger at the nobles over Numidia', when: { num: { pressure: 'numidia' }, gte: 55 }, add: -0.25 },
      { label: 'Fear of the northern barbarians', when: { num: { pressure: 'north' }, gte: 60 }, add: -0.3 },
      { label: 'Tempers cool after bloodshed', when: { num: { stability: true }, lte: 50 }, add: 0.55 },
      { label: 'Old habits of concord', when: { num: { stability: true }, lte: 62 }, add: 0.2 },
    ],
  } as NumExpr,
};
