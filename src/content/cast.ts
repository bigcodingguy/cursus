// The cast of 133 BC: houses, historical figures, and pools for generated characters.
// Dates are approximate where the sources are. Traits are 0..1; lean is -1 (popularis) .. +1 (optimate).
import type { OfficeId, PlaceId, Rank, Traits } from '../sim/types';

export interface HouseDef {
  id: string;
  name: string;
  nomen: string;
  cognomen?: string;
  patrician: boolean;
  consulAncestors: number;
  praetorAncestors: number;
  home: PlaceId;
  tribe: string;
  lean: number; // family tradition
  /** Generated sons to add, as birth-year ranges (BC). */
  sons: [number, number][];
}

export const HOUSES: HouseDef[] = [
  { id: 'sempronii', name: 'Sempronii Gracchi', nomen: 'Sempronius', cognomen: 'Gracchus', patrician: false, consulAncestors: 3, praetorAncestors: 2, home: 'palatine', tribe: 'Pollia', lean: -0.4, sons: [] },
  { id: 'cornelii', name: 'Cornelii Scipiones', nomen: 'Cornelius', cognomen: 'Scipio', patrician: true, consulAncestors: 9, praetorAncestors: 3, home: 'palatine', tribe: 'Cornelia', lean: 0.5, sons: [[156, 150], [150, 146]] },
  { id: 'caecilii', name: 'Caecilii Metelli', nomen: 'Caecilius', cognomen: 'Metellus', patrician: false, consulAncestors: 4, praetorAncestors: 3, home: 'palatine', tribe: 'Aniensis', lean: 0.6, sons: [] },
  { id: 'claudii', name: 'Claudii Pulchri', nomen: 'Claudius', cognomen: 'Pulcher', patrician: true, consulAncestors: 7, praetorAncestors: 3, home: 'palatine', tribe: 'Palatina', lean: -0.1, sons: [[154, 150]] },
  { id: 'mucii', name: 'Mucii Scaevolae', nomen: 'Mucius', cognomen: 'Scaevola', patrician: false, consulAncestors: 4, praetorAncestors: 2, home: 'carinae', tribe: 'Quirina', lean: -0.1, sons: [] },
  { id: 'calpurnii', name: 'Calpurnii Pisones', nomen: 'Calpurnius', cognomen: 'Piso', patrician: false, consulAncestors: 2, praetorAncestors: 2, home: 'palatine', tribe: 'Menenia', lean: 0.6, sons: [[150, 147]] },
  { id: 'fulvii', name: 'Fulvii Flacci', nomen: 'Fulvius', cognomen: 'Flaccus', patrician: false, consulAncestors: 4, praetorAncestors: 2, home: 'aventine', tribe: 'Pollia', lean: -0.5, sons: [[152, 148]] },
  { id: 'papirii', name: 'Papirii Carbones', nomen: 'Papirius', cognomen: 'Carbo', patrician: false, consulAncestors: 1, praetorAncestors: 2, home: 'carinae', tribe: 'Papiria', lean: -0.3, sons: [] },
  { id: 'aemilii', name: 'Aemilii', nomen: 'Aemilius', patrician: true, consulAncestors: 6, praetorAncestors: 3, home: 'palatine', tribe: 'Palatina', lean: 0.5, sons: [[153, 149]] },
  { id: 'octavii', name: 'Octavii', nomen: 'Octavius', patrician: false, consulAncestors: 1, praetorAncestors: 2, home: 'carinae', tribe: 'Scaptia', lean: 0.5, sons: [[151, 147]] },
  { id: 'popillii', name: 'Popillii Laenates', nomen: 'Popillius', cognomen: 'Laenas', patrician: false, consulAncestors: 4, praetorAncestors: 1, home: 'palatine', tribe: 'Lemonia', lean: 0.8, sons: [[155, 150]] },
  { id: 'licinii', name: 'Licinii Crassi', nomen: 'Licinius', cognomen: 'Crassus', patrician: false, consulAncestors: 3, praetorAncestors: 2, home: 'palatine', tribe: 'Maecia', lean: 0.0, sons: [[158, 153], [149, 145]] },
  { id: 'aurelii', name: 'Aurelii', nomen: 'Aurelius', patrician: false, consulAncestors: 2, praetorAncestors: 2, home: 'carinae', tribe: 'Aemilia', lean: 0.4, sons: [[152, 148]] },
  { id: 'fabii', name: 'Fabii Maximi', nomen: 'Fabius', cognomen: 'Maximus', patrician: true, consulAncestors: 8, praetorAncestors: 2, home: 'palatine', tribe: 'Fabia', lean: 0.5, sons: [] },
];

export interface HistoricalDef {
  key: string;
  praenomen: string;
  nomen: string;
  cognomen?: string;
  house?: string; // HouseDef id; otherwise a house of one is created
  bornBC: number;
  female?: boolean;
  rank: Rank;
  lean: number;
  oratory: number;
  law?: number;
  traits?: Partial<Traits>;
  cash?: number;
  income?: number;
  offices?: [OfficeId, number][];
  home?: PlaceId;
  tribe?: string;
  location?: 'rome' | 'abroad' | 'arpinum';
  returnBC?: number; // if abroad: returns early in that year
  father?: string; // key
  consulAncestors?: number;
  patrician?: boolean;
  flags?: Record<string, number>;
  bio: string;
}

export const HISTORICAL: HistoricalDef[] = [
  // The Gracchi and their circle
  { key: 'ti_gracchus', praenomen: 'Tiberius', nomen: 'Sempronius', cognomen: 'Gracchus', house: 'sempronii', bornBC: 163, rank: 'senator', lean: -0.8, oratory: 72, traits: { ambition: 0.9, boldness: 0.9, loyalty: 0.7, sociability: 0.6, greed: 0.1, pride: 0.4 }, offices: [['quaestor', 137]], bio: 'Tribune of the plebs this year. Served at Carthage and in Spain. He means to give the public land back to the poor.' },
  { key: 'c_gracchus', praenomen: 'Gaius', nomen: 'Sempronius', cognomen: 'Gracchus', house: 'sempronii', bornBC: 154, rank: 'eques', lean: -0.85, oratory: 78, traits: { ambition: 0.95, boldness: 0.9, loyalty: 0.8, sociability: 0.5, greed: 0.1, pride: 0.5 }, location: 'abroad', returnBC: 132, bio: "Tiberius's younger brother, serving under Scipio at Numantia. Already the better speaker of the two." },
  { key: 'cornelia', praenomen: '', nomen: 'Cornelia', house: 'sempronii', bornBC: 190, female: true, rank: 'senator', lean: -0.3, oratory: 60, traits: { pride: 0.8, loyalty: 0.9 }, bio: "Daughter of Scipio Africanus, mother of the Gracchi. She refused a king's hand to raise her sons." },
  { key: 'sempronia', praenomen: '', nomen: 'Sempronia', house: 'sempronii', bornBC: 168, female: true, rank: 'senator', lean: -0.2, oratory: 20, bio: 'Sister of the Gracchi and wife of Scipio Aemilianus. The marriage is not a warm one.' },
  { key: 'tuditanus', praenomen: 'Gaius', nomen: 'Sempronius', cognomen: 'Tuditanus', house: 'sempronii', bornBC: 172, rank: 'senator', lean: 0.3, oratory: 55, law: 60, traits: { greed: 0.4 }, offices: [['quaestor', 145], ['praetor', 132]], bio: 'A learned man who writes on the magistracies. Of the other branch of the Sempronii.' },

  // Scipiones and Cornelii
  { key: 'aemilianus', praenomen: 'Publius', nomen: 'Cornelius', cognomen: 'Scipio Aemilianus', house: 'cornelii', bornBC: 185, rank: 'senator', lean: 0.3, oratory: 75, traits: { ambition: 0.6, pride: 0.8, boldness: 0.6, greed: 0.1, loyalty: 0.6, sociability: 0.4 }, offices: [['quaestor', 151], ['consul', 147], ['consul', 134]], location: 'abroad', returnBC: 132, cash: 400000, income: 150000, bio: 'Destroyer of Carthage, now besieging Numantia. The first man in Rome, and he knows it. Brother-in-law and cousin to the Gracchi.' },
  { key: 'nasica', praenomen: 'Publius', nomen: 'Cornelius', cognomen: 'Scipio Nasica Serapio', house: 'cornelii', bornBC: 183, rank: 'senator', lean: 0.95, oratory: 55, traits: { ambition: 0.6, pride: 0.95, boldness: 0.9, greed: 0.5, loyalty: 0.5, sociability: 0.3 }, offices: [['quaestor', 152], ['praetor', 141], ['consul', 138]], cash: 300000, income: 140000, flags: { pontifex: 1 }, bio: 'Pontifex maximus. Rich in public land and no friend of the people, who jeer him in the street.' },
  { key: 'lentulus', praenomen: 'Lucius', nomen: 'Cornelius', cognomen: 'Lentulus', house: 'cornelii', bornBC: 175, rank: 'senator', lean: 0.5, oratory: 40, traits: { greed: 0.6 }, offices: [['quaestor', 148], ['praetor', 136]], bio: 'A Cornelius of the Lentuli. Patient, rich, unremarkable: the kind who becomes consul.' },
  { key: 'cinna', praenomen: 'Lucius', nomen: 'Cornelius', cognomen: 'Cinna', house: 'cornelii', bornBC: 172, rank: 'senator', lean: 0.2, oratory: 40, traits: { greed: 0.5 }, offices: [['quaestor', 144]], bio: 'A Cornelius of the Cinnae, careful in his friendships.' },
  { key: 'nasica_f', praenomen: 'Publius', nomen: 'Cornelius', cognomen: 'Scipio Nasica', house: 'cornelii', bornBC: 157, rank: 'eques', lean: 0.6, oratory: 40, father: 'nasica', bio: "The pontifex's son. Witty, idle, and well connected." },

  // Metelli
  { key: 'macedonicus', praenomen: 'Quintus', nomen: 'Caecilius', cognomen: 'Metellus Macedonicus', house: 'caecilii', bornBC: 188, rank: 'senator', lean: 0.7, oratory: 65, traits: { pride: 0.8, ambition: 0.6, loyalty: 0.6, boldness: 0.6, greed: 0.3, sociability: 0.5 }, offices: [['quaestor', 159], ['praetor', 148], ['consul', 143]], cash: 350000, income: 160000, bio: 'Conqueror of Macedonia, father of four sons he means to make consuls. A bitter rival of Scipio Aemilianus.' },
  { key: 'metellus_q', praenomen: 'Quintus', nomen: 'Caecilius', cognomen: 'Metellus', house: 'caecilii', bornBC: 166, rank: 'senator', lean: 0.6, oratory: 45, father: 'macedonicus', offices: [['quaestor', 139]], bio: "Macedonicus's eldest. Dutiful, rich, expected to rise." },
  { key: 'metellus_l', praenomen: 'Lucius', nomen: 'Caecilius', cognomen: 'Metellus', house: 'caecilii', bornBC: 161, rank: 'eques', lean: 0.6, oratory: 35, father: 'macedonicus', bio: 'A younger son of Macedonicus, who suffers from a sore on his brow he hides under a band.' },
  { key: 'metellus_m', praenomen: 'Marcus', nomen: 'Caecilius', cognomen: 'Metellus', house: 'caecilii', bornBC: 158, rank: 'eques', lean: 0.6, oratory: 30, father: 'macedonicus', bio: 'Third son of Macedonicus.' },
  { key: 'metellus_c', praenomen: 'Gaius', nomen: 'Caecilius', cognomen: 'Metellus Caprarius', house: 'caecilii', bornBC: 155, rank: 'eques', lean: 0.6, oratory: 25, father: 'macedonicus', bio: "Macedonicus's youngest; the 'goat-herd', they call him, for reasons no one will explain." },
  { key: 'numidicus', praenomen: 'Quintus', nomen: 'Caecilius', cognomen: 'Metellus', house: 'caecilii', bornBC: 160, rank: 'eques', lean: 0.85, oratory: 50, traits: { pride: 0.9, greed: 0.1, boldness: 0.6 }, bio: 'A nephew of Macedonicus. Stiff, honest, and unbending.' },

  // Claudii
  { key: 'appius', praenomen: 'Appius', nomen: 'Claudius', cognomen: 'Pulcher', house: 'claudii', bornBC: 186, rank: 'senator', lean: -0.4, oratory: 60, traits: { pride: 0.9, ambition: 0.6, boldness: 0.6, greed: 0.4, loyalty: 0.7, sociability: 0.5 }, offices: [['quaestor', 155], ['praetor', 146], ['consul', 143], ['censor', 136]], cash: 250000, income: 120000, flags: { princeps: 1 }, bio: "Princeps senatus. Tiberius Gracchus's father-in-law, and the weight behind his law." },
  { key: 'claudia', praenomen: '', nomen: 'Claudia', house: 'claudii', bornBC: 152, female: true, rank: 'senator', lean: -0.3, oratory: 10, father: 'appius', bio: 'Daughter of Appius, wife of Tiberius Gracchus.' },

  // Mucii and Licinii
  { key: 'scaevola', praenomen: 'Publius', nomen: 'Mucius', cognomen: 'Scaevola', house: 'mucii', bornBC: 176, rank: 'senator', lean: -0.15, oratory: 60, law: 95, traits: { pride: 0.5, ambition: 0.5, boldness: 0.3, greed: 0.1, loyalty: 0.6, sociability: 0.6 }, offices: [['quaestor', 148], ['praetor', 136]], cash: 150000, income: 90000, bio: 'Consul this year and the best jurist in Rome. He helped draft the land law, and will not shed blood over it.' },
  { key: 'augur', praenomen: 'Quintus', nomen: 'Mucius', cognomen: 'Scaevola', house: 'mucii', bornBC: 159, rank: 'eques', lean: 0.3, oratory: 45, law: 70, traits: { greed: 0.1, sociability: 0.7, loyalty: 0.7 }, bio: 'A cousin of the consul, young for a jurist and already consulted. Takes pupils.' },
  { key: 'crassus', praenomen: 'Publius', nomen: 'Licinius', cognomen: 'Crassus Dives Mucianus', house: 'licinii', bornBC: 180, rank: 'senator', lean: -0.3, oratory: 70, law: 85, traits: { greed: 0.5, pride: 0.6, ambition: 0.7 }, offices: [['quaestor', 150], ['praetor', 134]], cash: 500000, income: 200000, bio: "Brother of the consul Scaevola by birth, adopted by the Licinii. Rich, learned, and Gaius Gracchus's father-in-law to be." },

  // Calpurnii
  { key: 'piso', praenomen: 'Lucius', nomen: 'Calpurnius', cognomen: 'Piso Frugi', house: 'calpurnii', bornBC: 180, rank: 'senator', lean: 0.65, oratory: 55, law: 70, traits: { greed: 0.0, pride: 0.6, loyalty: 0.7, boldness: 0.4 }, offices: [['quaestor', 152], ['praetor', 136]], bio: 'Consul this year. As tribune he founded the court for extortion. Called Frugi, the thrifty, and deserves it.' },

  // Fulvii
  { key: 'fulvius', praenomen: 'Marcus', nomen: 'Fulvius', cognomen: 'Flaccus', house: 'fulvii', bornBC: 170, rank: 'senator', lean: -0.75, oratory: 55, traits: { boldness: 0.9, ambition: 0.8, greed: 0.4, sociability: 0.7, pride: 0.3 }, offices: [['quaestor', 140]], bio: 'Loud, clever, impatient. Friend to the Gracchi and to the Italian allies.' },

  // Papirii
  { key: 'carbo', praenomen: 'Gaius', nomen: 'Papirius', cognomen: 'Carbo', house: 'papirii', bornBC: 164, rank: 'senator', lean: -0.55, oratory: 80, traits: { ambition: 0.9, loyalty: 0.2, boldness: 0.7, greed: 0.5, sociability: 0.6 }, offices: [['quaestor', 137]], bio: 'The finest speaker of his generation, and for sale to whichever side is winning.' },
  { key: 'carbo_cn', praenomen: 'Gnaeus', nomen: 'Papirius', cognomen: 'Carbo', house: 'papirii', bornBC: 156, rank: 'eques', lean: -0.2, oratory: 40, bio: "Carbo's younger brother." },

  // Aemilii
  { key: 'lepidus', praenomen: 'Marcus', nomen: 'Aemilius', cognomen: 'Lepidus', house: 'aemilii', bornBC: 170, rank: 'senator', lean: 0.5, oratory: 50, traits: { greed: 0.5 }, offices: [['quaestor', 143]], bio: 'A patrician Aemilius, handsome and easily flattered.' },
  { key: 'scaurus', praenomen: 'Marcus', nomen: 'Aemilius', cognomen: 'Scaurus', house: 'aemilii', bornBC: 163, rank: 'eques', lean: 0.75, oratory: 62, traits: { ambition: 0.95, greed: 0.6, boldness: 0.7, pride: 0.8, loyalty: 0.3, sociability: 0.6 }, consulAncestors: 0, bio: 'A patrician whose family sank so low his father sold charcoal. He intends to climb back to the top.' },

  // Octavii
  { key: 'octavius', praenomen: 'Marcus', nomen: 'Octavius', house: 'octavii', bornBC: 165, rank: 'senator', lean: 0.55, oratory: 45, traits: { loyalty: 0.6, boldness: 0.5, greed: 0.5 }, offices: [['quaestor', 136]], bio: "Tribune of the plebs. Tiberius's friend, and the man who will veto his law: he holds much public land himself." },
  { key: 'octavius_cn', praenomen: 'Gnaeus', nomen: 'Octavius', house: 'octavii', bornBC: 171, rank: 'senator', lean: 0.4, oratory: 40, offices: [['quaestor', 144]], bio: 'A kinsman of the tribune, moving steadily toward the consulship.' },

  // Popillii
  { key: 'laenas', praenomen: 'Publius', nomen: 'Popillius', cognomen: 'Laenas', house: 'popillii', bornBC: 176, rank: 'senator', lean: 0.9, oratory: 45, traits: { boldness: 0.7, pride: 0.8, greed: 0.4, loyalty: 0.4 }, offices: [['quaestor', 148], ['praetor', 135]], bio: 'Hard and tidy-minded. Will be consul next year.' },

  // Opimii
  { key: 'opimius', praenomen: 'Lucius', nomen: 'Opimius', bornBC: 165, rank: 'senator', lean: 0.9, oratory: 45, traits: { boldness: 0.95, ambition: 0.85, greed: 0.6, pride: 0.6, loyalty: 0.5, sociability: 0.4 }, offices: [['quaestor', 136]], consulAncestors: 1, home: 'palatine', tribe: 'Horatia', bio: "His father was consul once. He hates the Gracchi with a farmer's patience." },

  // Livii
  { key: 'drusus', praenomen: 'Marcus', nomen: 'Livius', cognomen: 'Drusus', bornBC: 160, rank: 'eques', lean: 0.45, oratory: 65, traits: { ambition: 0.7, sociability: 0.8, greed: 0.2 }, consulAncestors: 2, home: 'palatine', tribe: 'Pollia', bio: 'Rich, generous, a polished speaker. The Senate will find a use for him.' },

  // Aurelii, Fabii
  { key: 'orestes', praenomen: 'Lucius', nomen: 'Aurelius', cognomen: 'Orestes', house: 'aurelii', bornBC: 170, rank: 'senator', lean: 0.5, oratory: 40, traits: { greed: 0.5 }, offices: [['quaestor', 142]], bio: 'An Aurelius of the elder line.' },
  { key: 'cotta', praenomen: 'Lucius', nomen: 'Aurelius', cognomen: 'Cotta', house: 'aurelii', bornBC: 165, rank: 'senator', lean: 0.5, oratory: 45, traits: { greed: 0.75 }, offices: [['quaestor', 137]], bio: 'Owes money to half the bankers in the Forum, and is cheerful about it.' },
  { key: 'maximus', praenomen: 'Quintus', nomen: 'Fabius', cognomen: 'Maximus', house: 'fabii', bornBC: 164, rank: 'senator', lean: 0.55, oratory: 45, traits: { pride: 0.8, greed: 0.4 }, offices: [['quaestor', 136]], bio: "Grandson of Aemilius Paullus by adoption into the Fabii. Scipio Aemilianus's nephew." },
  { key: 'eburnus', praenomen: 'Quintus', nomen: 'Fabius', cognomen: 'Maximus Eburnus', house: 'fabii', bornBC: 158, rank: 'eques', lean: 0.7, oratory: 35, traits: { pride: 0.9 }, bio: 'Called Eburnus for his ivory complexion. A stern man already.' },

  // Men of their own houses (one each)
  { key: 'rupilius', praenomen: 'Publius', nomen: 'Rupilius', bornBC: 178, rank: 'senator', lean: 0.7, oratory: 35, offices: [['quaestor', 150], ['praetor', 135]], consulAncestors: 0, home: 'carinae', tribe: 'Fabia', bio: 'A new man and a friend of Scipio Aemilianus. Once, they say, a contractor for the tax-farmers.' },
  { key: 'flaccus_l', praenomen: 'Lucius', nomen: 'Valerius', cognomen: 'Flaccus', bornBC: 174, rank: 'senator', lean: 0.4, oratory: 40, offices: [['quaestor', 146]], consulAncestors: 4, patrician: true, home: 'palatine', tribe: 'Voltinia', bio: 'A patrician Valerius, flamen of Mars.' },
  { key: 'perperna', praenomen: 'Marcus', nomen: 'Perperna', bornBC: 172, rank: 'senator', lean: 0.4, oratory: 35, traits: { boldness: 0.7 }, offices: [['quaestor', 143]], consulAncestors: 0, home: 'carinae', tribe: 'Arnensis', bio: 'Of Etruscan stock, and touchy about it. A capable soldier.' },
  { key: 'aquillius', praenomen: 'Manius', nomen: 'Aquillius', bornBC: 172, rank: 'senator', lean: 0.5, oratory: 35, traits: { greed: 0.85, boldness: 0.7, pride: 0.5, loyalty: 0.5 }, offices: [['quaestor', 142]], consulAncestors: 0, home: 'carinae', tribe: 'Stellatina', bio: 'Ambitious and grasping. His friends are mostly men who lend money.' },
  { key: 'annius', praenomen: 'Titus', nomen: 'Annius', cognomen: 'Rufus', bornBC: 171, rank: 'senator', lean: 0.8, oratory: 50, offices: [['quaestor', 142]], consulAncestors: 0, home: 'carinae', tribe: 'Papiria', bio: 'He spoke against Tiberius in the Senate and will say so to anyone.' },
  { key: 'ravilla', praenomen: 'Lucius', nomen: 'Cassius', cognomen: 'Longinus Ravilla', bornBC: 172, rank: 'senator', lean: 0.0, oratory: 55, law: 75, traits: { greed: 0.0, pride: 0.7, loyalty: 0.5 }, offices: [['quaestor', 143]], consulAncestors: 1, home: 'carinae', tribe: 'Clustumina', bio: "The severest judge in Rome. His question for every case: 'Cui bono?' — who profited?" },
  { key: 'hypsaeus', praenomen: 'Marcus', nomen: 'Plautius', cognomen: 'Hypsaeus', bornBC: 168, rank: 'senator', lean: 0.3, oratory: 30, offices: [['quaestor', 140]], consulAncestors: 1, home: 'carinae', tribe: 'Aniensis', bio: 'A careful, forgettable man.' },
  { key: 'longinus', praenomen: 'Gaius', nomen: 'Cassius', cognomen: 'Longinus', bornBC: 167, rank: 'senator', lean: 0.4, oratory: 35, offices: [['quaestor', 139]], consulAncestors: 1, home: 'carinae', tribe: 'Clustumina', bio: 'A Cassius of the lesser line.' },
  { key: 'calvinus', praenomen: 'Gaius', nomen: 'Sextius', cognomen: 'Calvinus', bornBC: 167, rank: 'senator', lean: 0.5, oratory: 40, traits: { boldness: 0.6 }, offices: [['quaestor', 139]], consulAncestors: 0, home: 'carinae', tribe: 'Teretina', bio: 'A soldier with an eye on Gaul.' },
  { key: 'flamininus', praenomen: 'Titus', nomen: 'Quinctius', cognomen: 'Flamininus', bornBC: 166, rank: 'senator', lean: 0.4, oratory: 30, offices: [['quaestor', 138]], consulAncestors: 2, patrician: true, home: 'palatine', tribe: 'Sergia', bio: "Grandson of the man who declared the Greeks free. Lives on it." },
  { key: 'ahenobarbus', praenomen: 'Gnaeus', nomen: 'Domitius', cognomen: 'Ahenobarbus', bornBC: 165, rank: 'senator', lean: 0.6, oratory: 40, traits: { boldness: 0.8, pride: 0.8, greed: 0.5 }, offices: [['quaestor', 137]], consulAncestors: 2, home: 'palatine', tribe: 'Fabia', bio: 'Red-bearded, proud, and quick to anger.' },
  { key: 'fannius', praenomen: 'Gaius', nomen: 'Fannius', bornBC: 163, rank: 'eques', lean: 0.0, oratory: 55, traits: { loyalty: 0.3, ambition: 0.7 }, consulAncestors: 1, home: 'carinae', tribe: 'Pollia', bio: 'A friend of the Gracchi, for now. Writes history in his spare hours.' },
  { key: 'manilius', praenomen: 'Publius', nomen: 'Manilius', bornBC: 162, rank: 'eques', lean: 0.3, oratory: 35, consulAncestors: 1, home: 'carinae', tribe: 'Teretina', bio: 'A Manilius of the jurist family, cautious and correct.' },
  { key: 'minucius', praenomen: 'Marcus', nomen: 'Minucius', cognomen: 'Rufus', bornBC: 156, rank: 'eques', lean: 0.7, oratory: 40, consulAncestors: 2, home: 'carinae', tribe: 'Fabia', bio: 'A young Minucius with friends among the boni.' },
  { key: 'rubrius', praenomen: 'Gaius', nomen: 'Rubrius', bornBC: 157, rank: 'plebs', lean: -0.7, oratory: 35, consulAncestors: 0, home: 'aventine', tribe: 'Palatina', bio: 'A plebeian with Gracchan friends and few others.' },
  { key: 'marius', praenomen: 'Gaius', nomen: 'Marius', bornBC: 157, rank: 'eques', lean: -0.2, oratory: 25, traits: { ambition: 1.0, boldness: 0.9, pride: 0.2, greed: 0.4, loyalty: 0.6, sociability: 0.3 }, consulAncestors: 0, home: 'subura', tribe: 'Cornelia', location: 'abroad', returnBC: 132, bio: 'A farmer\'s son from Arpinum, like you, serving at Numantia. Rough, brave, and noticed by Scipio.' },
  // Men who come of age in the 110s and 100s BC
  { key: 'bestia', praenomen: 'Lucius', nomen: 'Calpurnius', cognomen: 'Bestia', house: 'calpurnii', bornBC: 155, rank: 'eques', lean: 0.6, oratory: 40, traits: { greed: 0.85, ambition: 0.7, boldness: 0.5 }, bio: 'A Calpurnius of the lesser branch. Able, energetic, and fond of money.' },
  { key: 'albinus', praenomen: 'Spurius', nomen: 'Postumius', cognomen: 'Albinus', bornBC: 155, rank: 'eques', lean: 0.6, oratory: 35, traits: { greed: 0.6, ambition: 0.8, boldness: 0.4 }, consulAncestors: 4, home: 'palatine', tribe: 'Clustumina', bio: 'Of an old patrician-minded house of consuls. Ambitious; his brother Aulus is not clever.' },
  { key: 'silanus', praenomen: 'Marcus', nomen: 'Iunius', cognomen: 'Silanus', bornBC: 153, rank: 'eques', lean: 0.55, oratory: 35, traits: { boldness: 0.7, greed: 0.5 }, consulAncestors: 2, home: 'palatine', tribe: 'Fabia', bio: 'A Iunius Silanus. Brave, and not a careful general.' },
  { key: 'cassius_l', praenomen: 'Lucius', nomen: 'Cassius', cognomen: 'Longinus', bornBC: 150, rank: 'eques', lean: 0.3, oratory: 35, traits: { boldness: 0.7, greed: 0.3 }, consulAncestors: 1, home: 'carinae', tribe: 'Clustumina', bio: 'A Cassius, honest by the standards of his class.' },
  { key: 'caepio', praenomen: 'Quintus', nomen: 'Servilius', cognomen: 'Caepio', bornBC: 148, rank: 'eques', lean: 0.85, oratory: 45, traits: { pride: 0.95, greed: 0.8, boldness: 0.6, loyalty: 0.3 }, consulAncestors: 3, home: 'palatine', tribe: 'Cornelia', bio: 'Of a proud patrician-minded house of consuls. He despises new men and the equites alike.' },
  { key: 'rutilius', praenomen: 'Publius', nomen: 'Rutilius', cognomen: 'Rufus', bornBC: 158, rank: 'eques', lean: 0.5, oratory: 50, law: 75, traits: { greed: 0.0, pride: 0.7, loyalty: 0.8, sociability: 0.4 }, consulAncestors: 0, home: 'carinae', tribe: 'Menenia', bio: 'A Stoic and a jurist, served at Numantia under Scipio. The most honest man in Rome, and he lets people know it.' },
  { key: 'mallius', praenomen: 'Gnaeus', nomen: 'Mallius', cognomen: 'Maximus', bornBC: 150, rank: 'eques', lean: 0.0, oratory: 30, traits: { ambition: 0.8, boldness: 0.5 }, consulAncestors: 0, home: 'carinae', tribe: 'Sergia', bio: 'A new man, without distinction or connections, they say. Wants the consulship badly.' },
  { key: 'fimbria', praenomen: 'Gaius', nomen: 'Flavius', cognomen: 'Fimbria', bornBC: 150, rank: 'eques', lean: -0.2, oratory: 55, traits: { ambition: 0.8, boldness: 0.7 }, consulAncestors: 0, home: 'subura', tribe: 'Quirina', bio: 'A new man and a hard-hitting advocate.' },
  { key: 'catulus', praenomen: 'Quintus', nomen: 'Lutatius', cognomen: 'Catulus', bornBC: 149, rank: 'eques', lean: 0.7, oratory: 60, traits: { pride: 0.7, sociability: 0.7, greed: 0.2 }, consulAncestors: 1, home: 'palatine', tribe: 'Palatina', bio: 'Cultivated, a writer of verses and memoirs. Has stood for the consulship and will stand again.' },
  { key: 'memmius', praenomen: 'Gaius', nomen: 'Memmius', bornBC: 150, rank: 'eques', lean: -0.6, oratory: 65, traits: { boldness: 0.85, ambition: 0.7, pride: 0.6 }, consulAncestors: 0, home: 'carinae', tribe: 'Menenia', bio: 'A fierce speaker who hates the nobles’ arrogance.' },
  { key: 'mamilius', praenomen: 'Gaius', nomen: 'Mamilius', cognomen: 'Limetanus', bornBC: 150, rank: 'eques', lean: -0.5, oratory: 40, traits: { boldness: 0.6 }, consulAncestors: 0, home: 'carinae', tribe: 'Lemonia', bio: 'Of an old Tusculan family. Ambitious for the tribunate.' },
  { key: 'saturninus', praenomen: 'Lucius', nomen: 'Appuleius', cognomen: 'Saturninus', bornBC: 138, rank: 'eques', lean: -0.9, oratory: 60, traits: { ambition: 0.95, boldness: 1.0, pride: 0.7, loyalty: 0.4, greed: 0.4, sociability: 0.7 }, consulAncestors: 0, home: 'carinae', tribe: 'Palatina', bio: 'A boy now; in time a brilliant, reckless speaker who will make the tribunate a weapon.' },
  { key: 'glaucia', praenomen: 'Gaius', nomen: 'Servilius', cognomen: 'Glaucia', bornBC: 140, rank: 'eques', lean: -0.8, oratory: 55, traits: { ambition: 0.9, boldness: 0.8, sociability: 0.8, greed: 0.6 }, consulAncestors: 0, home: 'subura', tribe: 'Suburana', bio: 'A boy now; in time the wittiest and most shameless man in the Forum.' },
  { key: 'sulla', praenomen: 'Lucius', nomen: 'Cornelius', cognomen: 'Sulla', bornBC: 138, rank: 'eques', lean: 0.7, oratory: 45, traits: { ambition: 0.9, boldness: 0.95, pride: 0.8, greed: 0.5, loyalty: 0.5, sociability: 0.9 }, patrician: true, consulAncestors: 1, home: 'subura', tribe: 'Cornelia', bio: 'A boy of a patrician house fallen into poverty. Red-gold hair, pale eyes, a blotched face.' },
  { key: 'crassus_o', praenomen: 'Lucius', nomen: 'Licinius', cognomen: 'Crassus', house: 'licinii', bornBC: 140, rank: 'eques', lean: 0.5, oratory: 70, law: 70, traits: { ambition: 0.7, sociability: 0.8, greed: 0.3 }, bio: 'A boy now; he will be the finest orator of his age.' },
  { key: 'antonius', praenomen: 'Marcus', nomen: 'Antonius', bornBC: 143, rank: 'eques', lean: 0.4, oratory: 65, traits: { ambition: 0.8, sociability: 0.7 }, consulAncestors: 0, home: 'carinae', tribe: 'Falerna', bio: 'A boy now; a natural speaker who pretends never to have read a book.' },
  { key: 'jugurtha', praenomen: '', nomen: 'Jugurtha', bornBC: 160, rank: 'eques', lean: 0, oratory: 50, traits: { ambition: 1.0, boldness: 0.9, greed: 0.7, pride: 0.8, loyalty: 0.2, sociability: 0.8 }, location: 'abroad', flags: { foreign: 1 }, home: 'carinae', tribe: 'Palatina', bio: 'Grandson of King Masinissa by a concubine, commanding the Numidian horse at Numantia. Scipio admires him; the young Roman nobles admire him more.' },
];

/** Equestrian financiers and men of business. */
export const MONEYMEN = [
  { key: 'aufidius', praenomen: 'Sextus', nomen: 'Aufidius', cash: 1800000, income: 60000, lean: 0.4, greed: 0.8, bio: "An equestrian banker with a counter by the Basilica Porcia. Your father's chief creditor." },
  { key: 'pinarius', praenomen: 'Titus', nomen: 'Pinarius', cash: 1200000, income: 40000, lean: 0.0, greed: 0.6, bio: 'A banker who lends to young men of promise, at a price.' },
  { key: 'granius', praenomen: 'Quintus', nomen: 'Granius', cash: 900000, income: 30000, lean: -0.3, greed: 0.5, bio: 'Auctioneer and moneylender. Knows the price of everything sold in the Forum.' },
];

/** Plebeians and freedmen of the city; potential clients. */
export const CITY_FOLK: { praenomen: string; nomen: string; cognomen?: string; trade: string; home: PlaceId; lean: number }[] = [
  { praenomen: 'Marcus', nomen: 'Pomponius', trade: 'a fuller in the Subura', home: 'subura', lean: -0.5 },
  { praenomen: 'Lucius', nomen: 'Vibius', trade: 'a baker near the Esquiline gate', home: 'subura', lean: -0.4 },
  { praenomen: 'Gaius', nomen: 'Seius', trade: 'a grain dealer at the river port', home: 'boarium', lean: -0.2 },
  { praenomen: 'Aulus', nomen: 'Furius', cognomen: 'Philo', trade: 'a freedman scribe', home: 'subura', lean: 0.0 },
  { praenomen: 'Publius', nomen: 'Atilius', trade: 'a cattle dealer in the Forum Boarium', home: 'boarium', lean: -0.1 },
  { praenomen: 'Quintus', nomen: 'Mamilius', trade: 'a veteran of the Spanish wars', home: 'aventine', lean: -0.6 },
  { praenomen: 'Decimus', nomen: 'Laetorius', trade: 'a freedman who keeps a cookshop', home: 'aventine', lean: -0.7 },
  { praenomen: 'Spurius', nomen: 'Oppius', trade: 'a builder and contractor', home: 'subura', lean: 0.1 },
  { praenomen: 'Titus', nomen: 'Vettius', trade: 'a dealer in Campanian wine', home: 'boarium', lean: 0.0 },
  { praenomen: 'Gnaeus', nomen: 'Plancius', trade: 'a divisor, who hands out money at elections', home: 'subura', lean: 0.0 },
  { praenomen: 'Lucius', nomen: 'Sergius', trade: 'a freedman who rents rooms', home: 'subura', lean: -0.3 },
  { praenomen: 'Marcus', nomen: 'Fulcinius', trade: 'a small landholder dispossessed by a senator', home: 'aventine', lean: -0.9 },
];

export const PRAENOMINA = ['Gaius', 'Lucius', 'Marcus', 'Publius', 'Quintus', 'Gnaeus', 'Titus', 'Sextus', 'Aulus', 'Decimus', 'Manius', 'Servius', 'Spurius'];
export const PLAYER_NOMINA = ['Gratidius', 'Herennius', 'Fufidius', 'Plotius', 'Vettius', 'Tullius', 'Aufustius'];

/** Families outside the cast who send sons to stand for the quaestorship. */
export const OUTSIDE_NOMINA = [
  'Atilius', 'Baebius', 'Caelius', 'Claudius Marcellus', 'Didius', 'Fabricius', 'Hortensius', 'Junius', 'Lucilius', 'Maenius',
  'Marcius', 'Memmius', 'Naevius', 'Oppius', 'Porcius', 'Postumius', 'Quinctilius', 'Sentius', 'Servilius', 'Sulpicius',
  'Terentius', 'Titinius', 'Valerius', 'Vibius', 'Volumnius', 'Licinius Lucullus', 'Marcius Philippus', 'Junius Silanus', 'Servilius Caepio', 'Porcius Cato',
];
