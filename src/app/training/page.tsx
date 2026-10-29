"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ContextPanel from "@/components/ContextPanel";
import WorkspaceLoading from "@/components/WorkspaceLoading";
import { PageHeader } from "@/components/Workspace";
import PuzzlePlayer from "@/components/PuzzlePlayer";
import { useI18n } from "@/lib/i18n";
import { useStore, useStoreHydrated } from "@/lib/store";
import { duePuzzles } from "@/lib/training";
import { buildCurriculum } from "@/lib/curriculum";
import { academyForSkill } from "@/lib/academy";
import { PATTERNS } from "@/lib/pattern-catalog";
import { useCuratedPuzzles } from "@/lib/use-curated-puzzles";
import { explainCuratedPuzzle } from "@/lib/puzzle-explanation";

const CURATED_IDS = new Set(PATTERNS.flatMap(pattern => pattern.ids.map(id => `lichess:${id}`)));
export default function TrainingPage() {
  const {locale}=useI18n();const fr=locale==='fr';
  const [planOpen,setPlanOpen]=useState(false);const [historyOpen,setHistoryOpen]=useState(false);
  const hydrated=useStoreHydrated();const allPuzzles=useStore(s=>s.puzzles);
  const games=useStore(s=>s.games);const analyses=useStore(s=>s.analyses);
  const session=useStore(s=>s.trainingSession);const start=useStore(s=>s.startTrainingSession);
  const advance=useStore(s=>s.advanceTrainingSession);const update=useStore(s=>s.updateTrainingAttempt);
  const curated=useCuratedPuzzles(PATTERNS);
  const puzzles=useMemo(()=>allPuzzles.filter(puzzle=>puzzle.source==='lichess'&&CURATED_IDS.has(puzzle.id)),[allPuzzles]);
  const plan=useMemo(()=>buildCurriculum(games,analyses,[]),[games,analyses]);
  const recommendations=plan.items.filter(item=>item.evidence.length);
  const validSession=session&&session.remainingIds.every(id=>CURATED_IDS.has(id))?session:null;
  const due=(validSession?.remainingIds??[]).map(id=>puzzles.find(p=>p.id===id)).filter(p=>p!==undefined);
  const current=due[0];
  const ready=duePuzzles(puzzles).sort((a,b)=>(a.solution_lines_uci?.[0]?.length??0)-(b.solution_lines_uci?.[0]?.length??0)||(a.rating??0)-(b.rating??0));
  if(!hydrated)return <WorkspaceLoading/>;
  return <main className="axis-shell axis-training">
    <PageHeader title={fr?'Pratique vérifiée':'Verified practice'} description={fr?'Problèmes de mat Lichess, disponibles sans parties personnelles.':'Lichess mating exercises, available without a personal game history.'} actions={<><Link className="axis-button secondary" href="/academy">Chess Academy</Link><button className="axis-button secondary" onClick={()=>setPlanOpen(true)}>{fr?'Entraînement personnalisé':'Personalized training'}</button><button className="axis-button secondary" onClick={()=>setHistoryOpen(true)}>{fr?'Historique':'History'}</button></>}/>
    <ContextPanel title={fr?'Entraînement personnalisé':'Personalized training'} open={planOpen} onClose={()=>setPlanOpen(false)} drawer>
      <p>{fr?'Les recommandations relient les décisions vérifiées de vos revues aux leçons existantes. Les lignes moteur de vos parties restent des exemples de revue, pas des problèmes validés.':'Recommendations connect verified decisions in your reviews to existing lessons. Engine lines from your games remain review examples, not validated puzzles.'}</p>
      <p className="axis-muted">{plan.analyzedGames} {fr?'parties vérifiées':'verified games'} · {plan.verifiedDecisions} {fr?'décisions évaluées':'rated decisions'}</p>
      {recommendations.length?recommendations.map(item=><section key={item.skill.id} className="axis-recommendation"><h2>{fr?item.skill.fr:item.skill.title}</h2><p>{item.mistakes} {fr?'observations dans':'observations across'} {item.games} {fr?'parties':'games'} · {item.status==='recurring'?(fr?'récurrent':'recurring'):(fr?'échantillon limité':'limited sample')}</p><p>{fr?item.skill.objectiveFr:item.skill.objective}</p><ul>{academyForSkill(item.skill.id).map(lesson=><li key={lesson.id}><Link className="axis-link" href={`/academy/${lesson.id}`}>{lesson.title}</Link></li>)}</ul><details><summary>{fr?'Voir les preuves':'See the evidence'}</summary>{item.evidence.slice(0,5).map(evidence=><p key={`${evidence.game.id}:${evidence.issue.ply}`}><Link href={`/review/${encodeURIComponent(evidence.game.id)}`} className="axis-link">{evidence.game.opponent_name??'Game'} · {Math.ceil(evidence.issue.ply/2)}{evidence.game.user_color==='w'?'.':'…'}{evidence.issue.san}</Link> · {evidence.issue.severity}</p>)}</details></section>):<p>{fr?'Aucune faiblesse établie. Étudiez à l’Academy ou analysez une partie pour obtenir des observations personnelles.':'No weakness has been established. Study in the Academy, or review a game to obtain personal observations.'}</p>}
      <Link href="/games" className="axis-button secondary">{fr?'Ouvrir mes parties':'Open my games'}</Link>
    </ContextPanel>
    <ContextPanel title={fr?'Historique des exercices vérifiés':'Verified exercise history'} open={historyOpen} onClose={()=>setHistoryOpen(false)} drawer><p>{fr?'Cet historique concerne les problèmes de la bibliothèque vérifiée. Les anciennes tentatives issues de parties restent conservées dans les données de revue.':'This history covers the verified exercise library. Earlier personal-game attempts remain saved with review data.'}</p>{puzzles.filter(p=>p.reviews?.length).map(p=><p key={p.id}><a className="axis-link" href={p.source_url??'#'}>{p.id}</a> · {p.reviews?.length} {fr?'tentatives':'attempts'} · {p.due_at?new Date(p.due_at).toLocaleDateString(locale):'—'}</p>)}</ContextPanel>
    {curated.error&&<p role="alert">{curated.error} <button className="axis-button secondary" onClick={curated.retry}>{fr?'Réessayer':'Retry'}</button></p>}
    {curated.loading?<p role="status">{fr?'Vérification de la bibliothèque…':'Checking the exercise library…'}</p>:current?<section className="axis-training-stage"><PuzzlePlayer puzzles={due} requireAttempt hideTheme blind postSolveText={explainCuratedPuzzle(current,locale)} onAdvance={advance} progress={validSession?.active} onProgress={update}/></section>:<section className="axis-practice-start"><h2>{fr?'Reconnaître, puis calculer.':'Recognize, then calculate.'}</h2><p>{fr?'Les positions proviennent de vraies parties. Chaque solution publiée est rejouée légalement jusqu’au mat. Commencez par une session de huit exercices, avec indices progressifs et orientation explicite.':'Positions come from real games. Each published solution is legally replayed through checkmate. Begin an eight-exercise session with progressive hints and an explicit side to move.'}</p><button className="axis-button" disabled={!ready.length} onClick={()=>start(ready.slice(0,8).map(p=>p.id))}>{fr?'Commencer la pratique vérifiée':'Start verified practice'}</button>{!ready.length&&<p>{fr?'Les révisions sont à jour. Choisissez une voie pour travailler en avance.':'Your reviews are up to date. Choose a pattern path to practice ahead.'}</p>}<Link href="/patterns" className="axis-link">{fr?'Choisir un motif':'Choose a pattern path'}</Link></section>}
  </main>;
}
