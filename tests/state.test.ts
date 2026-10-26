import { test } from "node:test";
import assert from "node:assert/strict";
import { restorePersistedState } from "../src/lib/state-validation";
import { importPgnText } from "../src/lib/import-pgn";
import type { Settings } from "../src/lib/types";

const defaults: Settings = { chesscomUsername: "", lichessUsername: "", analyzeLastN: 50, engineMovetimeMs: 90, boardTheme: "grey" };
const game = importPgnText('1. f3 e5 2. g4 Qh4# 0-1', "w")[0];

test("restoration preserves valid state and repairs interrupted analysis", () => {
  const annotation = { gameId: "master", locale: "en", created_at: new Date().toISOString(), intro: "Study", notes: [{ ply: 2, reasoning: "Develop." }] };
  const restored = restorePersistedState({ settings: { chesscomUsername: "lris_m" }, games: [{ ...game, analysis_status: "analyzing" }], masterAnnotations: [annotation], onboardedFlag: true }, defaults);
  assert.equal(restored.settings.chesscomUsername, "lris_m");
  assert.equal(restored.settings.engineMovetimeMs, 90);
  assert.equal(restored.games[0].analysis_status, "pending");
  assert.deepEqual(restored.masterAnnotations, [annotation]);
  assert.equal(restored.onboardedFlag, true);
});

test("corrupted storage falls back safely and never replaces store actions", () => {
  const restored = restorePersistedState({ settings: { chesscomUsername: 42, engineMovetimeMs: -1 }, games: "broken", puzzles: [null, { fen: "illegal" }], analyses: { bad: { accuracy: 99 } }, setGames: "broken", aiLessons: [{}] }, defaults);
  assert.deepEqual(restored.settings, defaults);
  assert.deepEqual(restored.games, []);
  assert.deepEqual(restored.puzzles, []);
  assert.deepEqual(restored.analyses, {});
  assert.deepEqual(restored.aiLessons, []);
  assert.ok(!("setGames" in restored));
  assert.deepEqual(restorePersistedState(null, defaults).settings, defaults);
  assert.equal(restorePersistedState({ games: [{ ...game, analysis_status: "done" }] }, defaults).games[0].analysis_status, "pending");
});
