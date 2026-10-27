"use client";

import {
  DEFAULT_SETTINGS,
  purgeLegacyKeys,
  type StoredAiKey,
  useStore,
} from "./store";
import type { AiProviderId } from "./providers";
import type {
  AiLessonRow,
  AnalysisSummary,
  GameRow,
  GeneratedLesson,
  MasterAnnotation,
  PuzzleReview,
  PuzzleRow,
  Settings,
} from "./types";


export { DEFAULT_SETTINGS };
export type { StoredAiKey };

const st = () => useStore.getState();

export function loadSettings(): Settings {
  return st().settings;
}
export function saveSettings(s: Settings): void {
  st().setSettings(s);
}

export function loadGames(): GameRow[] {
  return st().games;
}
export function saveGames(games: GameRow[]): void {
  st().setGames(games);
}
export function upsertGames(incoming: GameRow[]): number {
  return st().upsertGames(incoming);
}
export function setGameStatus(
  gameId: string,
  status: GameRow["analysis_status"],
  accuracy?: number | null
): void {
  st().setGameStatus(gameId, status, accuracy);
}

export function loadAnalyses(): Record<string, AnalysisSummary> {
  return st().analyses;
}
export function saveAnalysis(gameId: string, summary: AnalysisSummary): void {
  st().setAnalysis(gameId, summary);
}

export function recordReview(id: string, solved: boolean, evidence?: Partial<Omit<PuzzleReview, "at" | "solved">>): void {
  st().recordReview(id, solved, evidence);
}
export function loadPuzzles(): PuzzleRow[] {
  return st().puzzles;
}
export function upsertPuzzles(incoming: PuzzleRow[]): void {
  st().upsertPuzzles(incoming);
}
export function updatePuzzle(id: string, patch: Partial<Pick<PuzzleRow, "attempts" | "solved">>): void {
  st().updatePuzzle(id, patch);
}

export function loadLessons(): GeneratedLesson[] {
  return st().lessons;
}
export function saveLessons(lessons: GeneratedLesson[]): void {
  st().setLessons(lessons);
}
export function setLessonCompleted(slug: string, completed: boolean): void {
  st().setLessonCompletedAction(slug, completed);
}
export function removeLesson(slug: string): void {
  st().removeLessonAction(slug);
}

export function loadAiLessons(): AiLessonRow[] {
  return st().aiLessons;
}
export function addAiLesson(lesson: AiLessonRow): void {
  st().addAiLessonAction(lesson);
}
export function setAiLessonCompleted(id: string, completed: boolean): void {
  st().setAiLessonCompletedAction(id, completed);
}
export function removeAiLesson(id: string): void {
  st().removeAiLessonAction(id);
}

export function loadMasterAnnotations(): MasterAnnotation[] {
  return st().masterAnnotations;
}
export function addMasterAnnotation(annotation: MasterAnnotation): void {
  st().addMasterAnnotationAction(annotation);
}
export function removeMasterAnnotation(gameId: string, locale: "en" | "fr"): void {
  st().removeMasterAnnotationAction(gameId, locale);
}

export function isOnboarded(): boolean {
  const s = st();
  if (!s.hydrated) return true;
  return s.onboardedFlag || Boolean(s.settings.chesscomUsername || s.settings.lichessUsername);
}
export function setOnboarded(): void {
  st().setOnboardedFlag();
}

export function loadAiKey(): StoredAiKey | null {
  return st().apiKey;
}
export function saveAiKey(provider: AiProviderId, key: string): void {
  st().setApiKeyAction(provider, key);
}
export function clearAiKey(): void {
  st().clearApiKeyAction();
}

export function clearAllData(): void {
  st().clearAllAction();
  purgeLegacyKeys();
}
