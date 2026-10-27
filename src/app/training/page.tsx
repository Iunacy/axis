"use client";

import { useEffect, useMemo } from "react";
import { Check, X } from "lucide-react";
import WorkspaceLoading from "@/components/WorkspaceLoading";
import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/Workspace";
import PuzzlePlayer from "@/components/PuzzlePlayer";
import { useI18n } from "@/lib/i18n";
import { useStore, useStoreHydrated } from "@/lib/store";
import { duePuzzles } from "@/lib/training";

export default function TrainingPage() {
  const { t, locale } = useI18n();
  const hydrated = useStoreHydrated();
  const puzzles = useStore(s => s.puzzles);
  const session = useStore(s => s.trainingSession);
  const startSession = useStore(s => s.startTrainingSession);
  const advanceSession = useStore(s => s.advanceTrainingSession);
  const updateAttempt = useStore(s => s.updateTrainingAttempt);
  const dueIds = useMemo(() => duePuzzles(puzzles).map(p => p.id), [puzzles]);
  useEffect(() => {
    if (hydrated && !session && dueIds.length) startSession(dueIds);
  }, [hydrated, session, dueIds, startSession]);
  if (!hydrated) return <WorkspaceLoading/>;
  if (!session && dueIds.length) return <WorkspaceLoading/>;
  const due = (session?.remainingIds ?? []).map(id => puzzles.find(p => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const reviews = puzzles.reduce((total, puzzle) => total + (puzzle.reviews?.length ?? 0), 0);
  const solved = puzzles.reduce((total, puzzle) => total + (puzzle.reviews?.filter(r => r.solved).length ?? 0), 0);
  const firstAttempts = puzzles.flatMap(puzzle => puzzle.reviews ?? []).filter(review => review.firstAttempt);
  const independentRate = firstAttempts.length ? Math.round(100 * firstAttempts.filter(review => review.solved && !review.hintsUsed).length / firstAttempts.length) : null;
  const nextDue = puzzles.filter(p => p.due_at).map(p => p.due_at!).sort()[0];
  return <main className="axis-shell axis-training">
    <PageHeader title={t.axis.training} description={t.ui.trainingHelp} actions={<Link className="axis-button secondary" href="/games">{t.axis.backGames}</Link>}/>
    <div className="axis-training-counts"><div><strong>{due.length}</strong><span>{t.axis.queue}</span></div><div><strong>{reviews}</strong><span>{t.axis.reviewed}</span></div><div><strong>{solved}</strong><span>{t.axis.solved}</span></div><div><strong>{independentRate === null ? "—" : `${independentRate}%`}</strong><span>{locale === "fr" ? "Première tentative sans indice" : "First try, no hints"}</span></div></div>
    {due.length > 0 ? <section className="axis-training-stage"><PuzzlePlayer puzzles={due} onAdvance={advanceSession} progress={session?.active} onProgress={updateAttempt}/></section> : <EmptyState title={puzzles.length ? t.ui.trainingClearTitle : t.ui.reviewFirst} description={puzzles.length ? t.ui.trainingClear : t.ui.trainingEmpty}><Link href="/games" className="axis-button">{t.ui.reviewGame}</Link></EmptyState>}
    {puzzles.length > 0 && <section className="axis-history"><h2>{t.axis.history}</h2><div className="axis-review-dots mt-5" aria-label={t.ui.recentReviews}>{puzzles.flatMap(p => p.reviews ?? []).sort((a,b) => a.at.localeCompare(b.at)).slice(-10).map((review,index) => <span key={`${review.at}:${index}`} className={review.solved ? "solved" : "failed"} title={`${new Date(review.at).toLocaleDateString(locale)} · ${review.solved ? t.axis.solved : t.puzzles.wrong}`} aria-label={review.solved ? t.axis.solved : t.puzzles.wrong}>{review.solved ? <Check size={12}/> : <X size={12}/>}</span>)}</div><p className="axis-muted">{puzzles.length} {t.nav.puzzles} · {reviews} {t.axis.reviewed}{nextDue && ` · ${t.axis.nextDue}: ${new Date(nextDue).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB")}`}</p><div className="axis-history-list">{puzzles.slice(0, 20).map(p => <div key={p.id}><span>{t.motifs[p.theme].split(" (")[0]}</span><span>{p.reviews?.length ?? 0} {t.axis.reviewed}</span><span>{p.due_at ? new Date(p.due_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB") : t.axis.queue}</span></div>)}</div></section>}
  </main>;
}
