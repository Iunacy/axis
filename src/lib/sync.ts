"use client";

import { fetchChesscomGames } from "./fetchers/chesscom";
import { fetchLichessGames } from "./fetchers/lichess";
import { loadGames, loadSettings, upsertGames } from "./storage";
import type { Settings } from "./types";

export interface SyncResult {
  inserted: number;
  chesscom: number;
  lichess: number;
}

export class NoUsernamesError extends Error {}

export async function syncGames(
  override?: Partial<Pick<Settings, "chesscomUsername" | "lichessUsername" | "analyzeLastN">>
): Promise<SyncResult> {
  const base = loadSettings();
  const chesscomUsername = (override?.chesscomUsername ?? base.chesscomUsername).trim();
  const lichessUsername = (override?.lichessUsername ?? base.lichessUsername).trim();
  if (!chesscomUsername && !lichessUsername) throw new NoUsernamesError();

  const analyzeLastN = override?.analyzeLastN ?? base.analyzeLastN;
  const maxGames = Math.max(analyzeLastN * 2, 200);
  const previousChesscom = loadGames().filter(game => {
    if (game.platform !== "chesscom") return false;
    const name = game.pgn.match(game.user_color === "w" ? /\[White "([^"]+)"\]/ : /\[Black "([^"]+)"\]/)?.[1];
    return name?.toLowerCase() === chesscomUsername.toLowerCase();
  });
  const since = previousChesscom.reduce((latest, game) => Math.max(latest, Date.parse(game.played_at) || 0), 0);
  const [chesscom, lichess] = await Promise.all([
    chesscomUsername ? fetchChesscomGames(chesscomUsername, maxGames, since) : Promise.resolve([]),
    lichessUsername ? fetchLichessGames(lichessUsername, maxGames) : Promise.resolve([]),
  ]);
  const inserted = upsertGames([...chesscom, ...lichess]);
  return { inserted, chesscom: chesscom.length, lichess: lichess.length };
}
