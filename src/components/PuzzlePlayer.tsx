"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Check, X, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import Board from "./Board";
import { useI18n } from "@/lib/i18n";
import { playPuzzleMove, preparePuzzle, replayPuzzlePath } from "@/lib/puzzle-solution";
import { recordReview } from "@/lib/storage";
import type { PuzzleRow, TrainingAttempt } from "@/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function PuzzlePlayer({ puzzles, onAdvance, progress, onProgress, hideTheme = false, postSolveText, blind = false, recognitionPrompt = false, nextDisabled = false }: { puzzles: PuzzleRow[]; onAdvance?: (id: string) => void; progress?: TrainingAttempt; onProgress?: (attempt: TrainingAttempt) => void; hideTheme?: boolean; postSolveText?: string; blind?: boolean; recognitionPrompt?: boolean; nextDisabled?: boolean }) {
  const { t } = useI18n();
  const [idx, setIdx] = useState(0);

  if (!puzzles.length) return <p className="text-muted-foreground">{t.puzzles.empty}</p>;
  const puzzle = puzzles[idx % puzzles.length];

  return (
    <SinglePuzzle
      key={`${puzzle.id}-${idx}`}
      puzzle={puzzle}
      index={(idx % puzzles.length) + 1}
      total={puzzles.length}
      onNext={() => onAdvance ? onAdvance(puzzle.id) : setIdx(idx + 1)}
      progress={progress}
      onProgress={onProgress}
      hideTheme={hideTheme}
      postSolveText={postSolveText}
      blind={blind}
      recognitionPrompt={recognitionPrompt}
      nextDisabled={nextDisabled}
    />
  );
}

function SinglePuzzle({
  puzzle,
  index,
  total,
  onNext,
  progress,
  onProgress,
  hideTheme,
  postSolveText,
  blind,
  recognitionPrompt,
  nextDisabled,
}: {
  puzzle: PuzzleRow;
  index: number;
  total: number;
  onNext: () => void;
  progress?: TrainingAttempt;
  onProgress?: (attempt: TrainingAttempt) => void;
  hideTheme: boolean;
  postSolveText?: string;
  blind: boolean;
  recognitionPrompt: boolean;
  nextDisabled: boolean;
}) {
  const { t, locale } = useI18n();
  const hasGame = useStore(state => state.games.some(game => game.id === puzzle.game_id));
  const prepared = useMemo(() => preparePuzzle(puzzle), [puzzle]);
  const restored = useMemo(() => prepared && progress?.puzzleId === puzzle.id ? replayPuzzlePath(prepared, progress.path) : null, [prepared, progress, puzzle.id]);
  const [fen, setFen] = useState(restored?.fen ?? puzzle.fen);
  const [lastMove, setLastMove] = useState(restored?.lastMove ?? null);
  const [lastReplySan, setLastReplySan] = useState(restored?.lastReplySan ?? null);
  const [step, setStep] = useState(restored ? Math.floor((progress?.path.length ?? 0) / 2) : 0);
  const [state, setState] = useState<"playing" | "wrong" | "solved" | "revealed">(restored && progress ? progress.status : "playing");
  const [boardKey, setBoardKey] = useState(0);
  const cancelRef = useRef(false);
  const generationRef = useRef(0);
  const [showTools, setShowTools] = useState(false);
  const reported = useRef(Boolean(restored && progress?.status !== "playing"));
  const [waiting, setWaiting] = useState(false);
  const [path, setPath] = useState<string[]>(restored && progress ? progress.path : []);
  const [hintLevel, setHintLevel] = useState(restored && progress ? progress.hintLevel : 0);
  const startedAt = useRef<number | null>(restored && progress ? Date.parse(progress.startedAt) : null);
  const hadAttempt = useRef(puzzle.attempts > 0);
  const wrongMoves = useRef(0);

  useEffect(() => {
    cancelRef.current = false;
    startedAt.current ??= Date.now();
    return () => {
      cancelRef.current = true;
      generationRef.current += 1;
    };
  }, []);

  const sequence = prepared?.lines[0].san ?? [];
  const expected = prepared?.lines.find(line => path.every((move, index) => line.uci[index] === move))?.uci[path.length];
  const selectedSolution = prepared?.lines.find(line => line.uci.length === path.length && path.every((move, index) => line.uci[index] === move)) ?? prepared?.lines[0];
  const solutionText = selectedSolution?.san.filter((_, index) => index % 2 === 0).join(", ") ?? "";

  function persistAttempt(status: TrainingAttempt["status"], nextPath = path, nextHintLevel = hintLevel, start = startedAt.current ?? Date.now()) {
    onProgress?.({ puzzleId: puzzle.id, startedAt: new Date(start).toISOString(), path: nextPath, hintLevel: nextHintLevel, status });
  }

  function report(solved: boolean, solutionRevealed = false) {
    if (reported.current) return;
    reported.current = true;
    recordReview(puzzle.id, solved, {
      firstAttempt: puzzle.attempts === 0 && !hadAttempt.current,
      hintsUsed: hintLevel,
      elapsedMs: Math.max(0, Date.now() - (startedAt.current ?? Date.now())),
      wrongMoves: wrongMoves.current,
      solutionRevealed,
      recognitionPending: recognitionPrompt && (solved || solutionRevealed),
    });
    hadAttempt.current = true;
  }

  function tryMove(san: string): boolean {
    if (state !== "playing" || waiting || !prepared) return false;
    const result = playPuzzleMove(prepared, path, fen, san);
    if (result.status === "wrong") {
      wrongMoves.current += 1;
      setState("wrong");
      report(false);
      persistAttempt("wrong");
      return false;
    }

    if (result.status === "solved") {
      setPath(result.path);
      setState("solved");
      report(true);
      persistAttempt("solved", result.path);
      return true;
    }

    setWaiting(true);
    const generation = generationRef.current;
    setTimeout(() => {
      if (cancelRef.current || generation !== generationRef.current) return;
      setFen(result.nextFen);
      setLastMove({ from: result.reply.from, to: result.reply.to });
      setLastReplySan(result.reply.san);
      setPath(result.path);
      persistAttempt("playing", result.path);
      setWaiting(false);
      setStep((s) => s + 1);
    }, 480);
    return true;
  }

  async function showSolution() {
    const generation = ++generationRef.current;
    report(false, true);
    setState("revealed");
    setPath([]);
    persistAttempt("revealed", []);
    setFen(puzzle.fen);
    setLastMove(null);
    setLastReplySan(null);
    setBoardKey((k) => k + 1);
    const c = new Chess(puzzle.fen);
    for (const san of sequence) {
      await sleep(700);
      if (cancelRef.current || generation !== generationRef.current) return;
      let m;
      try {
        m = c.move(san);
      } catch {
        break;
      }
      if (!m) break;
      setFen(c.fen());
      setLastMove({ from: m.from, to: m.to });
    }
  }

  function retry() {
    generationRef.current += 1;
    setWaiting(false);
    setFen(puzzle.fen);
    setLastMove(null);
    setLastReplySan(null);
    setStep(0);
    setPath([]);
    setHintLevel(0);
    wrongMoves.current = 0;
    startedAt.current = Date.now();
    persistAttempt("playing", [], 0, startedAt.current);
    setState("playing");
    reported.current = false;
    setBoardKey((k) => k + 1);
  }

  const sideToMove = puzzle.user_side === "w" ? t.puzzles.white : t.puzzles.black;

  if (!prepared) return <div className="axis-puzzle-detail"><p role="alert">{locale === "fr" ? "Cette position ne peut pas être vérifiée." : "This position could not be verified."}</p><button type="button" className="axis-button secondary" onClick={onNext}>{t.puzzles.next}</button></div>;

  return (
    <div className="axis-puzzle">
      <Board
        key={boardKey}
        fen={fen}
        lastMove={lastMove}
        orientation={puzzle.user_side}
        interactive={state === "playing" && !waiting}
        onTryMove={tryMove}
        showOverlayControls={showTools}
      />

      <div className="axis-puzzle-detail">
        <div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {!hideTheme && !blind && <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs text-foreground/90">
              {t.motifs[puzzle.theme]?.split(" (")[0] ?? puzzle.theme}
            </span>}
            {!blind && puzzle.kind && (
              <span className="inline-block rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-300 px-3 py-1 text-xs">
                {t.puzzles.kinds[puzzle.kind]}
              </span>
            )}
            {!blind && puzzle.difficulty && (
              <span
                className="axis-tag"
              >
                {t.puzzles.difficulties[puzzle.difficulty]}
              </span>
            )}
          </div>
          <h2 className="text-lg font-medium text-foreground">
            {t.puzzles.findBest} — {t.puzzles.toMove(sideToMove)}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t.puzzles.counter(index, total)}
            {hasGame && (!blind || state === "solved" || state === "revealed") && <> · <Link className="underline" href={`/review/${encodeURIComponent(puzzle.game_id)}`}>{locale === "fr" ? "Revenir à la partie" : "Return to game"}</Link></>}
            {puzzle.source_url && (!blind || state === "solved" || state === "revealed") && (
              <>
                {" · "}
                <a href={puzzle.source_url} target="_blank" className="underline hover:text-foreground/90">
                  {puzzle.source === "lichess" ? "Lichess · CC0" : t.puzzles.fromGame}
                </a>
              </>
            )}
          </p>
        </div>

        <button className="axis-button secondary w-fit" onClick={() => setShowTools(!showTools)} aria-pressed={showTools}><SlidersHorizontal size={16}/>{t.ui.boardTools}</button>
        {state === "playing" && step > 0 && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            {t.puzzles.correct} {t.puzzles.opponentPlays(lastReplySan ?? "…")}{" "}
            {t.puzzles.moveOf(step + 1, puzzle.solution_san.length)}.
          </p>
        )}
        {state === "solved" && (
          <div className="axis-puzzle-result"><p className="rounded-lg bg-emerald-500/10 border border-emerald-600/40 px-4 py-3 text-emerald-600 dark:text-emerald-300 text-sm"><Check size={16} className="inline mr-1"/> {t.puzzles.solved} — {solutionText}</p>{postSolveText && <p className="axis-puzzle-hint">{postSolveText}</p>}</div>
        )}
        {state === "wrong" && (
          <p className="rounded-lg bg-red-500/10 border border-red-600/40 px-4 py-3 text-red-600 dark:text-red-300 text-sm">
            <X size={16} className="inline mr-1"/> {t.puzzles.wrong}
          </p>
        )}
        {state === "revealed" && (
          <p className="rounded-lg bg-accent px-4 py-3 text-foreground/90 text-sm">
            {t.puzzles.solution}: <strong>{solutionText}</strong>
          </p>
        )}

        {state === "playing" && hintLevel > 0 && <p className="axis-puzzle-hint" role="status">{hintLevel === 1 ? locale === "fr" ? "Comparez les échecs, les prises et les menaces immédiates." : "Compare checks, captures, and immediate threats." : locale === "fr" ? `Regardez la pièce sur ${expected?.slice(0, 2) ?? "?"}.` : `Look closely at the piece on ${expected?.slice(0, 2) ?? "?"}.`}</p>}

        <div className="flex flex-wrap gap-2">
          {state === "playing" && hintLevel < 2 && <button type="button" className="axis-button secondary" disabled={waiting} onClick={() => { const next = hintLevel + 1; setHintLevel(next); persistAttempt("playing", path, next); }}>{locale === "fr" ? "Indice" : "Hint"} {hintLevel + 1}/2</button>}
          {(state === "wrong" || state === "revealed") && (
            <button onClick={retry} className="axis-button">
              {t.puzzles.retry}
            </button>
          )}
          {state !== "solved" && state !== "revealed" && (
            <button
              disabled={waiting}
              onClick={showSolution}
              className="axis-button secondary"
            >
              {t.puzzles.showSolution}
            </button>
          )}
          <button
            onClick={onNext}
            disabled={state === "playing" || waiting || nextDisabled}
            className="axis-button secondary"
          >
            {t.puzzles.next}
          </button>
        </div>
      </div>
    </div>
  );
}
