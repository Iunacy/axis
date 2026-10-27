import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { parseLichessPuzzle } from "../src/lib/lichess-puzzles";
import { findPattern } from "../src/lib/pattern-catalog";
import { preparePuzzle } from "../src/lib/puzzle-solution";

const boden = findPattern("boden")!;
const source = {
  game: { id: "3twYIFSk", pgn: "e4 c6 c3 d5 e5 Bf5 d4 e6 Bd3 Bg6 Nf3 c5 O-O Nc6 Bg5 Qb6 b3 cxd4 cxd4 Nxd4 Nxd4 Qxd4" },
  puzzle: { id: "rz4lN", rating: 818, plays: 969, solution: ["d3b5"], themes: ["bodenMate", "middlegame", "oneMove", "mateIn1"], initialPly: 21 },
};

test("Lichess import replays the source game and validates a real mating pattern", () => {
  const parsed = parseLichessPuzzle(source, boden, 0, new Date("2026-01-01T00:00:00Z"))!;
  assert.ok(parsed);
  assert.equal(parsed.source, "lichess");
  assert.equal(parsed.pattern, "boden");
  assert.equal(parsed.license, "CC0-1.0");
  assert.equal(parsed.rating, 818);
  assert.deepEqual(parsed.solution_lines_uci, [["d3b5"]]);
  assert.ok(preparePuzzle(parsed));
  const chess = new Chess(parsed.fen);
  chess.move({ from: "d3", to: "b5" });
  assert.equal(chess.isCheckmate(), true);
});

test("Lichess import rejects mismatched themes, illegal lines and invented game context", () => {
  assert.equal(parseLichessPuzzle({ ...source, puzzle: { ...source.puzzle, themes: ["mateIn1"] } }, boden, 0), null);
  assert.equal(parseLichessPuzzle({ ...source, puzzle: { ...source.puzzle, solution: ["d3c4"] } }, boden, 0), null);
  assert.equal(parseLichessPuzzle({ ...source, puzzle: { ...source.puzzle, initialPly: 22 } }, boden, 0), null);
});
