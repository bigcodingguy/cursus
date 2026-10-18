import { on } from '../../bus';
import type { SystemDef } from '../../core';
import { entryValue, standingOf } from './api';

export const standing: SystemDef = {
  id: 'standing',
  register() {
    on('standing', (s, e) => {
      if (!e.value) return;
      // Favor saturates: the more the people (or the boni) love a man, the less each new act moves them.
      let value = e.value;
      if (e.kind !== 'dignitas') {
        const cur = standingOf(s, e.who, e.kind).total;
        value *= value > 0 ? Math.max(0.05, 1 - Math.max(0, cur) / 100) : Math.max(0.05, 1 + Math.min(0, cur) / 100);
      }
      const list = (s.standing.entries[e.who] ??= []);
      const halfLife = e.halfLife ?? (e.kind === 'dignitas' ? 0 : 540);
      const same = list.find((x) => x.kind === e.kind && x.label === e.label && x.halfLife === halfLife && s.day - x.day < 180);
      if (same) {
        same.value = entryValue(same, s.day) + value;
        same.day = s.day;
      } else list.push({ kind: e.kind, label: e.label, value, day: s.day, halfLife });
    });
    on('death', (s, e) => {
      delete s.standing.entries[e.who];
    });
  },
  yearly(s) {
    for (const [id, list] of Object.entries(s.standing.entries)) s.standing.entries[id] = list.filter((x) => Math.abs(entryValue(x, s.day)) >= 0.5);
  },
};
