import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { boardPoint, matchesUciMove, promotionChoices } from "../src/lib/board-interaction";

test("board geometry preserves square identity when flipped", () => {
  assert.deepEqual(boardPoint("a8", "w"), { x: .5, y: .5 });
  assert.deepEqual(boardPoint("a8", "b"), { x: 7.5, y: 7.5 });
  assert.deepEqual(boardPoint("h1", "b"), { x: .5, y: .5 });
});

test("promotion choices include every legal underpromotion and preserve move identity", () => {
  const fen = "7k/P7/8/8/8/8/8/7K w - - 0 1";
  assert.deepEqual(promotionChoices(fen, "a7", "a8").sort(), ["b", "n", "q", "r"]);
  assert.equal(matchesUciMove(fen, "a8=N", "a7a8n"), true);
  assert.equal(matchesUciMove(fen, "a8=Q+", "a7a8n"), false);
  assert.equal(matchesUciMove(fen, "a9=Q", "a7a8q"), false);
});

test("castling and en passant use chess legality rather than SAN text similarity", () => {
  const castle = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
  assert.equal(matchesUciMove(castle, "O-O", "e1g1"), true);
  const chess = new Chess();
  for (const move of ["e4", "a6", "e5", "d5"]) chess.move(move);
  assert.equal(matchesUciMove(chess.fen(), "exd6", "e5d6"), true);
  chess.move("h3"); chess.move("a5");
  assert.equal(matchesUciMove(chess.fen(), "exd6", "e5d6"), false);
});
