import { Chess } from "chess.js";
import reference from "./data/openings.json";

export const OPENING_REFERENCE = reference.source;
const start = new Chess().fen();
const prefixes = new Set<string>();
const names = new Map<string, { eco: string; name: string }>();
for (const [eco, name, moves] of reference.rows as [string, string, string[]][]) {
  for (let index = 1; index <= moves.length; index++) prefixes.add(moves.slice(0, index).join(" "));
  names.set(moves.join(" "), { eco, name });
}

export function isBookMove(initialFen: string, playedMoves: string[]): boolean {
  return initialFen === start && prefixes.has(playedMoves.join(" "));
}

export function identifyOpening(initialFen: string, playedMoves: string[]): { eco: string; name: string } | undefined {
  if (initialFen !== start) return;
  for (let length = playedMoves.length; length > 0; length--) {
    const known = names.get(playedMoves.slice(0, length).join(" "));
    if (known) return known;
  }
}
