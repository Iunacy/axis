import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import reference from "../src/lib/data/openings.json";
import { curatedOpeningSubset, parseOpeningTsv } from "../src/lib/opening-import";
import { identifyOpening, isBookMove } from "../src/lib/opening-book";

test("the compact opening reference has 500 distinct ECO codes and entirely legal lines", () => {
  assert.equal(reference.source.license, "CC0-1.0");
  assert.equal(reference.rows.length, 500);
  assert.equal(new Set(reference.rows.map(row => row[0])).size, 500);
  for (const [, , moves] of reference.rows as [string, string, string[]][]) {
    const chess = new Chess();
    for (const move of moves) assert.ok(chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] }));
  }
});

test("opening import validates schema and chooses a reproducible subset without inventing book moves", () => {
  const rows = parseOpeningTsv("eco\tname\tpgn\nB00\tKing Pawn\t1. e4\nB00\tLonger line\t1. e4 e5");
  assert.equal(curatedOpeningSubset(rows).length, 1);
  assert.equal(curatedOpeningSubset([...rows].reverse())[0][1], "King Pawn");
  assert.throws(() => parseOpeningTsv("eco\tname\tpgn\nZ99\tInvalid\t1. e4"));
  assert.throws(() => parseOpeningTsv("eco\tname\tpgn\nB00\tIllegal\t1. e5"));
  assert.equal(identifyOpening(new Chess().fen(), ["e2e4", "c7c5"])?.eco, "B20");
  assert.equal(isBookMove("7k/P7/8/8/8/8/8/7K w - - 0 1", ["e2e4"]), false);
  assert.equal(isBookMove(new Chess().fen(), ["e2e4", "e7e5", "d1h5", "b8c6", "h5e5"]), false);
});
