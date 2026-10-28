import { Chess } from "chess.js";
import { preparePuzzle } from "./puzzle-solution";
import type { GameRow, MoveIssue, PuzzleRow } from "./types";
import type { ReviewPractice } from "./review-position";

export function reviewAttemptEvidence(practice: ReviewPractice, attempts: number, solved: boolean, now: number) {
  return { firstAttempt: attempts === 0, wrongMoves: practice.wrongMoves, hintsUsed: solved ? 0 : 1, solutionRevealed: !solved, elapsedMs: Math.max(0, now - practice.startedAt) };
}

// A corrective first-move drill shares the existing puzzle queue and review history.
export function reviewExercise(game: GameRow, issue: MoveIssue, now = new Date()): PuzzleRow | null {
  if (!issue.bestUci) return null;
  try {
    const chess = new Chess(issue.fenBefore);
    const side = chess.turn();
    const move = chess.move({ from: issue.bestUci.slice(0, 2), to: issue.bestUci.slice(2, 4), promotion: issue.bestUci[4] });
    const puzzle: PuzzleRow = {
      id: `review:${game.id}:${issue.ply}:${issue.bestUci}`, game_id: game.id,
      fen: issue.fenBefore, solution_san: [move.san], reply_san: [], solution_lines_uci: [[issue.bestUci]],
      theme: issue.motif, severity: issue.severity, user_side: side, source_url: game.url,
      attempts: 0, solved: false, created_at: now.toISOString(), source: "game", played_san: issue.san,
    };
    return preparePuzzle(puzzle) ? puzzle : null;
  } catch { return null; }
}
