// Events: historical pressures that ripen (likely, not scripted) and personal moments.
// Pure data in the condition/effect DSL. See src/sim/dsl and src/sim/systems/events/api.ts.

import type { Cond, Effect } from '../sim/dsl';
import type { EventDef } from '../sim/systems/events/api';

const inRome: Cond = { inRome: 'player' };
const away: Cond = { not: { inRome: 'player' } };

/** The men who follow Nasica up the Capitol: senators in Rome who hate Tiberius and lean to the boni. */
const killerOfTiberius: Cond = { all: [{ senator: 'it' }, { inRome: 'it' }, { num: { lean: 'it' }, gte: 0.45 }, { num: { opinion: ['it', '@ti_gracchus'] }, lte: -15 }] };
const patronAmongKillers: Cond = {
  all: [{ alive: 'patron' }, { senator: 'patron' }, { inRome: 'patron' }, { num: { lean: 'patron' }, gte: 0.45 }, { num: { opinion: ['patron', '@ti_gracchus'] }, lte: -15 }],
};

const KILL_TIBERIUS: Effect[] = [
  { forEach: { select: 'senators', where: killerOfTiberius }, do: [
    { charFlag: 'it', key: 'killed_tiberius' },
    { standing: { who: 'it', kind: 'people', value: -10, label: 'Among the killers of Tiberius Gracchus', halfLife: 2500 } },
    { standing: { who: 'it', kind: 'boni', value: 5, label: 'Saved the Republic from a tyrant' } },
    { memory: { owner: '@c_gracchus', about: 'it', act: 'Killed my brother', weight: -50, halfLife: 0 } },
    { memory: { owner: '@cornelia', about: 'it', act: 'Killed my son', weight: -50, halfLife: 0 } },
    { memory: { owner: { select: 'adultMen', where: { num: { lean: 'it' }, lte: -0.4 } }, about: 'it', act: 'Has Tiberius’s blood on his hands', weight: -15, halfLife: 3000 } },
  ] },
  { kill: '@ti_gracchus', cause: 'clubbed to death on the Capitol' },
  { flag: 'tiberius_dead' },
  { stability: -20, label: 'Blood on the Capitol' },
  { pressure: 'land', add: 6 },
  { news: 'Three hundred dead on the Capitol, they say, and the bodies thrown in the Tiber at night. Tiberius among them.', truth: 'true', delay: 0 },
  { news: 'They are saying Tiberius asked for a crown — that he touched his head to call for one.', truth: 'false', delay: 1 },
  { log: 'Tiberius Gracchus and some three hundred of his followers are killed on the Capitol by senators led by Scipio Nasica.' },
];

const KILL_GAIUS: Effect[] = [
  { kill: '@c_gracchus', cause: 'killed in the grove of Furrina, across the Tiber' },
  { kill: '@fulvius', cause: 'killed on the Aventine' },
  { forEach: { select: 'adultMen', where: { all: [{ inHouse: 'it', house: 'fulvii' }, { inRome: 'it' }, { not: { same: ['it', 'player'] } }] } }, do: [{ kill: 'it', cause: 'killed with his father on the Aventine' }] },
  { flag: 'gaius_dead' },
  { stability: -22, label: 'Massacre on the Aventine' },
  { standing: { who: '@opimius', kind: 'boni', value: 12, label: 'Put down Gaius Gracchus' } },
  { standing: { who: '@opimius', kind: 'people', value: -25, label: 'Butcher of the Aventine', halfLife: 3000 } },
  { memory: { owner: { select: 'adultMen', where: { num: { lean: 'it' }, lte: -0.4 } }, about: '@opimius', act: 'Butchered the Gracchans', weight: -30, halfLife: 4000 } },
  { news: 'They say three thousand have been strangled in the prison since the Aventine. Opimius has had a temple of Concord built. Someone wrote beneath its inscription: “a work of discord makes a temple of Concord.”', truth: 'true', delay: 3 },
  { log: 'Gaius Gracchus and Marcus Fulvius Flaccus are killed after the consul Opimius arms the Senate’s supporters under its first emergency decree.' },
];

export const EVENTS: EventDef[] = [
  // ---------------------------------------------------------------- opening
  {
    id: 'intro',
    title: 'Rome, the Kalends of March',
    player: true,
    text: [
      'You came down the Via Latina with two slaves, a mule, and your father’s letters. Arpinum is three days behind you; ahead is the city, louder and dirtier than anyone said.',
      'Your father has rented you a narrow house in the Carinae and paid a year ahead. His letters of introduction will open three doors. A young man without a patron is nobody in Rome. Whose morning salutatio will you attend?',
      'This year the tribune Tiberius Gracchus has put a bill to the people to share out the public land the rich have occupied. The city talks of nothing else.',
    ],
    choices: [
      { label: 'Scipio Nasica, the pontifex maximus — the old order, and the old money', effects: [{ setPatron: ['player', '@nasica'] }, { memory: { owner: '@nasica', about: 'player', act: 'Brought a letter from a friend', weight: 10, halfLife: 900 } }], text: 'Nasica’s steward reads the letter, and you are told to come back at dawn with the others.' },
      { label: 'Publius Mucius Scaevola, the consul and jurist — law, and a cool head', effects: [{ setPatron: ['player', '@scaevola'] }, { memory: { owner: '@scaevola', about: 'player', act: 'Brought a letter from a friend', weight: 10, halfLife: 900 } }], text: 'Scaevola reads the letter himself and asks what you have read. He seems content with the answer.' },
      { label: 'Appius Claudius, the princeps senatus — behind Tiberius and his law', effects: [{ setPatron: ['player', '@appius'] }, { memory: { owner: '@appius', about: 'player', act: 'Brought a letter from a friend', weight: 10, halfLife: 900 } }], text: 'Appius looks you over as if you were a horse at auction, and grunts. You will do.' },
      { label: 'Metellus Macedonicus — a triumph, four sons, and enemies of the Scipios', effects: [{ setPatron: ['player', '@macedonicus'] }, { memory: { owner: '@macedonicus', about: 'player', act: 'Brought a letter from a friend', weight: 10, halfLife: 900 } }], text: 'Macedonicus has so many clients at his door that you wait an hour in the street. When he sees you he is warm.' },
      { label: 'None yet. Keep the letters, and look about you first', text: 'You keep the letters in your chest. Rome will still be here tomorrow.' },
    ],
  },
  {
    id: 'service_reminder',
    title: 'The legions',
    player: true,
    when: { all: [inRome, { num: { age: 'player' }, gte: 17 }, { num: { served: 'player' }, lte: 0 }, { after: [132, 1, 15] }] },
    hazard: 0.03,
    cooldown: 365,
    text: 'No man stands for office who has not served. The armies leave each spring; a young man of good family goes as a military tribune, if a commander will have him. You can enlist from the Campus Martius.',
    choices: [{ label: 'Noted' }],
  },

  // ---------------------------------------------------------------- 133: Tiberius
  {
    id: 'octavius_veto',
    title: 'The veto',
    when: { all: [{ after: [133, 2, 20] }, { before: [133, 5, 1] }, { alive: '@ti_gracchus' }, { alive: '@octavius' }] },
    hazard: 0.08,
    player: true,
    text: [
      'The tribes were already lining up in the Forum to vote on the land bill when Marcus Octavius, Tiberius’s colleague and once his friend, stood and forbade it. One tribune’s word stops the whole Republic.',
      'Tiberius answered by suspending every magistrate’s business until the vote is taken. The treasury is sealed. Men are carrying swords under their togas.',
    ],
    immediate: [{ flag: 'octavius_veto' }, { tie: { a: '@ti_gracchus', b: '@octavius', kind: 'inimicus' } }, { stability: -3, label: 'Deadlock over the land bill' }],
    choices: [
      { label: 'Stand in the Forum with the land bill’s supporters', when: inRome, effects: [{ memory: { owner: '@ti_gracchus', about: 'player', act: 'Stood with me in the Forum', weight: 8 } }, { memory: { owner: '@octavius', about: 'player', act: 'Jeered at my veto', weight: -6 } }, { standing: { who: 'player', kind: 'people', value: 3, label: 'Stood with Tiberius' } }, { standing: { who: 'player', kind: 'boni', value: -3, label: 'Stood with Tiberius' } }, { lean: 'player', add: -0.06 }] },
      { label: 'Stand with those who say a tribune’s veto is sacred', when: inRome, effects: [{ memory: { owner: '@octavius', about: 'player', act: 'Defended my veto', weight: 8 } }, { memory: { owner: '@ti_gracchus', about: 'player', act: 'Sided with Octavius', weight: -6 } }, { standing: { who: 'player', kind: 'boni', value: 3, label: 'Defended the veto' } }, { standing: { who: 'player', kind: 'people', value: -2, label: 'Defended the veto' } }, { lean: 'player', add: 0.06 }] },
      { label: 'Keep out of it' },
    ],
  },
  {
    id: 'octavius_deposed',
    title: 'Your tribe is called',
    when: { all: [{ flag: 'octavius_veto' }, { before: [133, 6, 1] }, { alive: '@ti_gracchus' }] },
    hazard: 0.07,
    player: true,
    text: [
      'Tiberius has done what no one has done before: he has asked the tribes to remove Octavius from office. Seventeen tribes have voted yes. One more and it is done.',
      'The Cornelia — your tribe, Arpinum’s tribe — is next to vote. Tiberius embraces Octavius in front of the crowd and begs him to give way. Octavius looks at the ground and says nothing.',
    ],
    immediate: [{ flag: 'octavius_deposed' }, { flag: 'land_commission' }, { pressure: 'land', add: -8 }, { stability: -5, label: 'A tribune deposed' },
      { memory: { owner: '@octavius', about: '@ti_gracchus', act: 'Had me thrown out of office', weight: -40, halfLife: 0 } },
      { memory: { owner: { select: 'senators', where: { num: { lean: 'it' }, gte: 0.3 } }, about: '@ti_gracchus', act: 'Deposed a fellow tribune', weight: -12, halfLife: 3000 } },
      { log: 'The tribes depose Octavius. The land bill passes, and Tiberius, his brother Gaius, and Appius Claudius are named commissioners to divide the land.' },
      { news: 'The land law has passed. Three commissioners will measure every field of public land in Italy.', truth: 'true', delay: 0 }],
    choices: [
      { label: 'Vote to depose him', when: inRome, effects: [{ memory: { owner: '@ti_gracchus', about: 'player', act: 'Voted with me against Octavius', weight: 8 } }, { memory: { owner: '@octavius', about: 'player', act: 'Voted me out of office', weight: -12, halfLife: 3000 } }, { standing: { who: 'player', kind: 'people', value: 3, label: 'Voted for the land law' } }, { standing: { who: 'player', kind: 'boni', value: -4, label: 'Voted to depose a tribune' } }, { lean: 'player', add: -0.08 }], text: 'The Cornelia votes yes. Octavius is dragged down from the benches by Tiberius’s freedmen; a slave who shields him loses an eye.' },
      { label: 'Vote against', when: inRome, effects: [{ memory: { owner: '@octavius', about: 'player', act: 'Voted to keep me in office', weight: 8 } }, { memory: { owner: '@ti_gracchus', about: 'player', act: 'Voted against me', weight: -6 } }, { standing: { who: 'player', kind: 'boni', value: 3, label: 'Voted for the veto' } }, { lean: 'player', add: 0.08 }], text: 'Your vote is one among hundreds. The Cornelia votes yes regardless. Octavius is pulled down from the benches.' },
      { label: 'Abstain', text: 'The Cornelia votes yes without you. Octavius is pulled from the benches; the law passes the same day.' },
    ],
  },
  {
    id: 'pergamum',
    title: 'The king’s will',
    when: { all: [{ flag: 'land_commission' }, { after: [133, 4, 1] }, { alive: '@ti_gracchus' }, { year: [133, 133] }] },
    hazard: 0.05,
    text: 'Attalus of Pergamum is dead, and he has left his kingdom to the Roman people. Tiberius proposes that the king’s treasure stock the new farms — and that the people, not the Senate, decide what becomes of Asia.',
    immediate: [{ flag: 'pergamum' }, { stability: -3, label: 'The Pergamene bequest' },
      { memory: { owner: { select: 'senators', where: { num: { lean: 'it' }, gte: 0.2 } }, about: '@ti_gracchus', act: 'Took the Senate’s business to the people', weight: -10, halfLife: 2500 } },
      { news: 'A Pergamene envoy, Eudemus, brought Tiberius a diadem and a purple robe. Or so Pompeius swears in the Senate.', truth: 'false', delay: 0 },
      { log: 'News of Attalus’s bequest. Tiberius proposes to use the royal treasure for the land commission.' }],
  },
  {
    id: 'tiberius_reelection',
    title: 'A second year',
    when: { all: [{ flag: 'land_commission' }, { after: [133, 5, 10] }, { alive: '@ti_gracchus' }, { year: [133, 133] }] },
    hazard: 0.08,
    player: true,
    text: [
      'Tiberius will stand again for the tribunate. No man has held it twice running. His friends say he must, or he will be prosecuted the day his term ends. His enemies say a man who will not leave office means to be king.',
      'His country voters are at the harvest. The Forum is full of men from the city who are his.',
    ],
    immediate: [{ flag: 'ti_reelection' }, { stability: -4, label: 'Tiberius seeks re-election' }, { news: 'They say Tiberius has been seen with a bodyguard of three thousand.', truth: 'false', delay: 1 }],
    choices: [{ label: 'Rome holds its breath' }],
  },
  {
    id: 'capitol',
    title: 'On the Capitol',
    when: { all: [{ flag: 'ti_reelection' }, { after: [133, 6, 1] }, { before: [133, 7, 16] }, { alive: '@ti_gracchus' }, inRome, { noFlag: 'capitol_done' }] },
    hazard: 0.06,
    player: true,
    roles: { patron: 'player.patron' },
    text: [
      'The tribes have assembled on the Capitol, in front of the temple of Jupiter, to elect the tribunes. You are in the crowd. Tiberius’s men have staves; there has already been pushing at the edges.',
      'Word runs through the crowd: in the Senate, meeting in the temple of Fides, Nasica demanded the consul act against Tiberius. Scaevola refused to kill a citizen without trial. “Then since the consul betrays the state,” Nasica said, “let those who would save the laws follow me.”',
      'Now they are coming: senators with their togas wrapped around their left arms, their slaves carrying clubs and the legs of broken benches. The crowd parts before their rank. Tiberius has put his hand to his head — to signal danger, his friends say. To ask for a crown, someone shouts.',
      { when: { all: [patronAmongKillers, { not: { same: ['patron', '@nasica'] } }] }, text: 'Among them, his toga wrapped around his arm and a bench-leg in his fist, you see your patron, {patron}.' },
      { when: { same: ['patron', '@nasica'] }, text: 'At their head walks your patron, Nasica, the pontifex maximus, his toga drawn over his head as if for a sacrifice.' },
    ],
    immediate: [{ flag: 'capitol_done' }, { if: patronAmongKillers, then: [{ flag: 'moment_capitol_patron' }] }],
    choices: [
      {
        label: 'Stand with Tiberius and his people',
        effects: [{ flag: 'player_gracchan' }, { lean: 'player', add: -0.15 }],
        risk: {
          chance: { base: 0.8, label: 'Getting away from the clubs unhurt', mods: [] },
          success: [...KILL_TIBERIUS, { standing: { who: 'player', kind: 'people', value: 10, label: 'Stood by Tiberius on the Capitol' } }, { standing: { who: 'player', kind: 'boni', value: -10, label: 'Stood by Tiberius on the Capitol' } }, { memory: { owner: '@c_gracchus', about: 'player', act: 'Stood by my brother on the Capitol', weight: 30, halfLife: 0 } }, { memory: { owner: '@cornelia', about: 'player', act: 'Stood by my son', weight: 25, halfLife: 0 } }, { memory: { owner: '@nasica', about: 'player', act: 'Stood with the mob', weight: -15 } }],
          failure: [...KILL_TIBERIUS, { standing: { who: 'player', kind: 'people', value: 10, label: 'Stood by Tiberius on the Capitol' } }, { standing: { who: 'player', kind: 'boni', value: -10, label: 'Stood by Tiberius on the Capitol' } }, { memory: { owner: '@c_gracchus', about: 'player', act: 'Stood by my brother on the Capitol', weight: 30, halfLife: 0 } }, { travel: 'player', to: 'arpinum', days: 45 }],
          successText: 'You stand. The senators come on regardless, and the crowd breaks around you. Tiberius trips on the bodies of men who fell before him; Publius Satureius, his colleague, strikes the first blow with a bench-leg. You get down the Hundred Steps alive, with blood on your tunic that is not yours.',
          failureText: 'You stand, and a slave’s club takes you across the head. You remember nothing more until the litter. Tiberius is dead, they tell you, and three hundred with him. You are carried home to Arpinum to mend.',
        },
      },
      {
        label: 'Go with the senators',
        when: { senator: 'player.patron' },
        effects: [...KILL_TIBERIUS, { flag: 'player_killer' }, { charFlag: 'player', key: 'killed_tiberius' }, { lean: 'player', add: 0.2 }, { standing: { who: 'player', kind: 'boni', value: 10, label: 'Went up the Capitol with Nasica' } }, { standing: { who: 'player', kind: 'people', value: -12, label: 'Among the killers of Tiberius Gracchus', halfLife: 3000 } }, { memory: { owner: '@nasica', about: 'player', act: 'Followed me up the Capitol', weight: 20, halfLife: 3000 } }, { memory: { owner: 'patron', about: 'player', act: 'Stood beside me on the Capitol', weight: 15, halfLife: 3000 } }, { memory: { owner: '@c_gracchus', about: 'player', act: 'Was among my brother’s murderers', weight: -45, halfLife: 0 } }, { memory: { owner: '@cornelia', about: 'player', act: 'Was among my son’s murderers', weight: -40, halfLife: 0 } }],
        text: 'You fall in behind the senators. Nobody stops you. You do not strike anyone, or you tell yourself so afterwards; the crush is too great to know. At the end of it Tiberius Gracchus is dead by the temple doors, and in the evening the bodies go into the Tiber.',
      },
      {
        label: 'Shout for the consul and try to hold the crowd back',
        effects: [{ standing: { who: 'player', kind: 'dignitas', value: 2, label: 'Tried to keep the peace on the Capitol', halfLife: 3000 } }],
        risk: {
          chance: { base: 0.03, label: 'Few will listen to a boy', mods: [{ label: 'Your oratory', add: { mul: [{ oratory: 'player' }, 0.002] } }, { label: 'Favor of the people', add: { mul: [{ standing: ['player', 'people'] }, 0.002] } }], min: 0, max: 1 },
          success: [{ flag: 'tiberius_saved' }, { stability: -6, label: 'A near thing on the Capitol' }, { standing: { who: 'player', kind: 'dignitas', value: 10, label: 'Kept the peace on the Capitol', halfLife: 0 } }, { memory: { owner: '@ti_gracchus', about: 'player', act: 'Saved my life on the Capitol', weight: 40, halfLife: 0 } }, { memory: { owner: '@nasica', about: 'player', act: 'Cheated me on the Capitol', weight: -25, halfLife: 0 } }, { news: 'A young man from Arpinum held the steps of the Capitol long enough for Tiberius to get away. Nasica is beside himself.', truth: 'true', delay: 0 }, { log: 'Tiberius Gracchus escapes the senators on the Capitol.' }],
          failure: [...KILL_TIBERIUS],
          successText: 'Somehow they hear you. A line of men links arms across the steps; the senators hesitate, Nasica bellowing, and in that pause Tiberius’s friends hustle him down the far side of the hill. It will not be the last attempt.',
          failureText: 'You shout until you are hoarse. Nobody hears one young man. The senators go through the crowd like a ship through reeds, and Tiberius Gracchus dies by the temple doors.',
        },
      },
      { label: 'Get off the hill', effects: [...KILL_TIBERIUS], text: 'You go down the Hundred Steps against the press of men coming up. By the time you reach the Forum it is over. That night the bodies are thrown in the Tiber.' },
    ],
  },
  {
    id: 'capitol_away',
    title: 'News from Rome',
    when: { all: [{ flag: 'ti_reelection' }, { after: [133, 6, 1] }, { before: [133, 7, 16] }, { alive: '@ti_gracchus' }, away, { noFlag: 'capitol_done' }] },
    hazard: 0.06,
    text: 'Senators led by Nasica killed Tiberius Gracchus on the Capitol.',
    immediate: [{ flag: 'capitol_done' }, ...KILL_TIBERIUS],
  },
  {
    id: 'popillian_court',
    title: 'The consuls’ court',
    when: { all: [{ flag: 'tiberius_dead' }, { after: [132, 1, 1] }, { year: [132, 132] }, { flag: 'player_gracchan' }, inRome] },
    hazard: 0.05,
    player: true,
    roles: { patron: 'player.patron' },
    text: 'The new consuls, Popillius Laenas and Rupilius, have set up a court to try the friends of Tiberius. Blossius of Cumae has fled; others have been put to death. Your name has been given to them. A lictor is at your door.',
    choices: [
      { label: 'Leave for Arpinum until it blows over', effects: [{ travel: 'player', to: 'arpinum', days: 120 }, { standing: { who: 'player', kind: 'dignitas', value: -2, label: 'Fled the consuls’ court', halfLife: 1500 } }], text: 'You ride south before dawn. Your father says nothing for a day, and then says you were right to come.' },
      {
        label: 'Face the questioning',
        risk: {
          chance: { base: 0.45, label: 'Their mood', mods: [{ label: 'Your knowledge of the law', add: { mul: [{ oratory: 'player' }, 0.004] } }, { label: 'Your patron is one of theirs', when: { num: { lean: 'patron' }, gte: 0.4 }, add: 0.2 }] , min: 0, max: 0.95 },
          success: [{ standing: { who: 'player', kind: 'people', value: 3, label: 'Faced the consuls’ court' } }],
          failure: [{ money: { who: 'player', amount: -8000, reason: 'fine' } }, { standing: { who: 'player', kind: 'boni', value: -10, label: 'Named as a Gracchan' } }, { standing: { who: 'player', kind: 'dignitas', value: -4, label: 'Fined by the consuls’ court', halfLife: 3000 } }],
          successText: 'They ask you who paid you, and who else was there. You give them nothing they can use. Popillius dismisses you with a look that says he will remember your face.',
          failureText: 'You are fined eight thousand sesterces and your name is read out with the others. The boni will not forget it.',
        },
      },
      {
        label: 'Ask your patron, {patron}, to speak for you',
        when: { alive: 'patron' },
        risk: {
          chance: { base: 0.35, label: 'A favor asked', mods: [{ label: 'His regard for you', add: { mul: [{ opinion: ['patron', 'player'] }, 0.008] } }, { label: 'He is one of the boni', when: { num: { lean: 'patron' }, gte: 0.4 }, add: 0.2 }], min: 0, max: 0.95 },
          success: [{ favor: { debtor: 'player', creditor: 'patron', weight: 2, reason: 'Kept me from the consuls’ court' } }],
          failure: [{ memory: { owner: 'patron', about: 'player', act: 'Embarrassed me with the consuls', weight: -10 } }, { money: { who: 'player', amount: -8000, reason: 'fine' } }, { standing: { who: 'player', kind: 'boni', value: -8, label: 'Named as a Gracchan' } }],
          successText: '{patron} has a word with Popillius. Your name is struck off. You owe him for it, and both of you know it.',
          failureText: '{patron} will not risk his name for yours. You are fined eight thousand sesterces.',
        },
      },
    ],
  },
  {
    id: 'nasica_embassy',
    title: 'Nasica leaves Rome',
    when: { all: [{ flag: 'tiberius_dead' }, { after: [132, 2, 1] }, { year: [132, 131] }, { alive: '@nasica' }, { inRome: '@nasica' }] },
    hazard: 0.03,
    text: 'The Senate sends Nasica on an embassy to Asia.',
    immediate: [{ travel: '@nasica', to: 'abroad', days: 2000 }, { flag: 'nasica_abroad' }, { news: 'The Senate has sent Nasica to Asia. The people hoot at him whenever he shows his face; the pontifex maximus cannot even perform the rites outside the city.', truth: 'true', delay: 0 }],
  },
  {
    id: 'nasica_dies',
    title: 'Death at Pergamum',
    when: { all: [{ flag: 'nasica_abroad' }, { alive: '@nasica' }] },
    hazard: 0.006,
    text: 'Nasica has died at Pergamum.',
    immediate: [{ kill: '@nasica', cause: 'died at Pergamum, far from Rome' }, { news: 'Nasica is dead at Pergamum. The city does not mourn him.', truth: 'true', delay: 20 }],
  },
  {
    id: 'aemilianus_rightly',
    title: '“Rightly slain”',
    when: { all: [{ flag: 'tiberius_dead' }, { inRome: '@aemilianus' }, { after: [132, 3, 15] }] },
    hazard: 0.05,
    text: 'Asked in a public meeting what he thought of Tiberius’s death, Scipio Aemilianus said: if he meant to seize the state, he was rightly slain. The crowd shouted him down.',
    immediate: [{ standing: { who: '@aemilianus', kind: 'people', value: -15, label: '“Rightly slain”', halfLife: 3000 } }, { standing: { who: '@aemilianus', kind: 'boni', value: 6, label: '“Rightly slain”' } }, { memory: { owner: '@c_gracchus', about: '@aemilianus', act: 'Said my brother was rightly slain', weight: -30, halfLife: 0 } }, { news: 'Scipio said Tiberius was rightly slain, and when they jeered he told them he had never feared the shouts of armed enemies, and would not fear men whose stepmother was Italy.', truth: 'true', delay: 0 }],
  },
  {
    id: 'carbo_ballot',
    title: 'Carbo’s tribunate',
    when: { all: [{ year: [131, 131] }, { alive: '@carbo' }, { after: [131, 3, 1] }] },
    hazard: 0.02,
    text: 'The tribune Carbo carries a law for secret ballots in the legislative assemblies, and tries to make tribunes re-eligible.',
    immediate: [{ news: 'Carbo has carried the secret ballot for laws. Now he wants tribunes to be able to stand again — so that no one need die as Tiberius did, he says.', truth: 'true', delay: 0 }, { standing: { who: '@carbo', kind: 'people', value: 8, label: 'Ballot law' } }],
  },
  {
    id: 'crassus_killed',
    title: 'Death in Asia',
    when: { all: [{ year: [130, 130] }, { alive: '@crassus' }] },
    hazard: 0.01,
    text: 'Crassus Mucianus is killed in Asia.',
    immediate: [{ kill: '@crassus', cause: 'killed fighting Aristonicus in Asia; he goaded a Thracian into running him through rather than be taken' }, { news: 'Crassus is dead in Asia, taken by Aristonicus’s men near Leucae. They say he struck his captor in the eye with a rod so the man would kill him.', truth: 'true', delay: 15 }],
  },

  // ---------------------------------------------------------------- 129: Scipio
  {
    id: 'scipio_italians',
    title: 'Scipio and the allies',
    when: { all: [{ year: [129, 129] }, { flag: 'land_commission' }, { inRome: '@aemilianus' }] },
    hazard: 0.04,
    player: true,
    text: 'The Italian allies have come to Scipio Aemilianus: the land commissioners are taking land their cities have farmed for generations. Scipio has persuaded the Senate to take the commission’s power to judge disputed land and give it to the consul Tuditanus — who promptly left for a war in Illyria. The commission is stopped dead.',
    immediate: [{ flag: 'commission_curbed' }, { flag: 'scipio_italians' }, { pressure: 'allies', add: -6 }, { pressure: 'land', add: 4 }, { stability: -4, label: 'The commission curbed' },
      { memory: { owner: { select: 'adultMen', where: { num: { lean: 'it' }, lte: -0.4 } }, about: '@aemilianus', act: 'Crippled the land commission', weight: -20, halfLife: 3000 } },
      { standing: { who: '@aemilianus', kind: 'boni', value: 8, label: 'Champion of the allies' } }],
    choices: [
      { label: 'Say publicly that Scipio is right', effects: [{ memory: { owner: '@aemilianus', about: 'player', act: 'Spoke up for me', weight: 10 } }, { memory: { owner: '@c_gracchus', about: 'player', act: 'Sided with Scipio against the commission', weight: -12 } }, { standing: { who: 'player', kind: 'boni', value: 3, label: 'Sided with Scipio' } }, { lean: 'player', add: 0.05 }] },
      { label: 'Say publicly that the commission must go on', effects: [{ memory: { owner: '@c_gracchus', about: 'player', act: 'Defended the commission', weight: 10 } }, { memory: { owner: '@aemilianus', about: 'player', act: 'Spoke against me', weight: -10 } }, { standing: { who: 'player', kind: 'people', value: 3, label: 'Defended the commission' } }, { lean: 'player', add: -0.05 }] },
      { label: 'Say nothing' },
    ],
  },
  {
    id: 'scipio_death',
    title: 'Scipio is dead',
    when: { all: [{ flag: 'scipio_italians' }, { year: [129, 129] }, { alive: '@aemilianus' }, { inRome: '@aemilianus' }] },
    hazard: 0.03,
    player: true,
    text: [
      'Scipio Aemilianus went home from the Senate last night with tablets for a speech on the allies. This morning he was found dead in his bed. There are no wounds. He was fifty-six and in good health.',
      'There will be no inquiry. The Forum is full of names.',
    ],
    immediate: [{ kill: '@aemilianus', cause: 'found dead in his bed, without a mark on him' }, { flag: 'scipio_dead' }, { stability: -6, label: 'The death of Scipio' },
      { news: 'They say his wife Sempronia let the murderers in, and her mother Cornelia planned it.', truth: 'unconfirmed', delay: 0 },
      { news: 'Carbo strangled him. Everyone knows Carbo hated him.', truth: 'unconfirmed', delay: 1 },
      { news: 'Gaius Gracchus was seen near the house that night, they say.', truth: 'false', delay: 2 },
      { news: 'His doctor says his heart simply stopped. Nobody wants to hear it.', truth: 'unconfirmed', delay: 3 }],
    choices: [
      { label: 'Keep your counsel', text: 'You say you do not know. It is the truth, and it makes you no enemies.' },
      { label: 'Repeat what everyone says: the Gracchans did it', effects: [{ standing: { who: 'player', kind: 'boni', value: 3, label: 'Blamed the Gracchans for Scipio' } }, { memory: { owner: '@c_gracchus', about: 'player', act: 'Slandered my family over Scipio', weight: -15 } }, { lean: 'player', add: 0.05 }], text: 'It goes down well at dinner tables on the Palatine.' },
      { label: 'Demand that his death be investigated', effects: [{ standing: { who: 'player', kind: 'boni', value: 2, label: 'Demanded an inquiry into Scipio’s death' } }, { standing: { who: 'player', kind: 'dignitas', value: 1, label: 'Demanded an inquiry into Scipio’s death', halfLife: 1500 } }, { memory: { owner: '@carbo', about: 'player', act: 'Wants me investigated', weight: -12 } }], text: 'Nobody in power wants an inquiry. Your demand is noted, and ignored.' },
    ],
  },

  // ---------------------------------------------------------------- 126-125: the allies
  {
    id: 'fulvius_allies',
    title: 'Citizenship for the allies',
    when: { all: [{ holds: '@fulvius', office: 'consul' }, { after: [125, 1, 1] }] },
    hazard: 0.03,
    text: 'The consul Fulvius Flaccus proposes Roman citizenship for the Italian allies. The Senate packs him off to fight in Gaul before it can come to a vote.',
    immediate: [{ flag: 'fulvius_bill' }, { pressure: 'allies', add: 10 }, { travel: '@fulvius', to: 'abroad', days: 400 }, { news: 'Fulvius’s bill is dead. In the allied towns they are saying Rome will never share.', truth: 'true', delay: 0 }],
  },
  {
    id: 'fregellae',
    title: 'Fregellae',
    when: { all: [{ flag: 'fulvius_bill' }, { year: [125, 124] }] },
    hazard: 0.02,
    player: true,
    text: 'Fregellae, a Latin colony loyal through every war, has risen against Rome. The praetor Lucius Opimius has taken it — by treachery from within, they say — and razed it to the ground.',
    immediate: [{ flag: 'fregellae_destroyed' }, { pressure: 'allies', add: 12 }, { stability: -4, label: 'Fregellae destroyed' }, { standing: { who: '@opimius', kind: 'dignitas', value: 8, label: 'Destroyed Fregellae', halfLife: 0 } }, { standing: { who: '@opimius', kind: 'boni', value: 6, label: 'Destroyed Fregellae' } }],
    choices: [{ label: 'A hard lesson for the allies' }, { label: 'A hard lesson for Rome' }],
  },

  // ---------------------------------------------------------------- 123-121: Gaius
  {
    id: 'gaius_laws',
    title: 'Gaius Gracchus, tribune',
    when: { all: [{ holds: '@c_gracchus', office: 'tribune_pleb' }, { year: [123, 123] }, { after: [123, 0, 20] }] },
    hazard: 0.04,
    player: true,
    text: [
      'Gaius Gracchus is tribune, and he speaks as no one has spoken in the Forum — pacing, shouting, turning his back on the Senate house to address the people. A slave behind him sounds a pitch-pipe when his voice climbs too high.',
      'His first laws: grain for every citizen at a fixed low price, and the taxes of Asia sold at Rome to the equestrian companies. Every interest in Rome now has something to gain from him, or to lose.',
    ],
    immediate: [{ flag: 'gaius_laws' }, { flag: 'land_commission' }, { standing: { who: '@c_gracchus', kind: 'people', value: 20, label: 'The grain law' } }, { stability: -3, label: 'Gaius Gracchus’s laws' }, { pressure: 'land', add: -4 }],
    choices: [
      { label: 'Throw yourself into his cause', effects: [{ memory: { owner: '@c_gracchus', about: 'player', act: 'Worked for my laws', weight: 15 } }, { standing: { who: 'player', kind: 'people', value: 5, label: 'A Gracchan' } }, { standing: { who: 'player', kind: 'boni', value: -5, label: 'A Gracchan' } }, { lean: 'player', add: -0.1 }] },
      { label: 'Join those who mean to stop him', effects: [{ memory: { owner: '@c_gracchus', about: 'player', act: 'Worked against my laws', weight: -12 } }, { memory: { owner: '@opimius', about: 'player', act: 'Stood against Gracchus', weight: 8 } }, { standing: { who: 'player', kind: 'boni', value: 5, label: 'Against Gracchus' } }, { standing: { who: 'player', kind: 'people', value: -4, label: 'Against Gracchus' } }, { lean: 'player', add: 0.1 }] },
      { label: 'Watch and wait' },
    ],
  },
  {
    id: 'jury_law',
    title: 'The courts change hands',
    when: { all: [{ flag: 'gaius_laws' }, { year: [123, 122] }, { alive: '@c_gracchus' }, { noFlag: 'jury_law' }] },
    hazard: 0.02,
    player: true,
    text: [
      'Gaius has carried his law on the courts. From now on the juries of the extortion court will be drawn from the equites, not the Senate — men of business judging the senators who govern the provinces where they do business. Convicted governors will repay double.',
      'Whoever you mean to prosecute or defend, it is equestrian bankers and contractors you must now persuade.',
    ],
    immediate: [{ flag: 'jury_law' }, { law: 'repetundaeJury', value: 'equites' }, { law: 'repetundaeMultiplier', value: 2 },
      { memory: { owner: { select: 'senators', where: { num: { lean: 'it' }, gte: 0.3 } }, about: '@c_gracchus', act: 'Handed the courts to the equites', weight: -15, halfLife: 3000 } },
      { log: 'The extortion court’s juries pass from senators to equites. Restitution is now doubled.' }],
    choices: [{ label: 'Understood' }],
  },
  {
    id: 'junonia',
    title: 'Junonia',
    when: { all: [{ holds: '@c_gracchus', office: 'tribune_pleb' }, { year: [122, 122] }, { after: [122, 1, 1] }] },
    hazard: 0.03,
    text: 'Gaius has gone to Africa to found a colony, Junonia, on the cursed ground of Carthage. In his absence the tribune Livius Drusus, backed by the Senate, outbids him: twelve colonies instead of two, and no rent on the new allotments.',
    immediate: [{ flag: 'junonia' }, { travel: '@c_gracchus', to: 'abroad', days: 70 }, { standing: { who: '@c_gracchus', kind: 'people', value: -10, label: 'Outbid by Drusus' } }, { standing: { who: '@drusus', kind: 'people', value: 10, label: 'Out-promised Gracchus' } }, { news: 'Wolves dug up the boundary stones at Junonia, they say. The augurs are saying the gods do not want a colony on Carthage.', truth: 'unconfirmed', delay: 4 }],
  },
  {
    id: 'antyllius',
    title: 'Blood at the sacrifice',
    when: { all: [{ holds: '@opimius', office: 'consul' }, { flag: 'junonia' }, { alive: '@c_gracchus' }, { after: [121, 1, 15] }] },
    hazard: 0.03,
    player: true,
    text: [
      'The Senate means to repeal the colony at Carthage. At the sacrifice before the assembly, one of Opimius’s attendants, Quintus Antyllius, shoved at Gaius’s men and called them scum. They stabbed him with their writing styluses.',
      'Opimius has had the body carried through the Forum on a bier. The Senate has voted that the consul should see to it that the Republic takes no harm. It has never said such a thing before.',
    ],
    immediate: [{ flag: 'scu' }, { stability: -10, label: 'The Senate’s last decree' }],
    choices: [{ label: 'Then it will come to swords' }],
  },
  {
    id: 'aventine',
    title: 'The Aventine',
    when: { all: [{ flag: 'scu' }, { alive: '@c_gracchus' }, inRome, { noFlag: 'aventine_done' }] },
    hazard: 0.5,
    player: true,
    roles: { patron: 'player.patron' },
    text: [
      'Opimius has summoned the senators and the equites to come armed, each with two slaves. Gaius Gracchus and Fulvius Flaccus have occupied the temple of Diana on the Aventine with their followers. Fulvius has sent his younger son, a boy, with a herald’s staff to ask for terms. Opimius has sent the boy back with orders to bring no more messages.',
      'Opimius has offered the weight of Gaius’s head in gold to whoever brings it.',
    ],
    immediate: [{ flag: 'aventine_done' }],
    choices: [
      { label: 'Arm yourself and answer the consul’s summons', effects: [...KILL_GAIUS, { flag: 'player_aventine_killer' }, { standing: { who: 'player', kind: 'boni', value: 10, label: 'Answered the consul’s summons' } }, { standing: { who: 'player', kind: 'people', value: -12, label: 'Marched on the Aventine', halfLife: 3000 } }, { memory: { owner: '@opimius', about: 'player', act: 'Came armed when I called', weight: 20, halfLife: 3000 } }, { lean: 'player', add: 0.15 }], text: 'There is a little fighting on the slopes, and then Cretan archers, and then it is a hunt. Gaius gets across the river before his slave kills him at his order. Septimuleius, who was once his friend, fills the head with lead before he weighs it.' },
      {
        label: 'Go up the Aventine to stand with Gaius',
        risk: {
          chance: { base: 0.55, label: 'Getting out alive', mods: [{ label: 'Young and quick', when: { num: { age: 'player' }, lte: 32 }, add: 0.1 }] },
          success: [...KILL_GAIUS, { flag: 'player_gracchan' }, { standing: { who: 'player', kind: 'people', value: 12, label: 'Stood with Gaius on the Aventine' } }, { standing: { who: 'player', kind: 'boni', value: -15, label: 'Stood with Gaius on the Aventine' } }, { memory: { owner: '@opimius', about: 'player', act: 'Took up arms against me', weight: -40, halfLife: 0 } }, { lean: 'player', add: -0.15 }],
          failure: [...KILL_GAIUS, { kill: 'player', cause: 'killed on the Aventine with the followers of Gaius Gracchus' }],
          successText: 'When the archers come you go over a garden wall and down through the potteries to the river. Behind you they are killing everyone they catch. Gaius is dead across the Tiber. You live.',
          failureText: 'The archers come first, and then the slaves with clubs.',
        },
      },
      { label: 'Bar your door and wait', effects: [...KILL_GAIUS], text: 'You hear it more than see it: shouting from the south all afternoon, and in the evening carts going to the river.' },
    ],
  },
  {
    id: 'aventine_away',
    title: 'News from Rome',
    when: { all: [{ flag: 'scu' }, { alive: '@c_gracchus' }, away, { noFlag: 'aventine_done' }] },
    hazard: 0.5,
    text: 'Gaius Gracchus killed.',
    immediate: [{ flag: 'aventine_done' }, ...KILL_GAIUS],
  },
  {
    id: 'opimius_tried',
    title: 'Opimius on trial',
    when: { all: [{ flag: 'gaius_dead' }, { year: [120, 120] }, { alive: '@opimius' }, { after: [120, 0, 20] }] },
    hazard: 0.02,
    text: 'Opimius prosecuted for killing citizens without trial.',
    immediate: [{ news: 'The tribune Decius has prosecuted Opimius before the people for killing citizens without trial. His defender is Carbo — Carbo, who was Tiberius’s friend. Opimius says he did what the Senate asked. The people acquit him.', truth: 'true', delay: 0 }, { memory: { owner: { select: 'adultMen', where: { num: { lean: 'it' }, lte: -0.4 } }, about: '@carbo', act: 'Defended Opimius', weight: -25, halfLife: 3000 } }],
  },

  // ---------------------------------------------------------------- courts and money
  {
    id: 'asked_to_defend',
    hook: 'asked_to_defend',
    title: 'A request',
    player: true,
    text: [
      '{defendant} sends a freedman to your house. He is to be tried for extortion in {var:province}; {prosecutor} is prosecuting. He asks you to defend him.',
      'An advocate takes no fee — the law forbids it. But a man you have saved owes you for life.',
    ],
    choices: [
      { label: 'Accept', effects: [{ signal: 'accept_defense' }], text: 'You send word that you will take his case. The trial is set; there are weeks to prepare.' },
      { label: 'Decline', effects: [{ signal: 'decline_defense' }], text: 'You send your regrets. He will find someone else, and he will remember.' },
    ],
  },
  {
    id: 'creditor_warning',
    hook: 'case_opened',
    title: 'A word from the bankers’ stalls',
    when: { all: [{ same: ['prosecutor', 'player'] }, { tie: ['@aufidius', 'defendant'], kind: 'amicus' }, { alive: 'player.father' }, { num: { debtTo: ['player.father', '@aufidius'] }, gte: 1 }] },
    player: true,
    roles: { creditor: '@aufidius', father: 'player.father' },
    vars: { debt: { debtTo: ['player.father', '@aufidius'] } },
    text: [
      '{creditor} stops you outside the Basilica Porcia, smiling, and walks with you a little way.',
      '{defendant} is an old friend of his, he says. A generous man. He would hate to see a promising young man make an enemy like that — or to have to think about the HS {var:debt} your father owes him, which he has always been happy to roll over.',
    ],
    choices: [
      { label: 'Drop the case', effects: [{ signal: 'drop_case' }, { memory: { owner: '@aufidius', about: 'player', act: 'Took my advice', weight: 10 } }], text: 'You let it be known you are withdrawing the charge. {creditor} sends a basket of figs.' },
      {
        label: 'Press on with the prosecution',
        effects: [{ memory: { owner: '@aufidius', about: 'player', act: 'Ignored my warning', weight: -15, halfLife: 2000 } }],
        risk: {
          chance: { base: 0.45, label: 'He may be bluffing', mods: [{ label: 'His regard for you', add: { mul: [{ opinion: ['@aufidius', 'player'] }, 0.006] } }] , min: 0.05, max: 0.95 },
          success: [],
          failure: [{ callLoans: { lender: '@aufidius', borrower: 'player.father' } }, { trigger: 'father_loan_called', delay: 6 }],
          successText: 'You tell him you will see him in court. He laughs, and pats your arm, and lets it go. It seems he was bluffing.',
          failureText: 'You tell him you will see him in court. Within the week a letter comes from Arpinum: {creditor} has called in your father’s loan.',
        },
      },
    ],
  },
  {
    id: 'father_loan_called',
    title: 'A letter from your father',
    player: true,
    roles: { creditor: '@aufidius', father: 'player.father' },
    needs: ['father'],
    vars: { debt: { debtTo: ['player.father', '@aufidius'] } },
    text: 'Your father writes that {creditor} wants his HS {var:debt} within the month. He cannot find it without selling the land. He does not reproach you; he asks what you mean to do.',
    choices: [
      { label: 'Send him everything you have', effects: [{ give: { from: 'player', to: 'father', amount: 'all', reason: 'help for your father' } }, { memory: { owner: 'father', about: 'player', act: 'Sent me all he had', weight: 20 } }], text: 'You send what you have. It may not be enough. Look to the bankers, or to your friends.' },
      { label: 'Go to {creditor} and drop the case after all', effects: [{ signal: 'drop_case' }, { forgiveCall: { lender: '@aufidius', borrower: 'player.father' } }], text: '{creditor} is gracious. The loan is extended. The whole Forum knows why.' },
      { label: 'Tell him to hold on; you will find a way', text: 'You have thirty days. A banker might lend you enough to send to Arpinum.' },
    ],
  },
  {
    id: 'trial_won',
    title: 'Verdict',
    player: true,
    text: 'The jurors drop their tablets in the urn: {var:convict} to condemn, {var:acquit} to absolve. The verdict goes your way. Men you do not know clasp your hand on the way out.',
    choices: [{ label: 'Go home' }],
  },
  {
    id: 'trial_lost',
    title: 'Verdict',
    player: true,
    text: 'The jurors drop their tablets in the urn: {var:convict} to condemn, {var:acquit} to absolve. The verdict goes against you. The crowd is already looking for someone else to watch.',
    choices: [{ label: 'Go home' }],
  },

  // ---------------------------------------------------------------- elections
  {
    id: 'omen',
    title: 'Lightning on the left',
    when: { all: [{ candidate: 'player' }, { num: { election: 'daysLeft' }, lte: 2, gte: 0 }, { num: { election: 'postponements' }, lte: 0 }, { num: { election: 'chance' }, gte: 0.2, lte: 0.85 }] },
    hazard: 0.4,
    player: true,
    roles: {
      rival: { pick: { select: 'adultMen', where: { all: [{ candidate: 'it' }, { not: { same: ['it', 'player'] } }] } }, best: { standing: ['it', 'dignitas'] } },
    },
    needs: ['rival'],
    vars: { gap: { election: 'gap' } },
    text: [
      'A magistrate friendly to {rival} announces that he has been watching the sky and has seen lightning. No assembly may meet. The elections are put off eight days.',
      'You know what this means: {rival}’s friends think you were going to win, or close to it. On the present count you are about {var:gap} votes short in the tribes that would decide it. You have a week.',
    ],
    immediate: [{ postpone: { office: 'quaestor', days: 8, reason: 'a magistrate reported unfavorable omens' } }, { memory: { owner: 'player', about: 'rival', act: 'Had the elections postponed against me', weight: -15, halfLife: 2000 } }],
    choices: [{ label: 'Back to the tribes' }],
  },
  {
    id: 'election_won',
    title: 'Quaestor',
    player: true,
    text: 'The herald reads out the tribes. You carry {var:tribes} of thirty-five with {var:votes} votes. You will be quaestor in {var:year} BC, and after that, a senator. Your father will weep when he hears.',
    choices: [{ label: 'Go and thank the voters' }],
  },
  {
    id: 'election_lost',
    title: 'Repulsa',
    player: true,
    text: 'The herald reads out the tribes. You carry {var:tribes} of thirty-five, with {var:votes} votes. It is not enough. Men who shook your hand last week walk past without seeing you.',
    choices: [{ label: 'There is next year' }],
  },
  {
    id: 'returned_from_service',
    title: 'Home from the army',
    player: true,
    text: 'You are back from {var:campaign}, leaner and browner, with a scar or two and men who will vouch for you. You may now stand for office when you are of age.',
    choices: [{ label: 'Back to the Forum' }],
  },
  {
    id: 'candidacy_open',
    title: 'The elections',
    when: { all: [inRome, { num: { election: 'daysLeft' }, lte: 60 }, { not: { candidate: 'player' } }, { num: { age: 'player' }, gte: 26 }] },
    cooldown: 300,
    player: true,
    text: 'Candidates for the quaestorship may give in their names to the consul on the Campus Martius. You must be twenty-seven in your year of office and have served abroad. The vote is on the 25th of Quintilis. Canvassing done before you declare still counts.',
    choices: [{ label: 'Noted' }],
  },

  // ---------------------------------------------------------------- family
  {
    id: 'father_died',
    hook: 'death',
    title: 'Your father',
    when: { same: ['dead', 'player.father'] },
    player: true,
    text: 'A rider from Arpinum. Your father is dead. You are master of the household now: the olive groves and the mill are yours, and so are his debts.',
    choices: [{ label: 'Mourn him' }],
  },
  {
    id: 'patron_died',
    hook: 'death',
    title: 'Your patron',
    when: { patronOf: ['dead', 'player'] },
    player: true,
    text: '{dead}, your patron, is dead. You will need another.',
    choices: [{ label: 'Noted' }],
  },
];
