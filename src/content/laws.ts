// Laws a tribune or consul can put before the people. NPC magistrates choose from the same list.
// `side`: -1 popular measure .. +1 the Senate's measure. `appeal`: how well it sits with the voters (0..1).
// `equites`: how much the business class wants it (-1..1); an equestrian creditor may call in a vote for it.
// Effects run when it passes, with the role `proposer` bound.
import type { Cond, Effect } from '../sim/dsl';

export interface LawDef {
  id: string;
  label: string;
  blurb: string;
  when: Cond;
  side: number;
  appeal: number;
  equites?: number;
  /** Historical key of the man who carried it in our history. */
  sponsor?: string;
  /** Can it be carried more than once (after this many days)? Default: once. */
  again?: number;
  passed: Effect[];
}

const people = (v: number, label: string): Effect => ({ standing: { who: 'proposer', kind: 'people', value: v, label } });
const boni = (v: number, label: string): Effect => ({ standing: { who: 'proposer', kind: 'boni', value: v, label } });

export const LAWS: LawDef[] = [
  {
    id: 'grain_dole', label: 'A law on the grain dole', side: -0.8, appeal: 0.8,
    blurb: 'Sell grain to citizens at a fixed low price, out of the treasury.',
    when: { after: [120, 0, 1] }, again: 2500, sponsor: 'saturninus',
    passed: [people(10, 'Carried a grain law'), boni(-8, 'Emptied the treasury for the mob'), { stability: 2, label: 'Cheap bread' }, { pressure: 'land', add: -2 }],
  },
  {
    id: 'voting_bridges', label: 'A law narrowing the voting bridges', side: -0.5, appeal: 0.65, sponsor: 'marius',
    blurb: 'Make the gangways at the voting pens too narrow for the nobles’ men to stand on them and watch how each man votes.',
    when: { year: [120, 110] },
    passed: [people(8, 'Freed the ballot from watchers'), boni(-10, 'Defied the Senate on the ballot'), { flag: 'voting_bridges' }],
  },
  {
    id: 'land_privatize', label: 'A law confirming the allotments as private land', side: 0.4, appeal: 0.55, equites: 0.4,
    blurb: 'End the land commission’s work: the allotments and the public land in private hands become private property, to be bought and sold.',
    when: { all: [{ after: [119, 0, 1] }, { noFlag: 'land_private' }] }, sponsor: 'thorius',
    passed: [boni(6, 'Settled the land question'), { flag: 'land_private' }, { pressure: 'land', add: 6 }, { log: 'The Gracchan allotments become private property. The rich begin to buy them up.' }],
  },
  {
    id: 'colony', label: 'A law founding a colony', side: -0.4, appeal: 0.7,
    blurb: 'Settle poor citizens on land overseas or in Italy, with three commissioners to divide it.',
    when: { after: [119, 0, 1] }, again: 3000,
    passed: [people(7, 'Founded a colony'), { pressure: 'land', add: -4 }],
  },
  {
    id: 'repetundae', label: 'A sterner law on extortion', side: -0.2, appeal: 0.6, equites: 0.5,
    blurb: 'Heavier penalties for governors who rob the provinces, and rewards for provincials who prosecute.',
    when: { after: [119, 0, 1] }, again: 4000,
    passed: [people(5, 'Carried a law against extortion'), { law: 'repetundaeMultiplier', value: 2.5 }],
  },
  {
    id: 'juries_senate', label: 'A law returning the juries to the Senate', side: 0.9, appeal: 0.35, equites: -1,
    blurb: 'Take the extortion juries back from the equites, or share them with the senators.',
    when: { all: [{ law: 'repetundaeJury', eq: 'equites' }, { after: [110, 0, 1] }] }, sponsor: 'caepio',
    passed: [boni(10, 'Gave the courts back to the Senate'), { law: 'repetundaeJury', value: 'senators' }, { log: 'The extortion juries go back to the senators.' }],
  },
  {
    id: 'juries_equites', label: 'A law giving the juries back to the equites', side: -0.6, appeal: 0.55, equites: 1,
    blurb: 'Hand the extortion court back to the equestrian order.',
    when: { all: [{ law: 'repetundaeJury', eq: 'senators' }, { flag: 'jury_law' }] }, sponsor: 'glaucia',
    passed: [people(5, 'Gave the courts to the equites'), boni(-8, 'Took the courts from the Senate'), { law: 'repetundaeJury', value: 'equites' }, { log: 'The extortion juries pass to the equites again.' }],
  },
  {
    id: 'jugurtha_inquiry', label: 'A commission on the dealings with Jugurtha', side: -0.7, appeal: 0.8, equites: 0.6, sponsor: 'mamilius',
    blurb: 'A special court, with equestrian jurors, for every man who took the Numidian’s money or betrayed an army to him.',
    when: { all: [{ flag: 'jugurtha_in_rome' }, { noFlag: 'mamilian_commission' }] },
    passed: [people(10, 'Exposed the Numidian bribery'), boni(-12, 'Set a court on the nobles'), { flag: 'mamilian_commission' }, { trigger: 'mamilian_verdicts', delay: 90 }],
  },
  {
    id: 'african_command', label: 'A law giving the African command to a new man', side: -0.6, appeal: 0.75, sponsor: 'mancinus',
    blurb: 'Let the people, not the Senate, choose who will finish the war with Jugurtha.',
    when: { all: [{ flag: 'numidian_war' }, { noFlag: 'jugurtha_captured' }, { holds: '@marius', office: 'consul' }, { noFlag: 'marius_africa' }] },
    passed: [people(6, 'Gave the war to Marius'), { flag: 'marius_africa' }, { standing: { who: '@marius', kind: 'people', value: 10, label: 'The people gave him the war' } }, { memory: { owner: '@numidicus', about: 'proposer', act: 'Took my command from me', weight: -40, halfLife: 6000 } }],
  },
  {
    id: 'veteran_land', label: 'A law giving land to veterans', side: -0.8, appeal: 0.7, sponsor: 'saturninus',
    blurb: 'Allotments in Africa or Gaul for the soldiers of the new armies, who have no farms to go home to.',
    when: { all: [{ flag: 'capite_censi' }, { after: [104, 0, 1] }] }, again: 2000,
    passed: [people(8, 'Gave the veterans land'), boni(-10, 'Bought the soldiers with public land'), { standing: { who: '@marius', kind: 'people', value: 5, label: 'His veterans settled' } }, { stability: -3, label: 'Veterans at the voting' }, { pressure: 'land', add: -3 }],
  },
  {
    id: 'maiestas', label: 'A law on treason against the people', side: -0.7, appeal: 0.7, sponsor: 'saturninus',
    blurb: 'A court for any magistrate who diminishes the majesty of the Roman people — by losing an army, for a start.',
    when: { all: [{ flag: 'arausio' }, { noFlag: 'maiestas_law' }] },
    passed: [people(6, 'Carried the treason law'), boni(-8, 'A court aimed at the nobles'), { flag: 'maiestas_law' }],
  },
  {
    id: 'senate_decree', label: 'A law confirming the Senate’s authority over the treasury', side: 0.8, appeal: 0.4,
    blurb: 'No public money spent without a decree of the Senate.',
    when: { after: [119, 0, 1] }, again: 4000,
    passed: [boni(8, 'Defended the Senate’s authority'), people(-4, 'Took the purse from the people'), { stability: 1, label: 'The Senate’s hand firmer' }],
  },
];
