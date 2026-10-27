import { Chess } from "chess.js";
import type { EngineLine, PositionEvaluation } from "./types";

export interface PositionHistory { initialFen: string; moves: string[] }
export interface SearchOptions { depth?: number; nodes?: number; multiPv?: number; movetimeMs?: number }
export interface SearchLimits { depth: number; nodes: number; multiPv: number; movetimeMs: number }
export const ENGINE_ID = "stockfish.js-18.0.7-lite-single/v2";

export function searchLimits(options: SearchOptions = {}): SearchLimits {
  const clamp = (value: number | undefined, fallback: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value! : fallback)));
  const timed = options.movetimeMs !== undefined;
  return { depth: timed ? 0 : clamp(options.depth, 16, 8, 24), nodes: timed ? 0 : clamp(options.nodes, 60000, 1000, 2000000), multiPv: clamp(options.multiPv, 1, 1, 5), movetimeMs: timed ? clamp(options.movetimeMs, 300, 40, 10000) : 0 };
}

export function positionCommand(fen: string, history?: PositionHistory): string {
  const position = new Chess(history?.initialFen ?? fen);
  if (history) for (const uci of history.moves) position.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  if (position.fen() !== new Chess(fen).fen()) throw new Error("Position history does not match this board.");
  return `position fen ${history?.initialFen ?? fen}${history?.moves.length ? ` moves ${history.moves.join(" ")}` : ""}`;
}

export function evaluationKey(fen: string, limits: SearchLimits, history?: PositionHistory, hashMb = 32): string {
  positionCommand(fen, history);
  return JSON.stringify([ENGINE_ID, fen, history?.initialFen ?? fen, history?.moves ?? [], limits, hashMb, 1]);
}

function legalPv(fen: string, moves: string[]): boolean {
  try {
    const chess = new Chess(fen);
    for (const uci of moves) {
      if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return false;
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    }
    return true;
  } catch { return false; }
}

export function parseEngineResult(fen: string, output: string[], multiPv = 1, history?: PositionHistory): PositionEvaluation {
  positionCommand(fen, history);
  const chess = new Chess(history?.initialFen ?? fen);
  if (history) for (const uci of history.moves) chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  const side = chess.turn() === "w" ? 1 : -1;
  if (chess.isCheckmate()) return { cpWhite: -10000 * side, bestUci: null, pvUci: [], depth: 0, nodes: 0, mate: { winner: chess.turn() === "w" ? "b" : "w", moves: 0 }, lines: [] };
  if (chess.isDraw()) return { cpWhite: 0, bestUci: null, pvUci: [], depth: 0, nodes: 0, wdlWhite: [0, 1000, 0], lines: [] };
  const best = output.findLast(line => line.startsWith("bestmove "))?.split(/\s+/)[1];
  if (!best || !legalPv(fen, [best])) throw new Error("Stockfish returned no legal best move.");
  const depths = new Map<number, Map<number, EngineLine>>();
  for (const line of output) {
    if (!line.startsWith("info ") || /\b(lowerbound|upperbound)\b/.test(line)) continue;
    const score = line.match(/\bscore (cp|mate) (-?\d+)/);
    const depth = Number(line.match(/\bdepth (\d+)/)?.[1]);
    const pv = line.match(/\bpv (.+)$/)?.[1].trim().split(/\s+/).slice(0, 24);
    if (!score || !Number.isFinite(depth) || !pv?.length || !legalPv(fen, pv)) continue;
    const index = Number(line.match(/\bmultipv (\d+)/)?.[1] ?? 1);
    const value = Number(score[2]);
    const mate = score[1] === "mate" ? { winner: (value > 0 ? chess.turn() : chess.turn() === "w" ? "b" : "w") as "w" | "b", moves: Math.abs(value) } : undefined;
    const cpWhite = (mate ? (value > 0 ? 10000 - Math.min(999, Math.abs(value)) : -10000 + Math.min(999, Math.abs(value))) : value) * side;
    const rawWdl = line.match(/\bwdl (\d+) (\d+) (\d+)/);
    const wdl = rawWdl ? rawWdl.slice(1).map(Number) as [number, number, number] : undefined;
    const wdlWhite = wdl && wdl.reduce((sum, number) => sum + number, 0) === 1000 ? side === 1 ? wdl : [wdl[2], wdl[1], wdl[0]] as [number, number, number] : undefined;
    const rows = depths.get(depth) ?? new Map<number, EngineLine>();
    rows.set(index, { cpWhite, pvUci: pv, depth, nodes: Number(line.match(/\bnodes (\d+)/)?.[1] ?? 0), mate, wdlWhite });
    depths.set(depth, rows);
  }
  const count = Math.min(multiPv, chess.moves().length);
  const complete = [...depths.entries()].sort(([a], [b]) => b - a).find(([, rows]) => rows.get(1)?.pvUci[0] === best && Array.from({ length: count }, (_, index) => rows.has(index + 1)).every(Boolean));
  if (!complete) throw new Error("Stockfish returned an incomplete evaluation. Retry this position.");
  const lines = Array.from({ length: count }, (_, index) => complete[1].get(index + 1)!);
  return { ...lines[0], bestUci: best, lines };
}

export function validCachedEvaluation(value: unknown, fen: string): value is PositionEvaluation {
  if (!value || typeof value !== "object") return false;
  const row = value as PositionEvaluation;
  const score = (line: PositionEvaluation | EngineLine) => typeof line.cpWhite === "number" && Number.isFinite(line.cpWhite)
    && typeof line.depth === "number" && Number.isFinite(line.depth) && line.depth >= 0
    && typeof line.nodes === "number" && Number.isFinite(line.nodes) && line.nodes >= 0
    && (line.mate === undefined || line.mate !== null && ["w", "b"].includes(line.mate.winner) && Number.isInteger(line.mate.moves) && line.mate.moves >= 0)
    && (line.wdlWhite === undefined || Array.isArray(line.wdlWhite) && line.wdlWhite.length === 3 && line.wdlWhite.every(value => Number.isInteger(value) && value >= 0) && line.wdlWhite.reduce((sum, number) => sum + number, 0) === 1000);
  return score(row) && Array.isArray(row.pvUci) && legalPv(fen, row.pvUci)
    && (row.bestUci === null || typeof row.bestUci === "string" && row.pvUci[0] === row.bestUci)
    && Array.isArray(row.lines) && row.lines.every(line => line && score(line) && Array.isArray(line.pvUci) && legalPv(fen, line.pvUci));
}

export function evaluationLabel(result: PositionEvaluation): string {
  if (result.mate) return result.mate.moves === 0 ? `${result.mate.winner === "w" ? "White" : "Black"} mates` : `M${result.mate.moves} ${result.mate.winner === "w" ? "White" : "Black"}`;
  return `${result.cpWhite >= 0 ? "+" : ""}${(result.cpWhite / 100).toFixed(2)}`;
}
