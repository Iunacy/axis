"use client";

import { chesscomPages } from "./fetchers/chesscom";
import { lichessPages } from "./fetchers/lichess";
import { flushStoredState } from "./indexed-storage";
import { loadSettings } from "./storage";
import { useStore } from "./store";
import type { GameRow, Settings } from "./types";

export interface SyncResult { inserted: number; chesscom: number; lichess: number }
export interface SyncProgress { platform: "chesscom" | "lichess"; imported: number; pages: number; retrySeconds?: number }
export class NoUsernamesError extends Error {}
let syncing = false;
export async function syncGames(
  override?: Partial<Pick<Settings, "chesscomUsername" | "lichessUsername" | "analyzeLastN">>,
  options: { fullHistory?: boolean; signal?: AbortSignal; onProgress?: (progress: SyncProgress) => void } = {},
): Promise<SyncResult> {
  if (syncing) throw new Error("A game import is already running.");
  const base = loadSettings();
  const usernames = { chesscom: (override?.chesscomUsername ?? base.chesscomUsername).trim(), lichess: (override?.lichessUsername ?? base.lichessUsername).trim() };
  if (!usernames.chesscom && !usernames.lichess) throw new NoUsernamesError();
  syncing = true;
  const result = { inserted: 0, chesscom: 0, lichess: 0 };
  let pages = 0;
  try {
    for (const platform of ["chesscom", "lichess"] as const) {
      const username = usernames[platform]; if (!username) continue;
      const key = `${platform}:${username.toLowerCase()}`;
      // A discarded account checkpoint must not skip its deleted history on return.
      const hasAccount = useStore.getState().games.some(game => game.platform === platform);
      const saved = hasAccount ? useStore.getState().syncAccounts[key] : undefined;
      const sameAccount = (platform === "chesscom" ? base.chesscomUsername : base.lichessUsername).toLowerCase() === username.toLowerCase();
      const checkpoint = sameAccount && !options.fullHistory ? saved : undefined;
      const request = { signal: options.signal, onRetry: (retrySeconds: number) => options.onProgress?.({ platform, imported: result.inserted, pages, retrySeconds }) };
      let latest = checkpoint?.latest ?? 0;
      const commit = async (games: GameRow[], next: { latest: number; until?: number; archive?: string; complete: boolean }) => {
        options.signal?.throwIfAborted();
        // Do not overwrite a setting changed while an import was in flight.
        const current = loadSettings();
        const field = platform === "chesscom" ? "chesscomUsername" : "lichessUsername";
        if (current[field] !== base[field] && current[field].toLowerCase() !== username.toLowerCase()) throw new Error("Account changed during import. Restart synchronization.");
        const beforePage = useStore.getState();
        result.inserted += beforePage.importAccountPage(platform, username, games, next);
        result[platform] += games.length; pages++;
        try { await flushStoredState(); } catch (error) { useStore.setState(beforePage); throw error; }
        options.onProgress?.({ platform, imported: result.inserted, pages });
      };
      if (platform === "chesscom") {
        // Complete histories only fetch their newest month(s). Interrupted histories
        // restart the last atomic monthly page, where stable IDs remove duplicates.
        for await (const page of chesscomPages(username, { ...request, since: checkpoint?.complete ? latest : 0, beforeArchive: checkpoint?.complete ? undefined : checkpoint?.archive })) {
          latest = page.games.reduce((time, game) => Math.max(time, Date.parse(game.played_at)), latest);
          await commit(page.games, { latest, archive: page.archive, complete: page.complete });
        }
      } else {
        for await (const page of lichessPages(username, { ...request, since: checkpoint?.complete ? latest : 0, until: checkpoint?.complete ? undefined : checkpoint?.until })) {
          latest = Math.max(latest, page.latest);
          await commit(page.games, { latest, until: page.nextUntil, complete: page.complete });
        }
      }
    }
    return result;
  } finally { syncing = false; }
}
