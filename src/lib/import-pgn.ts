import { parsePgn, resultForUser } from "./pgn";
import type { GameRow } from "./types";

function hash(text: string): string {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0).toString(36);
}

export function importPgnText(text: string, userColor: "w" | "b"): GameRow[] {
  if (text.length > 2_000_000) throw new Error("PGN file is larger than 2 MB.");
  const blocks = text.trim().split(/(?=\[Event\s+")/).filter(Boolean);
  const games: GameRow[] = [];
  for (const block of blocks) {
    const parsed = parsePgn(block);
    if (!parsed || !parsed.moves.length || !["1-0", "0-1", "1/2-1/2"].includes(parsed.headers.Result)) continue;
    const date = parsed.headers.UTCDate || parsed.headers.Date;
    const parsedDate = /^\d{4}\.\d{2}\.\d{2}$/.test(date ?? "") ? new Date(`${date.replaceAll(".", "-")}T12:00:00Z`) : null;
    const playedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString();
    const opponent = userColor === "w" ? parsed.headers.Black : parsed.headers.White;
    const ratingText = userColor === "w" ? parsed.headers.WhiteElo : parsed.headers.BlackElo;
    const opponentRatingText = userColor === "w" ? parsed.headers.BlackElo : parsed.headers.WhiteElo;
    const normalized = parsed.fens.join("|");
    const identity = [normalized, parsed.headers.Date, parsed.headers.White, parsed.headers.Black, parsed.headers.Site, parsed.headers.Result, userColor].join("|");
    const id = `pgn:${hash(identity)}:${parsed.moves.length}`;
    games.push({
      id, platform: "pgn", external_id: id, url: null, pgn: block,
      time_class: "rapid", time_control: parsed.headers.TimeControl || null,
      rated: false, played_at: playedAt, user_color: userColor,
      user_rating: Number(ratingText) || null, opponent_rating: Number(opponentRatingText) || null,
      opponent_name: opponent || null, result: resultForUser(parsed.headers.Result, userColor),
      eco: parsed.headers.ECO || null, opening_name: parsed.headers.Opening || null,
      accuracy_user: null, analysis_status: "pending",
    });
  }
  return games;
}
