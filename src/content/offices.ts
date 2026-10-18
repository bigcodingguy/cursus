// Offices, tribes, provinces, fasti, campaigns. Pure data.
import type { OfficeId } from '../sim/types';

export interface OfficeDef {
  id: OfficeId;
  label: string;
  minAge: number;
  dignitas: number;
  makesSenator: boolean;
}

export const OFFICES: Record<OfficeId, OfficeDef> = {
  military_tribune: { id: 'military_tribune', label: 'Military tribune', minAge: 17, dignitas: 4, makesSenator: false },
  quaestor: { id: 'quaestor', label: 'Quaestor', minAge: 27, dignitas: 8, makesSenator: true },
  tribune_pleb: { id: 'tribune_pleb', label: 'Tribune of the plebs', minAge: 27, dignitas: 6, makesSenator: true },
  aedile: { id: 'aedile', label: 'Aedile', minAge: 33, dignitas: 8, makesSenator: true },
  praetor: { id: 'praetor', label: 'Praetor', minAge: 39, dignitas: 12, makesSenator: true },
  consul: { id: 'consul', label: 'Consul', minAge: 42, dignitas: 18, makesSenator: true },
  censor: { id: 'censor', label: 'Censor', minAge: 45, dignitas: 8, makesSenator: true },
};

export interface ElectionDef {
  office: OfficeId;
  seats: number;
  month: number;
  dom: number;
  assembly: 'tribal' | 'centuriate';
  /** Censors are elected only in census years (BC). */
  years?: number[];
}

/** The summer elections, in the order they were held. Each runs as a real vote. */
export const ELECTION_DEFS: ElectionDef[] = [
  { office: 'censor', seats: 2, month: 6, dom: 2, assembly: 'centuriate', years: [131, 125, 120, 115, 109, 102] },
  { office: 'consul', seats: 2, month: 6, dom: 5, assembly: 'centuriate' },
  { office: 'praetor', seats: 6, month: 6, dom: 9, assembly: 'centuriate' },
  { office: 'aedile', seats: 4, month: 6, dom: 14, assembly: 'tribal' },
  { office: 'tribune_pleb', seats: 10, month: 6, dom: 18, assembly: 'tribal' },
  { office: 'quaestor', seats: 8, month: 6, dom: 25, assembly: 'tribal' },
];

/** The centuriate assembly: the classes by wealth, the richest voting first and weighing most. 193 centuries. */
export const CENTURIES = [
  { id: 'equites', label: 'The equestrian centuries', weight: 18, voters: 600, wealth: 1 },
  { id: 'class1', label: 'The first class', weight: 80, voters: 1600, wealth: 0.85 },
  { id: 'class2', label: 'The second class', weight: 20, voters: 600, wealth: 0.6 },
  { id: 'class3', label: 'The third class', weight: 20, voters: 600, wealth: 0.45 },
  { id: 'class4', label: 'The fourth class', weight: 20, voters: 700, wealth: 0.3 },
  { id: 'class5', label: 'The fifth class', weight: 30, voters: 900, wealth: 0.15 },
  { id: 'proletarii', label: 'The proletarii', weight: 5, voters: 1200, wealth: 0 },
];

/** Quaestorian election: seats, timing. Voting on a.d. VIII Kal. Sext. (25 Quintilis). */
export const QUAESTOR_ELECTION = {
  seats: 8,
  month: 6,
  dom: 25,
  openMonth: 5, // candidacies may be declared from the Kalends of Iunius
  professioDays: 24, // trinundinum: declare at least three market-weeks before
  fieldMargin: [5, 8] as [number, number], // losers in a typical field
};

export const URBAN_TRIBES = ['Suburana', 'Esquilina', 'Collina', 'Palatina'];
export const RUSTIC_TRIBES = [
  'Romilia', 'Lemonia', 'Pupinia', 'Voltinia', 'Camilia', 'Galeria', 'Pollia', 'Claudia', 'Aemilia', 'Cornelia',
  'Fabia', 'Horatia', 'Menenia', 'Papiria', 'Sergia', 'Veturia', 'Clustumina', 'Stellatina', 'Tromentina', 'Sabatina',
  'Arnensis', 'Pomptina', 'Publilia', 'Maecia', 'Scaptia', 'Oufentina', 'Falerna', 'Aniensis', 'Teretina', 'Velina', 'Quirina',
];
export const TRIBES = [...URBAN_TRIBES, ...RUSTIC_TRIBES];

/** Voters who actually turn out at Rome for a minor election, by tribe. Rustic tribes are thin. */
export function tribeTurnout(tribe: string): number {
  if (URBAN_TRIBES.includes(tribe)) return 1800;
  let h = 0;
  for (let i = 0; i < tribe.length; i++) h = (h * 31 + tribe.charCodeAt(i)) % 997;
  return 180 + (h % 260);
}

/** Districts where canvassing reaches particular tribes. */
export const CANVASS_ZONES = {
  subura: { label: 'Canvass the Subura and the urban tribes', tribes: URBAN_TRIBES, days: 3, cost: 600 },
  campus: { label: 'Canvass country voters on market days', tribes: RUSTIC_TRIBES, days: 5, cost: 1200 },
  arpinum: { label: 'Ride home to Arpinum and rally the Cornelia', tribes: ['Cornelia', 'Teretina', 'Oufentina'], days: 12, cost: 2000 },
} as const;
export type CanvassZone = keyof typeof CANVASS_ZONES;

export interface ProvinceDef {
  id: string;
  label: string;
  fromBC: number; // first year it has a governor
  richness: number; // multiplier on what can be squeezed out of it
  /** Days a letter takes to reach Rome. */
  letterDays: number;
  /** A war command given to a consul, not an ordinary province. */
  war?: boolean;
}
export const PROVINCES: ProvinceDef[] = [
  { id: 'sicilia', label: 'Sicily', fromBC: 227, richness: 1.0, letterDays: 9 },
  { id: 'sardinia', label: 'Sardinia', fromBC: 227, richness: 0.6, letterDays: 8 },
  { id: 'hisp_cit', label: 'Nearer Spain', fromBC: 197, richness: 0.8, letterDays: 24 },
  { id: 'hisp_ult', label: 'Further Spain', fromBC: 197, richness: 0.9, letterDays: 32 },
  { id: 'macedonia', label: 'Macedonia', fromBC: 146, richness: 1.0, letterDays: 18 },
  { id: 'africa', label: 'Africa', fromBC: 146, richness: 0.9, letterDays: 12 },
  { id: 'asia', label: 'Asia', fromBC: 129, richness: 1.8, letterDays: 35 },
  { id: 'gallia', label: 'Transalpine Gaul', fromBC: 120, richness: 0.6, letterDays: 20 },
  { id: 'numidia', label: 'the war in Numidia', fromBC: 0, richness: 0.8, letterDays: 15, war: true },
];

export interface FastiYear {
  consuls: string[]; // historical keys
  tribunes?: string[];
  praetors?: string[];
  quaestors?: string[];
}
/** Historical magistrates. If a man is dead or disgraced, the sim fills the seat from the living. */
export const FASTI: Record<number, FastiYear> = {
  133: { consuls: ['scaevola', 'piso'], tribunes: ['ti_gracchus', 'octavius'] },
  132: { consuls: ['laenas', 'rupilius'] },
  131: { consuls: ['crassus', 'flaccus_l'], tribunes: ['carbo'] },
  130: { consuls: ['lentulus', 'perperna'], quaestors: ['scaurus'] },
  129: { consuls: ['tuditanus', 'aquillius'], quaestors: ['metellus_l'] },
  128: { consuls: ['octavius_cn', 'annius'], quaestors: ['numidicus', 'rutilius'] },
  127: { consuls: ['cassius', 'cinna'], quaestors: ['metellus_m', 'augur'] },
  126: { consuls: ['lepidus', 'orestes'], quaestors: ['eburnus', 'drusus'] },
  125: { consuls: ['hypsaeus', 'fulvius'], praetors: ['opimius'], quaestors: ['metellus_c', 'nasica_f'] },
  124: { consuls: ['longinus', 'calvinus'], quaestors: ['carbo_cn', 'minucius'] },
  123: { consuls: ['metellus_q', 'flamininus'], tribunes: ['c_gracchus', 'rubrius'], quaestors: ['bestia', 'albinus', 'marius'] },
  122: { consuls: ['ahenobarbus', 'fannius'], tribunes: ['c_gracchus', 'drusus'], quaestors: ['silanus'] },
  121: { consuls: ['opimius', 'maximus'], tribunes: ['minucius'] },
  120: { consuls: ['manilius', 'carbo'], praetors: ['metellus_l', 'augur'], quaestors: ['cassius_l'] },
  // From here the record is a guide, not a script: men die, lose, or are beaten to it.
  119: { consuls: ['cotta'], tribunes: ['marius'], praetors: ['eburnus', 'scaurus'], quaestors: ['mallius', 'fimbria', 'memmius'] },
  118: { consuls: [], praetors: ['metellus_m', 'rutilius'], quaestors: ['caepio', 'catulus'] },
  117: { consuls: ['metellus_l', 'augur'] },
  116: { consuls: ['eburnus'], praetors: ['carbo_cn', 'metellus_c'] },
  115: { consuls: ['scaurus', 'metellus_m'], praetors: ['marius', 'drusus'] },
  114: { consuls: [], praetors: ['nasica_f', 'bestia'] },
  113: { consuls: ['metellus_c', 'carbo_cn'], praetors: ['minucius', 'albinus'], quaestors: ['antonius'] },
  112: { consuls: ['drusus'], praetors: ['numidicus', 'silanus'] },
  111: { consuls: ['nasica_f', 'bestia'], tribunes: ['memmius'], praetors: ['cassius_l'] },
  110: { consuls: ['minucius', 'albinus'], quaestors: ['crassus_o'] },
  109: { consuls: ['numidicus', 'silanus'], tribunes: ['mamilius'], praetors: ['caepio', 'catulus'], quaestors: ['glaucia'] },
  108: { consuls: [], praetors: ['mallius'] },
  107: { consuls: ['marius', 'cassius_l'], praetors: ['fimbria'], quaestors: ['sulla'] },
  106: { consuls: ['caepio'] },
  105: { consuls: ['rutilius', 'mallius'] },
  104: { consuls: ['marius', 'fimbria'], praetors: ['memmius'], quaestors: ['saturninus'] },
  103: { consuls: ['marius'], tribunes: ['saturninus'] },
  102: { consuls: ['marius', 'catulus'], praetors: ['antonius'] },
  101: { consuls: ['marius'], tribunes: ['glaucia'] },
  100: { consuls: ['marius'], tribunes: ['saturninus'], praetors: ['glaucia'] },
};

/** Historical governorships worth seeding (extortion trials grew out of exactly these). */
export const HISTORICAL_GOVERNORS = [
  { who: 'aquillius', province: 'asia', departBC: 129, returnBC: 126, greed: 0.85 },
  { who: 'orestes', province: 'sardinia', departBC: 126, returnBC: 123, greed: 0.5 },
];

export interface CampaignDef {
  id: string;
  label: string;
  years: [number, number]; // BC inclusive (from, to)
  commander: string; // historical key or role
  risk: number; // chance of death over a season
  dignitas: number;
  /** Only while this world flag is set (and `until`, if given, is not). */
  flag?: string;
  until?: string;
}
export const CAMPAIGNS: CampaignDef[] = [
  { id: 'numantia', label: 'the siege of Numantia', years: [133, 133], commander: 'aemilianus', risk: 0.04, dignitas: 5 },
  { id: 'sicily', label: 'the slave war in Sicily', years: [133, 132], commander: 'rupilius', risk: 0.05, dignitas: 4 },
  { id: 'aristonicus', label: 'the war against Aristonicus in Asia', years: [131, 129], commander: 'crassus', risk: 0.06, dignitas: 5 },
  { id: 'illyria', label: 'the campaign against the Iapydes', years: [129, 129], commander: 'tuditanus', risk: 0.04, dignitas: 4 },
  { id: 'sardinia', label: 'the garrison of Sardinia', years: [126, 123], commander: 'orestes', risk: 0.03, dignitas: 3 },
  { id: 'gaul', label: 'the war beyond the Alps', years: [125, 120], commander: 'fulvius', risk: 0.05, dignitas: 5 },
  { id: 'baleares', label: 'the war against the Balearic pirates', years: [123, 122], commander: 'metellus_q', risk: 0.04, dignitas: 4 },
  { id: 'spain', label: 'garrison duty in Spain', years: [133, 100], commander: '', risk: 0.03, dignitas: 3 },
  { id: 'dalmatia', label: 'the war in Dalmatia', years: [119, 118], commander: 'metellus_l', risk: 0.04, dignitas: 4 },
  { id: 'scordisci', label: 'the war with the Scordisci in Macedonia', years: [114, 110], commander: 'minucius', risk: 0.05, dignitas: 4 },
  { id: 'numidia', label: 'the war against Jugurtha', years: [111, 105], commander: '', risk: 0.05, dignitas: 6, flag: 'numidian_war', until: 'jugurtha_captured' },
  { id: 'cimbri', label: 'the war against the Cimbri and Teutones', years: [105, 101], commander: 'marius', risk: 0.06, dignitas: 7, flag: 'arausio', until: 'cimbri_beaten' },
];
