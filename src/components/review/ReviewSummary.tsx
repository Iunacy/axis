"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import type { AnalysisSummary, GameRow, MoveClassification } from "@/lib/types";
import { CLASSIFICATION_META } from "@/lib/classification-meta";
import MoveBadge from "@/components/MoveBadge";

export default function ReviewSummary({ analysis, game }: { analysis: AnalysisSummary; game: GameRow }) {
  const { t, locale } = useI18n();
  const counts = useMemo(() => {
    const result = new Map<MoveClassification | null, number>();
    for (const move of analysis.moveAssessments ?? []) result.set(move.classification, (result.get(move.classification) ?? 0) + 1);
    return result;
  }, [analysis.moveAssessments]);
  return <>
    <div className="axis-analysis-summary">
      {analysis.accuracyByColor ? (["w", "b"] as const).map(color => <div key={color}>
        <strong>{analysis.accuracyByColor?.[color] == null ? "—" : `${analysis.accuracyByColor[color]}%`}</strong>
        <span>{color === "w" ? t.axis.white : t.axis.black} · {t.games.accuracy}</span>
      </div>) : <div><strong>{analysis.accuracy}%</strong><span>{game.user_color === "w" ? t.axis.white : t.axis.black} · {t.games.accuracy}</span></div>}
      <div><strong>{analysis.blunders}</strong><span>{t.ui.classifications.blunder}</span></div>
    </div>
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
          ? "Les annotations et la précision AXIS utilisent des estimations de résultat issues de recherches limitées de Stockfish, pas une mesure du niveau humain. Un mat en un manqué reste une occasion manquée même si la position reste gagnante. Les coups exceptionnels exigent une seconde recherche. Théorie indique une ligne référencée, sans garantir sa qualité."
          : "AXIS annotations and accuracy use expected-outcome estimates from bounded Stockfish searches, not a measurement of human skill. An unplayed mate in one is a Miss even if the position remains winning. Exceptional moves require a second search. Book identifies a referenced opening line and does not guarantee its quality."}</p>
      </details>
    </details>}
  </>;
}
