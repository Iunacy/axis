"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PuzzlePlayer from "@/components/PuzzlePlayer";
import { Folio } from "@/components/EditorialFrame";
import { useI18n } from "@/lib/i18n";
import { findPattern, type PatternDefinition } from "@/lib/pattern-catalog";
import { duePuzzles } from "@/lib/training";
import type { PuzzleRow } from "@/lib/types";
import { useCuratedPuzzles } from "@/lib/use-curated-puzzles";

const NO_PATTERNS: PatternDefinition[] = [];

export default function PatternPage() {
  const { slug } = useParams<{ slug: string }>();
  const pattern = findPattern(slug);
  const selected = useMemo(() => pattern ? [pattern] : NO_PATTERNS, [pattern]);
  const { puzzles, loading, error, retry } = useCuratedPuzzles(selected);
  const { locale } = useI18n();
  if (!pattern) return <main className="axis-shell"><h1>{locale === "fr" ? "Voie introuvable" : "Pattern not found"}</h1><Link href="/patterns" className="edit-text-link">{locale === "fr" ? "Toutes les voies" : "All paths"} ↗</Link></main>;
  const rows = pattern.ids.map(id => puzzles.find(puzzle => puzzle.id === `lichess:${id}`)).filter((puzzle): puzzle is PuzzleRow => Boolean(puzzle));
  return <main className="edit-pattern-detail">
    <Folio label={locale === "fr" ? "RECONNAISSANCE / MAT" : "RECOGNITION / MATE"} detail={pattern.name[locale]} number="02 / AXIS"/>
    <Link href="/patterns" className="edit-pattern-back">← {locale === "fr" ? "Toutes les voies" : "All pattern paths"}</Link>
    <div className="edit-pattern-detail-head"><div><span className="edit-kicker">AXIS / PATTERN STUDY</span><h1>{pattern.name[locale]}<em>.</em></h1></div><p>{pattern.principle[locale]}</p></div>
    {error && <div className="edit-pattern-error" role="alert"><span>{locale === "fr" ? "Impossible de vérifier ces positions." : "Could not verify these positions."} {error}</span><button type="button" className="axis-button secondary" onClick={retry}>{locale === "fr" ? "Réessayer" : "Retry"}</button></div>}
    {loading ? <p className="edit-source-note" role="status">{locale === "fr" ? "Vérification des positions Lichess…" : "Verifying Lichess positions…"}</p> : rows.length === 3 ? <PatternSession key={pattern.id} pattern={pattern} rows={rows} locale={locale}/> : null}
    <p className="edit-source-note">{locale === "fr" ? "Positions de la base Lichess · licence CC0 1.0" : "Positions from the Lichess database · CC0 1.0"}</p>
  </main>;
}

function PatternSession({ pattern, rows, locale }: { pattern: PatternDefinition; rows: PuzzleRow[]; locale: "en" | "fr" }) {
  const [queue, setQueue] = useState(() => {
    const fresh = rows.filter(row => !row.reviews?.length);
    const due = duePuzzles(rows.filter(row => Boolean(row.reviews?.length)));
    return [...fresh, ...due].map(row => row.id);
  });
  const current = rows.find(row => row.id === queue[0]);
  const completed = rows.filter(row => row.reviews?.some(review => review.solved)).length;
  const stage = current ? rows.findIndex(row => row.id === current.id) : -1;
  return <section className="edit-pattern-session">
    <div className="edit-pattern-stages" aria-label={locale === "fr" ? "Progression" : "Progression"}>{rows.map((row, index) => <div key={row.id} className={current?.id === row.id ? "is-current" : ""}><span>0{index + 1} / {index === 0 ? locale === "fr" ? "RECONNAÎTRE" : "RECOGNIZE" : index === 1 ? locale === "fr" ? "APPLIQUER" : "APPLY" : locale === "fr" ? "CALCULER" : "CALCULATE"}</span><strong>{row.rating ?? "—"}</strong><small>{row.reviews?.some(review => review.solved) ? locale === "fr" ? "résolu" : "solved" : row.reviews?.length ? locale === "fr" ? "à revoir" : "review later" : locale === "fr" ? "nouveau" : "new"}</small></div>)}</div>
    {current ? <><div className="edit-pattern-prompt"><span className="edit-kicker">{locale === "fr" ? "POSITION" : "POSITION"} / 0{stage + 1}</span><p>{stage === 0 ? locale === "fr" ? "Repérez la configuration avant de calculer." : "Recognize the configuration before calculating." : stage === 1 ? locale === "fr" ? "Trouvez la suite forcée." : "Find the forcing continuation." : locale === "fr" ? "Calculez jusqu’au mat." : "Calculate through to mate."}</p></div><PuzzlePlayer puzzles={[current]} onAdvance={() => setQueue(ids => ids.slice(1))} hideTheme postSolveText={pattern.principle[locale]}/></> : <div className="edit-pattern-complete"><span className="edit-kicker">{locale === "fr" ? "SESSION TERMINÉE" : "SESSION COMPLETE"}</span><h2>{completed === rows.length ? locale === "fr" ? "Le motif se précise." : "The pattern is taking shape." : locale === "fr" ? "La révision continue." : "The review continues."}</h2><p>{completed} / 3 {locale === "fr" ? "positions résolues. Les positions déjà vues reviendront selon leur échéance de révision." : "positions solved. Attempted positions return when their review is due."}</p><Link href="/patterns" className="edit-text-link">{locale === "fr" ? "Toutes les voies" : "All pattern paths"}<span aria-hidden="true">↗</span></Link></div>}
  </section>;
}
