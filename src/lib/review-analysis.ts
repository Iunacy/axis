import { OPENING_BOOK_VERSION } from "./opening-book";
import { parsePgn } from "./pgn";
import { ENGINE_ID, validCachedEvaluation } from "./engine-protocol";
import type { AnalysisSummary, GameRow, PositionEvaluation } from "./types";

export function needsAutomaticReview(game: GameRow, saved?: AnalysisSummary): boolean {
  if (["failed", "skipped"].includes(game.analysis_status)) return false;
  if (game.analysis_status !== "done" || !saved || saved.complete === false || saved.engineId !== ENGINE_ID) return true;
  if (saved.openingBookVersion !== OPENING_BOOK_VERSION) return true;
  const parsed = parsePgn(game.pgn);
  if (!parsed || saved.positionEvals?.length !== parsed.fens.length || saved.evaluations?.length !== parsed.fens.length || saved.moveAssessments?.length !== parsed.moves.length) return true;
  if (!saved.positionEvals.every((evaluation, index) => validCachedEvaluation(evaluation, parsed.fens[index]) && evaluation.engineId === ENGINE_ID && evaluation.cpWhite === saved.evaluations![index])) return true;
  if (!saved.moveAssessments.every((move,index) => move.ply === index + 1 && move.color === parsed.moves[index].color)) return true;
  // Upgrade older incomplete rating coverage once, without endlessly reopening
  // positions which remain uncertain after the bounded coverage pass.
  return saved.ratingCoverageVersion !== 1 && saved.moveAssessments.some(move => move.classification === null);
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
