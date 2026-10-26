import type { StateStorage } from "zustand/middleware";

let database: Promise<IDBDatabase> | undefined;
let writes = Promise.resolve();
function db(): Promise<IDBDatabase> {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("axis", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("state");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(request.error); };
    request.onblocked = () => { database = undefined; reject(new Error("Storage upgrade blocked")); };
  });
}
async function read(key: string): Promise<string | null> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database.transaction("state").objectStore("state").get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}
async function write(key: string, value: string): Promise<void> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("state", "readwrite");
    transaction.objectStore("state").put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
function notify() {
  window.dispatchEvent(new Event("axis:storage-error"));
}
export const indexedStorage: StateStorage = {
  async getItem(key) {
    try {
      const stored = await read(key);
      if (stored !== null) return stored;
    } catch { notify(); }
    try { return localStorage.getItem(key); } catch { notify(); return null; }
  },
  setItem(key, value) {
    writes = writes.then(async () => {
      try {
        await write(key, value);
        localStorage.removeItem(key);
      } catch {
        try { localStorage.setItem(key, value); } catch { notify(); }
      }
    });
    return writes;
  },
  removeItem(key) {
    writes = writes.then(async () => {
      try {
        const database = await db();
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction("state", "readwrite");
          transaction.objectStore("state").delete(key);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });
        localStorage.removeItem(key);
      } catch { notify(); }
    });
    return writes;
  },
};
