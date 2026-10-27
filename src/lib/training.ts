import type { PatternId, PuzzleReview, PuzzleRow } from "./types";

const DAYS = [1, 3, 7, 14, 30];
export function scheduleReview(puzzle: PuzzleRow, solved: boolean, now = new Date(), evidence: Partial<Omit<PuzzleReview, "at" | "solved">> = {}): PuzzleRow {
  const streak = solved ? (puzzle.streak ?? 0) + 1 : 0;
  const days = solved ? DAYS[Math.min(streak - 1, DAYS.length - 1)] : 1;
  return {
    ...puzzle,
    attempts: puzzle.attempts + 1,
    solved,
    streak,
    last_reviewed_at: now.toISOString(),
    due_at: new Date(now.getTime() + days * 86400000).toISOString(),
    reviews: [...(puzzle.reviews ?? []), { at: now.toISOString(), solved, ...evidence }].slice(-100),
  };
}

export function duePuzzles(puzzles: PuzzleRow[], now = new Date()): PuzzleRow[] {
  return puzzles.filter(p => !p.due_at || Date.parse(p.due_at) <= now.getTime())
    .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? "") || a.theme.localeCompare(b.theme));
}

export function mixedPatternQueue(puzzles: PuzzleRow[], now = new Date()): PuzzleRow[] {
  const learned = puzzles.filter(puzzle => puzzle.pattern && puzzle.source === "lichess" && puzzle.reviews?.some(review => review.solved));
  const due = duePuzzles(learned, now);
  const dueIds = new Set(due.map(puzzle => puzzle.id));
  const ahead = learned.filter(puzzle => !dueIds.has(puzzle.id)).sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));
  return [...due, ...ahead];
}

export function identifyPattern(puzzle: PuzzleRow, chosenPattern: PatternId): PuzzleRow {
  if (!puzzle.pattern) return puzzle;
  const reviews = [...(puzzle.reviews ?? [])];
  const index = reviews.findLastIndex(review => review.recognitionPending && review.recognizedPattern === undefined);
  if (index < 0) return puzzle;
  reviews[index] = { ...reviews[index], recognitionPending: false, chosenPattern, recognizedPattern: chosenPattern === puzzle.pattern };
  return { ...puzzle, reviews };
}
