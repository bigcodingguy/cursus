import { migrate, CURRENT_VERSION } from './migrations';
import type { GameState } from './types';

export interface SaveFile {
  version: number;
  seed: number;
  state: GameState;
}

export function serialize(s: GameState): string {
  const file: SaveFile = { version: CURRENT_VERSION, seed: s.seed, state: s };
  return JSON.stringify(file);
}

export function deserialize(text: string): GameState {
  const file = JSON.parse(text) as SaveFile;
  if (typeof file.version !== 'number' || !file.state) throw new Error('Not a Cursus save');
  if (file.version > CURRENT_VERSION) throw new Error('This save is from a newer version of the game');
  const state = migrate(file.state as unknown as Record<string, unknown>, file.version) as unknown as GameState;
  return state;
}
