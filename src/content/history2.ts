// 120–100 BC: Jugurtha, the Cimbri and Teutones, Marius, Saturninus.
// Pressures ripen (see pressures.ts); these events fire when conditions hold, with a daily hazard. History can diverge:
// a dead man's event does not fire, and the player can carry or block the laws that drive it.
import type { Cond, Effect } from '../sim/dsl';
import type { EventDef } from '../sim/systems/events/api';

const inRome: Cond = { inRome: 'player' };
const senator: Cond = { senator: 'player' };

const KILL_SATURNINUS: Effect[] = [
  { kill: '@saturninus', cause: 'stoned with roof tiles in the Senate house' },
  { kill: '@glaucia', cause: 'dragged from a house and killed' },
  { flag: 'saturninus_dead' },
  { stability: 6, label: 'Order restored by force' },
  { standing: { who: '@marius', kind: 'people', value: -12, label: 'Abandoned Saturninus' } },
  { standing: { who: '@marius', kind: 'boni', value: 5, label: 'Enforced the decree' } },
];

export const HISTORY_120_100: EventDef[] = [
  // ---------------- Numidia ----------------
  {
    id: 'micipsa_dies',
    title: 'Death of a king',
    when: { after: [118, 3, 1] },
    hazard: 0.01,
    text: '',
    immediate: [
      { flag: 'numidia_split' }, { pressure: 'numidia', add: 15 },
      { log: 'Micipsa, king of Numidia and friend of the Roman people, is dead. He leaves the kingdom jointly to his sons Adherbal and Hiempsal and his adopted nephew Jugurtha.' },
      { news: 'Within weeks of the old king’s death, they say, Jugurtha has had young Hiempsal murdered in his bed.', truth: 'true', delay: 25 },
    ],
  },
  {
    id: 'numidia_divided',
    title: 'The Senate’s commission',
    when: { all: [{ flag: 'numidia_split' }, { num: { pressure: 'numidia' }, gte: 25 }, { alive: '@jugurtha' }] },
    hazard: 0.01,
    text: '',
    immediate: [
      { flag: 'numidia_divided' },
      { log: 'Adherbal has fled to Rome. A commission of ten senators under Lucius Opimius divides Numidia between him and Jugurtha. Jugurtha gets the richer, western half.' },
      { news: 'Jugurtha’s agents have been seen at the houses of half the commission, and none of them came away empty-handed.', truth: 'true', delay: 4 },
      { standing: { who: '@opimius', kind: 'dignitas', value: -4, label: 'Said to have taken Numidian gold' } },
    ],
  },
  {
    id: 'cirta',
    title: 'Cirta',
    when: { all: [{ flag: 'numidia_divided' }, { after: [113, 0, 1] }, { num: { pressure: 'numidia' }, gte: 40 }, { alive: '@jugurtha' }] },
    hazard: 0.01,
    player: true,
    text: [
      'Jugurtha has taken Cirta after a long siege. He had Adherbal tortured to death — and with him every Italian in the city, the traders and bankers’ agents who had held the walls.',
      'The equites are in uproar: those were their partners and their money. The Senate has sent embassy after embassy, and Jugurtha has received each one politely and sent it home rich.',
    ],
    immediate: [{ flag: 'cirta' }, { pressure: 'numidia', add: 15 }, { stability: -3, label: 'Italians massacred at Cirta' }],
    choices: [
      { label: 'Say in the Forum that Rome must go to war', effects: [{ standing: { who: 'player', kind: 'people', value: 4, label: 'Demanded war with Jugurtha' } }], text: 'The crowd cheers. Several senators who own Numidian horses look away.' },
      { label: 'Counsel patience', effects: [{ standing: { who: 'player', kind: 'boni', value: 2, label: 'Counseled patience over Numidia' } }, { standing: { who: 'player', kind: 'people', value: -3, label: 'Seemed to excuse Jugurtha' } }], text: 'Men look at you and wonder what he sent you.' },
      { label: 'Keep your own counsel' },
    ],
  },
  {
    id: 'numidian_war',
    title: 'War with Jugurtha',
    when: { all: [{ flag: 'cirta' }, { after: [112, 5, 1] }, { alive: '@jugurtha' }] },
    hazard: 0.02,
    text: '',
    immediate: [
      { flag: 'numidian_war' }, { travel: '@bestia', to: 'abroad', days: 300 }, { travel: '@scaurus', to: 'abroad', days: 200 },
      { log: 'Under pressure from the tribune Memmius and the equites, the Senate declares war on Jugurtha. The consul Calpurnius Bestia sails for Africa, with Aemilius Scaurus on his staff.' },
    ],
  },
  {
    id: 'bestia_peace',
    title: 'A bought peace',
    when: { all: [{ flag: 'numidian_war' }, { after: [111, 3, 1] }, { alive: '@jugurtha' }] },
    hazard: 0.015,
    text: '',
    immediate: [
      { flag: 'bestia_peace' }, { pressure: 'numidia', add: 12 }, { stability: -3, label: 'A war sold for gold' },
      { log: 'After a few easy successes, the consul Bestia grants Jugurtha peace on absurdly mild terms: thirty elephants, some cattle, a little silver.' },
      { news: 'Everyone says it: Jugurtha bought the consul and Scaurus with him.', truth: 'true', delay: 3 },
      { standing: { who: '@bestia', kind: 'people', value: -12, label: 'Sold the peace to Jugurtha' } },
      { standing: { who: '@memmius', kind: 'people', value: 8, label: 'Attacked the bought peace' } },
    ],
  },
  {
    id: 'jugurtha_in_rome',
    title: 'A city for sale',
    when: { all: [{ flag: 'bestia_peace' }, { after: [111, 9, 1] }, { alive: '@jugurtha' }] },
    hazard: 0.02,
    player: true,
    text: [
      'Jugurtha has come to Rome under a safe-conduct, to testify about who took his money. Memmius brought him before the people in the Forum, and then a tribune, Baebius — paid, everyone says — forbade him to speak.',
      'While he was here his men murdered his cousin Massiva, who had a claim to the throne, in the middle of the city. Ordered out of Italy, the king looked back from the road, they say, and said: “A city for sale, and soon to perish, if it finds a buyer.”',
    ],
    immediate: [{ flag: 'jugurtha_in_rome' }, { pressure: 'numidia', add: 8 }, { stability: -4, label: 'Murder in Rome under safe-conduct' }, { flag: 'numidian_war' }],
    choices: [{ label: 'Remember the words' }],
  },
  {
    id: 'suthul',
    title: 'Under the yoke',
    when: { all: [{ flag: 'jugurtha_in_rome' }, { after: [110, 11, 1] }, { noFlag: 'metellus_africa' }, { alive: '@jugurtha' }] },
    hazard: 0.03,
    text: '',
    immediate: [
      { flag: 'suthul' }, { pressure: 'numidia', add: 15 }, { stability: -4, label: 'A Roman army sent under the yoke' },
      { log: 'At Suthul, Aulus Postumius, left in command by his brother the consul Albinus, is surprised by Jugurtha at night. To save his men he agrees to leave Numidia within ten days and sends his army out under the yoke.' },
      { standing: { who: '@albinus', kind: 'dignitas', value: -15, label: 'His brother’s surrender at Suthul', halfLife: 0 } },
    ],
  },
  {
    id: 'mamilian_verdicts',
    title: 'The Mamilian court',
    text: '',
    immediate: [
      { exile: '@bestia', reason: 'condemned by the Mamilian commission for taking Jugurtha’s money' },
      { exile: '@albinus', reason: 'condemned by the Mamilian commission' },
      { exile: '@opimius', reason: 'condemned by the Mamilian commission for his Numidian dealings' },
      { stability: -3, label: 'The equestrian juries take their revenge' },
      { log: 'The Mamilian court, with equestrian jurors, condemns a consular after a consular. Scaurus, who sat on the court himself, is not touched.' },
    ],
  },
  {
    id: 'metellus_africa',
    title: 'Metellus in Africa',
    when: { all: [{ flag: 'numidian_war' }, { noFlag: 'jugurtha_captured' }, { after: [109, 2, 1] }, { alive: '@numidicus' }, { holds: '@numidicus', office: 'consul' }] },
    hazard: 0.05,
    text: '',
    immediate: [
      { flag: 'metellus_africa' }, { travel: '@numidicus', to: 'abroad', days: 640 }, { travel: '@marius', to: 'abroad', days: 400 }, { travel: '@rutilius', to: 'abroad', days: 400 },
      { log: 'The consul Caecilius Metellus takes over the African war and restores the army’s discipline. Among his legates is a new man from Arpinum, Gaius Marius.' },
      { standing: { who: '@numidicus', kind: 'dignitas', value: 8, label: 'Restored the army in Africa' } },
    ],
  },
  {
    id: 'marius_stands',
    title: 'Time enough',
    when: { all: [{ flag: 'metellus_africa' }, { after: [108, 3, 1] }, { alive: '@marius' }, { noFlag: 'marius_standing' }] },
    hazard: 0.03,
    text: '',
    immediate: [
      { flag: 'marius_standing' }, { travel: '@marius', to: 'rome' },
      { memory: { owner: '@numidicus', about: '@marius', act: 'Deserted my command to stand for consul', weight: -40, halfLife: 0 } },
      { standing: { who: '@marius', kind: 'people', value: 12, label: 'The soldiers’ candidate' } },
      { log: 'Marius asked his commander for leave to go to Rome and stand for the consulship. Metellus told him there would be time enough when Metellus’s own son — a boy of twenty — was old enough to stand with him. Marius went anyway.' },
      { news: 'Letters from the army in Africa all say the same: Metellus is dragging the war out for glory, and Marius would end it in a season.', truth: 'unconfirmed', delay: 2 },
    ],
  },
  {
    id: 'capite_censi',
    title: 'The head count',
    when: { all: [{ holds: '@marius', office: 'consul' }, { flag: 'numidian_war' }, { noFlag: 'capite_censi' }] },
    hazard: 0.03,
    player: true,
    text: [
      'The consul Marius is raising his army, and he is not waiting for the old levy. He is enlisting volunteers from the head count — men with no property at all, who have never before been allowed to serve.',
      'They will be paid, armed and fed by the state, and at the end of their service they will want land. They will look to their general, not the Senate, to get it for them.',
    ],
    immediate: [{ flag: 'capite_censi' }, { flag: 'marius_africa' }, { travel: '@marius', to: 'abroad', days: 900 }, { travel: '@sulla', to: 'abroad', days: 900 }, { stability: -2, label: 'An army of the landless' }],
    choices: [
      { label: 'It is the end of the old Republic', effects: [{ standing: { who: 'player', kind: 'boni', value: 2, label: 'Opposed the new levy' } }] },
      { label: 'It is the only way to find soldiers', effects: [{ standing: { who: 'player', kind: 'people', value: 2, label: 'Supported the new levy' } }] },
    ],
  },
  {
    id: 'jugurtha_captured',
    title: 'Jugurtha in chains',
    when: { all: [{ flag: 'marius_africa' }, { after: [105, 0, 1] }, { alive: '@jugurtha' }, { noFlag: 'jugurtha_captured' }] },
    hazard: 0.015,
    text: '',
    immediate: [
      { flag: 'jugurtha_captured' }, { kill: '@jugurtha', cause: 'strangled in the Tullianum after Marius’s triumph' },
      { standing: { who: '@marius', kind: 'dignitas', value: 15, label: 'Ended the Jugurthine war', halfLife: 0 } },
      { standing: { who: '@sulla', kind: 'dignitas', value: 8, label: 'Took Jugurtha alive', halfLife: 0 } },
      { memory: { owner: '@marius', about: '@sulla', act: 'Claims the credit for Jugurtha', weight: -20, halfLife: 6000 } },
      { log: 'King Bocchus of Mauretania betrays his son-in-law Jugurtha to Marius’s quaestor, Cornelius Sulla. Sulla has the scene engraved on his signet ring. Marius does not like the ring.' },
    ],
  },

  // ---------------- The north ----------------
  {
    id: 'noreia',
    title: 'Noreia',
    when: { after: [113, 5, 1] },
    hazard: 0.01,
    text: '',
    immediate: [
      { flag: 'cimbri' }, { pressure: 'north', add: 25 }, { stability: -3, label: 'A consular army destroyed' },
      { standing: { who: '@carbo_cn', kind: 'dignitas', value: -15, label: 'Beaten at Noreia', halfLife: 0 } },
      { log: 'A people called the Cimbri, wandering south from the northern ocean with their wagons and women, have destroyed the consul Papirius Carbo’s army at Noreia, beyond the Alps. They did not follow up. No one knows where they will go.' },
    ],
  },
  {
    id: 'silanus_beaten',
    title: 'Silanus beaten',
    when: { all: [{ flag: 'cimbri' }, { after: [109, 5, 1] }, { noFlag: 'cimbri_beaten' }] },
    hazard: 0.01,
    text: '',
    immediate: [{ pressure: 'north', add: 12 }, { stability: -2, label: 'Another army lost in Gaul' }, { standing: { who: '@silanus', kind: 'dignitas', value: -12, label: 'Beaten by the Cimbri' } }, { log: 'The Cimbri have defeated the consul Iunius Silanus in Gaul. They asked the Senate for land to settle on. The Senate refused.' }],
  },
  {
    id: 'cassius_killed',
    title: 'The Tigurini',
    when: { all: [{ flag: 'cimbri' }, { after: [107, 3, 1] }, { noFlag: 'cimbri_beaten' }] },
    hazard: 0.01,
    text: '',
    immediate: [{ kill: '@cassius_l', cause: 'killed fighting the Tigurini in Gaul' }, { pressure: 'north', add: 12 }, { stability: -3, label: 'A consul killed in Gaul' }, { log: 'The Tigurini, allies of the Cimbri, have killed a consul in Gaul and sent his surviving soldiers under the yoke.' }],
  },
  {
    id: 'tolosa',
    title: 'The gold of Tolosa',
    when: { all: [{ flag: 'cimbri' }, { after: [106, 5, 1] }, { alive: '@caepio' }] },
    hazard: 0.01,
    text: '',
    immediate: [
      { money: { who: '@caepio', amount: 1500000, reason: 'the gold of Tolosa' } }, { flag: 'tolosa_gold' },
      { log: 'The consul Servilius Caepio has taken Tolosa and the treasure of its temples — fifteen thousand talents of gold and silver, men say. The convoy sent to Massilia with it was attacked on the road and the gold has vanished.' },
      { news: 'Caepio’s people have been buying land all over Campania. Nobody asks with what.', truth: 'true', delay: 40 },
    ],
  },
  {
    id: 'arausio',
    title: 'Arausio',
    when: { all: [{ flag: 'cimbri' }, { after: [105, 8, 1] }, { num: { pressure: 'north' }, gte: 45 }, { noFlag: 'cimbri_beaten' }] },
    hazard: 0.03,
    player: true,
    text: [
      'At Arausio on the Rhone the proconsul Caepio, who would not take orders from a new man, and the consul Mallius Maximus, who could not give them, fought the Cimbri and Teutones in two separate camps. Both armies have been destroyed.',
      'Eighty thousand dead, they are saying — the worst day since Cannae. Every street in Rome has a house in mourning. The barbarians are on the road to Italy, and there is no army between them and the Alps.',
    ],
    immediate: [
      { flag: 'arausio' }, { pressure: 'north', add: 20 }, { stability: -12, label: 'The disaster at Arausio' },
      { charFlag: '@marius', key: 'iterationAllowed', value: 1 },
      { standing: { who: '@caepio', kind: 'dignitas', value: -30, label: 'Lost an army at Arausio', halfLife: 0 } },
      { standing: { who: '@mallius', kind: 'dignitas', value: -25, label: 'Lost an army at Arausio', halfLife: 0 } },
      { standing: { who: '@marius', kind: 'people', value: 10, label: 'The only general left' } },
    ],
    choices: [
      { label: 'Marius must have the command, law or no law', effects: [{ standing: { who: 'player', kind: 'people', value: 3, label: 'Called for Marius' } }, { memory: { owner: '@marius', about: 'player', act: 'Called for me after Arausio', weight: 12, halfLife: 4000 } }], text: 'The people will elect him consul again, though he is still in Africa and the law says ten years.' },
      { label: 'The laws must hold, even now', effects: [{ standing: { who: 'player', kind: 'boni', value: 3, label: 'Held to the laws after Arausio' } }] },
    ],
  },
  {
    id: 'caepio_condemned',
    title: 'Caepio condemned',
    when: { all: [{ flag: 'arausio' }, { after: [103, 3, 1] }, { alive: '@caepio' }] },
    hazard: 0.01,
    text: '',
    immediate: [{ exile: '@caepio', reason: 'condemned for the loss of the army at Arausio and the gold of Tolosa' }, { stability: -2, label: 'A noble condemned by the people' }],
  },
  {
    id: 'aquae_sextiae',
    title: 'Aquae Sextiae',
    when: { all: [{ flag: 'arausio' }, { after: [102, 5, 1] }, { alive: '@marius' }, { holds: '@marius', office: 'consul' }, { noFlag: 'teutones_beaten' }] },
    hazard: 0.02,
    text: '',
    immediate: [
      { flag: 'teutones_beaten' }, { pressure: 'north', add: -30 }, { stability: 4, label: 'The Teutones destroyed' },
      { standing: { who: '@marius', kind: 'dignitas', value: 15, label: 'Victor at Aquae Sextiae', halfLife: 0 } },
      { log: 'Marius has destroyed the Teutones at Aquae Sextiae in Gaul. The locals will fence their vineyards with the bones.' },
    ],
  },
  {
    id: 'vercellae',
    title: 'Vercellae',
    when: { all: [{ flag: 'teutones_beaten' }, { after: [101, 5, 1] }, { alive: '@marius' }, { noFlag: 'cimbri_beaten' }] },
    hazard: 0.03,
    player: true,
    text: [
      'Marius and Lutatius Catulus have destroyed the Cimbri on the Raudine Plain near Vercellae. The Cimbrian women killed their children and themselves in the wagon-laager rather than be taken.',
      'Rome is safe. Men are calling Marius the third founder of the city, after Romulus and Camillus. Catulus is telling anyone who will listen that the victory was really his.',
    ],
    immediate: [
      { flag: 'cimbri_beaten' }, { stability: 6, label: 'The Cimbri destroyed' },
      { standing: { who: '@marius', kind: 'dignitas', value: 20, label: 'Third founder of Rome', halfLife: 0 } },
      { standing: { who: '@catulus', kind: 'dignitas', value: 8, label: 'Victor at Vercellae', halfLife: 0 } },
      { memory: { owner: '@catulus', about: '@marius', act: 'Stole my victory', weight: -30, halfLife: 0 } },
    ],
    choices: [{ label: 'Go up to the Capitol to give thanks' }],
  },

  // ---------------- Saturninus ----------------
  {
    id: 'numidicus_oath',
    title: 'The oath',
    when: { all: [{ holds: '@saturninus', office: 'tribune_pleb' }, { year: [100, 100] }, { alive: '@numidicus' }, senator, inRome] },
    hazard: 0.02,
    player: true,
    text: [
      'Saturninus’s law for veterans’ colonies carries a clause no law has carried before: within five days every senator must swear to obey it, or be expelled and fined.',
      'Marius said in the Senate he would never swear. Then, on the fifth day, he swore. Metellus Numidicus alone refuses, and is going into exile rather than take the oath.',
    ],
    immediate: [{ exile: '@numidicus', reason: 'refused to swear to Saturninus’s law' }],
    choices: [
      { label: 'Swear the oath', effects: [{ standing: { who: 'player', kind: 'boni', value: -3, label: 'Swore to Saturninus’s law' } }], text: 'You swear, as nearly everyone does, with your fingers crossed in your toga.' },
      { label: 'Refuse, and go into exile with Metellus', effects: [{ standing: { who: 'player', kind: 'boni', value: 15, label: 'Refused the oath', halfLife: 0 } }, { standing: { who: 'player', kind: 'dignitas', value: 8, label: 'Refused the oath', halfLife: 0 } }, { exile: 'player', reason: 'refused to swear to Saturninus’s law' }], text: 'You leave the city with Metellus. Some men think it the noblest thing they have seen.' },
    ],
  },
  {
    id: 'memmius_murdered',
    title: 'Murder at the elections',
    when: { all: [{ year: [100, 100] }, { after: [100, 9, 1] }, { alive: '@saturninus' }, { alive: '@glaucia' }, { holds: '@saturninus', office: 'tribune_pleb' }] },
    hazard: 0.03,
    text: '',
    immediate: [
      { kill: '@memmius', cause: 'clubbed to death at the consular elections' }, { flag: 'memmius_killed' }, { flag: 'scu_100' }, { stability: -12, label: 'A candidate murdered at the elections' },
      { log: 'Gaius Memmius, standing for the consulship against Glaucia, has been clubbed to death on the Campus by Saturninus’s men in full view of the voters. The Senate has passed its last decree and called on the consul Marius to defend the Republic.' },
    ],
  },
  {
    id: 'saturninus_end',
    title: 'The roof of the Senate house',
    when: { all: [{ flag: 'scu_100' }, { alive: '@saturninus' }, inRome] },
    hazard: 0.5,
    player: true,
    text: [
      'Saturninus, Glaucia and their followers have seized the Capitol. Marius, consul for the sixth time, has armed the Senate and the equites, cut the water pipes to the Capitol, and taken their surrender on his own promise of safety. He has locked them in the Senate house for their protection.',
      'Now there are young men of good family up on the roof of the Curia, pulling off the tiles.',
    ],
    choices: [
      { label: 'Join the young men on the roof', effects: [...KILL_SATURNINUS, { standing: { who: 'player', kind: 'boni', value: 8, label: 'On the roof of the Curia' } }, { standing: { who: 'player', kind: 'people', value: -10, label: 'Killed Saturninus’s men', halfLife: 3000 } }], text: 'It takes a long time. The tiles are heavy and the men inside have nowhere to go.' },
      { label: 'Stand at the door and demand the consul’s promise be kept', effects: [...KILL_SATURNINUS, { standing: { who: 'player', kind: 'people', value: 6, label: 'Spoke for the consul’s promise' } }, { standing: { who: 'player', kind: 'boni', value: -6, label: 'Shielded Saturninus' } }], text: 'No one listens. When it is over, you are on several men’s lists of people to remember.' },
      { label: 'Go home', effects: [...KILL_SATURNINUS], text: 'By evening it is over. Marius looks like a man who has lost something.' },
    ],
  },
  {
    id: 'saturninus_end_away',
    title: 'News from Rome',
    when: { all: [{ flag: 'scu_100' }, { alive: '@saturninus' }, { not: { inRome: 'player' } }] },
    hazard: 0.5,
    text: '',
    immediate: [...KILL_SATURNINUS, { log: 'Saturninus and Glaucia have been killed in Rome: stoned with roof tiles in the Senate house after surrendering to Marius.' }],
  },
];
