import { validateFen } from "chess.js";
import { preparePuzzle, replayPuzzlePath } from "./puzzle-solution";
import { isProviderId } from "./providers";
import type { AiLessonRow, AnalysisSummary, GameRow, GeneratedLesson, MasterAnnotation, PuzzleRow, Settings, TrainingAttempt, TrainingSession } from "./types";

const motifs = ["hanging_piece", "missed_tactic", "allowed_fork", "allowed_mate", "missed_mate", "bad_trade", "other"];
const severities = ["blunder", "mistake", "inaccuracy"];
const phases = ["opening", "middlegame", "endgame"];
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string");
const date = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const fen = (value: unknown): value is string => typeof value === "string" && validateFen(value).ok;
const side = (value: unknown) => value === "w" || value === "b";

function game(value: unknown): value is GameRow {
  return object(value) && typeof value.id === "string" && typeof value.pgn === "string" && date(value.played_at) && side(value.user_color)
    && ["chesscom", "lichess", "pgn"].includes(String(value.platform)) && ["win", "loss", "draw"].includes(String(value.result))
    && ["pending", "analyzing", "done", "failed", "skipped"].includes(String(value.analysis_status))
    && (value.accuracy_user === null || finite(value.accuracy_user)) && typeof value.time_class === "string";
}

function analysis(value: unknown): value is AnalysisSummary {
  if (!object(value) || !finite(value.acpl) || !finite(value.accuracy) || !finite(value.blunders) || !finite(value.mistakes) || !finite(value.inaccuracies) || !Array.isArray(value.issues) || !object(value.byPhase)) return false;
  const byPhase = value.byPhase;
  if (!phases.every(phase => { const item = byPhase[phase]; return object(item) && finite(item.blunders) && finite(item.mistakes) && finite(item.moves); })) return false;
  if (value.evaluations !== undefined && (!Array.isArray(value.evaluations) || !value.evaluations.every(finite))) return false;
  return value.issues.every(issue => object(issue) && finite(issue.ply) && issue.ply > 0 && fen(issue.fenBefore) && typeof issue.san === "string" && typeof issue.uci === "string"
    && motifs.includes(String(issue.motif)) && severities.includes(String(issue.severity)) && phases.includes(String(issue.phase))
    && finite(issue.cpBefore) && finite(issue.cpAfter) && finite(issue.winDrop)
    && (issue.bestSan === null || typeof issue.bestSan === "string") && (issue.bestUci === null || typeof issue.bestUci === "string")
    && (issue.continuation === undefined || strings(issue.continuation)));
}

function puzzle(value: unknown): value is PuzzleRow {
  return object(value) && typeof value.id === "string" && typeof value.game_id === "string" && fen(value.fen) && side(value.user_side)
    && strings(value.solution_san) && value.solution_san.length > 0 && strings(value.reply_san)
    && motifs.includes(String(value.theme)) && severities.includes(String(value.severity)) && finite(value.attempts) && typeof value.solved === "boolean"
    && (value.solution_lines_uci === undefined || (Array.isArray(value.solution_lines_uci) && value.solution_lines_uci.every(strings)))
    && (value.reviews === undefined || (Array.isArray(value.reviews) && value.reviews.every(review => object(review) && date(review.at) && typeof review.solved === "boolean"
      && (review.firstAttempt === undefined || typeof review.firstAttempt === "boolean")
      && (review.solutionRevealed === undefined || typeof review.solutionRevealed === "boolean")
      && [review.hintsUsed, review.elapsedMs, review.wrongMoves].every(n => n === undefined || (finite(n) && n >= 0)))))
    && (value.streak === undefined || (finite(value.streak) && value.streak >= 0))
    && (value.due_at === undefined || date(value.due_at));
}

function lesson(value: unknown): value is GeneratedLesson {
  return object(value) && typeof value.slug === "string" && (value.theme === "lines_of_force" || motifs.includes(String(value.theme))) && object(value.stats)
    && finite(value.stats.totalAnalyzed) && finite(value.stats.motifCount) && finite(value.stats.blundersPerGame)
    && Array.isArray(value.examples) && value.examples.every(example => object(example) && fen(example.fen) && side(example.user_side) && strings(example.solution_san));
}

function aiLesson(value: unknown): value is AiLessonRow {
  return object(value) && typeof value.id === "string" && typeof value.title === "string" && ["en", "fr"].includes(String(value.locale)) && object(value.content)
    && typeof value.content.concept === "string" && typeof value.content.mission === "string" && Array.isArray(value.content.sections)
    && value.content.sections.every(section => object(section) && ["text", "board", "quiz"].includes(String(section.type))
      && (section.type !== "board" || fen(section.fen)) && (section.type !== "quiz" || Array.isArray(section.questions)))
    && object(value.content.primarySource) && typeof value.content.primarySource.url === "string";
}

function annotation(value: unknown): value is MasterAnnotation {
  return object(value) && typeof value.gameId === "string" && ["en", "fr"].includes(String(value.locale)) && typeof value.intro === "string"
    && Array.isArray(value.notes) && value.notes.every(note => object(note) && finite(note.ply) && typeof note.reasoning === "string");
}

function list<T>(value: unknown, valid: (item: unknown) => item is T): T[] {
  return Array.isArray(value) ? value.filter(valid) : [];
}

export function restorePersistedState(value: unknown, defaults: Settings) {
  const saved = object(value) ? value : {};
  const rawSettings = object(saved.settings) ? saved.settings : {};
  const settings = { ...defaults };
  for (const key of ["chesscomUsername", "lichessUsername", "boardTheme", "voiceURI"] as const) if (typeof rawSettings[key] === "string") settings[key] = rawSettings[key];
  for (const key of ["analyzeLastN", "engineMovetimeMs"] as const) if (finite(rawSettings[key]) && rawSettings[key] > 0) settings[key] = Math.min(rawSettings[key], key === "analyzeLastN" ? 1000 : 10000);
  for (const key of ["soundEnabled", "voiceEnabled", "voiceAutoplay"] as const) if (typeof rawSettings[key] === "boolean") settings[key] = rawSettings[key];
  if (rawSettings.analysisMode === "fast" || rawSettings.analysisMode === "deep") settings.analysisMode = rawSettings.analysisMode;
  const analyses: Record<string, AnalysisSummary> = {};
  if (object(saved.analyses)) for (const [id, summary] of Object.entries(saved.analyses)) if (analysis(summary)) analyses[id] = summary;
  const games = list(saved.games, game).map(item => item.analysis_status === "analyzing" || (item.analysis_status === "done" && !analyses[item.id]) ? { ...item, analysis_status: "pending" as const } : item);
  const apiKey = object(saved.apiKey) && isProviderId(saved.apiKey.provider) && typeof saved.apiKey.key === "string" ? { provider: saved.apiKey.provider, key: saved.apiKey.key } : null;
  const puzzles = list(saved.puzzles, puzzle);
  const puzzleIds = new Set(puzzles.map(item => item.id));
  const rawSession = object(saved.trainingSession) ? saved.trainingSession : null;
  const remainingIds = rawSession && Array.isArray(rawSession.remainingIds)
    ? [...new Set(rawSession.remainingIds.filter((id): id is string => typeof id === "string" && puzzleIds.has(id)))]
    : [];
  let trainingSession: TrainingSession | null = null;
  if (rawSession && typeof rawSession.id === "string" && date(rawSession.startedAt) && remainingIds.length) {
    const first = puzzles.find(item => item.id === remainingIds[0]);
    const prepared = first ? preparePuzzle(first) : null;
    const candidate = object(rawSession.active) ? rawSession.active : null;
    const path = candidate && strings(candidate.path) ? candidate.path : [];
    const status = candidate && ["playing", "wrong", "solved", "revealed"].includes(String(candidate.status)) ? candidate.status as TrainingAttempt["status"] : "playing";
    const validPath = prepared && replayPuzzlePath(prepared, path);
    const complete = prepared?.lines.some(line => line.uci.length === path.length && path.every((move, index) => move === line.uci[index]));
    const compatible = validPath && (status === "solved" ? complete : path.length % 2 === 0);
    const active: TrainingAttempt = candidate && candidate.puzzleId === remainingIds[0] && date(candidate.startedAt) && finite(candidate.hintLevel) && candidate.hintLevel >= 0 && candidate.hintLevel <= 2 && compatible
      ? { puzzleId: remainingIds[0], startedAt: candidate.startedAt, path, hintLevel: candidate.hintLevel, status }
      : { puzzleId: remainingIds[0], startedAt: rawSession.startedAt, path: [], hintLevel: 0, status: "playing" };
    trainingSession = { id: rawSession.id, startedAt: rawSession.startedAt, remainingIds, active };
  }
  return { settings, games, analyses, puzzles, trainingSession, lessons: list(saved.lessons, lesson), aiLessons: list(saved.aiLessons, aiLesson), masterAnnotations: list(saved.masterAnnotations, annotation), apiKey, onboardedFlag: saved.onboardedFlag === true };
}
