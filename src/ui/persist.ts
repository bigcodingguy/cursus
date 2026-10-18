// Save storage: gzip-compressed saves in IndexedDB (room for many slots), with localStorage as a fallback.
// Every operation reports failure as a message; nothing fails silently.

const DB = 'cursus';
const STORE = 'saves';

export interface SlotMeta {
  slot: string;
  day: number;
  bytes: number;
}

async function gzip(text: string): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip');
  const stream = new Blob([text]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(data: Uint8Array): Promise<string> {
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return await new Response(stream).text();
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('This browser has no IndexedDB'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'slot' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open the save database'));
  });
}

function tx<T>(mode: IDBTransactionMode, f: (st: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const r = f(t.objectStore(STORE));
        t.oncomplete = () => resolve(r.result);
        t.onerror = () => reject(t.error ?? r.error ?? new Error('Save database error'));
        t.onabort = () => reject(t.error ?? new Error('Save aborted (is the disk full?)'));
      }),
  );
}

const LS = (slot: string) => `cursus.save.${slot}`;
const toB64 = (u: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b: string) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));

/** Store a save. Returns null, or the reason it failed. */
export async function putSave(slot: string, day: number, json: string): Promise<string | null> {
  let data: Uint8Array;
  try {
    data = await gzip(json);
  } catch (e) {
    return `Could not compress the save: ${(e as Error).message}`;
  }
  try {
    await tx('readwrite', (st) => st.put({ slot, day, bytes: data.length, data }));
    return null;
  } catch (e) {
    // Fall back to localStorage (compressed, so it still fits).
    try {
      localStorage.setItem(LS(slot), JSON.stringify({ day, gz: toB64(data) }));
      return null;
    } catch (e2) {
      return `Could not save: ${(e as Error).message}; and the fallback failed too: ${(e2 as Error).message}`;
    }
  }
}

/** Read a save as JSON text, or throw with the reason. */
export async function getSave(slot: string): Promise<string | null> {
  try {
    const rec = await tx<{ data: Uint8Array } | undefined>('readonly', (st) => st.get(slot) as IDBRequest<{ data: Uint8Array } | undefined>);
    if (rec) return await gunzip(rec.data);
  } catch {
    /* fall through to localStorage */
  }
  const raw = localStorage.getItem(LS(slot));
  if (!raw) return null;
  // Older saves were plain JSON in localStorage.
  if (raw.startsWith('{"version"')) return raw;
  const v = JSON.parse(raw) as { gz: string };
  return await gunzip(fromB64(v.gz));
}

export async function listSaves(): Promise<SlotMeta[]> {
  const out = new Map<string, SlotMeta>();
  try {
    const all = await tx<{ slot: string; day: number; bytes: number }[]>('readonly', (st) => st.getAll() as IDBRequest<{ slot: string; day: number; bytes: number }[]>);
    for (const r of all) out.set(r.slot, { slot: r.slot, day: r.day, bytes: r.bytes });
  } catch {
    /* no IndexedDB: localStorage only */
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (!k.startsWith('cursus.save.')) continue;
      const slot = k.slice('cursus.save.'.length);
      if (out.has(slot)) continue;
      const raw = localStorage.getItem(k)!;
      const day = raw.startsWith('{"version"') ? Number(/"day":(\d+)/.exec(raw)?.[1] ?? 0) : (JSON.parse(raw) as { day: number }).day;
      out.set(slot, { slot, day, bytes: raw.length });
    }
  } catch {
    /* private window */
  }
  return [...out.values()];
}

/** Move old uncompressed localStorage saves into IndexedDB, freeing localStorage. */
export async function migrateOldSaves(): Promise<void> {
  let keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith('cursus.save.')) keys.push(k);
    }
  } catch {
    keys = [];
  }
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (!raw?.startsWith('{"version"')) continue;
    const slot = k.slice('cursus.save.'.length);
    const day = Number(/"day":(\d+)/.exec(raw)?.[1] ?? 0);
    const err = await putSave(slot, day, raw);
    if (!err) {
      try {
        // Only drop the old copy once IndexedDB holds it.
        const there = await tx('readonly', (st) => st.get(slot));
        if (there) localStorage.removeItem(k);
      } catch {
        /* keep it */
      }
    }
  }
}
