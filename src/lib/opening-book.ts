import { Chess } from "chess.js";
import reference from "./data/openings.json";
import { openingPositionKey } from "./opening-import";

export const OPENING_REFERENCE = reference.source;
export const OPENING_BOOK_VERSION = 2;
export type OpeningIdentity = { eco: string; name: string };
const positions = new Map((reference.positions as [string, string[], number[]][]).map(([key, moves, openings]) => [key, { moves, openings }]));

/** Source-supported outgoing edges and named positions; no engine/popularity inference. */
export function lookupOpeningPosition(fen: string): { continuations: string[]; openings: OpeningIdentity[]; source: typeof OPENING_REFERENCE } {
  let node;
  try { node = positions.get(openingPositionKey(fen)); } catch {}
  return {
    continuations: node?.moves.slice() ?? [],
    openings: node?.openings.map(index => ({ eco: reference.rows[index][0] as string, name: reference.rows[index][1] as string })) ?? [],
    source: OPENING_REFERENCE,
  };
}

export function isBookContinuation(fen: string, uci: string): boolean {
  return lookupOpeningPosition(fen).continuations.includes(uci);
}

export function isBookMove(initialFen: string, playedMoves: string[]): boolean {
  if (!playedMoves.length) return false;
  try {
    const chess = new Chess(initialFen);
    for (const uci of playedMoves.slice(0, -1)) chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return isBookContinuation(chess.fen(), playedMoves.at(-1)!);
  } catch { return false; }
}

export function identifyOpening(initialFen: string, playedMoves: string[]): OpeningIdentity | undefined {
  try {
    const chess = new Chess(initialFen);
    let latest = lookupOpeningPosition(chess.fen()).openings[0];
    for (const uci of playedMoves) {
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      latest = lookupOpeningPosition(chess.fen()).openings[0] ?? latest;
    }
    return latest;
  } catch { return undefined; }
}
