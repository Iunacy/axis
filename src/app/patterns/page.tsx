"use client";

import Link from "next/link";
import { Folio } from "@/components/EditorialFrame";
import { useI18n } from "@/lib/i18n";
import { PATTERNS } from "@/lib/pattern-catalog";
import { useCuratedPuzzles } from "@/lib/use-curated-puzzles";

export default function PatternsPage() {
  const { locale } = useI18n();
  const { puzzles, loading, error, retry } = useCuratedPuzzles(PATTERNS);
  return <main className="edit-pattern-library">
    <Folio label={locale === "fr" ? "ÉTUDE / RECONNAISSANCE" : "STUDY / RECOGNITION"} detail={locale === "fr" ? "Six configurations de mat" : "Six mating configurations"} number="02 / AXIS"/>
    <div className="edit-pattern-intro"><span className="edit-kicker">AXIS / PATTERN RECOGNITION</span><h1>{locale === "fr" ? "Voir le mat avant le coup" : "See the mate before the move"}<em>.</em></h1><p>{locale === "fr" ? "Chaque voie commence par une configuration claire, puis ajoute des coups de calcul. Les positions proviennent de la collection de problèmes Lichess et sont vérifiées avant d’entrer dans votre pratique." : "Each path begins with a clear configuration, then adds calculation. Positions come from the Lichess puzzle collection and are checked before entering your practice."}</p></div>
    {error && <div className="edit-pattern-error" role="alert"><span>{locale === "fr" ? "Les positions ne sont pas disponibles pour le moment." : "The positions are unavailable right now."} {error}</span><button type="button" className="axis-button secondary" onClick={retry}>{locale === "fr" ? "Réessayer" : "Retry"}</button></div>}
    <section className="edit-pattern-index" aria-label={locale === "fr" ? "Voies de motifs" : "Pattern paths"}>{PATTERNS.map((pattern, index) => {
      const rows = pattern.ids.map(id => puzzles.find(puzzle => puzzle.id === `lichess:${id}`));
      const learned = rows.filter(row => row?.reviews?.some(review => review.solved)).length;
      const reviewed = rows.filter(row => row?.reviews?.length).length;
      return <Link href={`/patterns/${pattern.id}`} key={pattern.id} className="edit-pattern-row"><span className="edit-pattern-number">0{index + 1}</span><div><span className="edit-kicker">{locale === "fr" ? "VOIE DE MAT" : "MATING PATH"}</span><h2>{pattern.name[locale]}</h2><p>{pattern.principle[locale]}</p></div><div className="edit-pattern-progress"><strong>{learned}<span> / 3</span></strong><small>{locale === "fr" ? "résolus" : "solved"}</small><small>{reviewed} {locale === "fr" ? "vus" : "seen"}</small></div><span className="edit-pattern-arrow" aria-hidden="true">↗</span></Link>;
    })}</section>
    <p className="edit-source-note">{loading ? locale === "fr" ? "Vérification des positions…" : "Verifying positions…" : locale === "fr" ? "Positions vérifiées · licence CC0 1.0" : "Verified positions · CC0 1.0"} · <a href="https://database.lichess.org/#puzzles" target="_blank" rel="noreferrer">Lichess open database</a></p>
  </main>;
}
