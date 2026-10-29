import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { useStore, DEFAULT_SETTINGS } from "../src/lib/store";
import { belongsToAccount } from "../src/lib/import-account";
import { importPgnText } from "../src/lib/import-pgn";
import { flushStoredState, indexedStorage } from "../src/lib/indexed-storage";

const values = new Map<string,string>();
Object.defineProperty(globalThis, "localStorage", { value: { getItem: (key:string) => values.get(key) ?? null, setItem: (key:string,value:string) => values.set(key,value), removeItem: (key:string) => values.delete(key) } });
Object.defineProperty(globalThis, "window", { value: { dispatchEvent() {} } });
const game = (name: string, platform: "chesscom" | "lichess" | "pgn", side: "w" | "b" = "w") => ({ ...importPgnText(`[White "${side === "w" ? name : "opponent"}"]\n[Black "${side === "b" ? name : "opponent"}"]\n\n1. e4 e5 1/2-1/2`, side)[0], id: `${platform}:${name}`, platform });

test("successful account replacement keeps only selected player's games on that platform and removes stale evidence", async () => {
  const old = game("old", "chesscom"), current = game("New", "chesscom", "b"), other = game("another", "lichess"), manual = game("study", "pgn");
  useStore.setState({ games: [old,other,manual], settings: DEFAULT_SETTINGS, analyses: {}, puzzles: [], lessons: [], aiLessons: [], reviewLocations: { [old.id]: {ply:1,at:new Date().toISOString()} }, syncAccounts: { 'chesscom:old': { latest:100,complete:true } } });
  assert.equal(belongsToAccount(current," new "),true);
  assert.equal(belongsToAccount(current,"opponent"),false);
  assert.equal(useStore.getState().importAccountPage("chesscom","New",[current],{latest:200,complete:true}),1);
  await flushStoredState();
  assert.deepEqual(new Set(useStore.getState().games.map(row=>row.id)),new Set([current.id,other.id,manual.id]));
  assert.deepEqual(useStore.getState().reviewLocations,{});
  assert.equal(useStore.getState().settings.chesscomUsername,"New");
  assert.equal(useStore.getState().syncAccounts['chesscom:old'],undefined);
  assert.equal(useStore.getState().importAccountPage("chesscom","new",[current],{latest:200,complete:true}),0);
  const stored = JSON.parse((await indexedStorage.getItem("cc:store"))!);
  assert.equal(stored.state.games.length,3);
  assert.equal(stored.state.syncAccounts['chesscom:new'].latest,200);
});

test("a failed replacement import preserves the previous account and its checkpoint", async () => {
  const {syncGames}=await import('../src/lib/sync');
  const old=game('old','lichess');
  useStore.setState({games:[old],settings:{...DEFAULT_SETTINGS,lichessUsername:'new'},syncAccounts:{'lichess:old':{latest:100,complete:true}}});
  const original=globalThis.fetch;
  globalThis.fetch=(async()=>new Response('',{status:404})) as typeof fetch;
  try{await assert.rejects(syncGames());assert.equal(useStore.getState().games[0].id,old.id);assert.ok(useStore.getState().syncAccounts['lichess:old']);}
  finally{globalThis.fetch=original;}
});
