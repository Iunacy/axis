"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { LessonContentView } from "@/components/LessonView";
import CurriculumPlan from "@/components/CurriculumPlan";
import { buildCurriculum, curriculumHistory, curriculumQueue, curriculumLesson, type SkillId } from "@/lib/curriculum";
import { buildFacts } from "@/lib/dossier";
import { preparePuzzle } from "@/lib/puzzle-solution";
import { useCuratedPuzzles } from "@/lib/use-curated-puzzles";
import { PATTERNS } from "@/lib/pattern-catalog";
import ContextPanel from "@/components/ContextPanel";
import WorkspaceLoading from "@/components/WorkspaceLoading";
import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/Workspace";
import PuzzlePlayer from "@/components/PuzzlePlayer";
import { useI18n } from "@/lib/i18n";
import { useStore, useStoreHydrated } from "@/lib/store";
import { duePuzzles } from "@/lib/training";

const NO_PATTERNS: typeof PATTERNS = [];

export default function TrainingPage() {
  const { t, locale } = useI18n();
  const [reading, setReading] = useState<SkillId | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [related, setRelated] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const hydrated = useStoreHydrated();
  const allPuzzles = useStore(s => s.puzzles);
  const games = useStore(s => s.games);
  const analyses = useStore(s => s.analyses);
  const preference = useStore(s => s.curriculumPreference);
  const setPreference = useStore(s => s.setCurriculumPreference);
  const prepareSession = useStore(s => s.prepareCurriculumSession);
  const history = useMemo(() => curriculumHistory(games, analyses), [games, analyses]);
  const plan = useMemo(() => buildCurriculum(games, analyses, allPuzzles, new Date(), history), [games, analyses, allPuzzles, history]);
  const lessonItem = plan.items.find(item => item.skill.id === reading);
  const study = lessonItem ? curriculumLesson(lessonItem, locale) : null;
  const target = plan.items.find(item => item.skill.id === (preference ?? plan.nextSkillId));
  const planned = useMemo(() => target ? curriculumQueue(target) : [], [target]);
  const curated = useCuratedPuzzles(related ? PATTERNS : NO_PATTERNS);
  const puzzles = useMemo(() => allPuzzles.filter(puzzle => puzzle.source !== "lichess"), [allPuzzles]);
  const session = useStore(s => s.trainingSession);
  const startSession = useStore(s => s.startTrainingSession);
  const advanceSession = useStore(s => s.advanceTrainingSession);
  const updateAttempt = useStore(s => s.updateTrainingAttempt);
  const dueIds = useMemo(() => duePuzzles(puzzles).map(p => p.id), [puzzles]);
  useEffect(() => {
    if (!hydrated || session) return;
    if (planned.length && target) prepareSession(planned, target.skill.id, target.reassessment ? target.reassessmentEpoch : undefined);
    else if (!preference && !target && dueIds.length) startSession(dueIds);
  }, [hydrated, session, dueIds, startSession, planned, target, prepareSession, preference]);
  if (!hydrated) return <WorkspaceLoading/>;

  const due = (session?.remainingIds ?? []).map(id => allPuzzles.find(p => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const activeItem = plan.items.find(item => item.skill.id === session?.skillId) ?? (session ? plan.items.find(item => item.exercises.some(exercise => exercise.id === session.remainingIds[0])) : target);
  const activePuzzle = due[0];
  const facts = activePuzzle ? buildFacts(activePuzzle.fen, activePuzzle.played_san ?? null, preparePuzzle(activePuzzle)?.lines[0]?.san[0] ?? null) : null;
  const explanation = facts?.bestMove ? `${locale === "fr" ? "Coup candidat enregistré" : "Recorded candidate"}: ${facts.bestMove}. ${locale === "fr" ? "Une correction concrète de cette position ; pas une preuve de solution unique." : "A concrete correction for this position; not proof of a unique solution."}` : undefined;
  function choose(skill: SkillId) { setPreference(skill); setPlanOpen(false); }
  const reviews = puzzles.reduce((total, puzzle) => total + (puzzle.reviews?.length ?? 0), 0);
  const solved = puzzles.reduce((total, puzzle) => total + (puzzle.reviews?.filter(r => r.solved).length ?? 0), 0);
  const firstAttempts = puzzles.flatMap(puzzle => puzzle.reviews ?? []).filter(review => review.firstAttempt && typeof review.hintsUsed === "number" && typeof review.wrongMoves === "number" && typeof review.solutionRevealed === "boolean");
  const independentRate = firstAttempts.length ? Math.round(100 * firstAttempts.filter(review => review.solved && review.hintsUsed === 0 && review.wrongMoves === 0 && review.solutionRevealed === false).length / firstAttempts.length) : null;
  const nextDue = puzzles.filter(p => p.due_at).map(p => p.due_at!).sort()[0];
  return <main className="axis-shell axis-training">
    <PageHeader title={t.axis.training} description={t.ui.trainingHelp} actions={<><button className="axis-button secondary" onClick={() => setPlanOpen(true)}>{locale === "fr" ? "Mon parcours" : "Your learning plan"}</button><button className="axis-button secondary" disabled={!puzzles.length} onClick={() => setHistoryOpen(true)}>{t.axis.history}</button></>}/>

    {preference && session && session.skillId !== preference && <p className="axis-muted" role="status">{locale === "fr" ? "Prochaine session" : "Next session"}: {locale === "fr" ? target?.skill.fr : target?.skill.title}</p>}
    <ContextPanel title={locale === "fr" ? "Mon parcours" : "Your learning plan"} open={planOpen} onClose={() => setPlanOpen(false)} drawer><CurriculumPlan plan={plan} preference={preference} activeSession={Boolean(session)} onChoose={choose} onRead={skill => { setPlanOpen(false); setReading(skill); }}/><button className="axis-link" onClick={() => setRelated(true)} disabled={related && !curated.error}>{locale === "fr" ? "Charger des exemples de mat complémentaires" : "Load related mating examples"}</button>{related && curated.loading && <p role="status">{locale === "fr" ? "Chargement des exemples vérifiés…" : "Loading verified examples…"}</p>}{curated.error && <p role="alert">{curated.error} <button onClick={curated.retry}>{locale === "fr" ? "Réessayer" : "Retry"}</button></p>}</ContextPanel>
    <ContextPanel title={locale === "fr" ? "Leçon ciblée" : "Focused lesson"} open={Boolean(study)} onClose={() => { if (reading) { setReading(null); requestAnimationFrame(() => setPlanOpen(true)); } }}>{study && <LessonContentView key={`${reading}:${locale}`} title={study.title} content={study} initialCompleted={false}/>}</ContextPanel>

    {due.length > 0 ? <section className="axis-training-stage"><PuzzlePlayer context={activeItem && <section className="axis-curriculum-focus"><div><h2>{locale === "fr" ? activeItem.skill.fr : activeItem.skill.title}</h2><p>{locale === "fr" ? activeItem.skill.objectiveFr : activeItem.skill.objective}</p></div><details><summary>{locale === "fr" ? "Le concept" : "The concept"}</summary><p>{locale === "fr" ? activeItem.skill.conceptFr : activeItem.skill.concept}</p></details></section>} puzzles={due} requireAttempt hideTheme blind postSolveText={explanation} onAdvance={advanceSession} progress={session?.active} onProgress={updateAttempt}/></section> : <EmptyState title={preference && !target?.exercises.length ? locale === "fr" ? "Davantage de données nécessaires" : "More evidence needed" : puzzles.length ? t.ui.trainingClearTitle : t.ui.reviewFirst} description={preference && !target?.exercises.length ? locale === "fr" ? "Analysez d’autres parties ou choisissez une autre compétence dans votre parcours." : "Review more games or choose another skill in your learning plan." : puzzles.length ? t.ui.trainingClear : t.ui.trainingEmpty}><Link href="/games" className="axis-button">{t.ui.reviewGame}</Link></EmptyState>}
    {puzzles.length > 0 && <><ContextPanel title={t.axis.history} open={historyOpen} onClose={() => setHistoryOpen(false)} drawer><section className="axis-history"><div className="axis-training-counts"><div><strong>{due.length}</strong><span>{t.axis.queue}</span></div><div><strong>{reviews}</strong><span>{t.axis.reviewed}</span></div><div><strong>{solved}</strong><span>{t.axis.solved}</span></div><div><strong>{independentRate === null ? "—" : `${independentRate}%`}</strong><span>{locale === "fr" ? "Première tentative sans indice" : "First try, no hints"}</span></div></div><h2>{t.axis.history}</h2><div className="axis-review-dots mt-5" aria-label={t.ui.recentReviews}>{puzzles.flatMap(p => p.reviews ?? []).sort((a,b) => a.at.localeCompare(b.at)).slice(-10).map((review,index) => <span key={`${review.at}:${index}`} className={review.solved ? "solved" : "failed"} title={`${new Date(review.at).toLocaleDateString(locale)} · ${review.solved ? t.axis.solved : t.puzzles.wrong}`} aria-label={review.solved ? t.axis.solved : t.puzzles.wrong}>{review.solved ? <Check size={12}/> : <X size={12}/>}</span>)}</div><p className="axis-muted">{puzzles.length} {t.nav.puzzles} · {reviews} {t.axis.reviewed}{nextDue && ` · ${t.axis.nextDue}: ${new Date(nextDue).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB")}`}</p><div className="axis-history-list">{puzzles.slice(0, 20).map(p => <div key={p.id}><span>{t.motifs[p.theme].split(" (")[0]}</span><span>{p.reviews?.length ?? 0} {t.axis.reviewed}</span><span>{p.due_at ? new Date(p.due_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB") : t.axis.queue}</span></div>)}</div></section></ContextPanel></>}
  </main>;
}
