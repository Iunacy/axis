"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Check, X, SlidersHorizontal } from "lucide-react";
import Board from "./Board";
import { useI18n } from "@/lib/i18n";
import { recordReview } from "@/lib/storage";
import type { PuzzleRow } from "@/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clean = (s: string) => s.replace(/[+#?!]/g, "");

export default function PuzzlePlayer({ puzzles, onAdvance }: { puzzles: PuzzleRow[]; onAdvance?: (id: string) => void }) {
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
    />
  );
}

function SinglePuzzle({
  puzzle,
  index,
  total,
  onNext,
}: {
  puzzle: PuzzleRow;
  index: number;
  total: number;
  onNext: () => void;
}) {
  const { t } = useI18n();
  const [fen, setFen] = useState(puzzle.fen);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [step, setStep] = useState(0);
  const [state, setState] = useState<"playing" | "wrong" | "solved" | "revealed">("playing");
  const [boardKey, setBoardKey] = useState(0);
  const cancelRef = useRef(false);
  const generationRef = useRef(0);
  const [showTools, setShowTools] = useState(false);
  const reported = useRef(false);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    cancelRef.current = false;
    return () => {
      cancelRef.current = true;
      generationRef.current += 1;
    };
  }, []);

  const sequence = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < puzzle.solution_san.length; i++) {
      out.push(puzzle.solution_san[i]);
      if (puzzle.reply_san[i]) out.push(puzzle.reply_san[i]);
    }
    return out;
  }, [puzzle]);

  function report(solved: boolean) {
    if (reported.current) return;
    reported.current = true;
    recordReview(puzzle.id, solved);
  }

  function tryMove(san: string): boolean {
    if (state !== "playing" || waiting) return false;
    if (clean(san) !== clean(puzzle.solution_san[step] ?? "")) {
      setState("wrong");
      report(false);
      return false;
    }

    const isFinal = step + 1 >= puzzle.solution_san.length;
    if (isFinal) {
      setState("solved");
      report(true);
      return true;
    }

    const reply = puzzle.reply_san[step];
    const c = new Chess(fen);
    try {
      c.move(san);
    } catch {
      return false;
    }
    if (reply) {
      setWaiting(true);
      const generation = generationRef.current;
      setTimeout(() => {
        if (cancelRef.current || generation !== generationRef.current) return;
        try {
          const m = c.move(reply);
          if (m) {
            setFen(c.fen());
            setLastMove({ from: m.from, to: m.to });
          }
        } catch {
        }
        setWaiting(false);
        setStep((s) => s + 1);
      }, 480);
    } else {
      setFen(c.fen());
      setStep(step + 1);
    }
    return true;
  }

  async function showSolution() {
    const generation = ++generationRef.current;
    report(false);
    setState("revealed");
    setFen(puzzle.fen);
    setLastMove(null);
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
    setStep(0);
    setState("playing");
    reported.current = false;
    setBoardKey((k) => k + 1);
  }

  const sideToMove = puzzle.user_side === "w" ? t.puzzles.white : t.puzzles.black;

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
            <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs text-foreground/90">
              {t.motifs[puzzle.theme]?.split(" (")[0] ?? puzzle.theme}
            </span>
            {puzzle.kind && (
              <span className="inline-block rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-300 px-3 py-1 text-xs">
                {t.puzzles.kinds[puzzle.kind]}
              </span>
            )}
            {puzzle.difficulty && (
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
            {puzzle.source_url && (
              <>
                {" · "}
                <a href={puzzle.source_url} target="_blank" className="underline hover:text-foreground/90">
                  {t.puzzles.fromGame}
                </a>
              </>
            )}
          </p>
        </div>

        <button className="axis-button secondary w-fit" onClick={() => setShowTools(!showTools)} aria-pressed={showTools}><SlidersHorizontal size={16}/>{t.ui.boardTools}</button>
        {state === "playing" && step > 0 && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            {t.puzzles.correct} {t.puzzles.opponentPlays(puzzle.reply_san[step - 1] ?? "…")}{" "}
            {t.puzzles.moveOf(step + 1, puzzle.solution_san.length)}.
          </p>
        )}
        {state === "solved" && (
          <p className="rounded-lg bg-emerald-500/10 border border-emerald-600/40 px-4 py-3 text-emerald-600 dark:text-emerald-300 text-sm">
            <Check size={16} className="inline mr-1"/> {t.puzzles.solved} — {puzzle.solution_san.join(", ")}
          </p>
        )}
        {state === "wrong" && (
          <p className="rounded-lg bg-red-500/10 border border-red-600/40 px-4 py-3 text-red-600 dark:text-red-300 text-sm">
            <X size={16} className="inline mr-1"/> {t.puzzles.wrong}
          </p>
        )}
        {state === "revealed" && (
          <p className="rounded-lg bg-accent px-4 py-3 text-foreground/90 text-sm">
            {t.puzzles.solution}: <strong>{puzzle.solution_san.join(", ")}</strong>
          </p>
        )}

        <div className="flex flex-wrap gap-2">
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
            disabled={state === "playing" || waiting}
            className="axis-button secondary"
          >
            {t.puzzles.next}
          </button>
        </div>
      </div>
    </div>
  );
}
