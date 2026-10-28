import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { DEEP_ENGINE_ID, ENGINE_ID, evaluationKey, parseEngineResult, positionCommand, searchLimits, validCachedEvaluation } from "../src/lib/engine-protocol";
import { Engine } from "../src/lib/engine";
import { cacheEvaluation, cachedEvaluation, clearEvaluationCache, evaluationCacheEpoch } from "../src/lib/evaluation-cache";

const start = new Chess().fen();
const output = [
  "info depth 10 multipv 1 score cp 35 wdl 80 900 20 nodes 2000 pv e2e4 e7e5",
  "info depth 10 multipv 2 score cp 20 wdl 50 920 30 nodes 2000 pv d2d4 d7d5",
  "info depth 11 multipv 1 score cp 400 lowerbound nodes 3000 pv e2e4 e7e5",
  "bestmove e2e4 ponder e7e5",
];

test("UCI parsing uses complete exact MultiPV depths and rejects illegal or incomplete output", () => {
  const result = parseEngineResult(start, output, 2);
  assert.equal(result.depth, 10);
  assert.equal(result.cpWhite, 35);
  assert.equal(result.lines?.length, 2);
  assert.deepEqual(result.wdlWhite, [80, 900, 20]);
  assert.throws(() => parseEngineResult(start, ["info depth 12 score cp 20 pv e2e5", "bestmove e2e5"]));
  assert.throws(() => parseEngineResult(start, output, 3));
  assert.throws(() => parseEngineResult(start, ["bestmove e2e4"]));
  assert.equal(validCachedEvaluation({ ...result, mate: { winner: "x", moves: -1 } }, start), false);
});

test("scores and WDL normalize to White, with explicit mate and exact terminal results", () => {
  const chess = new Chess(); chess.move("f3"); chess.move("e5"); chess.move("g4");
  const result = parseEngineResult(chess.fen(), ["info depth 12 score mate 1 wdl 1000 0 0 nodes 3000 pv d8h4", "bestmove d8h4"]);
  assert.deepEqual(result.mate, { winner: "b", moves: 1 });
  assert.deepEqual(result.wdlWhite, [0, 0, 1000]);
  assert.equal(result.cpWhite, -9999);
  chess.move("Qh4#");
  assert.deepEqual(parseEngineResult(chess.fen(), []).mate, { winner: "b", moves: 0 });
  assert.equal(parseEngineResult("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", []).cpWhite, 0);
});

test("search identity includes rule counters, repetition history, configuration and engine settings", () => {
  const chess = new Chess(); const moves = ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"];
  for (const move of moves) chess.move({ from: move.slice(0, 2), to: move.slice(2, 4) });
  const history = { initialFen: start, moves };
  assert.ok(positionCommand(chess.fen(), history).includes(moves.join(" ")));
  assert.equal(parseEngineResult(chess.fen(), [], 1, history).cpWhite, 0);
  const limits = searchLimits();
  assert.notEqual(evaluationKey(chess.fen(), limits, history), evaluationKey(chess.fen(), limits));
  assert.notEqual(evaluationKey(start, limits), evaluationKey(start, searchLimits({ multiPv: 3 })));
  assert.notEqual(evaluationKey(start, limits), evaluationKey(start, limits, undefined, 64));
  assert.throws(() => positionCommand(start, { initialFen: start, moves: ["e2e4"] }));
  assert.equal(searchLimits({ nodes: 1e20 }).nodes, 2000000);
});

test("cache survives engine replacement, rejects stale writes after clearing, and isolates consumers", async () => {
  await clearEvaluationCache();
  const result = parseEngineResult(start, output, 2);
  const key = evaluationKey(start, searchLimits({ multiPv: 2 }));
  await cacheEvaluation(key, start, result);
  const saved = (await cachedEvaluation(key, start))!;
  saved.pvUci[0] = "invalid";
  assert.equal((await cachedEvaluation(key, start))?.pvUci[0], "e2e4");
  const epoch = evaluationCacheEpoch();
  await clearEvaluationCache();
  await cacheEvaluation(key, start, result, epoch);
  assert.equal(await cachedEvaluation(key, start), null);
});

test("engine deduplicates concurrent searches, reuses persisted results and cancels pending work", async t => {
  await clearEvaluationCache();
  const original = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  let searches = 0;
  let hold = false;
  let notifyStarted: (() => void) | undefined;
  class FakeWorker extends EventTarget {
    postMessage(command: string) {
      queueMicrotask(() => {
        const emit = (data: string) => this.dispatchEvent(new MessageEvent("message", { data }));
        if (command === "uci") emit("uciok");
        if (command === "isready") emit("readyok");
        if (command.startsWith("go ")) { searches++; notifyStarted?.(); if (!hold) { emit(output[0]); emit(output.at(-1)!); } }
      });
    }
    terminate() {}
  }
  Object.defineProperty(globalThis, "Worker", { configurable: true, writable: true, value: FakeWorker });
  t.after(() => { if (original) Object.defineProperty(globalThis, "Worker", original); else Reflect.deleteProperty(globalThis, "Worker"); });
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ version: "19.0.1", js: "stockfish-19-lite-single.js", deep: "stockfish-19-single.js" })));
  const engine = new Engine();
  const first = engine.analyze(start);
  assert.equal(first, engine.analyze(start));
  assert.equal((await first).cpWhite, 35);
  assert.equal(searches, 1);
  engine.destroy();
  const replacement = new Engine();
  const reused = await replacement.analyze(start);
  assert.equal(reused.cpWhite, 35);
  assert.equal(reused.cacheHit, true);
  assert.equal(searches, 1);
  hold = true;
  const started = new Promise<void>(resolve => { notifyStarted = resolve; });
  const cancelled = replacement.analyze(start, { nodes: 90000 });
  await started; replacement.destroy();
  await assert.rejects(cancelled, /cancelled/);
  await assert.rejects(replacement.analyze(start), /cancelled/);
});

test("a capped incomplete iteration is retried once on the same worker without relaxing evidence", async t => {
  await clearEvaluationCache();
  const original = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  let workers = 0;
  const searches: string[] = [];
  class FakeWorker extends EventTarget {
    constructor() { super(); workers++; }
    postMessage(command: string) {
      queueMicrotask(() => {
        const emit = (data: string) => this.dispatchEvent(new MessageEvent("message", { data }));
        if (command === "uci") emit("uciok");
        if (command === "isready") emit("readyok");
        if (command.startsWith("go ")) {
          searches.push(command);
          if (searches.length === 1) emit("info depth 12 score cp 70 lowerbound pv d2d4 d7d5");
          else emit(output[0]);
          emit(output.at(-1)!);
        }
      });
    }
    terminate() {}
  }
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: FakeWorker });
  t.after(() => { if (original) Object.defineProperty(globalThis, "Worker", original); else Reflect.deleteProperty(globalThis, "Worker"); });
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ version: "19.0.1", js: "stockfish-19-lite-single.js", deep: "stockfish-19-single.js" })));
  const engine = new Engine();
  t.after(() => engine.destroy());
  const result = await engine.analyze(start, { depth: 12, nodes: 40000 });
  assert.equal(workers, 1);
  assert.deepEqual(searches, ["go depth 12 nodes 40000", "go depth 16 nodes 160000"]);
  assert.equal(result.cpWhite, 35);
  assert.equal(result.bestUci, "e2e4");
});


test("default and full engines cannot share cache identities", () => {
  assert.notEqual(evaluationKey(start, searchLimits(), undefined, 32, ENGINE_ID), evaluationKey(start, searchLimits(), undefined, 32, DEEP_ENGINE_ID));
});

test("worker initialization rejects an obsolete manifest before starting a search", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ version: "18.0.7", js: "stockfish-18-lite-single.js" })));
  const original = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: class {} });
  t.after(() => { if (original) Object.defineProperty(globalThis, "Worker", original); else Reflect.deleteProperty(globalThis, "Worker"); });
  const engine = new Engine();
  await assert.rejects(engine.init(), /outdated/);
  engine.destroy();
});
