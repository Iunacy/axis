import { Chess } from "chess.js";
import type { MoveAssessment, PositionEvaluation } from "./types";
import { validCachedEvaluation } from "./engine-protocol";

export const CLASSIFICATION_POLICY = {
  version: 3,
  source: "https://official-stockfish.github.io/docs/stockfish-wiki/UCI-Protocol-and-Stockfish-Commands.html",
  accuracySource: "https://lichess.org/page/accuracy",
  minimumDepth: 12,
  expectedLoss: { excellent: .01, good: .05, inaccuracy: .05, mistake: .10, blunder: .20 },
  criticalAlternativeGap: .15,
  limitations: "AXIS labels and accuracy are independent expected-outcome review heuristics, not Stockfish annotations or calibrated measurements of human skill. WDL describes engine self-play. A Miss can identify an unplayed legal mate in one even when an advantage survives. Finite searches can miss tactics. Low-depth and contradictory evidence is left unclassified. Book coverage is a bounded opening reference. Exceptional labels require a second larger search and sustained material loss in the verified line; they are conservative and not an exhaustive proof of soundness.",
} as const;

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function score(result: PositionEvaluation, color: "w" | "b", useWdl: boolean): number {
  if (result.mate) return result.mate.winner === color ? 1 : 0;
  const white = useWdl && result.wdlWhite ? (result.wdlWhite[0] + result.wdlWhite[1] / 2) / 1000 : 1 / (1 + Math.exp(-.00368208 * Math.max(-1500, Math.min(1500, result.cpWhite))));
  return color === "w" ? white : 1 - white;
}

export function expectedLoss(before: PositionEvaluation, after: PositionEvaluation, color: "w" | "b"): number {
  const wdl = Boolean(before.wdlWhite && after.wdlWhite);
  return Math.max(0, score(before, color, wdl) - score(after, color, wdl));
}

function balance(chess: Chess, color: "w" | "b") {
  return chess.board().flat().reduce((total, piece) => total + (piece ? VALUES[piece.type] * (piece.color === color ? 1 : -1) : 0), 0);
}

export function sustainedSacrifice(fen: string, moves: string[], strict = true): boolean {
  if (moves.length < 2) return false;
  try {
    const chess = new Chess(fen); const color = chess.turn(); const initial = balance(chess, color);
    if (strict && initial > 1) return false;
    const first = chess.move({ from: moves[0].slice(0, 2), to: moves[0].slice(2, 4), promotion: moves[0][4] });
    if (first.piece === "p" || first.piece === "k") return false;
    const reply = chess.move({ from: moves[1].slice(0, 2), to: moves[1].slice(2, 4), promotion: moves[1][4] });
    if (reply.to !== first.to || reply.captured !== first.piece || balance(chess, color) > initial - 2) return false;
    if (!strict) return true;
    for (let index = 2; index < moves.length; index++) {
      const uci = moves[index]; chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      if (index % 2 === 1 && balance(chess, color) > initial - 2) return false;
    }
    return balance(chess, color) <= initial - 2 && (moves.length >= 8 || chess.isCheckmate() && chess.turn() !== color);
  } catch { return false; }
}

function mateLine(fen: string, evaluation: PositionEvaluation, color: "w" | "b"): boolean {
  if (evaluation.mate?.winner !== color) return false;
  try {
    const chess = new Chess(fen);
    for (const uci of evaluation.pvUci) chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return chess.isCheckmate() && chess.turn() !== color;
  } catch { return false; }
}

export function classifyMove({ fen, fenAfter, uci, before, after, ply, book = false, confirmation }: { fen: string; fenAfter: string; uci: string; before: PositionEvaluation; after: PositionEvaluation; ply: number; book?: boolean; confirmation?: PositionEvaluation }): MoveAssessment {
  const chess = new Chess(fen); const color = chess.turn();
  const depth = Math.min(before.depth ?? 0, after.depth ?? 0);
  const result: MoveAssessment = { ply, color, classification: null, expectedLoss: null, confidence: "limited", reason: "insufficient-evidence", depth };
  if (!validCachedEvaluation(before, fen) || !validCachedEvaluation(after, fenAfter)) return result;
  try { chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); if (chess.fen() !== fenAfter) return result; } catch { return result; }
  const best = uci === before.bestUci;
  const loss = best ? 0 : expectedLoss(before, after, color);
  const terminal = chess.isGameOver();
  const reliable = (before.depth ?? 0) >= CLASSIFICATION_POLICY.minimumDepth && ((after.depth ?? 0) >= CLASSIFICATION_POLICY.minimumDepth || terminal);
  if (!reliable && !book) return result;
  result.expectedLoss = Math.round(loss * 10000) / 10000;
  result.confidence = reliable ? "supported" : "limited";
  const set = (classification: NonNullable<MoveAssessment["classification"]>, reason: string, confirmed = false) => ({ ...result, classification, reason, confidence: confirmed ? "confirmed" as const : result.confidence });
  if (reliable && before.mate?.moves === 1 && mateLine(fen, before, color) && !chess.isCheckmate()) return set("miss", "missed-mate-in-one");
  if (reliable && loss >= .05) {
    if ((after.depth ?? 0) >= 16 && mateLine(fen, before, color) && score(after, color, Boolean(after.wdlWhite)) <= .65) return set("miss", "missed-verified-mate");
    return loss >= .20 ? set("blunder", "expected-outcome-loss") : loss >= .10 ? set("mistake", "expected-outcome-loss") : set("inaccuracy", "expected-outcome-loss");
  }
  if (book) return set("book", "opening-reference");
  if (best) {
    const second = before.lines?.[1];
    const confirmed = confirmation && validCachedEvaluation(confirmation, fen) && confirmation.bestUci === uci && (confirmation.depth ?? 0) >= (before.depth ?? 0) + 2 && Math.abs(score(confirmation, color, Boolean(confirmation.wdlWhite && before.wdlWhite)) - score(before, color, Boolean(confirmation.wdlWhite && before.wdlWhite))) <= .05;
    const gap = second ? score(before, color, Boolean(before.wdlWhite && second.wdlWhite)) - score({ ...second, bestUci: second.pvUci[0] }, color, Boolean(before.wdlWhite && second.wdlWhite)) : 0;
    const confirmedSecond = confirmation?.lines?.[1];
    const confirmedGap = confirmation && confirmedSecond ? score(confirmation, color, Boolean(confirmation.wdlWhite && confirmedSecond.wdlWhite)) - score({ ...confirmedSecond, bestUci: confirmedSecond.pvUci[0] }, color, Boolean(confirmation.wdlWhite && confirmedSecond.wdlWhite)) : 0;
    if (confirmed && (before.depth ?? 0) >= 16 && gap >= .15 && confirmedGap >= .15 && new Chess(fen).moves().length > 1 && score(before, color, Boolean(before.wdlWhite)) >= .45) {
      if ((before.depth ?? 0) >= 20 && (confirmation.depth ?? 0) >= 22 && sustainedSacrifice(fen, before.pvUci) && sustainedSacrifice(fen, confirmation.pvUci)) return set("brilliant", "confirmed-sustained-sacrifice", true);
      return set("great", "confirmed-critical-only-move", true);
    }
    return set("best", "engine-first-choice");
  }
  return loss <= .01 ? set("excellent", "near-best-outcome") : set("good", "small-outcome-loss");
}

export function verificationCandidates(fens: string[], moves: { uci: string; color: "w" | "b" }[], evaluations: PositionEvaluation[]): number[] {
  return moves.map((move, index) => {
    const before = evaluations[index]; const after = evaluations[index + 1];
    if (!before || !after) return { index, priority: 0 };
    const loss = move.uci === before.bestUci ? 0 : expectedLoss(before, after, move.color);
    const sacrifice = move.uci === before.bestUci && sustainedSacrifice(fens[index], before.pvUci, false);
    const previous = evaluations[index - 1];
    const opportunity = move.uci === before.bestUci && previous && expectedLoss(before, previous, move.color) >= .15;
    return { index, priority: sacrifice ? 3 : opportunity ? 2 : loss >= .05 ? 1 + loss : 0 };
  }).filter(row => row.priority > 0).sort((a, b) => b.priority - a.priority || a.index - b.index).slice(0, 6).map(row => row.index).sort((a, b) => a - b);
}
