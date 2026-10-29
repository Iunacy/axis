import { importRequest, type ImportOptions } from "./request";
import { lichessSpeedToTimeClass, resultForUser } from "../pgn";
import type { GameRow, Platform } from "../types";

interface LichessGame {
  id: string;
  rated: boolean;
  variant: string;
  speed: string;
  createdAt: number;
  status: string;
  winner?: "white" | "black";
  players: {
    white: { user?: { name: string }; rating?: number };
    black: { user?: { name: string }; rating?: number };
  };
  opening?: { eco: string; name: string };
  pgn: string;
}

export interface LichessPage { games: GameRow[]; nextUntil: number; latest: number; complete: boolean }
export async function* lichessPages(username: string, options: ImportOptions & { since?: number; until?: number } = {}): AsyncGenerator<LichessPage> {
  let until = options.until ?? Date.now();
  const since = options.since ?? 0;
  const pageSize = 100;
  const seen = new Set<string>();
  while (until >= since) {
    const params = new URLSearchParams({ max: String(pageSize), until: String(until), since: String(since), pgnInJson: "true", opening: "true", finished: "true", ongoing: "false", perfType: "ultraBullet,bullet,blitz,rapid,classical,correspondence" });
    const response = await importRequest(`https://lichess.org/api/games/user/${encodeURIComponent(username.trim())}?${params}`, options, { Accept: "application/x-ndjson" });
    const rows: LichessGame[] = [];
    // Each response is capped to 100 games rather than an entire account history.
    for (const line of (await response.text()).split("\n")) {
      if (!line.trim()) continue;
      const row = JSON.parse(line) as LichessGame;
      if (typeof row.id !== "string" || !Number.isFinite(row.createdAt)) throw new Error("Lichess returned an invalid game page.");
      rows.push(row);
    }
    const oldest = rows.reduce((time, row) => Math.min(time, row.createdAt), until);
    const games = parseLichessGames(rows, username).filter(game => !seen.has(game.id));
    for (const game of games) seen.add(game.id);
    const complete = rows.length < pageSize;
    yield { games, nextUntil: oldest, latest: rows.reduce((time, row) => Math.max(time, row.createdAt), 0), complete };
    if (complete) return;
    // Overlap the boundary millisecond so simultaneous games are not silently lost.
    if (oldest >= until) throw new Error("Lichess pagination did not advance. Imported pages are saved; retry later.");
    until = oldest;
  }
}

function parseLichessGames(rows: LichessGame[], username: string): GameRow[] {
  const lower = username.toLowerCase();
  const out: GameRow[] = [];

  for (const g of rows) {
    if (g.variant !== "standard" || !g.pgn || ["created", "started"].includes(g.status)) continue;
    const whiteName = g.players.white.user?.name?.toLowerCase() ?? "";
    if (![whiteName, g.players.black.user?.name?.toLowerCase()].includes(lower)) continue;
    const userIsWhite = whiteName === lower;
    const userColor: "w" | "b" = userIsWhite ? "w" : "b";
    const me = userIsWhite ? g.players.white : g.players.black;
    const opp = userIsWhite ? g.players.black : g.players.white;
    const pgnResult = g.winner === "white" ? "1-0" : g.winner === "black" ? "0-1" : "1/2-1/2";

    out.push({
      id: `lichess:${g.id}`,
      platform: "lichess" as Platform,
      external_id: g.id,
      analysis_status: "pending",
      url: `https://lichess.org/${g.id}`,
      pgn: g.pgn,
      time_class: lichessSpeedToTimeClass(g.speed),
      time_control: null,
      rated: g.rated,
      played_at: new Date(g.createdAt).toISOString(),
      user_color: userColor,
      user_rating: me.rating ?? null,
      opponent_rating: opp.rating ?? null,
      opponent_name: opp.user?.name ?? null,
      result: resultForUser(pgnResult, userColor),
      eco: g.opening?.eco ?? null,
      opening_name: g.opening?.name ?? null,
      accuracy_user: null,
    });
  }
  return out;
}

export async function fetchLichessGames(username: string, maxGames = Infinity): Promise<GameRow[]> {
  const games: GameRow[] = [];
  for await (const page of lichessPages(username)) {
    games.push(...page.games);
    if (games.length >= maxGames) break;
  }
  return games.slice(0, maxGames);
}
