import type { GameState } from '../../types';

/** How violent politics has become. */
export function violenceLevel(s: GameState): { level: number; label: string } {
  const st = s.crisis.stability;
  if (st >= 65) return { level: 0, label: 'Debate' };
  if (st >= 45) return { level: 1, label: 'Riots' };
  if (st >= 25) return { level: 2, label: 'Political murder' };
  return { level: 3, label: 'Armies' };
}
