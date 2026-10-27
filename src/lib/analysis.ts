import { Chess, type Square } from "chess.js";
import type { AnalysisSummary, Motif, MoveIssue, Phase, PositionEvaluation, MoveAssessment } from "./types";
import { classifyMove, expectedLoss } from "./move-classification";
import { identifyOpening, isBookMove } from "./opening-book";

export type PositionEval = PositionEvaluation;

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export function winProb(cpWhite: number): number {
  return 1 / (1 + Math.exp(-0.00368208 * Math.max(-1500, Math.min(1500, cpWhite))));
}

function moveAccuracy(winLossPct: number): number {
  const a = 103.1668 * Math.exp(-0.04354 * winLossPct) - 3.1669;
  return Math.max(0, Math.min(100, a));
}

export function phaseOf(fen: string, plyIndex: number): Phase {
  if (plyIndex < 20) return "opening";
  const board = fen.split(" ")[0];
  let nonPawnNonKing = 0;
  for (const ch of board) {
    if (/[nbrqNBRQ]/.test(ch)) nonPawnNonKing++;
  }
  return nonPawnNonKing <= 6 ? "endgame" : "middlegame";
}

function uciToSan(fen: string, uci: string): string | null {
  try {
    const c = new Chess(fen);
    const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return m?.san ?? null;
  } catch {
    return null;
  }
}

function isUnderdefended(chess: Chess, square: Square, ownerColor: "w" | "b"): boolean {
  const enemy = ownerColor === "w" ? "b" : "w";
  const attackers = chess.attackers(square, enemy).length;
  const defenders = chess.attackers(square, ownerColor).length;
  return attackers > defenders;
}

function createsForkLike(fen: string, uci: string): boolean {
  try {
    const c = new Chess(fen);
    const mover = c.turn();
    const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    if (!m) return false;
    const to = m.to as Square;
    let valuableTargets = 0;
    for (const row of c.board()) {
      for (const sq of row) {
        if (!sq || sq.color === mover) continue;
        if (PIECE_VALUE[sq.type] < 3 && sq.type !== "k") continue;
        const attackers = c.attackers(sq.square as Square, mover);
        if (attackers.includes(to)) valuableTargets++;
      }
    }
    return valuableTargets >= 2;
  } catch {
    return false;
  }
}

function classifyMotif(args: {
  fenBefore: string;
  fenAfter: string;
  userColor: "w" | "b";
  cpBeforeUser: number;
  cpAfterUser: number;
  bestReplyUci: string | null;
  bestMoveUci: string | null;
  beforeMate?: PositionEval["mate"];
  afterMate?: PositionEval["mate"];
}): Motif {
  const { fenAfter, userColor, cpBeforeUser, cpAfterUser, bestReplyUci, bestMoveUci, fenBefore, beforeMate, afterMate } = args;

  if (afterMate && afterMate.winner !== userColor) return "allowed_mate";
  if (beforeMate?.winner === userColor && cpAfterUser < 200) return "missed_mate";

  if (bestReplyUci) {
    try {
      const c = new Chess(fenAfter);
      const target = c.get(bestReplyUci.slice(2, 4) as Square);
      if (target && target.color === userColor) {
        if (isUnderdefended(c, bestReplyUci.slice(2, 4) as Square, userColor)) return "hanging_piece";
        const attacker = c.get(bestReplyUci.slice(0, 2) as Square);
        if (attacker && PIECE_VALUE[target.type] > PIECE_VALUE[attacker.type]) return "bad_trade";
      }
      if (createsForkLike(fenAfter, bestReplyUci)) return "allowed_fork";
    } catch {
    }
  }

  if (cpBeforeUser >= 200 && cpAfterUser < 100 && bestMoveUci) {
    try {
      const c = new Chess(fenBefore);
      const m = c.move({ from: bestMoveUci.slice(0, 2), to: bestMoveUci.slice(2, 4), promotion: bestMoveUci[4] });
      if (m && (m.captured || m.san.includes("+") || createsForkLike(fenBefore, bestMoveUci))) {
        return "missed_tactic";
      }
    } catch {
    }
  }

  return "other";
}

export interface GameForAnalysis {
  fens: string[];
  moves: { san: string; uci: string; color: "w" | "b" }[];
  userColor: "w" | "b";
  evals: PositionEval[];
  engineLabel: string;
  confirmations?: Record<number, PositionEval>;
}

export interface PuzzleCandidate {
  fen: string;
  solution_san: string[];
  reply_san: string[];
  theme: Motif;
  severity: "blunder" | "mistake" | "inaccuracy";
  user_side: "w" | "b";
  kind: "tactic" | "save";
  difficulty: "easy" | "medium" | "hard";
  played_san: string;
}

export function summarizeGame(g: GameForAnalysis): { summary: AnalysisSummary; puzzles: PuzzleCandidate[] } {
  const issues: MoveIssue[] = [];
  const assessments: MoveAssessment[] = [];
  const puzzles: PuzzleCandidate[] = [];
  const byPhase: AnalysisSummary["byPhase"] = {
    opening: { blunders: 0, mistakes: 0, moves: 0 },
    middlegame: { blunders: 0, mistakes: 0, moves: 0 },
    endgame: { blunders: 0, mistakes: 0, moves: 0 },
  };
  let cpLossSum = 0;
  let cpSamples = 0;
  let accSum = 0;
  let userMoves = 0;
  const accuracyByColor = { w: { sum: 0, count: 0 }, b: { sum: 0, count: 0 } };

  const sign = g.userColor === "w" ? 1 : -1;

  for (let i = 0; i < g.moves.length; i++) {
    const move = g.moves[i];
    const evBefore = g.evals[i];
    const evAfter = g.evals[i + 1];
    if (!evBefore || !evAfter) continue;
    const isEngineBest = move.uci === evBefore.bestUci;
    const moverDrop = isEngineBest ? 0 : expectedLoss(evBefore, evAfter, move.color);
    accuracyByColor[move.color].sum += moveAccuracy(moverDrop * 100);
    accuracyByColor[move.color].count += 1;
    const assessment = classifyMove({ fen: g.fens[i], fenAfter: g.fens[i + 1], uci: move.uci, before: evBefore, after: evAfter, ply: i + 1, book: isBookMove(g.fens[0], g.moves.slice(0, i + 1).map(move => move.uci)), confirmation: g.confirmations?.[i] });
    assessments.push(assessment);
    if (move.color !== g.userColor) continue;

    userMoves++;
    const phase = phaseOf(g.fens[i], i);
    byPhase[phase].moves++;

    const cpBeforeUser = sign * evBefore.cpWhite;
    const cpAfterUser = sign * evAfter.cpWhite;
    const winDrop = assessment.expectedLoss ?? moverDrop;

    const cpLoss = isEngineBest ? 0 : Math.max(0, cpBeforeUser - cpAfterUser);
    if (!evBefore.mate && !evAfter.mate) { cpLossSum += Math.min(cpLoss, 1000); cpSamples++; }
    accSum += moveAccuracy(moverDrop * 100);

    let severity: MoveIssue["severity"] | null = null;
    if (assessment.classification === "blunder" || assessment.classification === "mistake" || assessment.classification === "inaccuracy") severity = assessment.classification;
    else if (assessment.classification === "miss") severity = winDrop >= .2 ? "blunder" : winDrop >= .1 ? "mistake" : "inaccuracy";
    if (!severity) continue;

    if (severity === "blunder") byPhase[phase].blunders++;
    if (severity === "mistake") byPhase[phase].mistakes++;

    const bestMoveUci = evBefore.bestUci;
    const bestReplyUci = evAfter.bestUci;
    const motif = assessment.classification === "miss" && evBefore.mate?.winner === g.userColor ? "missed_mate" : classifyMotif({
      fenBefore: g.fens[i],
      fenAfter: g.fens[i + 1],
      userColor: g.userColor,
      cpBeforeUser,
      cpAfterUser,
      bestReplyUci,
      bestMoveUci,
      beforeMate: evBefore.mate,
      afterMate: evAfter.mate,
    });

    issues.push({
      ply: i + 1,
      san: move.san,
      uci: move.uci,
      fenBefore: g.fens[i],
      severity,
      motif,
      phase,
      cpBefore: cpBeforeUser,
      cpAfter: cpAfterUser,
      winDrop: Math.round(winDrop * 1000) / 1000,
      bestUci: bestMoveUci,
      bestSan: bestMoveUci ? uciToSan(g.fens[i], bestMoveUci) : null,
      continuation: legalVariation(g.fens[i], evBefore.pvUci),
      classification: assessment.classification ?? undefined,
    });

    if ((severity === "blunder" || severity === "mistake" || assessment.classification === "miss") && evBefore.pvUci.length > 0) {
      const isMateShot = evBefore.mate?.winner === g.userColor;
      const isTactic = cpBeforeUser >= 150;
      const isSave = cpBeforeUser >= -80 && cpAfterUser <= -250;

      if (isTactic || isSave) {
        const sol: string[] = [];
        const rep: string[] = [];
        const c = new Chess(g.fens[i]);
        for (let k = 0; k < Math.min(evBefore.pvUci.length, 5); k++) {
          const u = evBefore.pvUci[k];
          let san: string | null = null;
          try {
            const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
            san = m?.san ?? null;
          } catch {
            break;
          }
          if (!san) break;
          if (k % 2 === 0) sol.push(san);
          else rep.push(san);
          if (san.includes("#")) break;
        }

        if (sol.length > 0) {
          const solution = sol.slice(0, 3);
          const difficulty: PuzzleCandidate["difficulty"] =
            solution.length === 1 && (isMateShot || cpBeforeUser >= 300)
              ? "easy"
              : solution.length >= 3 || (!isMateShot && cpBeforeUser < 250)
              ? "hard"
              : "medium";

          puzzles.push({
            fen: g.fens[i],
            solution_san: solution,
            reply_san: rep.slice(0, 2),
            theme: motif,
            severity,
            user_side: g.userColor,
            kind: isTactic ? "tactic" : "save",
            difficulty,
            played_san: move.san,
          });
        }
      }
    }
  }

  const summary: AnalysisSummary = {
    acpl: cpSamples ? Math.round(cpLossSum / cpSamples) : 0,
    acplSamples: cpSamples,
    accuracy: userMoves ? Math.round((accSum / userMoves) * 10) / 10 : 0,
    blunders: issues.filter((x) => x.severity === "blunder").length,
    mistakes: issues.filter((x) => x.severity === "mistake").length,
    inaccuracies: issues.filter((x) => x.severity === "inaccuracy").length,
    issues,
    byPhase,
    engineDepthOrTime: g.engineLabel,
    evaluations: g.evals.map((e) => e.cpWhite),
    positionEvals: g.evals.slice(),
    accuracyByColor: { w: accuracyByColor.w.count ? Math.round(accuracyByColor.w.sum / accuracyByColor.w.count * 10) / 10 : null, b: accuracyByColor.b.count ? Math.round(accuracyByColor.b.sum / accuracyByColor.b.count * 10) / 10 : null },
    analysisVersion: 3,
    moveAssessments: assessments,
    opening: identifyOpening(g.fens[0], g.moves.map(move => move.uci)),
  };
  return { summary, puzzles };
}

export function legalVariation(fen: string, moves: string[]): string[] {
  const chess = new Chess(fen);
  const line: string[] = [];
  for (const uci of moves.slice(0, 8)) {
    try {
      line.push(chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san);
    } catch { break; }
  }
  return line;
}
