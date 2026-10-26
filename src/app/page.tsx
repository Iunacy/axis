"use client";

import Link from "next/link";
import { ArrowUpRight, Target } from "lucide-react";
import AnalysisRunner from "@/components/AnalysisRunner";
import GamesTable from "@/components/GamesTable";
import GettingStarted from "@/components/GettingStarted";
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
  const due = duePuzzles(puzzles).length;
  const accounts = [settings.chesscomUsername && `${settings.chesscomUsername} · Chess.com`, settings.lichessUsername && `${settings.lichessUsername} · Lichess`].filter(Boolean).join(" / ");
  return <main className="axis-dashboard">
    <div className="axis-page-head"><div><h1>{t.dashboard.title}</h1><p>{t.ui.overviewHelp}</p>{accounts && <p className="axis-account"><Link href="/settings">{accounts}</Link></p>}</div>{stats.totalGames > 0 && <SyncButton/>}</div>
    {!stats.totalGames ? <GettingStarted/> : <>
      <div className="axis-stats"><div><span>{t.dashboard.games}</span><strong>{stats.totalGames}</strong><small>{stats.analyzedCount} {t.dashboard.analyzed}</small></div><div><span>{t.dashboard.winRate}</span><strong>{stats.winRate == null ? "—" : `${stats.winRate}%`}</strong></div><div><span>{t.dashboard.accuracy}</span><strong>{stats.avgAccuracy == null ? "—" : `${stats.avgAccuracy}%`}</strong></div><div><span>{t.dashboard.blundersPerGame}</span><strong>{stats.blundersPerGame ?? "—"}</strong></div></div>
      <div className="axis-dashboard-grid"><section className="axis-panel"><div className="axis-panel-head"><h2>{t.dashboard.progression}</h2></div><RatingChart series={stats.ratingSeries}/></section><section className="axis-panel axis-session"><div><Target size={26}/><h2>{t.ui.nextSession}</h2><h3>{due ? t.ui.ready(due) : puzzles.length ? t.axis.allDone : t.axis.training}</h3><p>{due ? t.ui.trainingHelp : puzzles.length ? t.ui.trainingClear : t.ui.trainingEmpty}</p></div><Link className="axis-button" href={due ? "/training" : "/games"}>{due ? t.ui.startPractice : t.ui.reviewGame}<ArrowUpRight size={16}/></Link></section></div>
      <div className="axis-dashboard-grid"><AnalysisRunner pendingCount={stats.pendingCount}/><section className="axis-panel"><div className="axis-panel-head"><h2>{t.dashboard.weaknesses}</h2><Link href="/lessons" className="axis-link">{t.nav.lessons}</Link></div>{stats.weaknesses?.topMotifs.length ? <ul className="axis-weakness-list">{stats.weaknesses.topMotifs.map(item => <li key={item.motif}><span>{t.motifs[item.motif].split(" (")[0]}</span><span>{item.count}</span></li>)}</ul> : <p className="axis-muted text-sm leading-7">{t.axis.noTraining}</p>}</section></div>
      <section className="axis-panel"><div className="axis-panel-head"><h2>{t.dashboard.recentGames}</h2><Link href="/games" className="axis-link">{t.ui.viewAll}</Link></div><GamesTable games={stats.recentGames.slice(0, 6)} showStatus/></section>
    </>}
  </main>;
}
