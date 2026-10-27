"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FolderOpen, Search } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/Workspace";
import PgnImporter from "@/components/PgnImporter";
import GamesTable from "@/components/GamesTable";
import SyncButton from "@/components/SyncButton";
import WorkspaceLoading from "@/components/WorkspaceLoading";
import { useI18n } from "@/lib/i18n";
import { useGames, useStoreHydrated } from "@/lib/store";

export default function GamesPage() {
  const { t } = useI18n();
  const hydrated = useStoreHydrated();
  const games = useGames();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("all");
  const [page, setPage] = useState(0);
  if (!hydrated) return <WorkspaceLoading/>;
  const filtered = games.filter(game => (result === "all" || result === game.result) && `${game.opponent_name ?? ""} ${game.opening_name ?? ""} ${game.eco ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const current = Math.min(page, pages - 1);
  return <main className="axis-games"><PageHeader title={t.games.title} description={t.ui.gamesHelp} actions={<SyncButton/>}/><PgnImporter defaultOpen={!games.length}/>
    {games.length > 0 ? <><div className="axis-game-filters"><label className="axis-search"><Search size={17} aria-hidden="true"/><input className="axis-field" aria-label={t.ui.search} placeholder={t.ui.search} value={query} onChange={event => { setQuery(event.target.value); setPage(0); }}/></label><select className="axis-field" aria-label={t.games.result} value={result} onChange={event => { setResult(event.target.value); setPage(0); }}><option value="all">{t.ui.allResults}</option>{(["win", "loss", "draw"] as const).map(value => <option key={value} value={value}>{t.games.results[value]}</option>)}</select><span>{t.ui.results(filtered.length)}</span></div><section className="axis-panel">{filtered.length ? <GamesTable games={filtered.slice(current * 20, current * 20 + 20)} showStatus/> : <p className="axis-muted py-8">{t.ui.noMatches}</p>}</section>{pages > 1 && <div className="axis-pagination"><button aria-label={t.axis.previous} disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft size={18}/></button><span>{t.ui.page(current + 1, pages)}</span><button aria-label={t.axis.next} disabled={current === pages - 1} onClick={() => setPage(current + 1)}><ChevronRight size={18}/></button></div>}</> : <EmptyState icon={<FolderOpen size={28}/>} title={t.ui.emptyTitle} description={t.ui.startHelp}><Link href="/dashboard" className="axis-button">{t.ui.connect}</Link></EmptyState>}
  </main>;
}
