import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { parsePgn, resultForUser } from "../src/lib/pgn";
import { legalVariation, summarizeGame, winProb } from "../src/lib/analysis";
import { scheduleReview, duePuzzles } from "../src/lib/training";
import type { PositionEvaluation, PuzzleRow } from "../src/lib/types";

const puzzle: PuzzleRow = {
  id: "test", game_id: "game", fen: new Chess().fen(), solution_san: ["e4"], reply_san: [],
  theme: "other", severity: "mistake", user_side: "w", source_url: null,
  attempts: 0, solved: false, created_at: "2026-01-01T00:00:00.000Z",
};

test("PGN replay preserves legal positions and rejects malformed games", () => {
  const parsed = parsePgn('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0')!;
  assert.equal(parsed.moves.length, 6);
  assert.equal(parsed.fens.length, 7);
  assert.equal(new Chess(parsed.fens[6]).get("a6")?.type, "p");
  assert.equal(parsePgn('1. e4 e5 2. Qh9'), null);
  assert.equal(resultForUser("0-1", "b"), "win");
});

test("variations contain only verified legal moves", () => {
  assert.deepEqual(legalVariation(new Chess().fen(), ["e2e4", "e7e5", "e1e8", "g1f3"]), ["e4", "e5"]);
});

test("evaluation interpretation and puzzle generation work for Black", () => {
  assert.equal(winProb(0), 0.5);
  assert.ok(winProb(300) > winProb(-300));
  const parsed = parsePgn("1. f3 e5 2. g4 a6 *")!;
  const result = summarizeGame({ ...parsed, userColor: "b", engineLabel: "test", evals: parsed.fens.map((fen, i) => {
    const move = new Chess(fen).moves({ verbose: true })[0];
    const bestUci = i === 3 ? "d8h4" : `${move.from}${move.to}${move.promotion ?? ""}`;
    const line = { cpWhite: i === 3 ? -9999 : 0, pvUci: [bestUci], depth: 16, nodes: 50000, mate: i === 3 ? { winner: "b" as const, moves: 1 } : undefined };
    return { ...line, bestUci, lines: [line] };
  }) });
  assert.equal(result.summary.issues[0].motif, "missed_mate");
  assert.equal(result.summary.issues[0].bestSan, "Qh4#");
  assert.deepEqual(result.puzzles[0].solution_san, ["Qh4#"]);
  assert.equal(new Chess(result.puzzles[0].fen).turn(), "b");
});

test("spaced retrieval schedules 1, 3, 7, 14, 30 days and resets after failure", () => {
  let current = puzzle;
  let now = new Date("2026-01-01T00:00:00Z");
  for (const days of [1, 3, 7, 14, 30, 30]) {
    current = scheduleReview(current, true, now);
    assert.equal(Date.parse(current.due_at!) - now.getTime(), days * 86400000);
    now = new Date(current.due_at!);
  }
  current = scheduleReview(current, false, now);
  assert.equal(current.streak, 0);
  assert.equal(current.attempts, 7);
  assert.equal(current.reviews?.length, 7);
  assert.equal(duePuzzles([current], now).length, 0);
  assert.equal(duePuzzles([current], new Date(current.due_at!)).length, 1);
  assert.equal(duePuzzles([puzzle], now).length, 1);
});

test("the root best move is not penalized when a bounded child search loses the mate horizon", () => {
  const parsed = parsePgn('[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n1. a8=Q+ *')!;
  const { summary } = summarizeGame({ ...parsed, userColor: "w", engineLabel: "bounded fixture", evals: [{ cpWhite: 9986, bestUci: "a7a8q", pvUci: ["a7a8q"], mate: { winner: "w", moves: 14 } }, { cpWhite: 650, bestUci: "h8h7", pvUci: ["h8h7"] }] });
  assert.equal(summary.accuracy, 100);
  assert.equal(summary.acpl, 0);
  assert.equal(summary.issues.length, 0);
});


test("a missed mate still creates legitimate training when the advantage survives", () => {
  const parsed = parsePgn("1. f3 e5 2. g4 a6 *")!;
  const evals: PositionEvaluation[] = parsed.fens.map((fen, index) => {
    const move = new Chess(fen).moves({ verbose: true })[0];
    const bestUci = index === 3 ? "d8h4" : `${move.from}${move.to}${move.promotion ?? ""}`;
    const line = { cpWhite: -900, pvUci: [bestUci], depth: 16, nodes: 50000, wdlWhite: [0, 20, 980] as [number, number, number], mate: index === 3 ? { winner: "b" as const, moves: 1 } : undefined };
    return { ...line, bestUci, lines: [line] };
  });
  const { summary, puzzles } = summarizeGame({ ...parsed, evals, userColor: "b", engineLabel: "synthetic outcome regression" });
  const miss = summary.issues.find(issue => issue.ply === 4)!;
  assert.equal(miss.classification, "miss");
  assert.equal(miss.severity, "inaccuracy");
  assert.equal(miss.motif, "missed_mate");
  assert.deepEqual(puzzles.find(puzzle => puzzle.fen === parsed.fens[3])?.solution_san, ["Qh4#"]);
  assert.equal(summary.acplSamples, 1);
  assert.equal(summary.acpl, 0);
  assert.ok(summary.accuracy > 95);
});
