import { test } from "node:test";
import assert from "node:assert/strict";
import { needsAutomaticReview, resumableEvaluations } from "../src/lib/review-analysis";
import type { AnalysisSummary, GameRow } from "../src/lib/types";
import { parsePgn } from "../src/lib/pgn";
import { parseEngineResult } from "../src/lib/engine-protocol";

const game = { analysis_status: "pending" } as GameRow;
const saved = { complete: true } as AnalysisSummary;
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
