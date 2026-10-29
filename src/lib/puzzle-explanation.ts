import { Chess, type Square } from "chess.js";
import { findPattern } from "./pattern-catalog";
import { preparePuzzle } from "./puzzle-solution";
import type { PuzzleRow } from "./types";

/** Explain concrete terminal geometry; do not infer uniqueness from a single PV. */
export function explainCuratedPuzzle(puzzle: PuzzleRow, locale: "en" | "fr" = "en"): string {
  const prepared = preparePuzzle(puzzle);
  if (!prepared || puzzle.source !== "lichess") return "";
  const chess = new Chess(puzzle.fen);
  for (const uci of prepared.lines[0].uci) chess.move({ from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] });
  if (!chess.isCheckmate()) return "";
  const defender = chess.turn();
  const king = chess.board().flat().find(piece => piece?.color === defender && piece.type === "k")!;
  const checkers = chess.attackers(king.square, puzzle.user_side);
  const blocked: string[] = [], covered: string[] = [];
  const file = king.square.charCodeAt(0), rank = Number(king.square[1]);
  for (const df of [-1,0,1]) for (const dr of [-1,0,1]) {
    if (!df && !dr || file+df<97 || file+df>104 || rank+dr<1 || rank+dr>8) continue;
    const square = `${String.fromCharCode(file+df)}${rank+dr}` as Square;
    if (chess.get(square)?.color === defender) blocked.push(square);
    else covered.push(square);
  }
  let alternative = "";
  if (prepared.lines[0].uci.length === 1) {
    const initial = new Chess(puzzle.fen);
    for (const move of initial.moves({verbose:true})) {
      if (move.lan === prepared.lines[0].uci[0]) continue;
      const test = new Chess(puzzle.fen); test.move(move.san);
      if (!test.isCheck() || test.isCheckmate()) continue;
      const reply = test.moves({verbose:true}).find(reply => reply.piece === "k" || reply.captured === move.piece);
      if (!reply) continue;
      alternative = locale === "fr" ? ` L’échec tentant ${move.san} n’est pas mat : ${reply.san} est une réponse légale.` : ` The tempting check ${move.san} is not mate: ${reply.san} is a legal reply.`;
      break;
    }
  }
  const principle = findPattern(puzzle.pattern ?? "")?.principle[locale] ?? "";
  return locale === "fr"
    ? `${principle} La suite publiée se termine par ${prepared.lines[0].san.at(-1)}. Le roi en ${king.square} est en échec par ${checkers.join(", ")}. ${blocked.length ? `Ses pièces bloquent ${blocked.join(", ")}. ` : ""}${covered.length ? `Les autres cases voisines (${covered.join(", ")}) ne permettent aucune fuite légale. ` : ""}La ligne est vérifiée jusqu’au mat ; elle ne prouve pas que tous les autres coups perdent.${alternative}`
    : `${principle} The published line ends with ${prepared.lines[0].san.at(-1)}. The king on ${king.square} is checked by ${checkers.join(", ")}. ${blocked.length ? `Its own pieces block ${blocked.join(", ")}. ` : ""}${covered.length ? `The remaining adjacent squares (${covered.join(", ")}) offer no legal king escape. ` : ""}The line is verified through checkmate; it does not prove that every alternative loses.${alternative}`;
}
