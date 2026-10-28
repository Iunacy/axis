"use client";

import { use, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import { ArrowLeft, FlipVertical2, Compass, Settings2, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import Board from "@/components/Board";
import BoardFocusMode from "@/components/BoardFocusMode";
import PositionExplorer from "@/components/PositionExplorer";
import MoveBadge from "@/components/MoveBadge";
import AnalysisRunner from "@/components/AnalysisRunner";
import WorkspaceLoading from "@/components/WorkspaceLoading";
import ReviewNavigation, { type NavigationDirection } from "@/components/review/ReviewNavigation";
import MoveTimeline from "@/components/review/MoveTimeline";
import ReviewVariations from "@/components/review/ReviewVariations";
import ReviewCoach from "@/components/review/ReviewCoach";
import ReviewSummary from "@/components/review/ReviewSummary";
import EvaluationGraph from "@/components/review/EvaluationGraph";
import { parsePgn, type ParsedGame } from "@/lib/pgn";
import { createReviewPosition, restoreReviewBranches, serializeReviewBranches, reviewPositionReducer, reviewShortcut, reviewView } from "@/lib/review-position";
import { reviewAttemptEvidence, reviewExercise } from "@/lib/review-training";
import { useI18n } from "@/lib/i18n";
import { useAnalyses, useGames, useSettings, useStore, useStoreHydrated } from "@/lib/store";
import { CLASSIFICATION_META } from "@/lib/classification-meta";
import { winProb } from "@/lib/analysis";
import { evaluationLabel, validCachedEvaluation } from "@/lib/engine-protocol";
import type { AnalysisSummary, GameRow, MoveIssue, PositionEvaluation } from "@/lib/types";

const NO_ASSESSMENTS: NonNullable<AnalysisSummary["moveAssessments"]> = [];

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const hydrated = useStoreHydrated();
  const game = useGames().find(game => game.id === decodeURIComponent(id));
  const analysis = useAnalyses()[decodeURIComponent(id)];
  const pgn = game?.pgn;
  const parsed = useMemo(() => pgn ? parsePgn(pgn) : null, [pgn]);
  if (!hydrated) return <WorkspaceLoading/>;
  if (!game || !parsed) return <main className="axis-shell"><section className="axis-panel axis-empty"><h1>{t.axis.noGame}</h1><p>{t.ui.noGameHelp}</p><Link href="/games" className="axis-button">{t.axis.backGames}</Link></section></main>;
  return <ReviewWorkspace key={`${game.id}:${game.pgn}`} game={game} parsed={parsed} analysis={analysis}/>;
}

function ReviewWorkspace({ game, parsed, analysis }: { game: GameRow; parsed: ParsedGame; analysis?: AnalysisSummary }) {
  const { t, locale } = useI18n();
  const settings = useSettings();
  const setSettings = useStore(state => state.setSettings);
  const saveReviewLocation = useStore(state => state.saveReviewLocation);
  const lessons = useStore(state => state.lessons);
  const [position, dispatch] = useReducer(reviewPositionReducer, null, () => {
    const saved = useStore.getState().reviewLocations[game.id];
    return restoreReviewBranches(createReviewPosition(parsed, saved?.ply ?? 0), saved?.variations);
  });
  const view = useMemo(() => reviewView(position), [position]);
  const savedBranches = useMemo(() => serializeReviewBranches({ nodes: position.nodes }), [position.nodes]);
  const [tab, setTab] = useState<"moments" | "moves" | "explore">("moves");
  const [flipped, setFlipped] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [explorer, setExplorer] = useState(false);
  const [showBest, setShowBest] = useState(false);
  const [results, setResults] = useState<Record<string, PositionEvaluation>>({});
  const boardRef = useRef<HTMLElement>(null);
  const practice = position.practice;
  const issue = practice?.issue;
  const isExercise = Boolean(practice && ["ready", "wrong"].includes(practice.status));
  const savedEval = !practice && view.node.gamePly !== null ? analysis?.positionEvals?.[view.node.gamePly] : undefined;
  const knownEval = results[view.identity] ?? (savedEval && validCachedEvaluation(savedEval, view.fen) ? savedEval : undefined);
  const currentEval = isExercise ? undefined : knownEval?.cpWhite ?? (!practice && view.node.gamePly !== null ? analysis?.evaluations?.[view.node.gamePly] : undefined);
  const evalText = isExercise ? "—" : knownEval ? evaluationLabel(knownEval) : currentEval == null ? "—" : Math.abs(currentEval) >= 9000 ? `M${Math.max(1, 10000 - Math.abs(currentEval))}` : `${currentEval >= 0 ? "+" : ""}${(currentEval / 100).toFixed(2)}`;
  const orientation = flipped ? game.user_color === "w" ? "b" : "w" : game.user_color;
  const bestArrow = !isExercise && (knownEval?.bestUci ?? (practice?.status === "revealed" ? issue?.bestUci : null));
  const grade = !practice && view.node.gamePly !== null ? analysis?.moveAssessments?.find(move => move.ply === view.node.gamePly)?.classification : null;
  const lesson = issue ? lessons.find(lesson => lesson.theme === issue.motif || lesson.examples.some(example => example.fen === issue.fenBefore)) : undefined;

  useEffect(() => { saveReviewLocation(game.id, view.gamePly, savedBranches); }, [game.id, view.gamePly, savedBranches, saveReviewLocation]);
  useEffect(() => {
    if (!issue) return;
    const container = boardRef.current?.parentElement?.querySelector<HTMLElement>(".axis-review-scroll");
    const coach = container?.querySelector<HTMLElement>(".axis-issue-detail");
    if (container && coach) container.scrollTop += coach.getBoundingClientRect().top - container.getBoundingClientRect().top;
  }, [issue]);

  const goTo = useCallback((ply: number) => { setPlaying(false); dispatch({ type: "game", ply }); }, []);
  const navigate = useCallback((direction: NavigationDirection) => { setPlaying(false); dispatch({ type: "navigate", direction }); }, []);
  const togglePlay = useCallback(() => {
    if (view.index === view.line.length - 1) dispatch({ type: "navigate", direction: "first" });
    setPlaying(value => !value);
  }, [view.index, view.line.length]);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (view.index === view.line.length - 1) setPlaying(false);
      else dispatch({ type: "navigate", direction: "next" });
    }, settings.reviewPlaybackMs ?? 1200);
    return () => clearTimeout(timer);
  }, [playing, view.index, view.line.length, settings.reviewPlaybackMs]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const action = reviewShortcut(event.key, {
        prevented: event.defaultPrevented, modified: event.altKey || event.ctrlKey || event.metaKey || event.shiftKey,
        editable: Boolean(target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="tablist"], [role="slider"]')),
        dialog: Boolean(document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]:not(.axis-board-focus)')),
        board: Boolean(target?.closest('.axis-board-frame')), button: Boolean(target?.closest('button, a[href], summary')),
      });
      if (!action) return;
      if (action === "return") {
        if (position.tip === position.mainline.at(-1) && !practice) return;
        goTo(view.gamePly);
      } else if (action === "play") togglePlay();
      else navigate(action);
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, togglePlay, goTo, view.gamePly, position.tip, position.mainline, practice]);

  function startPractice(next: MoveIssue, now: number) {
    const exercise = reviewExercise(game, next);
    if (!exercise || parsed.fens[next.ply - 1] !== next.fenBefore) return;
    useStore.getState().upsertPuzzles([exercise]);
    dispatch({ type: "practice", issue: next, now });
    setPlaying(false); setExplorer(false); setTab("moments");
    if (window.matchMedia("(max-width: 760px)").matches) boardRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }

  function recordAttempt(solved: boolean) {
    if (!practice || !issue || !["ready", "wrong"].includes(practice.status)) return;
    const exercise = reviewExercise(game, issue);
    if (!exercise) return;
    const store = useStore.getState();
    store.upsertPuzzles([exercise]);
    const attempts = useStore.getState().puzzles.find(puzzle => puzzle.id === exercise.id)?.attempts ?? 0;
    store.recordReview(exercise.id, solved, reviewAttemptEvidence(practice, attempts, solved, Date.now()));
  }

  function openLine(moves: string[]) {
    dispatch({ type: "line", moves, advance: "first" }); setPlaying(false); setExplorer(true); setTab("explore");
  }
  function enableExplorer() {
    if (practice?.status === "correct" && issue?.bestUci) dispatch({ type: "line", moves: [issue.bestUci] });
    else if (practice) dispatch({ type: "game", ply: view.gamePly });
    setPlaying(false); setExplorer(true); setTab("explore");
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast.success(locale === "fr" ? "Copié" : "Copied"); }
    catch { toast.error(locale === "fr" ? "Copie indisponible." : "Clipboard access is unavailable."); }
  }
  function exportPgn() {
    const url = URL.createObjectURL(new Blob([game.pgn], { type: "application/x-chess-pgn;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "axis-game.pgn"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function player(color: "w" | "b") {
    const user = color === game.user_color;
    const name = parsed.headers[color === "w" ? "White" : "Black"] || (user ? settings.chesscomUsername || settings.lichessUsername || t.ui.yourGame : game.opponent_name ?? "—");
    return <div className="axis-board-player"><span className={`axis-piece-dot ${color === "w" ? "white" : "black"}`}/><strong>{name}</strong><span>{(user ? game.user_rating : game.opponent_rating) ?? (color === "w" ? t.axis.white : t.axis.black)}</span></div>;
  }

  return <main className="axis-shell axis-review axis-workspace">
    <header className="axis-workspace-heading"><Link href="/games" title={t.axis.backGames} aria-label={t.axis.backGames}><ArrowLeft size={18}/></Link><div><h1>{game.opponent_name ?? t.axis.review}</h1><p>{new Date(game.played_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB")} · {analysis?.opening?.name ?? game.opening_name ?? game.eco ?? game.time_class} · {t.games.results[game.result]}</p></div><span className="axis-tag">{game.platform === "pgn" ? "PGN" : game.platform === "chesscom" ? "Chess.com" : "Lichess"}</span></header>
    <div className="axis-workspace-grid">
      <section ref={boardRef} className="axis-board-column" aria-label={locale === "fr" ? "Échiquier et navigation" : "Board and navigation"}>
        <BoardFocusMode>
          {player(orientation === "w" ? "b" : "w")}
          <Board fen={view.fen} orientation={orientation} size="lg" showOverlayControls={false} annotationEnabled coordinates={settings.showCoordinates !== false}
            moveBadge={grade && view.lastUci ? { square: view.lastUci.slice(2, 4), classification: grade } : undefined}
            evaluation={settings.showEvaluationBar !== false ? { whiteShare: currentEval == null ? null : winProb(currentEval), label: `${t.axis.evaluation}: ${evalText}` } : undefined}
            suggestedMove={showBest && bestArrow ? { from: bestArrow.slice(0, 2), to: bestArrow.slice(2, 4) } : null}
            lastMove={view.lastUci ? { from: view.lastUci.slice(0, 2), to: view.lastUci.slice(2, 4) } : null}
            interactive={explorer || isExercise}
            onTryMove={san => {
              if (explorer) {
                const move = new Chess(view.fen).move(san);
                dispatch({ type: "line", moves: [`${move.from}${move.to}${move.promotion ?? ""}`] }); setPlaying(false); return true;
              }
              if (!practice) return false;
              const next = reviewPositionReducer(position, { type: "attempt", san });
              if (next.practice?.status === "correct") recordAttempt(true);
              dispatch({ type: "attempt", san });
              return next.practice?.status === "correct";
            }}/>
          {player(orientation)}
          <ReviewNavigation index={view.index} length={view.line.length - 1} playing={playing} onNavigate={navigate} onPlay={togglePlay}/>
          <div className="axis-workspace-tools">
            <button type="button" title={locale === "fr" ? "Retourner l’échiquier" : "Flip board"} aria-label={locale === "fr" ? "Retourner l’échiquier" : "Flip board"} onClick={() => setFlipped(value => !value)}><FlipVertical2 size={17}/></button>
            <button type="button" aria-pressed={explorer} title={locale === "fr" ? "Explorer la position" : "Explore position"} onClick={() => { if (explorer) setExplorer(false); else enableExplorer(); }}><Compass size={17}/>{locale === "fr" ? "Explorer" : "Explore"}</button>
            {(view.isVariation || practice) && <button type="button" className="axis-return-game" onClick={() => goTo(view.gamePly)}>{locale === "fr" ? "Partie" : "Main game"}</button>}
            <output aria-label={t.axis.evaluation}>{isExercise ? locale === "fr" ? "À vous" : "Your move" : evalText}{view.isVariation && <span> · {locale === "fr" ? "variante" : "variation"}</span>}</output>
            <details className="axis-board-settings"><summary title={locale === "fr" ? "Options de l’échiquier" : "Board options"} aria-label={locale === "fr" ? "Options de l’échiquier" : "Board options"}><Settings2 size={17}/></summary><div>
              <label>{locale === "fr" ? "Vitesse" : "Speed"}<select aria-label={locale === "fr" ? "Vitesse de lecture" : "Playback speed"} value={settings.reviewPlaybackMs ?? 1200} onChange={event => setSettings({ ...settings, reviewPlaybackMs: Number(event.target.value) })}><option value={2400}>0.5×</option><option value={1200}>1×</option><option value={600}>2×</option></select></label>
              <label><input type="checkbox" checked={settings.showCoordinates !== false} onChange={event => setSettings({ ...settings, showCoordinates: event.target.checked })}/>{locale === "fr" ? "Coordonnées" : "Coordinates"}</label>
              <label><input type="checkbox" checked={settings.showEvaluationBar !== false} onChange={event => setSettings({ ...settings, showEvaluationBar: event.target.checked })}/>{locale === "fr" ? "Évaluation" : "Evaluation bar"}</label>
              <label><input type="checkbox" checked={showBest} disabled={!bestArrow} onChange={event => setShowBest(event.target.checked)}/>{locale === "fr" ? "Flèche moteur" : "Engine arrow"}</label>
              <button type="button" onClick={() => void copy(view.fen)}><Copy size={14}/>FEN</button><button type="button" onClick={() => void copy(game.pgn)}><Copy size={14}/>PGN</button><button type="button" onClick={exportPgn}><Download size={14}/>PGN</button>
            </div></details>
          </div>
        </BoardFocusMode>
        {analysis?.evaluations?.length ? <EvaluationGraph evaluations={analysis.evaluations} assessments={analysis.moveAssessments ?? NO_ASSESSMENTS} locale={locale} ply={view.gamePly} onSelect={goTo} label={t.axis.evaluation}/> : <p className="axis-workspace-hint">← → · Home / End · Space</p>}
      </section>
      <section className="axis-review-panel" aria-label={locale === "fr" ? "Analyse de la partie" : "Game analysis"}>
        <div className="axis-analysis-tabs" role="tablist" aria-label={t.axis.review} onKeyDown={event => {
          const tabs = ["moves", "moments", "explore"] as const;
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault(); const index = tabs.indexOf(tab);
          const next = tabs[event.key === "Home" ? 0 : event.key === "End" ? 2 : (index + (event.key === "ArrowLeft" ? 2 : 1)) % 3];
          setTab(next); document.getElementById(`${next}-tab`)?.focus();
        }}>
          {([{ id: "moves", name: t.ui.moves, count: parsed.moves.length }, { id: "moments", name: t.axis.issues, count: analysis?.issues.length ?? 0 }, { id: "explore", name: locale === "fr" ? "Analyse" : "Explore" }] as const).map(item => <button key={item.id} role="tab" id={`${item.id}-tab`} tabIndex={tab === item.id ? 0 : -1} aria-controls={`${item.id}-panel`} aria-selected={tab === item.id} onClick={() => setTab(item.id)}>{item.name}{"count" in item && <span>{item.count}</span>}</button>)}
        </div>
        <AnalysisRunner key={game.id} pendingCount={game.analysis_status === "done" ? 0 : 1} gameId={game.id}/>
        <div className="axis-review-scroll">
          {analysis?.complete === false && <p className="axis-partial-review" role="status">{locale === "fr" ? "Revue partielle" : "Provisional review"} · {(analysis.evaluations?.length ?? 1) - 1} / {parsed.moves.length}</p>}
          <div id="moves-panel" role="tabpanel" aria-labelledby="moves-tab" hidden={tab !== "moves"} className="axis-analysis-tab-content axis-timeline-panel">
            <MoveTimeline game={parsed} assessments={analysis?.moveAssessments ?? NO_ASSESSMENTS} ply={practice || view.isVariation ? null : view.node.gamePly} onSelect={goTo} visible={tab === "moves"}/>
          </div>
          <div id="moments-panel" role="tabpanel" aria-labelledby="moments-tab" hidden={tab !== "moments"} className="axis-analysis-tab-content">
            {analysis && <ReviewSummary analysis={analysis} game={game} onPractice={issue => startPractice(issue, Date.now())}/>}
            {!analysis && <p className="axis-muted">{locale === "fr" ? "Les décisions importantes apparaîtront ici après l’analyse." : "Critical decisions will appear here as analysis progresses."}</p>}
            {practice && issue && <ReviewCoach issue={issue} practice={practice} lessonSlug={lesson?.slug} onReveal={() => { recordAttempt(false); dispatch({ type: "reveal" }); }} onRetry={() => dispatch({ type: "retry", now: Date.now() })} onLine={() => {
              try {
                const chess = new Chess(issue.fenBefore);
                const moves = (issue.continuation ?? []).map(san => { const move = chess.move(san); return `${move.from}${move.to}${move.promotion ?? ""}`; });
                openLine(moves);
              } catch { toast.error(locale === "fr" ? "Cette ligne ne correspond pas à la position." : "This line does not match the position."); }
            }} onReturn={() => goTo(issue.ply)}/>}
            <h2>{t.axis.issues} <span className="axis-muted">{analysis?.issues.length ?? 0}</span></h2>
            {analysis && analysis.issues.length === 0 && <p className="axis-muted">{t.axis.noIssues}</p>}
            <div className="axis-issue-list">{analysis?.issues.map(item => <button type="button" key={item.ply} disabled={!item.bestUci} onClick={() => startPractice(item, Date.now())} className={item.ply === issue?.ply ? "active" : ""}><span><MoveBadge classification={item.classification ?? item.severity}/>{Number(item.fenBefore.split(" ")[5])}{item.fenBefore.split(" ")[1] === "w" ? "." : "..."} {item.san}</span><span>{CLASSIFICATION_META[item.classification ?? item.severity].name[locale]} · {t.motifs[item.motif].split(" (")[0]}</span><span>{locale === "fr" ? "Travailler cette faiblesse" : "Practice this weakness"}</span></button>)}</div>
          </div>
          <div id="explore-panel" role="tabpanel" aria-labelledby="explore-tab" hidden={tab !== "explore"} className="axis-analysis-tab-content">
            {!explorer && <div className="axis-explore-intro"><h2>{locale === "fr" ? "Et si vous aviez joué…" : "What if you had played…"}</h2><p>{locale === "fr" ? "Jouez des alternatives sur l’échiquier. Vos variantes restent disponibles lorsque vous revenez à la partie." : "Try alternatives on the board. Your branches stay available when you return to the game."}</p><button type="button" className="axis-button" onClick={enableExplorer}>{locale === "fr" ? "Explorer la position" : "Explore position"}</button></div>}
            {explorer && <PositionExplorer fen={view.fen} history={view.history} initial={knownEval} onEvaluation={result => setResults(current => ({ ...current, [view.identity]: result }))} onOpenLine={openLine}/>}
            <ReviewVariations state={position} dispatch={action => { setPlaying(false); dispatch(action); }}/>
            {view.isVariation && <div className="axis-line-comparison"><h2>{locale === "fr" ? "Dans la partie" : "In the game"}</h2><p>{parsed.moves.slice(view.gamePly, view.gamePly + 8).map(move => move.san).join(" ") || (locale === "fr" ? "Fin de la partie" : "End of game")}</p><button type="button" className="axis-link" onClick={() => goTo(view.gamePly)}>{locale === "fr" ? "Comparer sur l’échiquier" : "Compare on the board"}</button></div>}
          </div>
        </div>
      </section>
    </div>
  </main>;
}
