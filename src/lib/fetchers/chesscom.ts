import { importRequest, type ImportOptions } from "./request";
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

export interface ChesscomPage { games: GameRow[]; archive: string; oldest: number; complete: boolean }
export async function* chesscomPages(username: string, options: ImportOptions & { since?: number; beforeArchive?: string } = {}): AsyncGenerator<ChesscomPage> {
  const res = await importRequest(`${BASE}/player/${encodeURIComponent(username.trim())}/games/archives`, options);
  const archives = (await res.json()) as { archives: string[] };
  if (!Array.isArray(archives.archives) || !archives.archives.every(url => typeof url === "string" && /^https:\/\/api\.chess\.com\/pub\/player\/[^/]+\/games\/\d{4}\/\d{2}$/.test(url))) throw new Error("Chess.com returned an invalid archive list.");
  const since = options.since ?? 0;
  const sinceMonth = since > 0 ? new Date(since).toISOString().slice(0, 7).replace("-", "/") : null;
  const selected = [...archives.archives].sort().reverse().filter(url => (!sinceMonth || url.slice(-7) >= sinceMonth) && (!options.beforeArchive || url <= options.beforeArchive));
  if (!selected.length) { yield { games: [], archive: "", oldest: 0, complete: true }; return; }
  for (let index = 0; index < selected.length; index++) {
    const archive = selected[index];
    const response = await importRequest(archive, options);
    const month = await response.json();
    if (!Array.isArray(month.games)) throw new Error("Chess.com returned an invalid game archive.");
    const games = parseChesscomGames(month.games, username, since);
    yield { games, archive, oldest: games.reduce((oldest, game) => Math.min(oldest, Date.parse(game.played_at)), Infinity), complete: index === selected.length - 1 };
  }
}

function parseChesscomGames(games: ChesscomGame[], username: string, since: number): GameRow[] {
  const out: GameRow[] = [];
  const lower = username.trim().toLowerCase();
  for (const g of [...games].reverse()) {
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
  return out;
}

// Compatibility helper; synchronization consumes durable monthly pages directly.
export async function fetchChesscomGames(username: string, maxGames = Infinity, since = 0): Promise<GameRow[]> {
  const games: GameRow[] = [];
  for await (const page of chesscomPages(username, { since })) {
    games.push(...page.games);
    if (games.length >= maxGames) break;
  }
  return games.slice(0, maxGames);
}
