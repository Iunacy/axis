import { Chess, type Square } from "chess.js";

export function boardPoint(square: string, orientation: "w" | "b") {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return orientation === "w" ? { x: file + .5, y: 7.5 - rank } : { x: 7.5 - file, y: rank + .5 };
}

export function promotionChoices(fen: string, from: Square, to: Square): string[] {
  return new Chess(fen).moves({ square: from, verbose: true }).filter(move => move.to === to && move.promotion).map(move => move.promotion!);
}

export function matchesUciMove(fen: string, san: string, expected: string | null): boolean {
  if (!expected) return false;
  try {
    const move = new Chess(fen).move(san);
    return `${move.from}${move.to}${move.promotion ?? ""}` === expected;
  } catch { return false; }
}
