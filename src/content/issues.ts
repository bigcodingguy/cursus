// Questions debated at public meetings (contiones). `popular` names the side the crowd favors.
import type { Cond } from '../sim/dsl';

export interface IssueDef {
  id: string;
  label: string;
  when: Cond;
  sponsor?: string; // historical key of the man pushing it
  forLabel: string;
  againstLabel: string;
  popular: 'for' | 'against';
  /** How much the outcome of the debate matters to the crisis pressure, per successful speech. */
  pressure?: { id: string; for: number; against: number };
}

export const ISSUES: IssueDef[] = [
  {
    id: 'lex_agraria', label: "Tiberius Gracchus's land bill", sponsor: 'ti_gracchus',
    when: { all: [{ year: [133, 133] }, { alive: '@ti_gracchus' }, { noFlag: 'tiberius_dead' }] },
    forLabel: 'Speak for the land bill', againstLabel: 'Speak against it', popular: 'for', pressure: { id: 'land', for: -0.5, against: 0.3 },
  },
  {
    id: 'commission', label: 'The work of the land commission', sponsor: 'c_gracchus',
    when: { all: [{ flag: 'land_commission' }, { year: [132, 124] }] },
    forLabel: 'Defend the commission', againstLabel: 'Call for it to be curbed', popular: 'for', pressure: { id: 'land', for: -0.3, against: 0.2 },
  },
  {
    id: 'allies', label: 'Citizenship for the Italian allies', sponsor: 'fulvius',
    when: { year: [126, 121] },
    forLabel: 'Speak for the allies', againstLabel: 'Speak against enfranchising them', popular: 'against', pressure: { id: 'allies', for: -0.6, against: 0.4 },
  },
  {
    id: 'grain', label: "Gaius Gracchus's grain law", sponsor: 'c_gracchus',
    when: { all: [{ year: [123, 122] }, { holds: '@c_gracchus', office: 'tribune_pleb' }] },
    forLabel: 'Speak for cheap grain', againstLabel: 'Speak against the dole', popular: 'for',
  },
  {
    id: 'juries', label: 'Moving the extortion juries to the equites', sponsor: 'c_gracchus',
    when: { all: [{ year: [123, 122] }, { noFlag: 'jury_law' }, { alive: '@c_gracchus' }] },
    forLabel: 'Speak for equestrian juries', againstLabel: 'Defend the senatorial juries', popular: 'for',
  },
  {
    id: 'junonia', label: 'The colony at Carthage', sponsor: 'c_gracchus',
    when: { all: [{ year: [122, 121] }, { flag: 'junonia' }] },
    forLabel: 'Defend the colony', againstLabel: 'Call for its repeal', popular: 'for',
  },
  {
    id: 'grain_supply', label: 'The price of grain', when: { year: [133, 120] },
    forLabel: 'Demand the Senate act on grain', againstLabel: 'Counsel patience', popular: 'for',
  },
];
