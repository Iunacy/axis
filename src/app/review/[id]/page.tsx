"use client";

import { Fragment, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FlipVertical2, Play, Pause, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import Board from "@/components/Board";
import BoardFocusMode from "@/components/BoardFocusMode";
import { EmptyState } from "@/components/Workspace";
import AnalysisRunner from "@/components/AnalysisRunner";
import WorkspaceLoading from "@/components/WorkspaceLoading";
import { parsePgn } from "@/lib/pgn";
import { useI18n } from "@/lib/i18n";
import { useAnalyses, useGames, useSettings, useStore, useStoreHydrated } from "@/lib/store";
import { matchesUciMove } from "@/lib/board-interaction";
import { winProb } from "@/lib/analysis";
import type { MoveIssue } from "@/lib/types";

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, locale } = useI18n();
  const hydrated = useStoreHydrated();
  const settings = useSettings();
  const setSettings = useStore(state => state.setSettings);
  const game = useGames().find(g => g.id === decodeURIComponent(id));
  const analysis = useAnalyses()[decodeURIComponent(id)];
  const parsed = useMemo(() => game ? parsePgn(game.pgn) : null, [game]);
  const boardRef = useRef<HTMLElement>(null);
  const [ply, setPly] = useState(0);
  const [tab, setTab] = useState<"moments" | "moves">("moments");
  const [flipped, setFlipped] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<MoveIssue | null>(null);
  const [practiceState, setPracticeState] = useState<"idle" | "wrong" | "correct" | "revealed">("idle");
  const [variation, setVariation] = useState(0);
  const [showVariation, setShowVariation] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [explorer, setExplorer] = useState(false);
  const [manual, setManual] = useState<{ fens: string[]; moves: { san: string; uci: string }[]; index: number } | null>(null);
  const [showBest, setShowBest] = useState(false);

  const goTo = useCallback((next: number, stopPlayback = true) => {
    setPly(Math.max(0, Math.min(parsed?.moves.length ?? 0, next)));
    setSelectedIssue(null); setShowVariation(false); setPracticeState("idle"); setManual(null);
    if (stopPlayback) setPlaying(false);
  }, [parsed]);

  useEffect(() => {
    if (!playing || !parsed) return;
    const timer = setTimeout(() => { if (ply < parsed.moves.length) goTo(ply + 1, false); else setPlaying(false); }, settings.reviewPlaybackMs ?? 1200);
    return () => clearTimeout(timer);
  }, [playing, parsed, ply, settings.reviewPlaybackMs, goTo]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!parsed || (event.target instanceof Element && event.target.closest("input, textarea, select, button, [contenteditable=true]"))) return;
      if (!["ArrowLeft", "ArrowRight", "Home", "End", " "].includes(event.key)) return;
      event.preventDefault();
      if (event.key === " ") { if (!manual) setPlaying(value => !value); return; }
      if (manual) { setManual(current => current && { ...current, index: event.key === "Home" ? 0 : event.key === "End" ? current.moves.length : Math.max(0, Math.min(current.moves.length, current.index + (event.key === "ArrowLeft" ? -1 : 1))) }); return; }
      goTo(event.key === "Home" ? 0 : event.key === "End" ? parsed.moves.length : ply + (event.key === "ArrowLeft" ? -1 : 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [parsed, manual, ply, goTo]);

  if (!hydrated) return <WorkspaceLoading/>;
  if (!game || !parsed) return <main className="axis-shell"><section className="axis-panel axis-empty"><h1>{t.axis.noGame}</h1><p>{t.ui.noGameHelp}</p><Link href="/games" className="axis-button w-fit">{t.axis.backGames}</Link></section></main>;

  const moveRows: { number: number; w?: { index: number; san: string }; b?: { index: number; san: string } }[] = [];
  parsed.moves.forEach((move, index) => {
    const number = Number(parsed.fens[index].split(" ")[5]);
    let row = moveRows[moveRows.length - 1];
    if (!row || row.number !== number) { row = { number }; moveRows.push(row); }
    row[move.color] = { index, san: move.san };
  });
  const issue = selectedIssue;
  const line = issue?.continuation ?? [];
  const variationPositions: string[] = [issue?.fenBefore ?? parsed.fens[ply]];
  if (issue && showVariation) {
    const chess = new Chess(issue.fenBefore);
    for (const san of line) {
      try { chess.move(san); variationPositions.push(chess.fen()); } catch { break; }
    }
  }
  let correctedFen = issue?.fenBefore;
  if (issue && practiceState === "correct" && issue.bestSan) {
    try { const position = new Chess(issue.fenBefore); position.move(issue.bestSan); correctedFen = position.fen(); } catch {}
  }
  const displayedFen = manual ? manual.fens[manual.index] : issue && showVariation ? variationPositions[Math.min(variation, variationPositions.length - 1)] : issue && practiceState === "correct" ? correctedFen! : parsed.fens[ply];
  const last = ply > 0 && !showVariation ? parsed.moves[ply - 1] : null;
  const uci = manual ? manual.moves[manual.index - 1]?.uci : issue && practiceState === "correct" && !showVariation ? issue.bestUci : last?.uci;
  const currentEval = manual || issue && (showVariation || practiceState === "correct") ? undefined : analysis?.evaluations?.[ply];
  const boardOrientation = flipped ? game.user_color === "w" ? "b" : "w" : game.user_color;
  const bestArrow = !manual && !showVariation && issue && (practiceState === "revealed") ? issue.bestUci : null;
  const evalText = currentEval == null ? "—" : Math.abs(currentEval) >= 9000
    ? `M${Math.max(1, 10000 - Math.abs(currentEval))} ${currentEval > 0 ? "White" : "Black"}`
    : `${currentEval >= 0 ? "+" : ""}${(currentEval / 100).toFixed(2)}`;

  function selectIssue(next: MoveIssue) {
    setPlaying(false); setExplorer(false); setManual(null);
    setSelectedIssue(next);
    setPly(next.ply - 1);
    setPracticeState("idle");
    setShowVariation(false);
    setVariation(0);
    if (window.matchMedia("(max-width: 760px)").matches) boardRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast.success(locale === "fr" ? "Copié" : "Copied"); }
    catch { toast.error(locale === "fr" ? "Copie indisponible dans ce navigateur." : "Clipboard access is unavailable in this browser."); }
  }

  function exportPgn() {
    const url = URL.createObjectURL(new Blob([game!.pgn], { type: "application/x-chess-pgn;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "axis-game.pgn"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <main className="axis-shell axis-review">
    <Link href="/games" className="axis-link inline-flex items-center gap-2"><ArrowLeft size={16}/>{t.axis.backGames}</Link>
    <div className="axis-page-head"><div><h1>{game.opponent_name ?? t.axis.review}</h1><p>{new Date(game.played_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB")} · {game.opening_name ?? game.eco ?? game.time_class} · {t.games.results[game.result]}</p></div><div className="axis-actions"><button className="axis-button secondary axis-flip-button" aria-label={locale === "fr" ? "Retourner l’échiquier" : "Flip board"} onClick={() => setFlipped(value => !value)}><FlipVertical2 size={16}/><span>{locale === "fr" ? "Retourner" : "Flip board"}</span></button><span className="axis-tag">{game.platform === "pgn" ? "PGN" : game.platform === "chesscom" ? "Chess.com" : "Lichess"}</span>{analysis && analysis.issues.length > 0 && <Link href="/training" className="axis-button">{t.ui.practiceThese}</Link>}</div></div>
    <div className="axis-review-grid">
      <section ref={boardRef} className="axis-board-column">
        <BoardFocusMode>
        <div className="axis-board-player"><span className={`axis-piece-dot ${(flipped ? game.user_color : game.user_color === "w" ? "b" : "w") === "b" ? "black" : "white"}`}/><strong>{flipped ? (game.user_color === "w" ? t.axis.white : t.axis.black) : (game.user_color === "w" ? t.axis.black : t.axis.white)}</strong><span>{flipped ? settings.chesscomUsername || settings.lichessUsername || t.ui.yourGame : game.opponent_name ?? "—"}</span><span>{(flipped ? game.user_rating : game.opponent_rating) ?? ""}</span></div>
        <div className="axis-board-with-eval">
        <Board key={`${id}:${issue?.ply ?? "game"}:${practiceState === "idle"}`} fen={displayedFen} orientation={boardOrientation} size="lg" showOverlayControls={false} annotationEnabled coordinates={settings.showCoordinates !== false} evaluation={settings.showEvaluationBar !== false ? { whiteShare: currentEval == null ? null : winProb(currentEval), label: `${t.axis.evaluation}: ${evalText}` } : undefined} suggestedMove={showBest && bestArrow ? { from: bestArrow.slice(0, 2), to: bestArrow.slice(2, 4) } : null}
          lastMove={uci ? { from: uci.slice(0, 2), to: uci.slice(2, 4) } : null}
          interactive={explorer || Boolean(issue && !showVariation && (practiceState === "idle" || practiceState === "wrong"))}
          onTryMove={san => {
            if (explorer) {
              const chess = new Chess(displayedFen); const move = chess.move(san);
              const fens = manual ? manual.fens.slice(0, manual.index + 1) : [displayedFen];
              const moves = manual ? manual.moves.slice(0, manual.index) : [];
              setManual({ fens: [...fens, chess.fen()], moves: [...moves, { san: move.san, uci: `${move.from}${move.to}${move.promotion ?? ""}` }], index: moves.length + 1 });
              setPlaying(false); return true;
            }
            if (!issue) return false;
            const correct = matchesUciMove(issue.fenBefore, san, issue.bestUci); setPracticeState(correct ? "correct" : "wrong"); return correct;
          }} />
        </div>
        <div className="axis-board-player axis-board-player-bottom"><span className={`axis-piece-dot ${(flipped ? game.user_color === "w" ? "b" : "w" : game.user_color) === "b" ? "black" : "white"}`}/><strong>{flipped ? (game.user_color === "w" ? t.axis.black : t.axis.white) : (game.user_color === "w" ? t.axis.white : t.axis.black)}</strong><span>{flipped ? game.opponent_name ?? "—" : settings.chesscomUsername || settings.lichessUsername || t.ui.yourGame}</span><span>{(flipped ? game.opponent_rating : game.user_rating) ?? ""}</span></div>
        <div className="axis-move-controls" aria-label={t.axis.move}>
          <button aria-label={t.axis.first} disabled={ply === 0 && !manual && !issue} onClick={() => goTo(0)}><ChevronsLeft size={20}/></button>
          <button aria-label={t.axis.previous} disabled={ply === 0 && !manual && !issue} onClick={() => goTo(ply - 1)}><ChevronLeft size={20}/></button>
          <span>{t.axis.move} {ply} / {parsed.moves.length}</span>
          <button aria-label={t.axis.next} disabled={ply === parsed.moves.length && !manual && !issue} onClick={() => goTo(ply + 1)}><ChevronRight size={20}/></button>
          <button aria-label={t.axis.last} disabled={ply === parsed.moves.length && !manual && !issue} onClick={() => goTo(parsed.moves.length)}><ChevronsRight size={20}/></button>
        </div>
        {manual && <div className="axis-manual-line" aria-label={locale === "fr" ? "Variante explorée" : "Explored variation"}><strong>{locale === "fr" ? "VARIANTE" : "VARIATION"}</strong><button type="button" aria-current={manual.index === 0 ? "step" : undefined} onClick={() => setManual(current => current && { ...current, index: 0 })}>{locale === "fr" ? "Début" : "Start"}</button>{manual.moves.map((move, index) => <button type="button" key={`${index}:${move.uci}`} aria-current={manual.index === index + 1 ? "step" : undefined} onClick={() => setManual(current => current && { ...current, index: index + 1 })}>{move.san}</button>)}<button type="button" className="axis-return-game" onClick={() => { setManual(null); setExplorer(false); }}>{locale === "fr" ? "Revenir à la partie" : "Return to game"} ↩</button></div>}
        <div className="axis-evaluation"><span>{t.axis.engine}</span><strong>{evalText}</strong></div>
        <div className="axis-review-tools">
          <button type="button" className="axis-focus-flip axis-button secondary" onClick={() => setFlipped(value => !value)}><FlipVertical2 size={16}/>{locale === "fr" ? "Retourner" : "Flip"}</button>
          <button type="button" className="axis-button secondary" aria-pressed={playing} disabled={Boolean(manual)} onClick={() => { if (ply === parsed.moves.length && !playing) goTo(0); setPlaying(value => !value); }}>{playing ? <Pause size={16}/> : <Play size={16}/>}<span>{playing ? locale === "fr" ? "Pause" : "Pause" : locale === "fr" ? "Lecture" : "Play"}</span></button>
          <label>{locale === "fr" ? "Vitesse" : "Speed"}<select aria-label={locale === "fr" ? "Vitesse de lecture" : "Playback speed"} value={settings.reviewPlaybackMs ?? 1200} onChange={event => setSettings({ ...settings, reviewPlaybackMs: Number(event.target.value) })}><option value={2400}>0.5×</option><option value={1200}>1×</option><option value={600}>2×</option></select></label>
          <button type="button" className="axis-button secondary" aria-pressed={explorer} onClick={() => { setExplorer(value => !value); goTo(ply); }}>{locale === "fr" ? "Explorer" : "Explore position"}</button>
          <label><input type="checkbox" checked={settings.showCoordinates !== false} onChange={event => setSettings({ ...settings, showCoordinates: event.target.checked })}/>{locale === "fr" ? "Coordonnées" : "Coordinates"}</label>
          <label><input type="checkbox" checked={settings.showEvaluationBar !== false} onChange={event => setSettings({ ...settings, showEvaluationBar: event.target.checked })}/>{locale === "fr" ? "Évaluation" : "Evaluation bar"}</label>
          <label><input type="checkbox" checked={showBest} disabled={!bestArrow} onChange={event => setShowBest(event.target.checked)}/>{locale === "fr" ? "Flèche moteur" : "Engine arrow"}</label>
        </div>
        </BoardFocusMode>
        <div className="axis-review-export"><button type="button" aria-label={locale === "fr" ? "Copier FEN" : "Copy FEN"} onClick={() => void copy(displayedFen)}><Copy size={14}/>FEN</button><button type="button" aria-label={locale === "fr" ? "Copier PGN" : "Copy PGN"} onClick={() => void copy(game.pgn)}><Copy size={14}/>PGN</button><button type="button" aria-label={locale === "fr" ? "Exporter PGN" : "Export PGN"} onClick={exportPgn}><Download size={14}/>PGN</button><span>← → / Home / End / Space</span></div>
      </section>
      <section className="axis-review-panel">
        <div className="axis-analysis-tabs" role="tablist" aria-label={t.axis.review} onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const nextTab = event.key === "Home" ? "moments" : event.key === "End" ? "moves" : tab === "moments" ? "moves" : "moments";
          setTab(nextTab);
          document.getElementById(`${nextTab}-tab`)?.focus();
        }}>
          <button role="tab" id="moments-tab" tabIndex={tab === "moments" ? 0 : -1} aria-controls="moments-panel" aria-selected={tab === "moments"} onClick={() => setTab("moments")}>{t.axis.issues}<span>{analysis?.issues.length ?? 0}</span></button>
          <button role="tab" id="moves-tab" tabIndex={tab === "moves" ? 0 : -1} aria-controls="moves-panel" aria-selected={tab === "moves"} onClick={() => setTab("moves")}>{t.ui.moves}<span>{parsed.moves.length}</span></button>
        </div>
        {analysis && <div className="axis-analysis-summary"><div><strong>{analysis.accuracy}%</strong><span>{t.games.accuracy}</span></div><div><strong>{analysis.blunders}</strong><span>{t.ui.classifications.blunder}</span></div><div><strong>{analysis.mistakes}</strong><span>{t.ui.classifications.mistake}</span></div></div>}
        <div id="moments-panel" role="tabpanel" aria-labelledby="moments-tab" hidden={tab !== "moments"} className="axis-analysis-tab-content">
        {analysis && analysis.issues.length > 0 && !issue && <EmptyState title={t.ui.selectMoment} description={t.ui.selectedMoment}/>}
        {game.analysis_status !== "done" && <AnalysisRunner pendingCount={1} gameId={game.id}/>}
        {!analysis && <p className="axis-muted">{t.axis.unanalysed}</p>}
        {issue && <div className="axis-issue-detail" aria-live="polite">
          <span className={`axis-tag axis-classification ${issue.severity}`}>{t.axis.move} {Number(issue.fenBefore.split(" ")[5])} · {t.ui.classifications[issue.severity]}</span>
          <h2>{t.axis.findMove}</h2>
          <p>{t.axis.explain[issue.motif]}</p><small>{t.axis.heuristic}</small>
          {practiceState === "wrong" && <p className="axis-feedback error">{t.axis.wrong}</p>}
          {practiceState === "correct" && <p className="axis-feedback success">{t.axis.correct}</p>}
          {(practiceState === "correct" || practiceState === "revealed") && <div className="axis-line"><p>{t.axis.played}: <strong>{issue.san}</strong> · {t.axis.best}: <strong>{issue.bestSan ?? "—"}</strong></p>{line.length > 0 && <p>{t.axis.line}: <strong>{line.join(" ")}</strong></p>}</div>}
          <div className="axis-actions">
            {practiceState !== "correct" && <button className="axis-button" onClick={() => setPracticeState("revealed")}>{t.axis.reveal}</button>}
            {practiceState !== "idle" && <button className="axis-button secondary" onClick={() => { setPracticeState("idle"); setShowVariation(false); }}>{t.axis.retry}</button>}
            {line.length > 0 && (practiceState === "correct" || practiceState === "revealed") && <button className="axis-button secondary" onClick={() => { setShowVariation(true); setVariation(0); }}>{t.axis.line}</button>}
          </div>
          {showVariation && <div className="axis-move-controls"><button disabled={variation === 0} onClick={() => setVariation(v => Math.max(0, v - 1))} aria-label={t.axis.previous}><ChevronLeft size={18}/></button><span>{variation} / {variationPositions.length - 1}</span><button disabled={variation === variationPositions.length - 1} onClick={() => setVariation(v => Math.min(variationPositions.length - 1, v + 1))} aria-label={t.axis.next}><ChevronRight size={18}/></button></div>}
        </div>}
        <h2>{t.axis.issues} <span className="axis-muted">{analysis?.issues.length ?? 0}</span></h2>
        {analysis && analysis.issues.length === 0 && <p className="axis-muted">{t.axis.noIssues}</p>}
        {analysis && <div className="axis-issue-list">{analysis.issues.map(item => <button key={item.ply} onClick={() => selectIssue(item)} className={item.ply === issue?.ply ? "active" : ""}><span>{Number(item.fenBefore.split(" ")[5])}{item.fenBefore.split(" ")[1] === "w" ? "." : "..."} {item.san}</span><span>{t.ui.classifications[item.severity]} · {t.motifs[item.motif].split(" (")[0]}</span></button>)}</div>}
        </div>
        <div id="moves-panel" role="tabpanel" aria-labelledby="moves-tab" hidden={tab !== "moves"} className="axis-analysis-tab-content"><h2>{t.ui.moves}</h2><div className="axis-move-labels"><span></span><span>{t.ui.moveWhite}</span><span>{t.ui.moveBlack}</span></div><div className="axis-moves">{moveRows.map(row => <Fragment key={row.number}><span>{row.number}</span>{(["w", "b"] as const).map(color => { const move = row[color]; return move ? <button key={color} onClick={() => goTo(move.index + 1)} aria-current={ply === move.index + 1 && !issue && !manual ? "step" : undefined} className={ply === move.index + 1 && !issue && !manual ? "active" : ""}>{move.san}</button> : <span key={color}>—</span>; })}</Fragment>)}</div>
        </div>
      </section>
        {analysis?.evaluations && <EvaluationGraph evaluations={analysis.evaluations} ply={ply} onSelect={p => goTo(p)} label={t.axis.evaluation}/>}
    </div>
  </main>;
}

function EvaluationGraph({ evaluations, ply, onSelect, label }: { evaluations: number[]; ply: number; onSelect: (ply: number) => void; label: string }) {
  const width = 600;
  const points = evaluations.map((value, index) => `${(index / Math.max(1, evaluations.length - 1)) * width},${60 - Math.max(-600, Math.min(600, value)) / 10}`).join(" ");
  return <div className="axis-graph"><p>{label}</p><svg viewBox="0 0 600 120" role="img" aria-label={label}><line x1="0" y1="60" x2="600" y2="60" stroke="currentColor" opacity=".25"/><polyline fill="none" stroke="var(--chart-line)" strokeWidth="2.5" points={points}/><line x1={(ply / Math.max(1, evaluations.length - 1)) * width} y1="0" x2={(ply / Math.max(1, evaluations.length - 1)) * width} y2="120" stroke="currentColor" opacity=".7"/></svg><input aria-label={label} type="range" min="0" max={evaluations.length - 1} value={ply} onChange={e => onSelect(Number(e.target.value))}/></div>;
}
