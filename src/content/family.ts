// Family and dynasty moments.
import type { Cond } from '../sim/dsl';
import type { EventDef } from '../sim/systems/events/api';

const inRome: Cond = { inRome: 'player' };

export const FAMILY_EVENTS: EventDef[] = [
  {
    id: 'succession',
    title: 'The family goes on',
    player: true,
    text: [
      '{dead} is dead, at {var:age}. They carry him out with the masks of his ancestors walking before the bier, and his son speaks the eulogy from the Rostra.',
      'On the tomb by the Appian Way they cut:',
      '{var:elogium}',
      'You are {heir}, {var:heirAge} years old, and head of the house now: its land, its debts, its friends, and its enemies. Men will remember your father in you.',
    ],
    choices: [{ label: 'Take up your father’s place' }],
  },
  {
    id: 'family_consul',
    hook: 'family_consul',
    title: 'A mask in the atrium',
    player: true,
    text: [
      '{consul} is consul. The Fasti will carry the name for as long as Rome stands.',
      { when: { num: { var: 'first' }, gte: 1 }, text: 'No one of your blood ever sat in the curule chair before. Now the house is noble. A wax mask of the consul is made and set up in a cupboard in the atrium, with the titles beneath it. At every family funeral from now on, it will walk.' },
      { when: { num: { var: 'first' }, lte: 0 }, text: 'Another mask goes up in the atrium beside the old ones.' },
    ],
    choices: [{ label: 'Sacrifice to the household gods' }],
  },
  {
    id: 'heir_reminder',
    title: 'Your testament',
    player: true,
    when: { all: [inRome, { num: { age: 'player' }, gte: 30 }] },
    hazard: 0.004,
    text: 'A man with sons should name his heir before the Vestals keep his will. Unless you write otherwise, the eldest inherits everything — the house, the land, the debts and the feuds. You can name a different son, or an adopted one, on your family page.',
    choices: [{ label: 'Noted' }],
  },
  {
    id: 'opp_marriage_offer',
    pool: 'opportunity',
    title: 'A marriage proposed',
    cooldown: 200,
    when: { all: [inRome, { num: { age: 'player' }, gte: 20 }, { not: { exists: 'player.spouse' } }] },
    roles: {
      bride: { pick: { select: 'all', where: { all: [{ female: 'it' }, { num: { age: 'it' }, gte: 15, lte: 24 }, { not: { exists: 'it.spouse' } }, { exists: 'it.father' }, { num: { opinion: ['it.father', 'player'] }, gte: -5 }, { not: { same: ['it.father', 'player'] } }] } }, random: true },
      father: 'bride.father',
    },
    needs: ['bride', 'father'],
    player: true,
    text: '{father} lets it be known through friends that he would not be displeased if you asked for the hand of his daughter {bride}. Her dowry would be generous; his house would be yours to count on.',
    choices: [
      { label: 'Ask for her', effects: [{ marry: ['player', 'bride'] }], text: 'The betrothal is made with a ring and a contract, the wedding in the spring. You have a wife, a dowry, and a father-in-law.' },
      { label: 'Not yet', effects: [{ memory: { owner: 'father', about: 'player', act: 'Passed over my daughter', weight: -6 } }], text: 'You let it pass. He will offer her elsewhere.' },
    ],
  },
  {
    id: 'opp_daughter_suitors',
    pool: 'opportunity',
    title: 'Two suitors for your daughter',
    cooldown: 300,
    when: inRome,
    roles: {
      daughter: { pick: { select: 'all', where: { all: [{ female: 'it' }, { same: ['it.father', 'player'] }, { num: { age: 'it' }, gte: 15, lte: 25 }, { not: { exists: 'it.spouse' } }] } } },
      old: { pick: { select: 'adultMen', inRome: true, where: { all: [{ num: { age: 'it' }, gte: 20, lte: 45 }, { not: { exists: 'it.spouse' } }, { num: { ancestors: 'it' }, gte: 3 }, { not: { same: ['it.father', 'player'] } }] } }, best: { ancestors: 'it' } },
      rising: { pick: { select: 'adultMen', inRome: true, where: { all: [{ num: { age: 'it' }, gte: 20, lte: 45 }, { not: { exists: 'it.spouse' } }, { num: { lean: 'it' }, lte: -0.25 }, { not: { same: ['it.father', 'player'] } }] } }, best: { standing: ['it', 'people'] } },
    },
    needs: ['daughter', 'old', 'rising'],
    player: true,
    text: [
      'Two men have asked for {daughter}.',
      '{old} has the masks of consuls in his atrium and very little money; his house is fading, but its name still opens doors among the boni.',
      '{rising} has no ancestors worth the name, a crowd at his door every morning, and the people’s favor. He is going somewhere, and he is going there fast.',
      'Whichever you choose, the other will take it as an insult.',
    ],
    choices: [
      { label: 'Give her to {old}', effects: [{ marry: ['old', 'daughter'] }, { memory: { owner: 'rising', about: 'player', act: 'Refused me his daughter', weight: -18, halfLife: 3000 } }, { standing: { who: 'player', kind: 'boni', value: 3, label: 'Married a daughter into an old house' } }], text: 'The wedding is old-fashioned and very grand. {rising} does not come.' },
      { label: 'Give her to {rising}', effects: [{ marry: ['rising', 'daughter'] }, { memory: { owner: 'old', about: 'player', act: 'Preferred an upstart to my house', weight: -18, halfLife: 3000 } }, { standing: { who: 'player', kind: 'people', value: 3, label: 'Married a daughter to a man of the people' } }], text: 'Half the Subura comes to the wedding. {old} lets it be known what he thinks of new men who marry their daughters to newer men.' },
      { label: 'Neither, for now', text: 'You put both off. Neither will ask twice.' },
    ],
  },
];
