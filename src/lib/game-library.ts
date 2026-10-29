import type { AnalysisSummary, GameRow } from "./types";
import { parsePgn } from "./pgn";
import { createReviewPosition, restoreReviewBranches, serializeReviewBranches, type SavedReviewBranch } from "./review-position";

export type LibrarySort = "newest" | "oldest" | "accuracy";
export interface LibraryFilters { query: string; result: string; platform: string; status: string; sort: LibrarySort }
export interface ReviewLocation { ply: number; at: string; variations?: SavedReviewBranch[] }

export function gameAccuracy(game: GameRow, analyses: Record<string, AnalysisSummary>): number | null {
  return analyses[game.id]?.complete === false || analyses[game.id]?.accuracySamples?.[game.user_color] === 0 ? null : analyses[game.id]?.accuracy ?? game.accuracy_user;
}

export function filterGames(games: GameRow[], analyses: Record<string, AnalysisSummary>, filters: LibraryFilters): GameRow[] {
  const terms = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return games.filter(game => {
    const opening = analyses[game.id]?.opening;
    const text = `${game.opponent_name ?? ""} ${game.opening_name ?? ""} ${game.eco ?? ""} ${opening?.name ?? ""} ${opening?.eco ?? ""} ${game.time_class} ${game.platform}`.toLocaleLowerCase();
    return (filters.result === "all" || filters.result === game.result)
      && (filters.platform === "all" || filters.platform === game.platform)
      && (filters.status === "all" || (filters.status === "reviewed" ? game.analysis_status === "done" && analyses[game.id]?.complete !== false : game.analysis_status !== "done" || analyses[game.id]?.complete === false))
      && terms.every(term => text.includes(term));
  }).sort((a, b) => {
    if (filters.sort === "accuracy") {
      const difference = (gameAccuracy(b, analyses) ?? -1) - (gameAccuracy(a, analyses) ?? -1);
      if (difference) return difference;
    }
    const dateOrder = Date.parse(b.played_at) - Date.parse(a.played_at);
    return (filters.sort === "oldest" ? -dateOrder : dateOrder) || a.id.localeCompare(b.id);
  });
}

export function restoreReviewLocations(value: unknown, games: GameRow[]): Record<string, ReviewLocation> {
  const ids = new Set(games.map(game => game.id));
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, row]) => ids.has(id) && row && typeof row === "object" && Number.isInteger(row.ply) && row.ply >= 0 && row.ply <= 10000 && typeof row.at === "string" && Number.isFinite(Date.parse(row.at))).map(([id, row]) => {
    const location: ReviewLocation = { ply: row.ply, at: row.at };
    if (Array.isArray(row.variations)) {
      const game = games.find(game => game.id === id);
      const parsed = game && parsePgn(game.pgn);
      if (parsed) location.variations = serializeReviewBranches(restoreReviewBranches(createReviewPosition(parsed), row.variations));
    }
    return [id, location];
  }));
}
