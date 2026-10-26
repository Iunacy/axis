import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { indexedStorage } from "../src/lib/indexed-storage";

const values = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
} });
Object.defineProperty(globalThis, "window", { value: { dispatchEvent() {} } });

test("legacy data survives migration and ordered writes restore latest state", async () => {
  values.set("cc:store", '{"state":{"games":[{"id":"old"}]},"version":1}');
  const old = await indexedStorage.getItem("cc:store");
  assert.ok(old?.includes("old"));
  assert.ok(values.has("cc:store"));
  await indexedStorage.setItem("cc:store", old!);
  assert.equal(values.has("cc:store"), false);
  assert.equal(await indexedStorage.getItem("cc:store"), old);
  await Promise.all([indexedStorage.setItem("cc:store", "first"), indexedStorage.setItem("cc:store", "latest")]);
  assert.equal(await indexedStorage.getItem("cc:store"), "latest");
  values.set("cc:store", "newer fallback");
  assert.equal(await indexedStorage.getItem("cc:store"), "newer fallback");
  await indexedStorage.setItem("cc:store", "recovered");
  assert.equal(values.has("cc:store"), false);
  assert.equal(await indexedStorage.getItem("cc:store"), "recovered");
  await indexedStorage.removeItem("cc:store");
  assert.equal(await indexedStorage.getItem("cc:store"), null);
});
