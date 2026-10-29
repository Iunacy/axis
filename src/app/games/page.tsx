"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { PageHeader } from "@/components/Workspace";
import PgnImporter from "@/components/PgnImporter";
import GamesTable from "@/components/GamesTable";
import SyncButton from "@/components/SyncButton";
import WorkspaceLoading from "@/components/WorkspaceLoading";
import { useI18n } from "@/lib/i18n";
import { useAnalyses, useGames, useStore, useStoreHydrated } from "@/lib/store";

import { filterGames, type LibrarySort } from "@/lib/game-library";

export default function GamesPage() {
  const { t, locale } = useI18n();
  const hydrated = useStoreHydrated();
  const games = useGames();
  const analyses = useAnalyses();
  const reviewLocations = useStore(state => state.reviewLocations);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<LibrarySort>("newest");
  const [page, setPage] = useState(0);
  if (!hydrated) return <WorkspaceLoading/>;
  const filtered = filterGames(games, analyses, { query, result, platform, status, sort });
  const lastReview = games.filter(game => reviewLocations[game.id]).sort((a, b) => Date.parse(reviewLocations[b.id].at) - Date.parse(reviewLocations[a.id].at))[0];
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const current = Math.min(page, pages - 1);
  return <main className="axis-games"><PageHeader title={t.games.title} description={t.ui.gamesHelp} actions={<SyncButton/>}/><PgnImporter defaultOpen={!games.length}/>
    {lastReview && <div className="axis-resume-review"><span className="edit-kicker">{locale === "fr" ? "REPRENDRE LA LECTURE" : "CONTINUE YOUR REVIEW"}</span><Link href={`/review/${encodeURIComponent(lastReview.id)}`} className="axis-link">{lastReview.opponent_name ?? t.axis.review} · Position {reviewLocations[lastReview.id].ply}<ChevronRight size={16}/></Link></div>}
    {games.length > 0 ? <><div className="axis-game-filters"><label className="axis-search"><Search size={17} aria-hidden="true"/><input className="axis-field" aria-label={t.ui.search} placeholder={t.ui.search} value={query} onChange={event => { setQuery(event.target.value); setPage(0); }}/></label><select className="axis-field" aria-label={t.games.result} value={result} onChange={event => { setResult(event.target.value); setPage(0); }}><option value="all">{t.ui.allResults}</option>{(["win", "loss", "draw"] as const).map(value => <option key={value} value={value}>{t.games.results[value]}</option>)}</select><select className="axis-field" aria-label={locale === "fr" ? "Source des parties" : "Game source"} value={platform} onChange={event => { setPlatform(event.target.value); setPage(0); }}><option value="all">{locale === "fr" ? "Toutes les sources" : "All sources"}</option><option value="chesscom">Chess.com</option><option value="lichess">Lichess</option><option value="pgn">PGN</option></select>
    <select className="axis-field" aria-label={t.games.status} value={status} onChange={event => { setStatus(event.target.value); setPage(0); }}><option value="all">{locale === "fr" ? "Toutes les revues" : "All reviews"}</option><option value="reviewed">{locale === "fr" ? "Analysées" : "Reviewed"}</option><option value="pending">{locale === "fr" ? "À analyser" : "Needs review"}</option></select>
    <select className="axis-field" aria-label={locale === "fr" ? "Trier les parties" : "Sort games"} value={sort} onChange={event => { setSort(event.target.value as LibrarySort); setPage(0); }}><option value="newest">{locale === "fr" ? "Plus récentes" : "Newest first"}</option><option value="oldest">{locale === "fr" ? "Plus anciennes" : "Oldest first"}</option><option value="accuracy">{locale === "fr" ? "Meilleure précision" : "Highest accuracy"}</option></select>
    <span>{t.ui.results(filtered.length)}</span>{(query || result !== "all" || platform !== "all" || status !== "all" || sort !== "newest") && <button className="axis-link" onClick={() => { setQuery(""); setResult("all"); setPlatform("all"); setStatus("all"); setSort("newest"); setPage(0); }}>{locale === "fr" ? "Réinitialiser" : "Reset filters"}</button>}</div><section className="axis-panel">{filtered.length ? <GamesTable games={filtered.slice(current * 20, current * 20 + 20)} showStatus/> : <p className="axis-muted py-8">{t.ui.noMatches}</p>}</section>{pages > 1 && <div className="axis-pagination"><button aria-label={t.axis.previous} disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft size={18}/></button><span>{t.ui.page(current + 1, pages)}</span><button aria-label={t.axis.next} disabled={current === pages - 1} onClick={() => setPage(current + 1)}><ChevronRight size={18}/></button></div>}</> : <p className="axis-library-start">{t.ui.startHelp} <Link href="/dashboard" className="axis-link">{t.ui.connect}</Link></p>}
  </main>;
}
