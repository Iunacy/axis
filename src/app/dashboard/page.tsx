"use client";

import Link from "next/link";
import { useState } from "react";
import Board from "@/components/Board";
import AnalysisRunner from "@/components/AnalysisRunner";
import { Folio } from "@/components/EditorialFrame";
import GamesTable from "@/components/GamesTable";
import GettingStarted from "@/components/GettingStarted";
import RatingChart from "@/components/RatingChart";
import SyncButton from "@/components/SyncButton";
import WorkspaceLoading from "@/components/WorkspaceLoading";
import { useI18n } from "@/lib/i18n";
import { computeDashboardStats } from "@/lib/stats";
import { duePuzzles } from "@/lib/training";
import { parsePgn } from "@/lib/pgn";
import { useAnalyses, useGames, useStore, useStoreHydrated } from "@/lib/store";

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const hydrated = useStoreHydrated();
  const games = useGames();
  const analyses = useAnalyses();
  const puzzles = useStore(state => state.puzzles);
  const [selection, setSelection] = useState(0);
  if (!hydrated) return <WorkspaceLoading/>;
  const stats = computeDashboardStats(games, analyses);
  const due = duePuzzles(puzzles.filter(puzzle => puzzle.source !== "lichess"));
  const positions = games.flatMap(game => (analyses[game.id]?.issues ?? []).map(issue => ({ game, issue }))).slice(0, 12);
  const selected = positions[Math.min(selection, positions.length - 1)];
  const recent = games.slice(0, 5);
  const lastGame = recent[0];
  const recordedPosition = lastGame ? parsePgn(lastGame.pgn)?.fens.at(-1) : null;
  const highlightedMotif = selected ? t.motifs[selected.issue.motif].split(" (")[0] : null;
  return <main className="edit-workspace edit-dashboard">
    <Folio label={locale === "fr" ? "LE JOURNAL / VOTRE JEU" : "THE JOURNAL / YOUR GAME"} detail={stats.totalGames ? `${stats.totalGames} ${t.dashboard.games} · ${stats.analyzedCount} ${t.dashboard.analyzed}` : t.ui.localOnly} number="01 / AXIS"/>
    {!stats.totalGames ? <><div className="edit-route-heading"><span className="edit-kicker">THE FIRST PAGE</span><h1>{t.ui.yourGame}<em>.</em></h1></div><GettingStarted/></> : <>
      <div className="edit-briefing">
        <aside className="edit-folio-rail">
          <span>{locale === "fr" ? "SOMMAIRE" : "CONTENTS"}</span>
          {positions.length ? positions.slice(0, 4).map(({ game, issue }, index) => <button type="button" key={`${game.id}:${issue.ply}`} onClick={() => setSelection(index)} className={selection === index ? "is-active" : ""} aria-pressed={selection === index}><small>0{index + 1}</small><strong>{t.motifs[issue.motif].split(" (")[0]}</strong></button>) : <div className="edit-rail-summary"><strong>{stats.analyzedCount}</strong><span>{t.dashboard.analyzed}</span><p>{stats.analyzedCount ? locale === "fr" ? "Ajoutez d’autres parties pour révéler les décisions récurrentes." : "Add more games to reveal recurring decisions." : locale === "fr" ? "Analysez une partie pour voir apparaître ses décisions critiques." : "Analyze a game to begin a journal of critical decisions."}</p></div>}
          <div className="edit-rail-actions"><SyncButton/><Link href="/games" className="edit-text-link">{t.nav.games} <span aria-hidden="true">↗</span></Link></div>
        </aside>
        <article className="edit-lead" key={selected ? `${selected.game.id}:${selected.issue.ply}` : "pending"}>
          <div className="edit-lead-meta"><span>{locale === "fr" ? "LE JOURNAL DE DÉCISIONS" : "THE DECISION JOURNAL"}</span><span>{selected ? `MOVE / ${selected.issue.ply}` : "AXIS / 001"}</span></div>
          <h1>{selected ? highlightedMotif : stats.analyzedCount ? (locale === "fr" ? "Une lecture plus nette" : "A clearer reading") : (locale === "fr" ? "Commencez par une partie" : "Begin with a game")}<em>.</em></h1>
          <p>{selected ? t.axis.explain[selected.issue.motif] : stats.analyzedCount ? t.axis.noIssues : t.axis.unanalysed}</p>
          {selected && <div className="edit-decision-evidence"><span>{selected.game.opponent_name ?? t.ui.yourGame} · {new Date(selected.game.played_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB")}</span><strong>{selected.issue.severity} / {selected.issue.san}</strong></div>}
          <Link className="edit-text-link" href={selected ? `/review/${encodeURIComponent(selected.game.id)}` : "/games"}>{selected ? t.ui.reviewGame : t.nav.games}<span aria-hidden="true">↗</span></Link>
          <div className="edit-lead-foot"><span>{stats.totalGames} {t.dashboard.games}</span><span>{stats.avgAccuracy == null ? "—" : `${stats.avgAccuracy}% ${t.games.accuracy}`}</span></div>
        </article>
        <aside className="edit-dossier">
          <div className="edit-dossier-top"><span>{selected ? "POSITION DOSSIER" : "NEXT STUDY"}</span><span>{due.length ? `${due.length} ${t.axis.queue}` : "AXIS"}</span></div>
          {selected ? <div className="edit-dossier-board"><Board fen={selected.issue.fenBefore} orientation={selected.game.user_color} size="sm" showOverlayControls={false}/></div> : due[0] ? <div className="edit-dossier-board"><Board fen={due[0].fen} orientation={due[0].user_side} size="sm" showOverlayControls={false}/></div> : recordedPosition ? <div className="edit-dossier-board"><Board fen={recordedPosition} orientation={lastGame?.user_color ?? "w"} size="sm" showOverlayControls={false}/></div> : null}
          <div className="edit-dossier-caption"><span>{due.length ? t.ui.ready(due.length) : t.ui.nextSession}</span><strong>{due[0] ? t.motifs[due[0].theme].split(" (")[0] : lastGame?.opponent_name ?? t.ui.yourGame}</strong><p>{due[0] ? t.ui.sessionPrompt : recordedPosition ? locale === "fr" ? "Revenez à cette position et rejouez la partie." : "Return to this position and replay the game." : t.ui.trainingEmpty}</p><Link href={due[0] ? "/training" : lastGame ? `/review/${encodeURIComponent(lastGame.id)}` : "/games"} className="edit-text-link">{due[0] ? t.ui.continueTraining : t.ui.reviewGame}<span aria-hidden="true">↗</span></Link></div>
        </aside>
      </div>
      <div className="edit-bottom-index"><span>{locale === "fr" ? "EN UN COUP D’ŒIL" : "AT A GLANCE"}</span><div><strong>{stats.totalGames}</strong><span>{t.dashboard.games}</span></div><div><strong>{stats.analyzedCount}</strong><span>{t.dashboard.analyzed}</span></div><div><strong>{stats.blundersPerGame ?? "—"}</strong><span>{t.dashboard.blundersPerGame}</span></div></div>
      <div className="edit-dashboard-record"><section><div className="edit-section-head"><span>01 / PERFORMANCE</span><h2>{locale === "fr" ? "La trajectoire" : "The trajectory"}</h2></div><RatingChart series={stats.ratingSeries}/></section><section><div className="edit-section-head"><span>02 / RECURRING DECISIONS</span><h2>{t.ui.focusAreas}</h2></div>{stats.weaknesses?.topMotifs.length ? <ol className="edit-focus-list">{stats.weaknesses.topMotifs.map(({ motif, count }, index) => <li key={motif}><span>0{index + 1}</span><strong>{t.motifs[motif].split(" (")[0]}</strong><span>{count}</span></li>)}</ol> : <p className="axis-muted">{t.axis.noTraining}</p>}</section></div>
      <AnalysisRunner pendingCount={stats.pendingCount}/>
      <section className="edit-recent"><div className="edit-section-head"><span>03 / THE LIBRARY</span><h2>{t.dashboard.recentGames}</h2><Link href="/games" className="edit-text-link">{t.ui.viewAll}<span aria-hidden="true">↗</span></Link></div><GamesTable games={recent} showStatus/></section>
    </>}
  </main>;
}
