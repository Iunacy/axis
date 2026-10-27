"use client";

import { useState } from "react";
import { toast } from "sonner";
import { describeError } from "@/lib/errors";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CometSpinner } from "@/components/ui/comet-spinner";
import { requestAiLesson, useCoachAvailability } from "@/lib/coach-client";
import { buildDossier } from "@/lib/dossier";
import { gameAccuracy } from "@/lib/game-library";
import { useAnalyses } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { addAiLesson, loadAiLessons, loadAnalyses, loadGames } from "@/lib/storage";
import type { AiLessonRow, GameRow } from "@/lib/types";

export function ResultBadge({ result }: { result: GameRow["result"] }) {
  const { t } = useI18n();
  return <span className={`axis-result ${result}`}>{t.games.results[result]}</span>;
}

function GameLessonButton({
  game,
  busyId,
  setBusyId,
}: {
  game: GameRow;
  busyId: string | null;
  setBusyId: (id: string | null) => void;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const analyzed = game.analysis_status === "done";
  const isBusy = busyId === game.id;
  const locked = busyId !== null && !isBusy;

  async function generate() {
    if (!analyzed || busyId !== null) return;
    setBusyId(game.id);
    try {
      const summary = loadAnalyses()[game.id];
      if (!summary) throw new Error(t.games.analyzeFirst);
      const dossier = buildDossier(loadGames(), { [game.id]: summary });
      const lesson = await requestAiLesson({
        dossier,
        locale,
        pastLessonTitles: loadAiLessons().map((l) => l.title),
        focus: `single-game post-mortem vs ${game.opponent_name ?? "?"} (${game.result}, ${game.opening_name ?? game.eco ?? "unknown opening"})`,
      });
      const row: AiLessonRow = {
        id: `ai-${Date.now()}`,
        locale,
        created_at: new Date().toISOString(),
        completed: false,
        title: lesson.title,
        content: lesson,
      };
      addAiLesson(row);
      setBusyId(null);
      router.push(`/lessons/${row.id}`);
    } catch (e) {
      toast.error(describeError(e, t));
      setBusyId(null);
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={generate}
          disabled={!analyzed || locked || isBusy}
          aria-label={t.games.aiLesson}
          className={[
            "inline-flex items-center justify-center rounded-md p-1.5 transition",
            isBusy
              ? "text-violet-500"
              : analyzed && !locked
              ? "text-violet-500 dark:text-violet-400 hover:bg-violet-500/10"
              : "text-muted-foreground/40 cursor-not-allowed",
          ].join(" ")}
        >
          {isBusy ? <CometSpinner className="size-3" /> : <BookOpen className="size-4" />}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {isBusy ? t.games.generatingLesson : analyzed ? t.games.aiLesson : t.games.analyzeFirst}
      </TooltipContent>
    </Tooltip>
  );
}

export default function GamesTable({ games, showStatus = false }: { games: GameRow[]; showStatus?: boolean }) {
  const { t, locale } = useI18n();
  const { available: aiConfigured } = useCoachAvailability();
  const [busyId, setBusyId] = useState<string | null>(null);
  const analyses = useAnalyses();
  const accuracy = (game: GameRow) => gameAccuracy(game, analyses);
  const date = (game: GameRow) => new Date(game.played_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB");
  const status = (game: GameRow) => ({ done: t.ui.analysisDone, pending: t.ui.analysisPending, failed: t.ui.analysisFailed, skipped: t.ui.analysisSkipped, analyzing: t.analysis.running })[game.analysis_status];
  return <TooltipProvider delayDuration={200}><div className="axis-table-wrap"><table className="axis-table"><thead><tr><th>{t.games.date}</th><th>{t.games.opponent}</th><th>{t.games.result}</th><th>{t.games.opening}</th><th>{t.games.accuracy}</th>{showStatus && <th>{t.games.status}</th>}{aiConfigured && <th aria-label={t.games.aiLesson}/>}</tr></thead><tbody>{games.map(game => <tr key={game.id}><td>{date(game)}</td><td><Link className="axis-opponent" href={`/review/${encodeURIComponent(game.id)}`}>{game.opponent_name ?? "—"}<ArrowUpRight size={13}/></Link><span className="axis-muted text-xs">{game.opponent_rating ?? "—"} · {game.platform === "chesscom" ? "Chess.com" : game.platform === "lichess" ? "Lichess" : "PGN"}</span></td><td><ResultBadge result={game.result}/></td><td className="axis-opening">{analyses[game.id]?.opening?.name ?? game.opening_name ?? game.eco ?? "—"}</td><td>{accuracy(game) == null ? "—" : `${accuracy(game)}%`}</td>{showStatus && <td><span className={`axis-analysis-status ${game.analysis_status}`}>{status(game)}</span></td>}{aiConfigured && <td><GameLessonButton game={game} busyId={busyId} setBusyId={setBusyId}/></td>}</tr>)}</tbody></table></div><div className="axis-game-mobile">{games.map(game => <Link key={game.id} href={`/review/${encodeURIComponent(game.id)}`}><h3><span>{game.opponent_name ?? "—"}</span><ArrowUpRight size={14}/></h3><ResultBadge result={game.result}/><span className="axis-mobile-opening">{analyses[game.id]?.opening?.name ?? game.opening_name ?? game.eco ?? game.time_class}</span><div className="axis-mobile-meta"><span>{date(game)} · {game.opponent_rating ?? "—"}</span><span>{showStatus ? status(game) : accuracy(game) == null ? "—" : `${accuracy(game)}%`}</span></div></Link>)}</div></TooltipProvider>;
}
