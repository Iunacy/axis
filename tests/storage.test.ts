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

test("10000 games persist as individual records and checkpoints survive reload without truncation", async () => {
  const games = Array.from({length:10000},(_,index)=>({id:`game:${index}`,pgn:'1. e4 e5 1/2-1/2',analysis_status:'pending'}));
  const state = {games,analyses:{},syncAccounts:{'lichess:player':{until:123,latest:456,complete:false}}};
  await indexedStorage.setItem('cc:store',JSON.stringify({state,version:1}));
  const restored = JSON.parse((await indexedStorage.getItem('cc:store'))!);
  assert.equal(restored.state.games.length,10000);
  assert.equal(new Set(restored.state.games.map((game:{id:string})=>game.id)).size,10000);
  assert.equal(restored.state.syncAccounts['lichess:player'].until,123);
  state.games[9999].analysis_status='done';
  await indexedStorage.setItem('cc:store',JSON.stringify({state,version:1}));
  assert.equal(JSON.parse((await indexedStorage.getItem('cc:store'))!).state.games.find((game:{id:string})=>game.id==='game:9999').analysis_status,'done');
  await indexedStorage.removeItem('cc:store');
  assert.equal(await indexedStorage.getItem('cc:store'),null);
});

test("an unreadable storage session cannot overwrite previously saved games", async () => {
  const {protectUnreadableState,flushStoredState}=await import('../src/lib/indexed-storage');
  const original=JSON.stringify({state:{games:[{id:'preserve-me'}],analyses:{}},version:1});
  await indexedStorage.setItem('cc:store',original);
  protectUnreadableState(new Error('Simulated blocked upgrade'));
  await indexedStorage.setItem('cc:store',JSON.stringify({state:{games:[],analyses:{}},version:1}));
  await assert.rejects(flushStoredState(),/Could not save/);
  assert.equal(JSON.parse((await indexedStorage.getItem('cc:store'))!).state.games[0].id,'preserve-me');
});
