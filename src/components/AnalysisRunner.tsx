"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Engine } from "@/lib/engine";
import { summarizeGame, type PositionEval } from "@/lib/analysis";
import { resolveAnalysisParams } from "@/lib/analysis-modes";
import { describeError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { parsePgn } from "@/lib/pgn";
import {
  loadGames,
  loadSettings,
  saveAnalysis,
  setGameStatus,
  upsertPuzzles,
} from "@/lib/storage";
import type { AnalysisMode, PuzzleRow } from "@/lib/types";

type Status = "idle" | "running" | "done" | "error";

export default function AnalysisRunner({
  pendingCount,
  onProgress,
  gameId,
}: {
  pendingCount: number;
  gameId?: string;
  onProgress?: () => void;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>("idle");
  const [label, setLabel] = useState("");
  const [progress, setProgress] = useState(0);
  const [runningMode, setRunningMode] = useState<AnalysisMode>("fast");
  const stopRef = useRef(false);
  const runningRef = useRef(false);
  const engineRef = useRef<Engine | null>(null);
  useEffect(() => () => { stopRef.current = true; engineRef.current?.destroy(); }, []);

  async function run(mode: AnalysisMode) {
    if (runningRef.current) return;
    runningRef.current = true;
    setStatus("running");
    setRunningMode(mode);
    stopRef.current = false;
    const engine = new Engine();
    engineRef.current = engine;
    let activeGame: string | null = null;

    try {
      const settings = loadSettings();
      const params = resolveAnalysisParams(settings, mode);
      const games = loadGames()
        .filter((g) => (!gameId || g.id === gameId) && ["pending", "failed", "skipped"].includes(g.analysis_status))
        .slice(0, settings.analyzeLastN);

      if (!games.length) {
        setStatus("done");
        setLabel(t.analysis.none);
        return;
      }
      await engine.init(params.hashMb);

      for (let gi = 0; gi < games.length; gi++) {
        if (stopRef.current) break;
        const game = games[gi];
        activeGame = game.id;
        setGameStatus(game.id, "analyzing");
        const parsed = parsePgn(game.pgn);
        if (!parsed || parsed.moves.length < 2) {
          setGameStatus(game.id, "skipped");
          continue;
        }

        const evals: PositionEval[] = [];
        for (let i = 0; i < parsed.fens.length; i++) {
          if (stopRef.current) break;
          evals.push(await engine.evaluate(parsed.fens[i], params.movetimeMs));
          setLabel(
            `${t.analysis.progress(gi + 1, games.length)} — ${t.analysis.moveProgress(i + 1, parsed.fens.length)}`
          );
          setProgress(Math.round(((gi + (i + 1) / parsed.fens.length) / games.length) * 100));
        }
        if (stopRef.current) { setGameStatus(game.id, "pending"); break; }

        const { summary, puzzles } = summarizeGame({
          fens: parsed.fens,
          moves: parsed.moves,
          userColor: game.user_color,
          evals,
          engineLabel: params.label,
        });

        saveAnalysis(game.id, summary);
        const rows: PuzzleRow[] = puzzles.map((p, k) => ({
          ...p,
          id: `${game.id}#${k}:${p.fen.split(" ")[0]}`,
          game_id: game.id,
          source_url: game.url,
          attempts: 0,
          solved: false,
          created_at: new Date().toISOString(),
        }));
        upsertPuzzles(rows);
        setGameStatus(game.id, "done", summary.accuracy);
        onProgress?.();
      }

      setStatus("done");
      setLabel(t.analysis.none);
    } catch (e) {
      if (activeGame) setGameStatus(activeGame, stopRef.current ? "pending" : "failed");
      if (stopRef.current) { setStatus("idle"); setLabel(""); return; }
      setStatus("error");
      setLabel((e as Error).message);
      toast.error(describeError(e, t));
    } finally {
      runningRef.current = false;
      engine.destroy();
      engineRef.current = null;
      onProgress?.();
    }
  }

  return (
    <div className="axis-panel flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-foreground">{t.analysis.title}</h2>
        <span className="text-xs text-muted-foreground">
          {pendingCount} {t.dashboard.pendingAnalysis}
        </span>
      </div>

      {status === "running" ? (
        <>
          <div className="h-2 rounded-full bg-accent overflow-hidden">
            <div
              className={`h-full transition-all ${runningMode === "deep" ? "bg-violet-500" : "bg-emerald-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              <span className="text-foreground/80">
                {runningMode === "deep" ? t.analysis.deep : t.analysis.fast} ·{" "}
              </span>
              {label}
            </span>
            <button onClick={() => { stopRef.current = true; engineRef.current?.destroy(); }} className="text-red-500 hover:text-red-600 dark:text-red-300">
              {t.analysis.stop}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{t.analysis.keepOpen}</p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => run("fast")}
              disabled={pendingCount === 0}
              className="axis-button"
            >
              {t.analysis.fast}
            </button>
            <button
              onClick={() => run("deep")}
              disabled={pendingCount === 0}
              className="axis-button secondary"
            >
              {t.analysis.deep}
            </button>
            {label && <span className="text-sm text-muted-foreground">{label}</span>}
            {!label && pendingCount === 0 && <span className="text-sm text-muted-foreground">{t.analysis.none}</span>}
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="text-emerald-600 dark:text-emerald-400">{t.analysis.fast}</span> {t.analysis.fastHint} ·{" "}
            <span className="text-violet-600 dark:text-violet-400">{t.analysis.deep}</span> {t.analysis.deepHint}
          </p>
        </>
      )}
    </div>
  );
}
