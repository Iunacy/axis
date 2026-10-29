import { Chess } from "chess.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { needsAutomaticReview, resumableEvaluations } from "../src/lib/review-analysis";
import type { AnalysisSummary, GameRow } from "../src/lib/types";
import { parsePgn } from "../src/lib/pgn";
import { ENGINE_ID, parseEngineResult } from "../src/lib/engine-protocol";

const parsedGame = parsePgn("1. f3 e5 2. g4 Qh4# 0-1")!;
const game = { analysis_status: "pending", pgn: "1. f3 e5 2. g4 Qh4# 0-1" } as GameRow;
const positionEvals = parsedGame.fens.map(fen => {
  const moves = new Chess(fen).moves({ verbose: true });
  const uci = moves.length ? `${moves[0].from}${moves[0].to}${moves[0].promotion ?? ""}` : null;
  return { ...parseEngineResult(fen, uci ? [`info depth 12 score cp 25 nodes 40000 pv ${uci}`, `bestmove ${uci}`] : []), engineId: ENGINE_ID };
});
const saved = { openingBookVersion: 3, complete: true, engineId: ENGINE_ID, positionEvals, evaluations: positionEvals.map(evaluation => evaluation.cpWhite), moveAssessments: parsedGame.moves.map((move,index) => ({ply:index+1,color:move.color,classification:"good",confidence:"supported",depth:12,reason:"test",expectedLoss:0})) } as AnalysisSummary;
test("automatic review respects saved, interrupted, partial, and failed states", () => {
  assert.equal(needsAutomaticReview(game), true);
  assert.equal(needsAutomaticReview({ ...game, analysis_status: "analyzing" }), true);
  assert.equal(needsAutomaticReview({ ...game, analysis_status: "done" }, saved), false);
  assert.equal(needsAutomaticReview({ ...game, analysis_status: "done" }, { ...saved, complete: false }), true);
  assert.equal(needsAutomaticReview({ ...game, analysis_status: "done" }), true);
  assert.equal(needsAutomaticReview({ ...game, analysis_status: "failed" }), false);
  assert.equal(needsAutomaticReview({ ...game, analysis_status: "skipped" }), false);
});
test("resume preserves ply alignment and stops at the first invalid saved position", () => {
  const parsed = parsePgn("1. e4 e5 2. Nf3 Nc6 *")!;
  const evaluation = parseEngineResult(parsed.fens[0], ["info depth 12 score cp 25 pv e2e4 e7e5", "bestmove e2e4"], 1);
  const summary = { ...saved, positionEvals: [evaluation, evaluation] };
  assert.deepEqual(resumableEvaluations(parsed.fens, summary), [evaluation]);
  assert.deepEqual(resumableEvaluations(parsed.fens.slice(1), summary), []);
  assert.deepEqual(resumableEvaluations(parsed.fens), []);
});

test("legacy engine reviews remain historical and cannot resume as Stockfish 19", () => {
  const legacy = { ...saved, engineId: undefined };
  assert.equal(needsAutomaticReview({ ...game, analysis_status: "done" }, legacy), true);
  assert.deepEqual(resumableEvaluations(["irrelevant"], legacy), []);
});


test("completed but damaged or position-mismatched cached reviews reopen for repair", () => {
  const done = { ...game, analysis_status: "done" as const };
  assert.equal(needsAutomaticReview(done, { ...saved, positionEvals: [] }), true);
  assert.equal(needsAutomaticReview(done, { ...saved, positionEvals: [...positionEvals].reverse() }), true);
  assert.equal(needsAutomaticReview(done, { ...saved, evaluations: [] }), true);
  assert.equal(needsAutomaticReview(done, { ...saved, moveAssessments: [] }), true);
  assert.equal(needsAutomaticReview(done, saved), false);
});

test("older sparse ratings get one coverage upgrade, while bounded uncertainty stays cached", () => {
  const done = { ...game, analysis_status: "done" as const };
  const sparse = { ...saved, moveAssessments: saved.moveAssessments!.map(move => ({ ...move, classification: null, confidence: "limited" as const })) };
  assert.equal(needsAutomaticReview(done, sparse), true);
  assert.equal(needsAutomaticReview(done, { ...sparse, ratingCoverageVersion: 1 }), false);
});

test("old opening labels refresh using cached engine evidence", () => {
  assert.equal(needsAutomaticReview({ ...game, analysis_status: "done" }, { ...saved, openingBookVersion: undefined }), true);
  assert.equal(resumableEvaluations(parsedGame.fens, saved).length, parsedGame.fens.length);
});
