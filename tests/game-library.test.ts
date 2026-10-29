import { test } from "node:test";
import assert from "node:assert/strict";
import { filterGames, gameAccuracy, restoreReviewLocations, type LibraryFilters } from "../src/lib/game-library";
import { importPgnText } from "../src/lib/import-pgn";
import { restorePersistedState } from "../src/lib/state-validation";
import { DEFAULT_SETTINGS } from "../src/lib/store";
import { summarizeGame } from "../src/lib/analysis";
import { parsePgn } from "../src/lib/pgn";

const base = importPgnText('[Black "Ada"]\n\n1. e4 e5 2. Nf3 Nc6 1-0', "w")[0];
const games = [
  { ...base, id: "a", played_at: "2026-01-01T00:00:00Z", accuracy_user: 99, analysis_status: "done" as const, platform: "chesscom" as const },
  { ...base, id: "b", played_at: "2026-02-01T00:00:00Z", opponent_name: "Bela", accuracy_user: 70, analysis_status: "done" as const },
  { ...base, id: "c", played_at: "2026-03-01T00:00:00Z", opponent_name: "Cora", result: "loss" as const },
];
const parsed = parsePgn(base.pgn)!;
const summary = summarizeGame({ ...parsed, userColor: "w", evals: [], engineLabel: "empty fixture" }).summary;
const analyses = { a: { ...summary, complete: false, opening: { eco: "C50", name: "Italian Game" } }, b: { ...summary, accuracy: 70, accuracySamples: {w:2,b:2}, complete: true } };
const filters: LibraryFilters = { query: "", result: "all", platform: "all", status: "all", sort: "newest" };

test("library search combines source, outcome, review state and engine-derived openings", () => {
  assert.deepEqual(filterGames(games, analyses, { ...filters, query: "ada italian c50", platform: "chesscom", result: "win", status: "pending" }).map(game => game.id), ["a"]);
  assert.deepEqual(filterGames(games, analyses, { ...filters, status: "reviewed" }).map(game => game.id), ["b"]);
  assert.deepEqual(filterGames(games, analyses, { ...filters, query: "missing" }), []);
  assert.deepEqual(games.map(game => game.id), ["a", "b", "c"]);
});

test("library sorting is deterministic and excludes partial-review accuracy", () => {
  assert.equal(gameAccuracy(games[0], analyses), null);
  assert.deepEqual(filterGames(games, analyses, filters).map(game => game.id), ["c", "b", "a"]);
  assert.deepEqual(filterGames(games, analyses, { ...filters, sort: "oldest" }).map(game => game.id), ["a", "b", "c"]);
  assert.deepEqual(filterGames(games, analyses, { ...filters, sort: "accuracy" }).map(game => game.id), ["b", "c", "a"]);
});

test("review locations survive restoration without admitting missing games or corrupt moves", () => {
  const locations = { a: { ply: 3, at: "2026-01-01T00:00:00Z" }, b: { ply: -1, at: "2026-01-01T00:00:00Z" }, c: { ply: 2.5, at: "invalid" }, missing: { ply: 2, at: "2026-01-01T00:00:00Z" } };
  assert.deepEqual(restoreReviewLocations(locations, games), { a: locations.a });
  const state = restorePersistedState({ games, reviewLocations: locations }, DEFAULT_SETTINGS);
  assert.deepEqual(state.reviewLocations, { a: locations.a });
  assert.deepEqual(restorePersistedState({ games }, DEFAULT_SETTINGS).reviewLocations, {});
});
