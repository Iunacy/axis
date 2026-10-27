"use client";

import Link from "next/link";
import { ArrowUpRight, Check, X } from "lucide-react";
import AnalysisRunner from "@/components/AnalysisRunner";
import Board from "@/components/Board";
import GamesTable from "@/components/GamesTable";
import GettingStarted from "@/components/GettingStarted";
import Logo from "@/components/Logo";
import RatingChart from "@/components/RatingChart";
import SyncButton from "@/components/SyncButton";
import WorkspaceLoading from "@/components/WorkspaceLoading";
import { useI18n } from "@/lib/i18n";
import { computeDashboardStats } from "@/lib/stats";
import { duePuzzles } from "@/lib/training";
import { useAnalyses, useGames, useSettings, useStore, useStoreHydrated } from "@/lib/store";

export default function DashboardPage() {
  const { t } = useI18n();
  const hydrated = useStoreHydrated();
  const games = useGames();
  const analyses = useAnalyses();
  const settings = useSettings();
  const puzzles = useStore(state => state.puzzles);
  if (!hydrated) return <WorkspaceLoading/>;
  const stats = computeDashboardStats(games, analyses);
  const due = duePuzzles(puzzles);
  const next = due[0];
  const reviews = puzzles.flatMap(puzzle => puzzle.reviews ?? []).sort((a,b) => a.at.localeCompare(b.at));
  const reviewed = games.filter(game => game.analysis_status === "done").slice(0, 4);
  const profile = settings.chesscomUsername || settings.lichessUsername;
  const accounts = [settings.chesscomUsername && "Chess.com", settings.lichessUsername && "Lichess"].filter(Boolean).join(" / ");
  return <main className="axis-dashboard axis-instrument">
    <div className="axis-overview-header"><div className="axis-player"><span className="axis-player-mark"><Logo/></span><div><h1>{profile || t.ui.yourGame}</h1><p>{accounts || t.app.tagline}{profile && <><span className="axis-status-dot"/>{t.ui.localOnly}</>}</p></div></div>{stats.totalGames > 0 && <SyncButton/>}</div>
    {!stats.totalGames ? <GettingStarted/> : <>
      <div className="axis-intelligence-stage"><section className="axis-rating-region"><RatingChart series={stats.ratingSeries}/><div className="axis-performance-summary"><div><strong>{stats.totalGames}</strong><span>{t.dashboard.games}</span></div><div><strong>{stats.analyzedCount}</strong><span>{t.dashboard.analyzed}</span></div><div><strong>{stats.avgAccuracy == null ? "—" : `${stats.avgAccuracy}%`}</strong><span>{t.ui.accuracyEngine}</span></div><div><strong>{stats.blundersPerGame ?? "—"}</strong><span>{t.dashboard.blundersPerGame}</span></div></div></section><section className="axis-session-focus"><div className="axis-session-heading"><h2>{t.ui.nextSession}</h2><span>{due.length ? t.ui.ready(due.length) : t.axis.queue + ": 0"}</span></div><div className="axis-session-content">{next ? <div className="axis-session-preview" aria-hidden="true" inert><Board fen={next.fen} orientation={next.user_side} size="sm" showOverlayControls={false}/></div> : <div className="axis-session-symbol" aria-hidden="true"><Logo className="size-16"/></div>}<div><h3>{next ? t.motifs[next.theme].split(" (")[0] : puzzles.length ? t.ui.trainingClearTitle : t.ui.reviewFirst}</h3><p>{next ? t.ui.sessionPrompt : puzzles.length ? t.ui.trainingClear : t.ui.trainingEmpty}</p></div></div><Link className="axis-button" href={next ? "/training" : "/games"}>{next ? t.ui.continueTraining : t.ui.reviewGame}<ArrowUpRight size={17}/></Link></section></div>
      <section className="axis-recent-region"><div className="axis-panel-head"><h2>{reviewed.length ? t.ui.recentlyReviewed : t.dashboard.recentGames}</h2><Link href="/games" className="axis-link">{t.ui.viewAll}<ArrowUpRight size={13}/></Link></div><GamesTable games={reviewed.length ? reviewed : stats.recentGames.slice(0, 4)} showStatus/></section>
      <div className="axis-dashboard-secondary"><AnalysisRunner pendingCount={stats.pendingCount}/><section className="axis-insight-region"><div className="axis-panel-head"><h2>{t.ui.focusAreas}</h2><Link href="/lessons" className="axis-link">{t.nav.lessons}<ArrowUpRight size={13}/></Link></div>{stats.weaknesses?.topMotifs.length ? <ul className="axis-weakness-list">{stats.weaknesses.topMotifs.map(item => <li key={item.motif}><span>{t.motifs[item.motif].split(" (")[0]}</span><span>{item.count}</span></li>)}</ul> : <p className="axis-muted text-sm leading-7">{t.axis.noTraining}</p>}{reviews.length > 0 && <div className="axis-practice-record"><h3>{t.ui.practiceProgress}</h3><div className="axis-review-dots" aria-label={t.ui.recentReviews}>{reviews.slice(-12).map((review,index) => <span key={`${review.at}:${index}`} className={review.solved ? "solved" : "failed"} title={review.solved ? t.axis.solved : t.puzzles.wrong}>{review.solved ? <Check size={12}/> : <X size={12}/>}</span>)}</div><p>{reviews.length} {t.axis.reviewed} · {reviews.filter(review => review.solved).length} {t.axis.solved}</p></div>}</section></div>
    </>}
  </main>;
}
