import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { restoreReviewLocations } from "../src/lib/game-library";
import { parsePgn } from "../src/lib/pgn";
import { positionCommand } from "../src/lib/engine-protocol";
import { createReviewPosition, nodePath, reviewPositionReducer as reduce, reviewShortcut, reviewView, restoreReviewBranches, serializeReviewBranches } from "../src/lib/review-position";
import { reviewAttemptEvidence, reviewExercise } from "../src/lib/review-training";
import { preparePuzzle, playPuzzleMove } from "../src/lib/puzzle-solution";
import { scheduleReview } from "../src/lib/training";
import type { GameRow, MoveIssue } from "../src/lib/types";

const game = parsePgn("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0")!;
const issue: MoveIssue = { ply: 3, san: "Nf3", uci: "g1f3", bestUci: "f1c4", bestSan: "Bc4", fenBefore: game.fens[2], severity: "mistake", motif: "other", phase: "opening", cpBefore: 0, cpAfter: -200, winDrop: .12 };

test("every main-game selection and resume projects the exact FEN, history and last move", () => {
  let state = createReviewPosition(game, 4);
  assert.equal(reviewView(state).fen, game.fens[4]);
  for (let ply = 0; ply <= game.moves.length; ply++) {
    state = reduce(state, { type: "game", ply });
    const view = reviewView(state);
    assert.equal(view.fen, game.fens[ply]);
    assert.equal(view.lastUci, game.moves[ply - 1]?.uci ?? "");
    assert.doesNotThrow(() => positionCommand(view.fen, view.history));
  }
  assert.equal(reviewView(reduce(state, { type: "game", ply: 999 })).gamePly, 6);
  assert.equal(reviewView(createReviewPosition(game, -5)).gamePly, 0);
});

test("branches retain siblings and return to the game without duplicating its history", () => {
  const root = createReviewPosition(game, 2);
  const first = reduce(root, { type: "line", moves: ["f1c4", "g8f6", "d2d3"], advance: "first" });
  assert.equal(reviewView(first).index, 3);
  assert.equal(reviewView(first).line.length, 6);
  const tip = first.tip;
  let state = reduce(first, { type: "navigate", direction: "previous" });
  state = reduce(state, { type: "line", moves: ["d2d4", "e5d4"] });
  assert.ok(state.nodes[tip]);
  assert.equal(reviewView(state).gamePly, 2);
  const view = reviewView(state);
  assert.deepEqual(view.history.moves, ["e2e4", "e7e5", "d2d4", "e5d4"]);
  assert.doesNotThrow(() => positionCommand(view.fen, view.history));
  state = reduce(state, { type: "game", ply: 5 });
  assert.equal(reviewView(state).fen, game.fens[5]);
  state = reduce(state, { type: "select", id: tip });
  assert.equal(reviewView(state).fen, first.nodes[tip].fen);
  assert.equal(state.nodes.g2.children.length, 3);
  assert.equal(root.nodes.g2.children.length, 1);
});

test("illegal engine lines are atomic and duplicate continuations reuse the same nodes", () => {
  const state = createReviewPosition(game, 2);
  assert.equal(reduce(state, { type: "line", moves: ["f1c4", "e8e1"] }), state);
  assert.equal(reduce(state, { type: "line", moves: ["not-uci"] }), state);
  const branch = reduce(state, { type: "line", moves: ["f1c4", "g8f6"] });
  const replay = reduce(reduce(branch, { type: "game", ply: 2 }), { type: "line", moves: ["f1c4", "g8f6"] });
  assert.equal(Object.keys(replay.nodes).length, Object.keys(branch.nodes).length);
  assert.equal(replay.tip, branch.tip);
  const main = reduce(state, { type: "line", moves: ["g1f3"] });
  assert.equal(main.tip, state.mainline.at(-1));
  assert.equal(reviewView(main).line.length, game.fens.length);
});

test("rapid navigation and playback actions stay on the same selected line at both boundaries", () => {
  let state = reduce(createReviewPosition(game, 2), { type: "line", moves: ["f1c4", "g8f6", "d2d3"] });
  const tip = state.tip;
  for (let i = 0; i < 30; i++) state = reduce(state, { type: "navigate", direction: "previous" });
  assert.equal(state.cursor, "g0");
  for (let i = 0; i < 30; i++) state = reduce(state, { type: "navigate", direction: "next" });
  assert.equal(state.cursor, tip);
  state = reduce(state, { type: "navigate", direction: "first" });
  assert.equal(state.cursor, "g0");
  state = reduce(state, { type: "navigate", direction: "last" });
  assert.equal(state.cursor, tip);
  assert.doesNotThrow(() => positionCommand(reviewView(state).fen, reviewView(state).history));
});

test("transposed positions keep distinct paths for repetition-aware engine searches", () => {
  const root = createReviewPosition(game);
  const first = reduce(root, { type: "line", moves: ["g1f3", "g8f6", "b1c3", "b8c6"] });
  const second = reduce(reduce(first, { type: "game", ply: 0 }), { type: "line", moves: ["b1c3", "b8c6", "g1f3", "g8f6"] });
  assert.equal(first.nodes[first.tip].fen, second.nodes[second.tip].fen);
  assert.notEqual(first.tip, second.tip);
  assert.notEqual(reviewView(first).identity, reviewView(second).identity);
  assert.equal(nodePath(second, first.tip).length, 5);
});

test("branches validate castling, en passant and underpromotion from custom positions", () => {
  const cases = [
    ["r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 15", ["e1c1", "e8g8"]],
    ["4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 31", ["e5d6", "e8d7"]],
    ["7k/P7/8/8/8/8/8/7K w - - 0 1", ["a7a8n", "h8g7"]],
  ] as const;
  for (const [fen, moves] of cases) {
    const state = reduce(createReviewPosition({ headers: {}, fens: [fen], moves: [] }), { type: "line", moves: [...moves] });
    const expected = new Chess(fen);
    moves.forEach(uci => expected.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }));
    assert.equal(reviewView(state).fen, expected.fen());
    assert.doesNotThrow(() => positionCommand(reviewView(state).fen, reviewView(state).history));
  }
});

test("terminal positions cannot gain illegal continuations and keep SAN checkmate notation", () => {
  const fool = parsePgn("1. f3 e5 2. g4 Qh4# 0-1")!;
  const mate = reduce(createReviewPosition(fool, 3), { type: "line", moves: ["d8h4"] });
  assert.equal(reviewView(mate).node.san, "Qh4#");
  assert.equal(reduce(mate, { type: "line", moves: ["a2a3"] }), mate);
  const fen = "7k/5K2/6Q1/8/8/8/8/8 b - - 0 1";
  const stale = createReviewPosition({ headers: {}, moves: [], fens: [fen] });
  assert.equal(new Chess(fen).isStalemate(), true);
  assert.equal(reduce(stale, { type: "line", moves: ["h8h7"] }), stale);
});

test("practice uses the puzzle validator, hides wrong moves and projects correct history", () => {
  let state = reduce(createReviewPosition(game), { type: "practice", issue, now: 100 });
  assert.equal(reviewView(state).fen, issue.fenBefore);
  state = reduce(state, { type: "attempt", san: "d4" });
  assert.equal(state.practice?.status, "wrong");
  assert.equal(state.practice?.wrongMoves, 1);
  assert.equal(reviewView(state).fen, issue.fenBefore);
  state = reduce(state, { type: "attempt", san: "Bc4" });
  assert.equal(state.practice?.status, "correct");
  assert.equal(reviewView(state).lastUci, "f1c4");
  assert.deepEqual(reviewView(state).history.moves, ["e2e4", "e7e5", "f1c4"]);
  assert.doesNotThrow(() => positionCommand(reviewView(state).fen, reviewView(state).history));
  state = reduce(state, { type: "retry", now: 200 });
  assert.equal(state.practice?.startedAt, 200);
  assert.equal(state.practice?.wrongMoves, 0);
  state = reduce(state, { type: "reveal" });
  assert.equal(state.practice?.status, "revealed");
  assert.equal(reviewView(state).fen, issue.fenBefore);
  state = reduce(state, { type: "game", ply: issue.ply });
  assert.equal(state.practice, null);
  assert.equal(reviewView(state).fen, game.fens[issue.ply]);
  const invalid = { ...issue, bestUci: "e1e8" };
  assert.equal(reduce(state, { type: "practice", issue: invalid, now: 0 }), state);
});

test("corrective drills use the existing puzzle queue and preserve scheduled evidence", () => {
  const row = { id: "review-game", url: null } as GameRow;
  const puzzle = reviewExercise(row, issue)!;
  assert.ok(puzzle);
  const prepared = preparePuzzle(puzzle)!;
  assert.equal(playPuzzleMove(prepared, [], puzzle.fen, "Bc4").status, "solved");
  const reviewed = scheduleReview(puzzle, true, new Date("2026-10-28T00:00:00Z"), { firstAttempt: true, wrongMoves: 0, hintsUsed: 0 });
  assert.equal(reviewed.attempts, 1);
  assert.equal(reviewed.due_at, "2026-10-29T00:00:00.000Z");
  assert.equal(reviewed.reviews?.[0].firstAttempt, true);
  assert.equal(reviewExercise(row, { ...issue, bestUci: "e1e8" }), null);
});

test("review shortcuts respect text input, board access, dialogs, modifiers and native buttons", () => {
  assert.equal(reviewShortcut("ArrowLeft"), "previous");
  assert.equal(reviewShortcut("ArrowRight"), "next");
  assert.equal(reviewShortcut("Home"), "first");
  assert.equal(reviewShortcut("End"), "last");
  assert.equal(reviewShortcut(" "), "play");
  assert.equal(reviewShortcut("Escape"), "return");
  for (const context of [{ editable: true }, { board: true }, { dialog: true }, { modified: true }, { prevented: true }]) assert.equal(reviewShortcut("ArrowRight", context), null);
  assert.equal(reviewShortcut(" ", { button: true }), null);
  assert.equal(reviewShortcut("ArrowRight", { button: true }), "next");
});


test("saved branches survive reload while corrupt and stale lines are discarded", () => {
  const branch = reduce(createReviewPosition(game, 2), { type: "line", moves: ["f1c4", "g8f6"] });
  const saved = serializeReviewBranches(branch);
  const initial = createReviewPosition(game, 5);
  const restored = restoreReviewBranches(initial, JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(serializeReviewBranches(restored), saved);
  assert.equal(reviewView(restored).gamePly, 5);
  const bad = restoreReviewBranches(initial, [{ ply: 900, moves: ["e2e4"] }, { ply: 2, moves: ["f1c4", "e1e8"] }, { ply: 2, moves: [17] }]);
  assert.deepEqual(serializeReviewBranches(bad), []);
  assert.equal(reviewView(bad).fen, game.fens[5]);
});


test("the existing review-location store restores only legal branches without losing the saved ply", () => {
  const row = { id: "game", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0" } as GameRow;
  const locations = restoreReviewLocations({ game: { ply: 4, at: "2026-10-28T00:00:00Z", variations: [{ ply: 2, moves: ["f1c4", "g8f6"] }, { ply: 2, moves: ["f1c4", "e8e1"] }] } }, [row]);
  assert.equal(locations.game.ply, 4);
  assert.deepEqual(locations.game.variations, [{ ply: 2, moves: ["f1c4", "g8f6"] }]);
});


test("review evidence distinguishes the first encounter from a later successful retry", () => {
  const state = reduce(createReviewPosition(game), { type: "practice", issue, now: 100 });
  const failed = reviewAttemptEvidence(state.practice!, 0, false, 250);
  assert.equal(failed.firstAttempt, true);
  assert.equal(failed.solutionRevealed, true);
  assert.equal(failed.elapsedMs, 150);
  const retried = reviewAttemptEvidence(state.practice!, 1, true, 400);
  assert.equal(retried.firstAttempt, false);
  assert.equal(retried.hintsUsed, 0);
});
