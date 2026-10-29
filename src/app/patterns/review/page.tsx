"use client";

import { useState } from "react";
import Link from "next/link";
import Board from "@/components/Board";
import PuzzlePlayer from "@/components/PuzzlePlayer";
import { Folio } from "@/components/EditorialFrame";
import { useI18n } from "@/lib/i18n";
import { PATTERNS } from "@/lib/pattern-catalog";
import { duePuzzles, mixedPatternQueue } from "@/lib/training";
import { useStore } from "@/lib/store";
import { useCuratedPuzzles } from "@/lib/use-curated-puzzles";
import type { PatternId, PuzzleRow } from "@/lib/types";

const CURATED_IDS = new Set(PATTERNS.flatMap(pattern => pattern.ids.map(id => `lichess:${id}`)));

export default function MixedPatternReviewPage() {
  const { locale } = useI18n();
  const { puzzles, loading, error, retry } = useCuratedPuzzles(PATTERNS);
  const identify = useStore(state => state.recordPatternRecognition);
  const [session, setSession] = useState<string[] | null>(null);
  const [baseline, setBaseline] = useState<Record<string, number>>({});
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const rows = puzzles.filter(puzzle => puzzle.source === "lichess" && puzzle.pattern && CURATED_IDS.has(puzzle.id));
  const eligible = mixedPatternQueue(rows);
  const due = duePuzzles(eligible);
  const pending = rows.find(puzzle => puzzle.reviews?.at(-1)?.recognitionPending && puzzle.reviews.at(-1)?.recognizedPattern === undefined);
  const feedback = rows.find(puzzle => puzzle.id === feedbackId);
  const current = session?.length ? rows.find(puzzle => puzzle.id === session[0]) : undefined;
  const currentReview = current && (current.reviews?.length ?? 0) > (baseline[current.id] ?? 0) ? current.reviews?.at(-1) : undefined;
  const finished = session?.length === 0;
  const choosePattern = (id: string, chosen: PatternId) => { identify(id, chosen); setFeedbackId(id); };

  return <main className="edit-pattern-detail">
    <Folio label={locale === "fr" ? "RECONNAISSANCE / RÉVISION" : "RECOGNITION / REVIEW"} detail={locale === "fr" ? "Sans indice de motif" : "No pattern labels"} number="02 / AXIS"/>
    <Link href="/patterns" className="edit-pattern-back">← {locale === "fr" ? "Toutes les voies" : "All pattern paths"}</Link>
    <div className="edit-pattern-detail-head"><div><span className="edit-kicker">AXIS / MIXED REVIEW</span><h1>{locale === "fr" ? "Sans étiquette" : "Without a label"}<em>.</em></h1></div><p>{locale === "fr" ? "Résolvez d’abord. Nommez ensuite le motif sans aide. Les positions dues passent en premier ; vous pouvez aussi vous entraîner en avance." : "Solve first. Then name the pattern without a cue. Due positions come first; you can also practice ahead."}</p></div>
    {error && <div className="edit-pattern-error" role="alert"><span>{error}</span><button type="button" className="axis-button secondary" onClick={retry}>{locale === "fr" ? "Réessayer" : "Retry"}</button></div>}
    {loading ? <p className="edit-source-note" role="status">{locale === "fr" ? "Vérification des positions…" : "Verifying positions…"}</p> : (pending || feedback) && !current ? <section className="edit-mixed-stage"><span className="edit-kicker">{pending ? locale === "fr" ? "IDENTIFICATION EN ATTENTE" : "IDENTIFICATION PENDING" : locale === "fr" ? "VOTRE RÉPONSE" : "YOUR ANSWER"}</span><div className="edit-mixed-board"><Board fen={(pending ?? feedback)!.fen} orientation={(pending ?? feedback)!.user_side} showOverlayControls={false}/></div><RecognitionQuiz puzzle={(pending ?? feedback)!} locale={locale} onIdentify={choosePattern}/>{feedback && <button type="button" className="axis-button secondary" onClick={() => setFeedbackId(null)}>{locale === "fr" ? "Continuer" : "Continue"}</button>}</section> : current ? <section className="edit-mixed-stage">
      <div className="edit-pattern-prompt"><span className="edit-kicker">{locale === "fr" ? "POSITION SANS ÉTIQUETTE" : "UNLABELED POSITION"} / {eligible.length - session!.length + 1}—{eligible.length}</span><p>{due.some(puzzle => puzzle.id === current.id) ? locale === "fr" ? "Révision prévue aujourd’hui" : "Scheduled for review today" : locale === "fr" ? "Entraînement en avance" : "Practice ahead"}</p></div>
      <PuzzlePlayer puzzles={[current]} blind recognitionPrompt nextDisabled={currentReview?.recognizedPattern === undefined} onAdvance={() => { setFeedbackId(null); setSession(ids => ids?.slice(1) ?? null); }}/>
      {(currentReview?.recognitionPending || currentReview?.recognizedPattern !== undefined) && <RecognitionQuiz puzzle={current} locale={locale} onIdentify={choosePattern}/>}
    </section> : finished ? <div className="edit-pattern-complete"><span className="edit-kicker">{locale === "fr" ? "SÉANCE TERMINÉE" : "SESSION COMPLETE"}</span><h2>{locale === "fr" ? "Revenez avec un autre regard." : "Return with a sharper eye."}</h2><Link href="/patterns" className="edit-text-link">{locale === "fr" ? "Toutes les voies" : "All pattern paths"} ↗</Link></div> : <section className="edit-mixed-start">
      <div><span className="edit-kicker">{locale === "fr" ? "VOTRE RÉPERTOIRE" : "YOUR REPERTOIRE"}</span><strong>{eligible.length}</strong><p>{locale === "fr" ? "positions apprises" : "learned positions"}</p></div>
      <div><span className="edit-kicker">{locale === "fr" ? "À REVOIR" : "DUE NOW"}</span><strong>{due.length}</strong><p>{locale === "fr" ? "positions à revoir" : "positions ready for review"}</p></div>
      <div className="edit-mixed-start-action"><p>{eligible.length ? locale === "fr" ? "Les motifs sont masqués jusqu’à ce que vous trouviez la suite et nommiez la configuration." : "Pattern names stay hidden until you find the line and identify the configuration." : locale === "fr" ? "Résolvez d’abord une position dans une voie de motifs pour ouvrir la révision mélangée." : "Solve a position in a pattern path to open mixed review."}</p>{eligible.length ? <button type="button" className="axis-button" onClick={() => { setBaseline(Object.fromEntries(eligible.map(puzzle => [puzzle.id, puzzle.reviews?.length ?? 0]))); setSession(eligible.map(puzzle => puzzle.id)); }}>{due.length ? locale === "fr" ? "Commencer la révision" : "Start mixed review" : locale === "fr" ? "S’entraîner en avance" : "Practice ahead"}</button> : <Link href="/patterns" className="axis-button">{locale === "fr" ? "Choisir une voie" : "Choose a path"}</Link>}</div>
    </section>}
    <p className="edit-source-note">{locale === "fr" ? "Positions de la base Lichess · licence CC0 1.0" : "Positions from the Lichess database · CC0 1.0"}</p>
  </main>;
}

function RecognitionQuiz({ puzzle, locale, onIdentify }: { puzzle: PuzzleRow; locale: "en" | "fr"; onIdentify: (id: string, chosen: PatternId) => void }) {
  const review = puzzle.reviews?.at(-1);
  const answered = review?.recognizedPattern !== undefined;
  const independent = review?.solved && !review.hintsUsed && !review.solutionRevealed && !review.wrongMoves;
  const actual = PATTERNS.find(pattern => pattern.id === puzzle.pattern);
  return <div className="edit-recognition-quiz"><span className="edit-kicker">{locale === "fr" ? "NOMMEZ LE MOTIF" : "NAME THE PATTERN"}</span><h2>{answered ? review.recognizedPattern ? independent ? locale === "fr" ? "Reconnu sans aide." : "Recognized independently." : locale === "fr" ? "Motif identifié." : "Pattern identified." : locale === "fr" ? "Regardez la structure." : "Look at the structure." : locale === "fr" ? "Quel mat venez-vous de voir ?" : "Which mate did you see?"}</h2>{answered ? <p>{actual?.name[locale]} — {actual?.principle[locale]} <a href={puzzle.source_url ?? "https://database.lichess.org/#puzzles"} target="_blank" rel="noreferrer">{locale === "fr" ? "Source Lichess" : "Lichess source"} ↗</a></p> : <div className="edit-recognition-choices">{PATTERNS.map(pattern => <button type="button" key={pattern.id} onClick={() => onIdentify(puzzle.id, pattern.id)}>{pattern.name[locale]}</button>)}</div>}</div>;
}
