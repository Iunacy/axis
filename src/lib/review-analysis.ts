import { ENGINE_ID, validCachedEvaluation } from "./engine-protocol";
import type { AnalysisSummary, GameRow, PositionEvaluation } from "./types";

export function needsAutomaticReview(game: GameRow, saved?: AnalysisSummary): boolean {
  return !["failed", "skipped"].includes(game.analysis_status) && !(game.analysis_status === "done" && saved && saved.complete !== false && saved.engineId === ENGINE_ID);
}

// Only reuse a contiguous, position-matched prefix. A gap must never shift the
// correspondence between evaluation index and game ply.
export function resumableEvaluations(fens: string[], saved?: AnalysisSummary): PositionEvaluation[] {
  if (saved?.engineId !== ENGINE_ID) return [];
  const prefix: PositionEvaluation[] = [];
  for (const evaluation of saved?.positionEvals ?? []) {
    if (prefix.length >= fens.length || !validCachedEvaluation(evaluation, fens[prefix.length])) break;
    prefix.push(evaluation);
  }
  return prefix;
}
