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
  tribune_pleb: { id: 'tribune_pleb', label: 'Tribune of the plebs', minAge: 27, dignitas: 6, makesSenator: false },
  aedile: { id: 'aedile', label: 'Aedile', minAge: 36, dignitas: 8, makesSenator: true },
  praetor: { id: 'praetor', label: 'Praetor', minAge: 39, dignitas: 12, makesSenator: true },
  consul: { id: 'consul', label: 'Consul', minAge: 42, dignitas: 18, makesSenator: true },
  censor: { id: 'censor', label: 'Censor', minAge: 45, dignitas: 8, makesSenator: true },
};

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
}
export const PROVINCES: ProvinceDef[] = [
  { id: 'sicilia', label: 'Sicily', fromBC: 227, richness: 1.0 },
  { id: 'sardinia', label: 'Sardinia', fromBC: 227, richness: 0.6 },
  { id: 'hisp_cit', label: 'Nearer Spain', fromBC: 197, richness: 0.8 },
  { id: 'hisp_ult', label: 'Further Spain', fromBC: 197, richness: 0.9 },
  { id: 'macedonia', label: 'Macedonia', fromBC: 146, richness: 1.0 },
  { id: 'africa', label: 'Africa', fromBC: 146, richness: 0.9 },
  { id: 'asia', label: 'Asia', fromBC: 129, richness: 1.8 },
];

export interface FastiYear {
  consuls: string[]; // historical keys
  tribunes?: string[];
  praetors?: string[];
}
/** Historical magistrates. If a man is dead or disgraced, the sim fills the seat from the living. */
export const FASTI: Record<number, FastiYear> = {
  133: { consuls: ['scaevola', 'piso'], tribunes: ['ti_gracchus', 'octavius'] },
  132: { consuls: ['laenas', 'rupilius'] },
  131: { consuls: ['crassus', 'flaccus_l'], tribunes: ['carbo'] },
  130: { consuls: ['lentulus', 'perperna'] },
  129: { consuls: ['tuditanus', 'aquillius'] },
  128: { consuls: ['octavius_cn', 'annius'] },
  127: { consuls: ['cassius', 'cinna'] },
  126: { consuls: ['lepidus', 'orestes'] },
  125: { consuls: ['hypsaeus', 'fulvius'], praetors: ['opimius'] },
  124: { consuls: ['longinus', 'calvinus'] },
  123: { consuls: ['metellus_q', 'flamininus'], tribunes: ['c_gracchus', 'rubrius'] },
  122: { consuls: ['ahenobarbus', 'fannius'], tribunes: ['c_gracchus', 'drusus'] },
  121: { consuls: ['opimius', 'maximus'], tribunes: ['minucius'] },
  120: { consuls: ['manilius', 'carbo'] },
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
}
export const CAMPAIGNS: CampaignDef[] = [
  { id: 'numantia', label: 'the siege of Numantia', years: [133, 133], commander: 'aemilianus', risk: 0.04, dignitas: 5 },
  { id: 'sicily', label: 'the slave war in Sicily', years: [133, 132], commander: 'rupilius', risk: 0.05, dignitas: 4 },
  { id: 'aristonicus', label: 'the war against Aristonicus in Asia', years: [131, 129], commander: 'crassus', risk: 0.06, dignitas: 5 },
  { id: 'illyria', label: 'the campaign against the Iapydes', years: [129, 129], commander: 'tuditanus', risk: 0.04, dignitas: 4 },
  { id: 'sardinia', label: 'the garrison of Sardinia', years: [126, 123], commander: 'orestes', risk: 0.03, dignitas: 3 },
  { id: 'gaul', label: 'the war beyond the Alps', years: [125, 120], commander: 'fulvius', risk: 0.05, dignitas: 5 },
  { id: 'baleares', label: 'the war against the Balearic pirates', years: [123, 122], commander: 'metellus_q', risk: 0.04, dignitas: 4 },
  { id: 'spain', label: 'garrison duty in Spain', years: [133, 120], commander: '', risk: 0.03, dignitas: 3 },
];
