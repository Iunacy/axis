import type { GameRow, AnalysisSummary, PuzzleRow, GeneratedLesson, AiLessonRow, TrainingSession } from "./types";
import type { ReviewLocation } from "./game-library";

export function belongsToAccount(game: GameRow, username: string): boolean {
  const tag = game.user_color === "w" ? "White" : "Black";
  const name = game.pgn.match(new RegExp(`\\[${tag} "([^"\\r\\n]+)"\\]`))?.[1];
  return Boolean(name && name.trim().toLowerCase() === username.trim().toLowerCase());
}

/** Called only after the replacement account has returned a valid import page. */
export function accountReplacement(state: {
  games: GameRow[]; analyses: Record<string, AnalysisSummary>; puzzles: PuzzleRow[];
  lessons: GeneratedLesson[]; aiLessons: AiLessonRow[]; reviewLocations: Record<string, ReviewLocation>;
  trainingSession: TrainingSession | null;
}, platform: "chesscom" | "lichess", username: string) {
  const removed = state.games.filter(game => game.platform === platform && !belongsToAccount(game, username));
  const ids = new Set(removed.map(game => game.id));
  if (!ids.size) return {};
  const positions = new Set(removed.flatMap(game => state.analyses[game.id]?.issues.map(issue => issue.fenBefore) ?? []));
  const urls = new Set(removed.map(game => game.url).filter(Boolean));
  const puzzles = state.puzzles.filter(puzzle => puzzle.source === "lichess" || !ids.has(puzzle.game_id));
  const available = new Set(puzzles.map(puzzle => puzzle.id));
  return {
    games: state.games.filter(game => !ids.has(game.id)),
    analyses: Object.fromEntries(Object.entries(state.analyses).filter(([id]) => !ids.has(id))),
    puzzles,
    reviewLocations: Object.fromEntries(Object.entries(state.reviewLocations).filter(([id]) => !ids.has(id))),
    lessons: state.lessons.filter(lesson => !lesson.examples.some(example => positions.has(example.fen) || example.source_url && urls.has(example.source_url))),
    // AI lessons lack game provenance, so cannot safely describe a replacement account.
    aiLessons: [],
    trainingSession: state.trainingSession?.remainingIds.every(id => available.has(id)) ? state.trainingSession : null,
  };
}
