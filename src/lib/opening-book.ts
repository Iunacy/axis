import { Chess } from "chess.js";
import { OPENING_SUPPLEMENTS } from "./opening-supplement";
import reference from "./data/openings.json";
import { openingPositionKey } from "./opening-import";

export const OPENING_REFERENCE = reference.source;
export const OPENING_BOOK_VERSION = 3;
export type OpeningIdentity = { eco: string; name: string };
const positions = new Map((reference.positions as [string, string[], number[]][]).map(([key, moves, openings]) => [key, { moves, openings }]));

const supplemental = new Map<string, { moves: Set<string>; references: Set<number> }>();
OPENING_SUPPLEMENTS.forEach((source, index) => {
  for (const pgn of source.lines) {
    const game = new Chess(); game.loadPgn(pgn, { strict: true });
    const chess = new Chess();
    for (const move of game.history({verbose:true})) {
      const key = openingPositionKey(chess.fen());
      const node = supplemental.get(key) ?? {moves: new Set<string>(), references: new Set<number>()};
      node.moves.add(move.lan); node.references.add(index); supplemental.set(key,node);
      chess.move(move.san);
    }
  }
});

/** Source-supported outgoing edges and named positions; no engine/popularity inference. */
export function lookupOpeningPosition(fen: string): { continuations: string[]; openings: OpeningIdentity[]; source: typeof OPENING_REFERENCE; references: { label: string; url: string }[] } {
  let node, extra;
  try { const key = openingPositionKey(fen); node = positions.get(key); extra = supplemental.get(key); } catch {}
  return {
    continuations: [...new Set([...(node?.moves ?? []), ...(extra?.moves ?? [])])].sort(),
    references: [...(node ? [{label: "Lichess chess-openings · CC0", url: OPENING_REFERENCE.repository}] : []), ...[...(extra?.references ?? [])].map(index => ({label:OPENING_SUPPLEMENTS[index].label,url:OPENING_SUPPLEMENTS[index].url}))],
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
