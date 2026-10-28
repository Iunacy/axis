"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import type { MoveIssue } from "@/lib/types";
import type { ReviewPractice } from "@/lib/review-position";
import { CLASSIFICATION_META } from "@/lib/classification-meta";
import MoveBadge from "@/components/MoveBadge";
import { lessonTeaching } from "@/lib/lessons";

export default function ReviewCoach({ issue, practice, lessonSlug, onReveal, onRetry, onLine, onReturn }: {
  issue: MoveIssue; practice: ReviewPractice; lessonSlug?: string; onReveal: () => void; onRetry: () => void; onLine: () => void; onReturn: () => void;
}) {
  const { t, locale } = useI18n();
  const answered = practice.status === "correct" || practice.status === "revealed";
  const teaching = lessonTeaching(issue.motif, locale);
  return <section className="axis-issue-detail" aria-label={locale === "fr" ? "Exercice de la partie" : "Game exercise"}>
    <span className={`axis-tag axis-classification ${issue.severity}`}><MoveBadge classification={issue.classification ?? issue.severity}/>{Number(issue.fenBefore.split(" ")[5])}{issue.fenBefore.split(" ")[1] === "w" ? "." : "..."} {issue.san} · {CLASSIFICATION_META[issue.classification ?? issue.severity].name[locale]}</span>
    <h2>{t.axis.findMove}</h2>
    <p>{locale === "fr" ? "Jouez votre correction sur l’échiquier. La réponse reste masquée." : "Play your correction on the board. The answer stays hidden until you try or reveal it."}</p>
    <div role="status" aria-live="polite">{practice.status === "wrong" && <p className="axis-feedback error">{t.axis.wrong}</p>}{practice.status === "correct" && <p className="axis-feedback success">{t.axis.correct}</p>}</div>
    {answered && <>
      <div className="axis-line"><p>{t.axis.played}: <strong>{issue.san}</strong> · {t.axis.best}: <strong>{issue.bestSan ?? "—"}</strong></p></div>
      <p>{t.axis.explain[issue.motif]}</p>
      <small>{t.axis.heuristic}</small>
      <p className="axis-practice-evidence">{locale === "fr" ? "Tentative enregistrée dans votre historique d’entraînement." : "Attempt saved to your training history."}</p>
      {teaching && <details className="axis-practice-teaching"><summary>{locale === "fr" ? "Étudier ce principe" : "Study this principle"}</summary><h3>{teaching.title}</h3><p>{teaching.concept}</p><ol>{teaching.steps.map(step => <li key={step}>{step}</li>)}</ol></details>}
    </>}
    <div className="axis-actions">
      {!answered && <button type="button" className="axis-button secondary" onClick={onReveal}>{t.axis.reveal}</button>}
      {answered && <button type="button" className="axis-button secondary" onClick={onRetry}>{t.axis.retry}</button>}
      {answered && issue.continuation?.length && <button type="button" className="axis-button" onClick={onLine}>{t.axis.line}</button>}
      {answered && lessonSlug && <Link className="axis-link" href={`/lessons/${lessonSlug}`}>{locale === "fr" ? "Étudier ce principe" : "Study this principle"}</Link>}
      <button type="button" className="axis-link" onClick={onReturn}>{locale === "fr" ? "Revenir à la partie" : "Return to game"}</button>
    </div>
  </section>;
}
