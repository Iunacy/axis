"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Engine } from "@/lib/engine";
import { summarizeGame, type PositionEval } from "@/lib/analysis";
import { describeError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { parsePgn } from "@/lib/pgn";
import { verificationCandidates } from "@/lib/move-classification";
import {
  loadGames,
  loadSettings,
  saveAnalysis,
  setGameStatus,
  upsertPuzzles,
} from "@/lib/storage";
import type { PuzzleRow } from "@/lib/types";

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
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<Status>("idle");
  const [label, setLabel] = useState("");
  const [progress, setProgress] = useState(0);
  const stopRef = useRef(false);
  const runningRef = useRef(false);
  const engineRef = useRef<Engine | null>(null);
  useEffect(() => () => { stopRef.current = true; engineRef.current?.destroy(); }, []);

  async function run() {
    if (runningRef.current) return;
    runningRef.current = true;
    setStatus("running");
    stopRef.current = false;
    const engine = new Engine();
    engineRef.current = engine;
    let activeGame: string | null = null;

    try {
      const settings = loadSettings();
      const search = { depth: 16, nodes: 150000, multiPv: 1 };
      const engineLabel = "Stockfish 18 · depth ≤16 · 150000 nodes · selective critical searches · 1 thread";
      const games = loadGames()
        .filter((g) => (!gameId || g.id === gameId) && (["pending", "failed", "skipped"].includes(g.analysis_status) || Boolean(gameId && g.analysis_status === "done")))
        .slice(0, settings.analyzeLastN);

      if (!games.length) {
        setStatus("done");
        setLabel(t.analysis.none);
        return;
      }

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
          evals.push(await engine.analyze(parsed.fens[i], search, { initialFen: parsed.fens[0], moves: parsed.moves.slice(0, i).map(move => move.uci) }));
          if (i > 0 && i < parsed.moves.length && (i === 1 || i % 8 === 0)) {
            const partial = summarizeGame({ fens: parsed.fens.slice(0, i + 1), moves: parsed.moves.slice(0, i), userColor: game.user_color, evals, engineLabel }).summary;
            saveAnalysis(game.id, { ...partial, complete: false, totalPlies: parsed.moves.length });
          }
          setLabel(
            `${t.analysis.progress(gi + 1, games.length)} — ${t.analysis.moveProgress(i + 1, parsed.fens.length)}`
          );
          setProgress(Math.round(((gi + .8 * (i + 1) / parsed.fens.length) / games.length) * 100));
        }
        if (stopRef.current) { setGameStatus(game.id, "pending"); break; }

        const candidates = verificationCandidates(parsed.fens, parsed.moves, evals);
        const confirmations: Record<number, PositionEval> = {};
        const stronger = (old: PositionEval, next: PositionEval) => (next.depth ?? 0) >= (old.depth ?? 0) ? next : old;
        for (let index = 0; index < candidates.length; index++) {
          if (stopRef.current) break;
          const ply = candidates[index];
          setLabel(locale === "fr" ? `Vérification de la décision ${ply + 1}…` : `Verifying decision ${ply + 1}…`);
          const history = { initialFen: parsed.fens[0], moves: parsed.moves.slice(0, ply).map(move => move.uci) };
          evals[ply] = stronger(evals[ply], await engine.analyze(parsed.fens[ply], { depth: 20, nodes: 600000, multiPv: 2 }, history));
          evals[ply + 1] = stronger(evals[ply + 1], await engine.analyze(parsed.fens[ply + 1], { depth: 18, nodes: 200000, multiPv: 1 }, { ...history, moves: [...history.moves, parsed.moves[ply].uci] }));
          if (evals[ply].bestUci === parsed.moves[ply].uci && (evals[ply].lines?.length ?? 0) > 1) {
            const confirmation = await engine.analyze(parsed.fens[ply], { depth: 22, nodes: 1500000, multiPv: 2 }, history);
            if (confirmation.bestUci === evals[ply].bestUci) confirmations[ply] = confirmation;
            else evals[ply] = stronger(evals[ply], confirmation);
          }
          const partial = summarizeGame({ fens: parsed.fens, moves: parsed.moves, userColor: game.user_color, evals, engineLabel, confirmations }).summary;
          saveAnalysis(game.id, { ...partial, complete: false, totalPlies: parsed.moves.length });
          setProgress(Math.round((gi + .8 + .2 * (index + 1) / candidates.length) / games.length * 100));
        }
        if (stopRef.current) { setGameStatus(game.id, "pending"); break; }

        const { summary, puzzles } = summarizeGame({
          fens: parsed.fens,
          moves: parsed.moves,
          userColor: game.user_color,
          evals,
          engineLabel,
          confirmations,
        });

        saveAnalysis(game.id, { ...summary, complete: true, totalPlies: parsed.moves.length });
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
        setProgress(Math.round((gi + 1) / games.length * 100));
        onProgress?.();
      }

      setStatus(stopRef.current ? "idle" : "done");
      setLabel(stopRef.current ? "" : gameId ? locale === "fr" ? "Revue conservée" : "Review saved" : t.analysis.none);
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
        <h2 className="font-medium text-foreground">{locale === "fr" ? "Revue de partie" : "Game review"}</h2>
        <span className="text-xs text-muted-foreground">
          {gameId && pendingCount === 0 ? locale === "fr" ? "Revue conservée" : "Saved review" : `${pendingCount} ${t.dashboard.pendingAnalysis}`}
        </span>
      </div>

      {status === "running" ? (
        <>
          <div className="axis-analysis-progress h-1 bg-accent overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={t.analysis.title}>
            <div
              className="h-full transition-all bg-[var(--edit-accent)]"
              style={{ transform: `scaleX(${progress / 100})`, transformOrigin: "left" }}
            />
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
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
              onClick={() => void run()}
              disabled={pendingCount === 0 && !gameId}
              className="axis-button"
            >
              {locale === "fr" ? gameId ? pendingCount === 0 ? "Relancer la revue" : "Analyser cette partie" : "Analyser les parties en attente" : gameId ? pendingCount === 0 ? "Review again" : "Review this game" : "Review pending games"}
            </button>
            {label && <span className="text-sm text-muted-foreground">{label}</span>}
            {!label && pendingCount === 0 && <span className="text-sm text-muted-foreground">{t.analysis.none}</span>}
          </div>
          <p className="text-xs text-muted-foreground">
            {locale === "fr" ? "Stockfish analyse localement. Les résultats apparaissent progressivement et sont conservés ; approfondissez une position dans l’explorateur." : "Stockfish runs locally. Results appear progressively and are saved; study a position further in the explorer."}
          </p>
        </>
      )}
    </div>
  );
}
