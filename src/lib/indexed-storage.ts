import type { StateStorage } from "zustand/middleware";

let database: Promise<IDBDatabase> | undefined;
let writes = Promise.resolve();
let lastError: unknown;
let readFailure: unknown;
export function protectUnreadableState(error: unknown) { readFailure = error; lastError = error; notify(); }
let recordCache: Record<string, Map<string, string>> | undefined;
function db(): Promise<IDBDatabase> {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("axis", 2);
    request.onupgradeneeded = () => {
      for (const name of ["state", "games", "analyses"]) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
    };
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); database = undefined; }; resolve(request.result); };
    request.onerror = () => { database = undefined; reject(request.error); };
    request.onblocked = () => { database = undefined; reject(new Error("Close other AXIS tabs to upgrade storage.")); };
  });
}
async function read(key: string): Promise<string | null> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(["state", "games", "analyses"]);
    const request = tx.objectStore("state").get(key);
    const games = tx.objectStore("games").getAll();
    const analyses = tx.objectStore("analyses").getAll();
    tx.oncomplete = () => {
      const value = request.result;
      if (typeof value !== "string") { resolve(null); return; }
      let envelope;
      try { envelope = JSON.parse(value); } catch { resolve(value); return; }
      if (envelope && typeof envelope === "object" && envelope.recordsVersion === 1 && envelope.state && typeof envelope.state === "object") {
        envelope!.state!.games = games.result;
        envelope!.state!.analyses = Object.fromEntries(analyses.result.map(row => [row.id, row.value]));
        delete envelope.recordsVersion;
        resolve(JSON.stringify(envelope));
      } else resolve(value);
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
async function write(key: string, value: string): Promise<void> {
  const database = await db();
  let envelope: { state?: { games: { id: string }[]; analyses: Record<string, unknown>; [key: string]: unknown }; [key: string]: unknown } | undefined;
  try { envelope = JSON.parse(value); } catch { /* Generic StateStorage values stay supported. */ }
  const split = envelope?.state && Array.isArray(envelope!.state!.games) && envelope!.state!.analyses && typeof envelope!.state!.analyses === "object";
  const nextCache: Record<string, Map<string, string>> = {};
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(["state", "games", "analyses"], "readwrite", {durability: "strict"});
    if (split) {
      // Cursor reconciliation writes only changed records. The metadata/checkpoint
      // and all new games commit atomically, including legacy blob migration.
      for (const [name, incoming] of [["games", envelope!.state!.games.map((game: { id: string }) => [game.id, game])], ["analyses", Object.entries(envelope!.state!.analyses).map(([id, value]) => [id, { id, value }])]] as [string, [string, unknown][]][]) {
        const store = tx.objectStore(name);
        const serialized = new Map(incoming.map(([id, row]) => [id, JSON.stringify(row)]));
        nextCache[name] = serialized;
        const previous = recordCache?.[name];
        if (previous) {
          for (const id of previous.keys()) if (!serialized.has(id)) store.delete(id);
          for (const [id, row] of incoming) if (previous.get(id) !== serialized.get(id)) store.put(row, id);
          continue;
        }
        const pending = new Map(incoming);
        const cursor = store.openCursor();
        cursor.onsuccess = () => {
          const row = cursor.result;
          if (!row) { for (const [id, data] of pending) store.put(data, id); return; }
          if (!pending.has(String(row.key))) row.delete();
          else {
            const next = pending.get(String(row.key));
            if (JSON.stringify(row.value) !== JSON.stringify(next)) row.update(next);
            pending.delete(String(row.key));
          }
          row.continue();
        };
      }
      const { games: _games, analyses: _analyses, ...metadata } = envelope!.state!;
      void _games; void _analyses;
      tx.objectStore("state").put(JSON.stringify({ ...envelope, recordsVersion: 1, state: metadata }), key);
    } else tx.objectStore("state").put(value, key);
    tx.oncomplete = () => { if (split) recordCache = nextCache; resolve(); };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
function notify() { if (typeof window !== "undefined") window.dispatchEvent(new Event("axis:storage-error")); }
/** Imports await durability before requesting the next historical page. */
export async function flushStoredState() {
  await writes;
  if (lastError) throw new Error("Could not save imported games. Free device storage and retry; the last durable page is preserved.");
}
export const indexedStorage: StateStorage = {
  async getItem(key) {
    try { const fallback = localStorage.getItem(key); if (fallback !== null) return fallback; } catch {}
    try { return await read(key); } catch (error) { protectUnreadableState(error); return null; }
  },
  setItem(key, value) {
    writes = writes.catch(() => {}).then(async () => {
      if (readFailure) { lastError = readFailure; notify(); return; }
      try {
        await write(key, value);
        // Once IndexedDB commits, failure to remove an old fallback must be visible.
        localStorage.removeItem(key);
        lastError = undefined;
      } catch (error) {
        lastError = error;
        // Keep the recovery snapshot, but never call this a durable large-history import.
        try { localStorage.setItem(key, value); } catch {}
        notify();
      }
    });
    return writes;
  },
  removeItem(key) {
    writes = writes.catch(() => {}).then(async () => {
      try {
        const database = await db();
        await new Promise<void>((resolve, reject) => {
          const tx = database.transaction(["state", "games", "analyses"], "readwrite", {durability: "strict"});
          tx.objectStore("state").delete(key);
          tx.objectStore("games").clear(); tx.objectStore("analyses").clear();
          tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
        });
        recordCache = undefined; localStorage.removeItem(key); lastError = undefined;
      } catch (error) { lastError = error; notify(); }
    });
    return writes;
  },
};
