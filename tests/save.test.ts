import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { runLifetime } from '../src/sim/bots';
import { deserialize, serialize } from '../src/sim/save';

describe('saves', () => {
  it('a 100 BC save round-trips and four of them (3 slots + autosave) fit comfortably', () => {
    const { state } = runLifetime(10011, 'orator');
    const text = serialize(state);
    const back = serialize(deserialize(text));
    expect(back.length).toBe(text.length);
    expect(JSON.parse(back)).toEqual(JSON.parse(text));
    // Saves are stored gzip-compressed (browser CompressionStream, same format as zlib's gzip).
    const gz = gzipSync(text).length;
    expect(gz * 4).toBeLessThan(2.5 * 1024 * 1024);
    // Even uncompressed, the archive keeps a late-game save well under the old 3–4 MB.
    expect(text.length).toBeLessThan(3 * 1024 * 1024);
  });
});
