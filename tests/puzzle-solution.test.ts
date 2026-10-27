import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { playPuzzleMove, preparePuzzle, replayPuzzlePath } from "../src/lib/puzzle-solution";
import { restorePersistedState } from "../src/lib/state-validation";
import { identifyPattern, mixedPatternQueue, scheduleReview } from "../src/lib/training";
import { DEFAULT_SETTINGS } from "../src/lib/store";
import type { PuzzleRow } from "../src/lib/types";

const basic: PuzzleRow = {
  id: "game:1", game_id: "game", fen: new Chess().fen(), solution_san: ["e4"], reply_san: [],
  theme: "other", severity: "mistake", user_side: "w", source_url: null,
  attempts: 0, solved: false, created_at: "2026-01-01T00:00:00.000Z",
};

test("puzzle answers require the legal move in the recorded position", () => {
  const prepared = preparePuzzle(basic)!;
  assert.equal(playPuzzleMove(prepared, [], basic.fen, "d4").status, "wrong");
  assert.equal(playPuzzleMove(prepared, [], new Chess().move("Nf3").after, "e4").status, "wrong");
  const result = playPuzzleMove(prepared, [], basic.fen, "e4");
  assert.equal(result.status, "solved");
  assert.deepEqual(result.status === "solved" && result.path, ["e2e4"]);
  assert.equal(replayPuzzlePath(prepared, ["e2e4"])?.fen, result.status === "solved" && result.playerFen);
  assert.equal(preparePuzzle({ ...basic, solution_san: ["Qh9"] }), null);
});

test("a real Lichess puzzle validates every move and scripted reply", () => {
  const sourceFen = "1k1r4/pp3pp1/2p1p3/4b3/P3n1P1/8/KPP2PN1/3rBR1R b - - 2 31";
  const source = new Chess(sourceFen);
  source.move({ from: "b8", to: "c7" });
  const row: PuzzleRow = {
    ...basic, id: "lichess:00sO1", game_id: "lichess:00sO1", fen: source.fen(), user_side: "w",
    solution_san: ["Ba5", "Rxd1"], reply_san: ["b6"],
    solution_lines_uci: [["e1a5", "b7b6", "f1d1"]],
  };
  const prepared = preparePuzzle(row)!;
  assert.ok(prepared);
  const first = playPuzzleMove(prepared, [], row.fen, "Ba5");
  assert.equal(first.status, "continue");
  if (first.status !== "continue") return;
  assert.equal(first.reply.san, "b6");
  assert.deepEqual(first.path, ["e1a5", "b7b6"]);
  assert.equal(playPuzzleMove(prepared, first.path, first.nextFen, "Re1").status, "wrong");
  assert.equal(playPuzzleMove(prepared, first.path, first.nextFen, "Rxd1").status, "solved");
  assert.equal(preparePuzzle({ ...row, solution_lines_uci: [["e1a5", "b7b3", "f1d1"]] }), null);
});

test("training evidence and the remaining queue survive restoration", () => {
  const reviewed = scheduleReview(basic, false, new Date("2026-01-02T00:00:00Z"), { firstAttempt: true, hintsUsed: 2, elapsedMs: 4500, wrongMoves: 1 });
  assert.deepEqual(reviewed.reviews?.[0], { at: "2026-01-02T00:00:00.000Z", solved: false, firstAttempt: true, hintsUsed: 2, elapsedMs: 4500, wrongMoves: 1 });
  const active = { puzzleId: reviewed.id, startedAt: "2026-01-02T00:00:00Z", path: ["e2e4"], hintLevel: 2, status: "solved" };
  const restored = restorePersistedState({ puzzles: [reviewed], trainingSession: { id: "session", startedAt: "2026-01-02T00:00:00Z", remainingIds: ["missing", reviewed.id, reviewed.id], active } }, DEFAULT_SETTINGS);
  assert.deepEqual(restored.trainingSession?.remainingIds, [reviewed.id]);
  assert.deepEqual(restored.trainingSession?.active, active);
  assert.equal(restored.puzzles[0].reviews?.[0].hintsUsed, 2);
  const repaired = restorePersistedState({ puzzles: [reviewed], trainingSession: { id: "session", startedAt: "2026-01-02T00:00:00Z", remainingIds: [reviewed.id], active: { ...active, path: ["e2e5"] } } }, DEFAULT_SETTINGS);
  assert.deepEqual(repaired.trainingSession?.active.path, []);
  assert.equal(restorePersistedState({ trainingSession: { id: "session", startedAt: "2026-01-02T00:00:00Z", remainingIds: ["missing"] } }, DEFAULT_SETTINGS).trainingSession, null);
});

test("mixed review prioritizes due learned patterns and persists independent identification", () => {
  const now = new Date("2026-01-03T00:00:00Z");
  const due: PuzzleRow = { ...basic, id: "lichess:due01", source: "lichess", pattern: "boden", due_at: "2026-01-02T00:00:00Z", reviews: [{ at: "2026-01-01T00:00:00Z", solved: true }] };
  const ahead: PuzzleRow = { ...basic, id: "lichess:ahead", source: "lichess", pattern: "smothered", due_at: "2026-01-08T00:00:00Z", reviews: [{ at: "2026-01-01T00:00:00Z", solved: true }] };
  const fresh: PuzzleRow = { ...basic, id: "lichess:fresh", source: "lichess", pattern: "arabian" };
  assert.deepEqual(mixedPatternQueue([ahead, fresh, due], now).map(row => row.id), [due.id, ahead.id]);
  const pending = scheduleReview(due, true, now, { recognitionPending: true, hintsUsed: 1 });
  const recognized = identifyPattern(pending, "boden");
  assert.equal(recognized.reviews?.at(-1)?.recognizedPattern, true);
  assert.equal(recognized.reviews?.at(-1)?.chosenPattern, "boden");
  assert.equal(recognized.reviews?.at(-1)?.hintsUsed, 1);
  assert.equal(identifyPattern(pending, "smothered").reviews?.at(-1)?.recognizedPattern, false);
  assert.equal(identifyPattern(recognized, "smothered"), recognized);
  const restored = restorePersistedState({ puzzles: [recognized] }, DEFAULT_SETTINGS);
  assert.equal(restored.puzzles[0].reviews?.at(-1)?.recognizedPattern, true);
});
