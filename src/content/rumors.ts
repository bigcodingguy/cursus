// Idle Forum talk. `a` is a senator picked at random; `truth` decides whether the rumor is so.
import type { Cond } from '../sim/dsl';

export const RUMORS: { text: string; truth: Cond; when?: Cond }[] = [
  { text: 'They say {a} is drowning in debt and the bankers have stopped lending to him.', truth: { num: { cash: 'a' }, lte: 0 } },
  { text: 'Word in the Forum is that {a} has turned against the Gracchans.', truth: { num: { lean: 'a' }, gte: 0.4 }, when: { not: { inHouse: 'a', house: 'sempronii' } } },
  { text: '{a} is said to be quietly courting the people. Watch his speeches.', truth: { num: { lean: 'a' }, lte: -0.3 } },
  { text: 'They say {a} took a fortune out of his province and has it buried at his villa.', truth: { charFlag: 'a', key: 'greedy_governor' } },
  { text: 'The story at the barbers is that {a} beats his slaves for sport. Nobody has seen it.', truth: { charFlag: 'a', key: 'cruel' } },
  { text: 'People say {a} will be consul within three years. People say a great deal.', truth: { num: { standing: ['a', 'dignitas'] }, gte: 55 } },
];
