import { Chess } from "chess.js";
import { PATTERNS, type PatternDefinition } from "./pattern-catalog";
import type { PuzzleRow } from "./types";

const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const ID = /^[A-Za-z0-9]{5}$/;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseLichessPuzzle(value: unknown, pattern: PatternDefinition, stage: number, now = new Date()): PuzzleRow | null {
  if (!record(value) || !record(value.puzzle) || !record(value.game)) return null;
  const puzzle = value.puzzle;
  const game = value.game;
  const initialPly = puzzle.initialPly;
  if (typeof puzzle.id !== "string" || !ID.test(puzzle.id) || puzzle.id !== pattern.ids[stage]
    || typeof puzzle.rating !== "number" || !Number.isFinite(puzzle.rating) || puzzle.rating < 400 || puzzle.rating > 3000
    || !Array.isArray(puzzle.themes) || !puzzle.themes.every(theme => typeof theme === "string") || !puzzle.themes.includes(pattern.lichessTheme)
    || !Array.isArray(puzzle.solution) || !puzzle.solution.length || puzzle.solution.length % 2 !== 1
    || puzzle.solution.length > 19 || !puzzle.solution.every(move => typeof move === "string" && UCI.test(move))
    || typeof initialPly !== "number" || !Number.isInteger(initialPly) || initialPly < 0
    || typeof game.id !== "string" || typeof game.pgn !== "string" || game.pgn.length > 4000) return null;
  const notation = game.pgn.trim().split(/\s+/);
  if (notation.length !== initialPly + 1 || notation.length > 300) return null;
  try {
    const chess = new Chess();
    for (const san of notation) chess.move(san);
    const fen = chess.fen();
    const user_side = chess.turn();
    const canonical: string[] = [];
    const solution_san: string[] = [];
    const reply_san: string[] = [];
    for (let index = 0; index < puzzle.solution.length; index++) {
      const move = puzzle.solution[index] as string;
      const played = chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
      if (!played) return null;
      canonical.push(`${played.from}${played.to}${played.promotion ?? ""}`);
      if (index % 2 === 0) solution_san.push(played.san);
      else reply_san.push(played.san);
    }
    if (!chess.isCheckmate()) return null;
    return {
      id: `lichess:${puzzle.id}`, game_id: `lichess:${game.id}`, fen, solution_san, reply_san,
      solution_lines_uci: [canonical], theme: "other", user_side,
      source_url: `https://lichess.org/training/${puzzle.id}`,
      source: "lichess", pattern: pattern.id, rating: puzzle.rating,
      rating_deviation: typeof puzzle.ratingDeviation === "number" && Number.isFinite(puzzle.ratingDeviation) ? puzzle.ratingDeviation : undefined,
      themes: puzzle.themes as string[],
      opening_tags: Array.isArray(puzzle.openingTags) && puzzle.openingTags.every(tag => typeof tag === "string") ? puzzle.openingTags as string[] : undefined,
      license: "CC0-1.0", difficulty: stage === 0 ? "easy" : stage === 1 ? "medium" : "hard",
      kind: "tactic", attempts: 0, solved: false, created_at: now.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function fetchCuratedPatterns(patterns: readonly PatternDefinition[] = PATTERNS): Promise<PuzzleRow[]> {
  const requested = patterns.flatMap(pattern => pattern.ids);
  if (!requested.length) return [];
  if (new Set(requested).size !== requested.length) throw new Error("The curated puzzle list contains duplicate IDs.");
  const response = await fetch(`https://lichess.org/api/puzzle/many?ids=${requested.join(",")}`, {
    headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Lichess puzzle request failed (${response.status}).`);
  const payload: unknown = await response.json();
  if (!record(payload) || !Array.isArray(payload.puzzles)) throw new Error("Lichess returned an unreadable puzzle set.");
  const rows = new Map<string, unknown>();
  for (const row of payload.puzzles) if (record(row) && record(row.puzzle) && typeof row.puzzle.id === "string") rows.set(row.puzzle.id, row);
  const imported: PuzzleRow[] = [];
  for (const pattern of patterns) for (let stage = 0; stage < pattern.ids.length; stage++) {
    const row = parseLichessPuzzle(rows.get(pattern.ids[stage]), pattern, stage);
    if (!row) throw new Error(`Could not verify Lichess puzzle ${pattern.ids[stage]}.`);
    imported.push(row);
  }
  return imported;
}
