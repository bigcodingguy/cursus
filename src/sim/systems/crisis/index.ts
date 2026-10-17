// Crisis clock: long pressures (the land question, the allies) and the Republic's stability.

import { PRESSURES, STABILITY } from '../../../content/pressures';
import { evalNum } from '../../dsl';
import { on } from '../../bus';
import type { SystemDef } from '../../core';
import { clamp } from '../../util';

export const crisis: SystemDef = {
  id: 'crisis',
  register() {
    on('pressure', (s, e) => {
      s.crisis.pressures[e.id] = clamp((s.crisis.pressures[e.id] ?? 0) + e.add, 0, 100);
    });
    on('stability', (s, e) => {
      s.crisis.stability = clamp(s.crisis.stability + e.add, 0, 100);
    });
  },
  init(s) {
    for (const p of PRESSURES) s.crisis.pressures[p.id] = p.start;
    s.crisis.stability = STABILITY.start;
  },
  monthly(s) {
    const sc = { roles: {}, vars: {} };
    for (const p of PRESSURES) {
      const d = evalNum(s, p.drift, sc).total;
      s.crisis.pressures[p.id] = clamp((s.crisis.pressures[p.id] ?? 0) + d, 0, 100);
    }
    s.crisis.stability = clamp(s.crisis.stability + evalNum(s, STABILITY.drift, sc).total, 0, 100);
    s.crisis.history.push({ day: s.day, stability: Math.round(s.crisis.stability), land: Math.round(s.crisis.pressures.land ?? 0), allies: Math.round(s.crisis.pressures.allies ?? 0) });
  },
};
