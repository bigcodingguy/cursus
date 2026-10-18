// The career ladder in office: games, laws, courts, provinces, the censorship, exile and late letters.
import type { EventDef } from '../sim/systems/events/api';

const banker = { pick: { select: 'adultMen' as const, where: { charFlag: 'it', key: 'banker' }, inRome: true }, best: { cash: 'it' } };

export const CAREER_EVENTS: EventDef[] = [
  // ---------------- aedile ----------------
  {
    id: 'aedile_games',
    hook: 'office_start_aedile',
    cooldown: 0,
    title: 'The games',
    player: true,
    roles: { banker },
    text: [
      'As aedile you have the care of the temples, the markets and the streets — and of the games. The treasury gives a little for them. Everyone knows the aedile is expected to give the rest himself, and everyone knows the voters remember who gave them panthers and who gave them a few tired boxers.',
    ],
    choices: [
      { label: 'Keep them modest (HS 50,000)', effects: [{ money: { who: 'player', amount: -50000, reason: 'the aedile’s games' } }, { standing: { who: 'player', kind: 'people', value: 3, label: 'Modest games' } }], text: 'The games are decent and soon forgotten.' },
      { label: 'Give them generously (HS 150,000)', when: { num: { cash: 'player' }, gte: 150000 }, effects: [{ money: { who: 'player', amount: -150000, reason: 'the aedile’s games' } }, { standing: { who: 'player', kind: 'people', value: 9, label: 'Generous games' } }, { standing: { who: 'player', kind: 'dignitas', value: 2, label: 'Generous games', halfLife: 3000 } }], text: 'Five days of races and plays. Men stop you in the street to talk about the chariots.' },
      {
        label: 'Borrow and make them lavish (HS 400,000)',
        when: { exists: 'banker' },
        effects: [
          { lend: { lender: 'banker', borrower: 'player', amount: 350000, months: 24 } },
          { money: { who: 'player', amount: -400000, reason: 'the aedile’s games' } },
          { standing: { who: 'player', kind: 'people', value: 16, label: 'Lavish games' } },
          { standing: { who: 'player', kind: 'dignitas', value: 4, label: 'Lavish games', halfLife: 4000 } },
          { charFlag: 'player', key: 'gamesDebt', value: 1 },
        ],
        text: 'African beasts, Greek actors, a banquet for the tribes. The city will talk about your games for years. {banker} has your bond for HS 350,000 at a heavy rate.',
      },
    ],
  },
  {
    id: 'eques_offer',
    title: 'An offer from the Carinae',
    when: { all: [{ charFlag: 'player', key: 'gamesDebt' }, { inRome: 'player' }, { exists: 'eques' }] },
    hazard: 0.03,
    player: true,
    roles: { eques: { pick: { select: 'adultMen', where: { all: [{ not: { senator: 'it' } }, { num: { cash: 'it' }, gte: 200000 }, { not: { charFlag: 'it', key: 'banker' } }] }, inRome: true }, best: { cash: 'it' } } },
    text: [
      '{eques}, who holds shares in half the tax contracts in Asia, comes to see you without his usual crowd of freedmen. He has heard about your debts. Everyone has.',
      '“I will lend you HS 350,000 without interest, for as long as you like. I ask one thing. Some day there will be a vote that matters to men like me. When it comes, I will send to you, and you will speak and vote as I ask. Just once. I will not tell you now what it is.”',
    ],
    choices: [
      { label: 'Take his money', effects: [{ lend: { lender: 'eques', borrower: 'player', amount: 350000, months: 120, monthlyRate: 0 } }, { charFlag: 'eques', key: 'holdsVoteOf', value: 1 }, { charFlag: 'player', key: 'gamesDebt', value: 0 }, { memory: { owner: 'eques', about: 'player', act: 'Took my offer', weight: 15, halfLife: 5000 } }], text: 'He has the money brought round in the evening, in sealed bags. You owe him one vote, unnamed.' },
      { label: 'Decline politely', effects: [{ charFlag: 'player', key: 'gamesDebt', value: 0 }, { memory: { owner: 'eques', about: 'player', act: 'Refused my offer', weight: -5 } }], text: '“As you like,” he says. “The offer will not come twice.”' },
    ],
  },
  {
    id: 'vote_called',
    title: 'The vote he bought',
    player: true,
    text: [
      '{proposer} has posted {var:law}. Within the hour a freedman of {creditor} is at your door with a short note.',
      '“This is the vote. Speak for it from the Rostra, and stand with it in the Senate.”',
    ],
    choices: [
      { label: 'Keep your word and speak for the bill', effects: [{ signal: 'speak_for_called' }, { charFlag: 'creditor', key: 'holdsVoteOf', value: 0 }, { memory: { owner: 'creditor', about: 'player', act: 'Kept his word to me', weight: 25, halfLife: 6000 } }, { memory: { owner: 'proposer', about: 'player', act: 'Spoke for my law', weight: 10 } }], text: 'You speak for it. Some of your friends look at you oddly afterwards.' },
      { label: 'Refuse him', effects: [{ charFlag: 'creditor', key: 'holdsVoteOf', value: 0 }, { memory: { owner: 'creditor', about: 'player', act: 'Broke his word to me', weight: -45, halfLife: 0 } }, { tie: { a: 'creditor', b: 'player', kind: 'inimicus' } }, { callLoans: { lender: 'creditor', borrower: 'player' } }, { standing: { who: 'player', kind: 'dignitas', value: -3, label: 'Said to have broken his word', halfLife: 2000 } }], text: 'He calls in the loan the same day, and tells everyone why.' },
    ],
  },

  // ---------------- tribune ----------------
  {
    id: 'tribune_start',
    hook: 'office_start_tribune_pleb',
    cooldown: 0,
    title: 'Sacrosanct',
    player: true,
    text: [
      'You are tribune of the plebs. For a year your person is sacred: whoever lays a hand on you is accursed. You can call the plebs to assembly and put laws to them, and with one word — veto, I forbid — you can stop any bill or any act of a magistrate.',
      'So can each of your nine colleagues. Tiberius Gracchus had his colleague deposed for using it, and was dead within the summer.',
      { when: { num: { stability: true }, lte: 45 }, text: 'These are violent years. Sacred or not, tribunes have been beaten to death in the Forum.' },
    ],
    choices: [{ label: 'Go down to the Forum' }],
  },
  {
    id: 'client_veto',
    title: 'Veto',
    player: true,
    text: [
      '{client} rises from the tribunes’ bench, the bench you helped him onto, and says the word in front of the whole assembly: “Veto.” Your bill on {var:law} dies there.',
      'He does not look at you. Afterwards his friends say he had no choice: the men who matter now had told him what it would cost him.',
    ],
    choices: [
      { label: 'Remember it', effects: [{ tie: { a: 'player', b: 'client', kind: 'inimicus' } }, { memory: { owner: 'client', about: 'player', act: 'Broke with me over the veto', weight: -20 } }], text: 'You stop greeting him in the street. Everyone notices.' },
      { label: 'Let it pass', effects: [{ memory: { owner: 'client', about: 'player', act: 'Forgave my veto', weight: 15, halfLife: 3000 } }], text: 'You let him come to the salutatio the next morning as if nothing had happened. He is very attentive.' },
    ],
  },
  {
    id: 'mob_at_door',
    title: 'Men with clubs',
    player: true,
    text: 'There are men in the street outside your house — thirty, forty — with clubs and stones. Someone has paid them, and someone has told them where you live. Your doorkeeper has barred the door.',
    choices: [
      {
        label: 'Go out and face them down',
        risk: {
          chance: { base: 0.9, label: 'Getting through it alive', mods: [{ label: 'Blood in the streets this year', when: { num: { stability: true }, lte: 30 }, add: -0.15 }, { label: 'Your clients around you', when: { num: { standing: ['player', 'people'] }, gte: 30 }, add: 0.05 }] },
          success: [{ standing: { who: 'player', kind: 'dignitas', value: 4, label: 'Faced down a mob', halfLife: 3000 } }],
          failure: [{ kill: 'player', cause: 'beaten to death by a gang outside his house' }],
          successText: 'You walk out in your toga with two slaves and a lamp. They shout, and then they let you pass.',
          failureText: 'The first stone takes you on the temple.',
        },
      },
      { label: 'Leave the city for a month', effects: [{ travel: 'player', to: 'arpinum', days: 30 }, { standing: { who: 'player', kind: 'people', value: -4, label: 'Fled the city' } }], text: 'You leave by the Porta Esquilina before dawn.' },
    ],
  },

  // ---------------- praetor ----------------
  {
    id: 'praetor_start',
    hook: 'office_start_praetor',
    cooldown: 0,
    title: 'The curule chair',
    player: true,
    text: [
      'You are praetor. Six lictors walk before you with the rods. You sit in judgment, and the extortion court is yours to preside over: you will empanel the juries and keep order at every trial this year.',
      'A praetor who wants to can tilt a trial — with the time he allows each side, the witnesses he admits, the jurors he lets the defense reject. Men will ask. Next spring you will be offered a province.',
    ],
    choices: [{ label: 'Take your seat' }],
  },
  {
    id: 'praetor_presides',
    cooldown: 0,
    title: 'Your court',
    player: true,
    text: [
      '{prosecutor} has charged {defendant} with {var:charge}. The trial will come before you.',
      'A friend of {defendant} has been to see you, and so, separately, has a friend of {prosecutor}.',
    ],
    choices: [
      { label: 'Preside fairly', effects: [{ standing: { who: 'player', kind: 'dignitas', value: 1, label: 'A fair praetor', halfLife: 2000 } }], text: 'You give each side its water-clock and no more.' },
      { label: 'Lean toward the defense', effects: [{ signal: 'preside_defense' }], text: 'The defense finds its witnesses heard at length, and the prosecution’s cut short.' },
      { label: 'Lean toward the prosecution', effects: [{ signal: 'preside_prosecution' }], text: 'The prosecution finds you patient, and the defense finds you strict.' },
    ],
  },
  {
    id: 'province_offer',
    title: 'A province',
    player: true,
    text: [
      'The Senate has assigned the provinces. Yours is {var:provinceLabel}, for a year, with the rank of proconsul.',
      'Everyone knows what a province is for. A governor must make three fortunes: one to pay his debts, one to bribe the jury when he is prosecuted, and one to live on. The provincials know it too, and some of them know the way to the extortion court.',
    ],
    choices: [
      { label: 'Govern with a light hand', effects: [{ signal: 'govern_light' }, { standing: { who: 'player', kind: 'dignitas', value: 3, label: 'An honest governor', halfLife: 4000 } }], text: 'You sail with a small staff and a reputation to keep.' },
      { label: 'Govern as most men do', effects: [{ signal: 'govern_usual' }], text: 'You sail with your staff, your friends, and a list of debts.' },
      { label: 'Make your fortune', effects: [{ signal: 'govern_hard' }], text: 'You sail with a large staff, several bankers’ agents, and every intention of coming home rich.' },
      { label: 'Excuse yourself from the province', effects: [{ standing: { who: 'player', kind: 'dignitas', value: -2, label: 'Declined a province', halfLife: 1500 } }], text: 'You plead your health and your affairs. Another man goes.' },
    ],
  },
  {
    id: 'city_gift',
    title: 'A gift',
    when: { all: [{ charFlag: 'player', key: 'governing' }] },
    hazard: 0.006,
    cooldown: 400,
    player: true,
    vars: { amount: 200000 },
    text: [
      'The council of a city in your province comes to you in a body. They have a dispute with their neighbors over a boundary, and a contractor’s claim against them they would like to see thrown out. They have also brought a gift: HS {var:amount}, in coin, for the governor’s expenses.',
      'Take it and your debts vanish. Your successor will hear about it either way, and so, perhaps, will a young man in Rome looking for a famous prosecution.',
    ],
    choices: [
      { label: 'Take the gift', effects: [{ money: { who: 'player', amount: 200000, reason: 'a gift from a provincial city' } }, { signal: 'governor_take' }], text: 'The boundary is settled in their favor.' },
      { label: 'Refuse it', effects: [{ standing: { who: 'player', kind: 'dignitas', value: 3, label: 'Refused a provincial bribe', halfLife: 4000 } }], text: 'They take it home again, puzzled.' },
    ],
  },
  {
    id: 'charges_coming',
    title: 'They are coming for you',
    player: true,
    text: 'Word has reached you that men are looking for a prosecutor to charge you with {var:charge}. Somebody ambitious will take it up. When they do, you will speak in your own defense.',
    choices: [{ label: 'Gather your friends' }],
  },

  // ---------------- consul ----------------
  {
    id: 'consul_start',
    hook: 'office_start_consul',
    cooldown: 0,
    title: 'Consul',
    player: true,
    text: [
      'You are consul. Twelve lictors. The year will carry your name. You preside over the Senate and the elections, you may put laws to the people, and next year you may be given a war.',
      { when: { num: { ancestors: 'player' }, lte: 1 }, text: 'Your house is noble now: your son and his sons will be men of consular family.' },
    ],
    choices: [{ label: 'Take the auspices' }],
  },
  {
    id: 'command_offer',
    title: 'A war',
    player: true,
    text: [
      'The Senate has given you {var:provinceLabel}, with an army and the rank of proconsul.',
      'Your chance of coming home with a victory is about {var:winChance} in a hundred. A victory means a triumph. A defeat means your name in the treason court.',
    ],
    choices: [
      {
        label: 'Take the command',
        risk: {
          chance: { mul: [{ var: 'winChance' }, 0.01] },
          success: [{ signal: 'command_go' }, { charFlag: 'player', key: 'warWon', value: 1 }, { trigger: 'war_report', delay: 330 }],
          failure: [{ signal: 'command_go' }, { charFlag: 'player', key: 'warWon', value: 0 }, { trigger: 'war_report', delay: 330 }],
          successText: 'You leave the city in the red cloak, with the lictors and the eagles. The campaign will decide itself in the field.',
          failureText: 'You leave the city in the red cloak, with the lictors and the eagles. The campaign will decide itself in the field.',
        },
      },
      { label: 'Let a colleague have it', effects: [{ standing: { who: 'player', kind: 'dignitas', value: -3, label: 'Avoided a war', halfLife: 2000 } }], text: 'You stay in Rome. Some men call it prudence.' },
    ],
  },
  {
    id: 'war_report',
    title: 'The end of the campaign',
    player: true,
    text: [
      { when: { charFlag: 'player', key: 'warWon' }, text: 'The enemy is broken. Your soldiers hailed you imperator on the field. The Senate has voted a thanksgiving, and you may ask for a triumph.' },
      { when: { not: { charFlag: 'player', key: 'warWon' } }, text: 'The campaign has gone badly: a camp overrun, a legion cut up in a pass, the enemy loose. Your enemies in Rome have the casualty lists by heart.' },
    ],
    immediate: [
      {
        if: { charFlag: 'player', key: 'warWon' },
        then: [{ standing: { who: 'player', kind: 'dignitas', value: 18, label: 'Hailed imperator', halfLife: 0 } }, { standing: { who: 'player', kind: 'people', value: 8, label: 'A victory' } }, { money: { who: 'player', amount: 400000, reason: 'spoils of war' } }, { if: { flag: 'numidian_war' }, then: [{ flag: 'jugurtha_captured' }, { pressure: 'numidia', add: -40 }], else: [{ flag: 'cimbri_beaten' }, { pressure: 'north', add: -40 }] }],
        else: [{ standing: { who: 'player', kind: 'dignitas', value: -12, label: 'Lost an army', halfLife: 5000 } }, { standing: { who: 'player', kind: 'people', value: -8, label: 'Lost an army' } }, { stability: -3, label: 'A Roman army beaten' }],
      },
    ],
    choices: [{ label: 'Come home' }],
  },

  // ---------------- censor ----------------
  {
    id: 'censor_start',
    hook: 'office_start_censor',
    cooldown: 0,
    title: 'The census',
    player: true,
    roles: {
      enemy: { pick: { select: 'senators', where: { num: { opinion: ['it', 'player'] }, lte: -30 } }, worst: { opinion: ['it', 'player'] } },
      client: { pick: { select: 'adultMen', where: { all: [{ patronOf: ['player', 'it'] }, { not: { senator: 'it' } }] } }, best: { oratory: 'it' } },
    },
    text: [
      'You are censor, the summit of a Roman career. For eighteen months you count the citizens, let the state’s contracts, and revise the roll of the Senate. A mark against a name ends a man’s career, and no one can appeal it.',
    ],
    choices: [
      { label: 'Strike your worst enemy from the roll', when: { exists: 'enemy' }, effects: [{ signal: 'censor_expel' }], text: 'You set a mark against the name of {enemy}: unworthy. He will not forgive it, and nor will his house.' },
      { label: 'Enroll a client of yours in the Senate', when: { exists: 'client' }, effects: [{ signal: 'censor_enroll' }], text: '{client} thanks you with tears in his eyes.' },
      { label: 'Leave the roll as it is', effects: [{ standing: { who: 'player', kind: 'boni', value: 3, label: 'A mild censor' } }], text: 'A quiet census. The old men approve.' },
    ],
  },

  // ---------------- exile and letters ----------------
  {
    id: 'succession_exile',
    title: 'Exile',
    player: true,
    text: [
      '{exile} has gone into exile ({var:reason}). He has taken what he could carry and a few slaves, and gone to Massilia, where many Roman exiles live comfortably enough.',
      'You are {heir}, {var:heirAge}, and the house in Rome is yours to keep up. Men will remember your father in you — and some of them will work for his recall.',
    ],
    choices: [{ label: 'Take up the house' }],
  },
  {
    id: 'letter_death',
    title: 'A letter',
    player: true,
    text: [
      'A letter from {var:from}, stained from the journey. It was written {var:days} days ago.',
      '{dead} is dead: {var:cause}. By now the funeral is long over.',
    ],
    choices: [{ label: 'Write to his family' }],
  },
];
