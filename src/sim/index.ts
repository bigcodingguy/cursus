// Installs the systems in a fixed order. Order matters for determinism.

import { installSystems } from './core';
import { people } from './systems/people';
import { network } from './systems/network';
import { money } from './systems/money';
import { standing } from './systems/standing';
import { offices } from './systems/offices';
import { courts } from './systems/courts';
import { crisis } from './systems/crisis';
import { events } from './systems/events';
import { news } from './systems/news';
import { city } from './systems/city';
import { agents } from './systems/agents';

export function installAll(): void {
  installSystems([people, network, money, standing, offices, courts, crisis, events, news, city, agents]);
}

export { advance, blockedBy, command, tick } from './core';
export { newGame } from './setup';
export { serialize, deserialize } from './save';
