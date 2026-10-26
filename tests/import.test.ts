import { test } from "node:test";
import assert from "node:assert/strict";
import { importPgnText } from "../src/lib/import-pgn";

const game = '[Event "Finished"]\n[Date "2026.10.26"]\n[White "Alice"]\n[Black "Bob"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1';

test("PGN import accepts completed games, preserves side and stable identity", () => {
  const first = importPgnText(game, "b")[0];
  const again = importPgnText(game, "b")[0];
  assert.equal(first.id, again.id);
  assert.equal(first.platform, "pgn");
  assert.equal(first.opponent_name, "Alice");
  assert.equal(first.result, "win");
  assert.equal(first.analysis_status, "pending");
  const otherOpponent = importPgnText(game.replace('Black "Bob"', 'Black "Carol"'), "b")[0];
  assert.notEqual(first.id, otherOpponent.id);
  const unknownDate = importPgnText(game.replace('2026.10.26', '0000.00.00'), "b")[0];
  assert.ok(Number.isFinite(Date.parse(unknownDate.played_at)));
});

test("PGN import rejects live, malformed, and oversized data", () => {
  assert.deepEqual(importPgnText(game.replaceAll('0-1', '*'), "w"), []);
  assert.deepEqual(importPgnText('1. e4 e5 2. Qh9', "w"), []);
  assert.throws(() => importPgnText('x'.repeat(2_000_001), "w"));
});
