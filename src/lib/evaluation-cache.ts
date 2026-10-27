import { validCachedEvaluation } from "./engine-protocol";
import type { PositionEvaluation } from "./types";

const memory = new Map<string, PositionEvaluation>();
let database: Promise<IDBDatabase> | undefined;
let epoch = 0;
export const evaluationCacheEpoch = () => epoch;

function db(): Promise<IDBDatabase> {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("axis-engine", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("evaluations").createIndex("savedAt", "savedAt");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(request.error); };
    request.onblocked = () => { database = undefined; reject(new Error("Engine cache is unavailable.")); };
  });
}

function remember(key: string, result: PositionEvaluation) {
  memory.delete(key); memory.set(key, structuredClone(result));
  if (memory.size > 200) memory.delete(memory.keys().next().value!);
}

export async function cachedEvaluation(key: string, fen: string): Promise<PositionEvaluation | null> {
  const known = memory.get(key);
  if (known && validCachedEvaluation(known, fen)) return structuredClone(known);
  if (typeof indexedDB === "undefined") return null;
  try {
    const database = await db();
    const saved = await new Promise<unknown>((resolve, reject) => {
      const request = database.transaction("evaluations").objectStore("evaluations").get(key);
      request.onsuccess = () => resolve(request.result?.result);
      request.onerror = () => reject(request.error);
    });
    if (validCachedEvaluation(saved, fen)) { remember(key, saved); return structuredClone(saved); }
  } catch {}
  return null;
}

export async function cacheEvaluation(key: string, fen: string, result: PositionEvaluation, expectedEpoch = epoch): Promise<void> {
  if (expectedEpoch !== epoch || !validCachedEvaluation(result, fen)) return;
  remember(key, result);
  if (typeof indexedDB === "undefined") return;
  try {
    const database = await db();
    if (expectedEpoch !== epoch) return;
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("evaluations", "readwrite");
      const store = transaction.objectStore("evaluations");
      store.put({ result, savedAt: Date.now() }, key);
      const count = store.count();
      count.onsuccess = () => {
        let excess = count.result - 1000;
        if (excess <= 0) return;
        const oldest = store.index("savedAt").openCursor();
        oldest.onsuccess = () => { const cursor = oldest.result; if (cursor && excess-- > 0) { cursor.delete(); cursor.continue(); } };
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch {}
}

export async function clearEvaluationCache(): Promise<void> {
  epoch += 1; memory.clear();
  if (typeof indexedDB === "undefined") return;
  try {
    const database = await db();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("evaluations", "readwrite");
      transaction.objectStore("evaluations").clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch { if (typeof window !== "undefined") window.dispatchEvent(new Event("axis:storage-error")); }
}
