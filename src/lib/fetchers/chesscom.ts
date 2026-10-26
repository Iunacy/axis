import { AppError } from "../errors";
import { normalizeTimeClass, openingNameFromEcoUrl, resultForUser } from "../pgn";
import type { GameRow, Platform } from "../types";

const BASE = "https://api.chess.com/pub";

interface ChesscomGame {
  url: string;
  pgn: string;
  time_control: string;
  end_time: number;
  rated: boolean;
  accuracies?: { white: number; black: number };
  uuid: string;
  time_class: string;
  rules: string;
  white: { username: string; rating: number; result: string };
  black: { username: string; rating: number; result: string };
  eco?: string;
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (res.status === 429) throw new AppError("syncRateLimit");
  if (!res.ok) throw new AppError("network");
  return (await res.json()) as T;
}

export async function fetchChesscomGames(username: string, maxGames = 300, since = 0): Promise<GameRow[]> {
  const res = await fetch(`${BASE}/player/${encodeURIComponent(username.trim())}/games/archives`, { signal: AbortSignal.timeout(20000) });
  if (res.status === 404) throw new AppError("syncUserNotFound");
  if (res.status === 429) throw new AppError("syncRateLimit");
  if (!res.ok) throw new AppError("network");
  const archives = (await res.json()) as { archives: string[] };
  if (!archives?.archives?.length) return [];

  const out: GameRow[] = [];
  const lower = username.trim().toLowerCase();
  const sinceMonth = since > 0 ? new Date(since).toISOString().slice(0, 7).replace("-", "/") : null;

  for (const archiveUrl of [...archives.archives].reverse()) {
    if (out.length >= maxGames) break;
    const archiveMonth = archiveUrl.match(/\/(\d{4}\/\d{2})$/)?.[1];
    if (sinceMonth && archiveMonth && archiveMonth < sinceMonth) continue;
    const month = await getJson<{ games: ChesscomGame[] }>(archiveUrl);
    if (!month) continue;

    for (const g of [...month.games].reverse()) {
      if (out.length >= maxGames) break;
      if (g.rules !== "chess" || !g.pgn || !g.end_time || g.end_time * 1000 < since || !/\[Result "(?:1-0|0-1|1\/2-1\/2)"\]/.test(g.pgn)) continue;
      if (![g.white.username.toLowerCase(), g.black.username.toLowerCase()].includes(lower)) continue;
      const userIsWhite = g.white.username.toLowerCase() === lower;
      const userColor: "w" | "b" = userIsWhite ? "w" : "b";
      const me = userIsWhite ? g.white : g.black;
      const opp = userIsWhite ? g.black : g.white;
      const pgnResult =
        me.result === "win" ? (userIsWhite ? "1-0" : "0-1")
        : opp.result === "win" ? (userIsWhite ? "0-1" : "1-0")
        : "1/2-1/2";
      const ecoUrlMatch = g.pgn.match(/\[ECOUrl "([^"]+)"\]/);

      out.push({
        id: `chesscom:${g.uuid || g.url}`,
        platform: "chesscom" as Platform,
        external_id: g.uuid || g.url,
        analysis_status: "pending",
        url: g.url,
        pgn: g.pgn,
        time_class: normalizeTimeClass(g.time_class),
        time_control: g.time_control,
        rated: g.rated,
        played_at: new Date(g.end_time * 1000).toISOString(),
        user_color: userColor,
        user_rating: me.rating ?? null,
        opponent_rating: opp.rating ?? null,
        opponent_name: opp.username ?? null,
        result: resultForUser(pgnResult, userColor),
        eco: g.eco ?? (g.pgn.match(/\[ECO "([^"]+)"\]/)?.[1] ?? null),
        opening_name: openingNameFromEcoUrl(ecoUrlMatch?.[1]),
        accuracy_user: userIsWhite ? g.accuracies?.white ?? null : g.accuracies?.black ?? null,
      });
    }
  }
  return out;
}
