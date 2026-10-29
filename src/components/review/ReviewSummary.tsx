"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import type { AnalysisSummary, GameRow, MoveClassification, MoveIssue } from "@/lib/types";
import { CLASSIFICATION_META } from "@/lib/classification-meta";
import MoveBadge from "@/components/MoveBadge";

export default function ReviewSummary({ analysis, game, onPractice }: { analysis: AnalysisSummary; game: GameRow; onPractice?: (issue: MoveIssue) => void }) {
  const { t, locale } = useI18n();
  const counts = useMemo(() => {
    const result = new Map<MoveClassification | null, number>();
    for (const move of analysis.moveAssessments ?? []) result.set(move.classification, (result.get(move.classification) ?? 0) + 1);
    return result;
  }, [analysis.moveAssessments]);
  const critical = analysis.issues.filter(issue => issue.bestUci).reduce<MoveIssue | undefined>((best, issue) => !best || issue.winDrop > best.winDrop ? issue : best, undefined);
  const motifs = new Map<string, number>();
  for (const issue of analysis.issues) if (issue.motif !== "other") motifs.set(issue.motif, (motifs.get(issue.motif) ?? 0) + 1);
  const repeated = analysis.issues.find(issue => issue.motif !== "other" && (motifs.get(issue.motif) ?? 0) >= 2);
  return <>
    {analysis.complete === false && <p className="axis-muted">{locale === "fr" ? "Bilan provisoire : vérification en cours." : "Provisional summary: verification is still in progress."}</p>}

    <div className="axis-analysis-summary">
      {analysis.accuracyByColor ? (["w", "b"] as const).map(color => <div key={color}>
        <strong>{analysis.accuracyByColor?.[color] == null ? "—" : `${analysis.accuracyByColor[color]}%`}</strong>
        <span>{color === "w" ? t.axis.white : t.axis.black} · {t.games.accuracy}</span>
      </div>) : <div><strong>{analysis.accuracy}%</strong><span>{game.user_color === "w" ? t.axis.white : t.axis.black} · {t.games.accuracy}</span></div>}
      {analysis.accuracySamples && <p className="axis-muted">{locale === "fr" ? "Précision calculée sur" : "Accuracy based on"} {analysis.accuracySamples.w + analysis.accuracySamples.b} / {analysis.moveAssessments?.length ?? 0} {locale === "fr" ? "coups suffisamment analysés ; les autres sont exclus." : "moves with sufficient evidence; other moves are excluded."}</p>}
      <div><strong>{analysis.blunders}</strong><span>{t.ui.classifications.blunder}</span></div>
    </div>
    {critical && onPractice && <div className="axis-review-next"><p>{locale === "fr" ? "Commencez par la plus grande perte d’évaluation de votre partie." : "Start with your largest evaluation drop in this game."}</p><button type="button" className="axis-button secondary" onClick={() => onPractice(critical)}>{locale === "fr" ? "Travailler la décision" : "Practice critical decision"} · {critical.san}</button></div>}
    {repeated && <p className="axis-muted">{t.motifs[repeated.motif].split(" (")[0]} · {motifs.get(repeated.motif)} {locale === "fr" ? "occurrences dans cette partie" : "occurrences in this game"}</p>}
    {analysis.moveAssessments && <details className="axis-grade-summary" aria-label={locale === "fr" ? "Classification des deux joueurs" : "Both players’ move classifications"}>
      <summary>{locale === "fr" ? "Classification des coups" : "Move classifications"}</summary>
      <div>{(Object.keys(CLASSIFICATION_META) as MoveClassification[]).map(classification => {
        const count = counts.get(classification);
        return count ? <span key={classification}><MoveBadge classification={classification}/><span>{CLASSIFICATION_META[classification].name[locale]}</span><strong>{count}</strong></span> : null;
      })}</div>
      <p>{counts.get(null) ?? 0} {locale === "fr" ? "coups non classés : données insuffisantes." : "moves unclassified: insufficient evidence."}</p>
      <details>
        <summary>{locale === "fr" ? "Interpréter les annotations" : "About these annotations"}</summary>
        <p>{locale === "fr"
          ? "Les annotations et la précision AXIS utilisent des estimations de résultat issues de recherches limitées de Stockfish, pas une mesure du niveau humain. Un mat en un manqué reste une occasion manquée même si la position reste gagnante. Les coups exceptionnels exigent une seconde recherche. Théorie indique une ligne référencée, sans garantir sa qualité ; une perte d’évaluation reste un point à revoir."
          : "AXIS annotations and accuracy use expected-outcome estimates from bounded Stockfish searches, not a measurement of human skill. An unplayed mate in one is a Miss even if the position remains winning. Exceptional moves require a second search. Book identifies a referenced opening line and does not guarantee its quality; evaluation losses can still appear as review issues."}</p>
      </details>
    </details>}
  </>;
}
