import { Chess, type Move } from "chess.js";
import type { PuzzleRow } from "./types";

export interface PreparedPuzzle {
  fen: string;
  lines: { uci: string[]; san: string[] }[];
}

export interface ReplayedPuzzlePath {
  fen: string;
  lastMove: { from: string; to: string } | null;
  lastReplySan: string | null;
  solverMoves: number;
}

function uci(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function replay(fen: string, moves: string[]): { uci: string[]; san: string[] } | null {
  try {
    const chess = new Chess(fen);
    const san: string[] = [];
    const canonical: string[] = [];
    for (const move of moves) {
      const played = chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
      if (!played) return null;
      canonical.push(uci(played));
      san.push(played.san);
    }
    return { uci: canonical, san };
  } catch {
    return null;
  }
}

function legacyLine(puzzle: PuzzleRow): string[] | null {
  try {
    const chess = new Chess(puzzle.fen);
    const line: string[] = [];
    for (let i = 0; i < puzzle.solution_san.length; i++) {
      const move = chess.move(puzzle.solution_san[i]);
      if (!move) return null;
      line.push(uci(move));
      if (i + 1 < puzzle.solution_san.length) {
        const reply = chess.move(puzzle.reply_san[i]);
        if (!reply) return null;
        line.push(uci(reply));
      }
    }
    return line;
  } catch {
    return null;
  }
}

export function preparePuzzle(puzzle: PuzzleRow): PreparedPuzzle | null {
  try {
    if (new Chess(puzzle.fen).turn() !== puzzle.user_side) return null;
  } catch {
    return null;
  }
  const raw = puzzle.solution_lines_uci?.length ? puzzle.solution_lines_uci : [legacyLine(puzzle)];
  const lines: PreparedPuzzle["lines"] = [];
  const seen = new Set<string>();
  for (const candidate of raw) {
    if (!candidate || !candidate.length || candidate.length % 2 !== 1 || candidate.length > 19) return null;
    const line = replay(puzzle.fen, candidate);
    if (!line) return null;
    const key = line.uci.join(" ");
    if (!seen.has(key)) { lines.push(line); seen.add(key); }
  }
  return lines.length ? { fen: puzzle.fen, lines } : null;
}

export function replayPuzzlePath(prepared: PreparedPuzzle, path: string[]): ReplayedPuzzlePath | null {
  if (!prepared.lines.some(line => path.length <= line.uci.length && path.every((move, index) => line.uci[index] === move))) return null;
  try {
    const chess = new Chess(prepared.fen);
    let lastMove: ReplayedPuzzlePath["lastMove"] = null;
    let lastReplySan: string | null = null;
    for (let index = 0; index < path.length; index++) {
      const move = path[index];
      const played = chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
      if (!played) return null;
      lastMove = { from: played.from, to: played.to };
      if (index % 2 === 1) lastReplySan = played.san;
    }
    return { fen: chess.fen(), lastMove, lastReplySan, solverMoves: Math.ceil(path.length / 2) };
  } catch {
    return null;
  }
}

export function playPuzzleMove(prepared: PreparedPuzzle, path: string[], fen: string, san: string):
  | { status: "wrong" }
  | { status: "solved"; path: string[]; playerFen: string; san: string }
  | { status: "continue"; path: string[]; playerFen: string; nextFen: string; reply: Move; san: string } {
  try {
    const chess = new Chess(prepared.fen);
    for (const previous of path) {
      const move = chess.move({ from: previous.slice(0, 2), to: previous.slice(2, 4), promotion: previous[4] });
      if (!move) return { status: "wrong" };
    }
    if (chess.fen() !== fen || path.length % 2 !== 0) return { status: "wrong" };
    const player = chess.move(san);
    if (!player) return { status: "wrong" };
    const playedUci = uci(player);
    const matching = prepared.lines.filter(line => path.every((move, index) => line.uci[index] === move) && line.uci[path.length] === playedUci);
    if (!matching.length) return { status: "wrong" };
    const nextPath = [...path, playedUci];
    const playerFen = chess.fen();
    const line = matching[0];
    if (line.uci.length === nextPath.length) return { status: "solved", path: nextPath, playerFen, san: player.san };
    const opponentUci = line.uci[nextPath.length];
    const reply = chess.move({ from: opponentUci.slice(0, 2), to: opponentUci.slice(2, 4), promotion: opponentUci[4] });
    if (!reply) return { status: "wrong" };
    return { status: "continue", path: [...nextPath, uci(reply)], playerFen, nextFen: chess.fen(), reply, san: player.san };
  } catch {
    return { status: "wrong" };
  }
}
