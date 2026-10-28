"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import Board from "@/components/Board";
import ContextPanel from "@/components/ContextPanel";
import GamesTable from "@/components/GamesTable";
import GettingStarted from "@/components/GettingStarted";
import RatingChart from "@/components/RatingChart";
import WorkspaceLoading from "@/components/WorkspaceLoading";
import { useI18n } from "@/lib/i18n";
import { computeDashboardStats } from "@/lib/stats";
import { duePuzzles } from "@/lib/training";
import { filterGames } from "@/lib/game-library";
import { useAnalyses, useGames, useStore, useStoreHydrated } from "@/lib/store";

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const hydrated = useStoreHydrated();
  const games = useGames();
  const analyses = useAnalyses();
  const puzzles = useStore(state => state.puzzles);
  const session = useStore(state => state.trainingSession);
  const [panel, setPanel] = useState<"games" | "progress" | null>(null);
  const [query, setQuery] = useState("");
  if (!hydrated) return <WorkspaceLoading/>;
  const fr = locale === "fr";
  const stats = computeDashboardStats(games, analyses);
  const due = duePuzzles(puzzles.filter(puzzle => puzzle.source !== "lichess"));
  const priority = stats.weaknesses?.topMotifs[0];
  const evidence = priority ? games.flatMap(game => (analyses[game.id]?.complete !== false ? analyses[game.id]?.issues ?? [] : []).filter(issue => issue.motif === priority.motif).map(issue => ({ game, issue })))[0] : undefined;
  const matching = filterGames(games, analyses, { query, sort: "newest", result: "all", platform: "all", status: "all" });
  const reviews = puzzles.flatMap(puzzle => puzzle.reviews ?? []);
  const independent = reviews.filter(review => review.firstAttempt && !review.hintsUsed);
  return <main className="edit-workspace axis-dashboard">
    <header className="axis-dashboard-heading"><div><h1>{fr ? "Votre prochain coup." : "Your next move."}</h1><p>{fr ? "Une partie. Une décision. Une meilleure habitude." : "One game. One decision. A better habit."}</p></div><span>{t.ui.localOnly}</span></header>
    {!games.length ? <GettingStarted/> : <>
      <div className="axis-dashboard-actions">
        <section><h2>{t.ui.reviewGame}</h2><p>{fr ? "Choisissez la partie à comprendre. L’analyse démarre à l’ouverture." : "Choose the game you want to understand. Analysis starts when you open it."}</p><button className="axis-button" onClick={() => setPanel("games")}>{fr ? "Choisir une partie" : "Choose a game"}<ArrowUpRight size={16}/></button></section>
        <section><h2>{t.ui.continueTraining}</h2><p>{session?.remainingIds.length ? `${session.remainingIds.length} ${fr ? "positions dans votre session enregistrée." : "positions in your saved session."}` : due.length ? `${due.length} ${fr ? "positions prêtes à revoir." : "positions ready for review."}` : fr ? "Votre pratique découle de vos décisions analysées." : "Your practice starts with decisions from your reviewed games."}</p><Link className="axis-button secondary" href="/training">{t.ui.continueTraining}<ArrowUpRight size={16}/></Link></section>
      </div>
      <div className="axis-dashboard-study"><section><h2>{fr ? "Votre prochaine priorité" : "Your next priority"}</h2>{evidence ? <><h3>{t.motifs[evidence.issue.motif].split(" (")[0]}</h3><p>{t.axis.explain[evidence.issue.motif]}</p><p className="axis-muted">{priority!.count} {fr ? "décisions observées. À confirmer par la pratique ; ce n’est pas une mesure de maîtrise." : "observed decisions. Practice will test this pattern; this is not a mastery assessment."}</p><Link className="axis-link" href={`/review/${encodeURIComponent(evidence.game.id)}`}>{t.ui.reviewGame}<ArrowUpRight size={16}/></Link></> : <><p>{fr ? "Analysez vos parties pour trouver des décisions à travailler." : "Review your games to find decisions worth practicing."}</p><button className="axis-link" onClick={() => setPanel("games")}>{t.ui.reviewGame}<ArrowUpRight size={16}/></button></>}</section>{evidence ? <div className="axis-dashboard-board"><Board fen={evidence.issue.fenBefore} orientation={evidence.game.user_color} size="sm" showOverlayControls={false}/></div> : <div className="axis-dashboard-note"><strong>{stats.analyzedCount} / {games.length}</strong><p>{fr ? "parties analysées" : "games reviewed"}</p></div>}</div>
      <section className="axis-dashboard-progress"><div><h2>{fr ? "Progrès récents" : "Recent progress"}</h2><p>{stats.analyzedCount} {t.dashboard.analyzed} · {stats.avgAccuracy == null ? "—" : `${stats.avgAccuracy}%`} {t.games.accuracy}</p></div><p>{independent.length ? `${independent.filter(review => review.solved).length}/${independent.length} ${fr ? "premières tentatives réussies sans indice" : "first attempts solved without hints"}` : fr ? "Pas encore de tentatives indépendantes." : "No independent practice attempts yet."}</p><button className="axis-link" onClick={() => setPanel("progress")}>{fr ? "Voir les détails" : "View details"}<ArrowUpRight size={16}/></button></section>
    </>}
    <ContextPanel open={panel === "games"} onClose={() => setPanel(null)} title={fr ? "Choisir une partie" : "Choose a game"}><label className="axis-search"><Search size={17}/><input autoFocus className="axis-field" aria-label={t.ui.search} placeholder={t.ui.search} value={query} onChange={event => setQuery(event.target.value)}/></label>{matching.length ? <GamesTable games={matching.slice(0, 50)} showStatus/> : <p>{t.ui.noMatches}</p>}<Link className="axis-link" href="/games">{fr ? "Importer ou parcourir toutes les parties" : "Import or browse all games"}<ArrowUpRight size={16}/></Link></ContextPanel>
    <ContextPanel open={panel === "progress"} onClose={() => setPanel(null)} title={fr ? "Historique des performances" : "Performance history"} drawer><RatingChart series={stats.ratingSeries}/><p>{fr ? "La précision est calculée sur les revues terminées. Les classements dépendent de la plateforme et de la cadence." : "Accuracy uses completed reviews. Ratings depend on platform and time control."}</p><h3>{t.ui.focusAreas}</h3>{stats.weaknesses?.topMotifs.map(item => <p key={item.motif}>{t.motifs[item.motif]} · {item.count}</p>)}</ContextPanel>
  </main>;
}
