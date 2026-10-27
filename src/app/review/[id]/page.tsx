"use client";

import { Fragment, use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FlipVertical2 } from "lucide-react";
import Board from "@/components/Board";
import { EmptyState } from "@/components/Workspace";
import AnalysisRunner from "@/components/AnalysisRunner";
import WorkspaceLoading from "@/components/WorkspaceLoading";
import { parsePgn } from "@/lib/pgn";
import { useI18n } from "@/lib/i18n";
import { useAnalyses, useGames, useSettings, useStoreHydrated } from "@/lib/store";
import type { MoveIssue } from "@/lib/types";

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, locale } = useI18n();
  const hydrated = useStoreHydrated();
  const settings = useSettings();
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!parsed || (event.target instanceof Element && event.target.closest("input, textarea, select, button, [contenteditable=true]"))) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); setPly(p => Math.max(0, p - 1)); setSelectedIssue(null); }
      if (event.key === "ArrowRight") { event.preventDefault(); setPly(p => Math.min(parsed.moves.length, p + 1)); setSelectedIssue(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [parsed]);

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
  const displayedFen = issue && showVariation ? variationPositions[Math.min(variation, variationPositions.length - 1)] : issue && practiceState === "correct" ? correctedFen! : parsed.fens[ply];
  const last = ply > 0 && !showVariation ? parsed.moves[ply - 1] : null;
  const uci = issue && practiceState === "correct" && !showVariation ? issue.bestUci : last?.uci;
  const currentEval = issue && (showVariation || practiceState === "correct") ? undefined : analysis?.evaluations?.[ply];
  const evalText = currentEval == null ? "—" : Math.abs(currentEval) >= 9000
    ? `M${Math.max(1, 10000 - Math.abs(currentEval))} ${currentEval > 0 ? "White" : "Black"}`
    : `${currentEval >= 0 ? "+" : ""}${(currentEval / 100).toFixed(2)}`;

  function selectIssue(next: MoveIssue) {
    setSelectedIssue(next);
    setPly(next.ply - 1);
    setPracticeState("idle");
    setShowVariation(false);
    setVariation(0);
    if (window.matchMedia("(max-width: 760px)").matches) boardRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  return <main className="axis-shell axis-review">
    <Link href="/games" className="axis-link inline-flex items-center gap-2"><ArrowLeft size={16}/>{t.axis.backGames}</Link>
    <div className="axis-page-head"><div><h1>{game.opponent_name ?? t.axis.review}</h1><p>{new Date(game.played_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB")} · {game.opening_name ?? game.eco ?? game.time_class} · {t.games.results[game.result]}</p></div><div className="axis-actions"><button className="axis-button secondary axis-flip-button" aria-label={locale === "fr" ? "Retourner l’échiquier" : "Flip board"} onClick={() => setFlipped(value => !value)}><FlipVertical2 size={16}/><span>{locale === "fr" ? "Retourner" : "Flip board"}</span></button><span className="axis-tag">{game.platform === "pgn" ? "PGN" : game.platform === "chesscom" ? "Chess.com" : "Lichess"}</span>{analysis && analysis.issues.length > 0 && <Link href="/training" className="axis-button">{t.ui.practiceThese}</Link>}</div></div>
    <div className="axis-review-grid">
      <section ref={boardRef} className="axis-board-column">
        <div className="axis-board-player"><span className={`axis-piece-dot ${(flipped ? game.user_color : game.user_color === "w" ? "b" : "w") === "b" ? "black" : "white"}`}/><strong>{flipped ? (game.user_color === "w" ? t.axis.white : t.axis.black) : (game.user_color === "w" ? t.axis.black : t.axis.white)}</strong><span>{flipped ? settings.chesscomUsername || settings.lichessUsername || t.ui.yourGame : game.opponent_name ?? "—"}</span><span>{(flipped ? game.user_rating : game.opponent_rating) ?? ""}</span></div>
        <Board key={`${id}:${issue?.ply ?? "game"}:${practiceState === "idle"}`} fen={displayedFen} orientation={flipped ? (game.user_color === "w" ? "b" : "w") : game.user_color} size="lg" showOverlayControls={false}
          lastMove={uci ? { from: uci.slice(0, 2), to: uci.slice(2, 4) } : null}
          interactive={Boolean(issue && !showVariation && (practiceState === "idle" || practiceState === "wrong"))}
          onTryMove={san => { if (!issue?.bestSan) return false; const correct = san.replace(/[+#?!]/g, "") === issue.bestSan.replace(/[+#?!]/g, ""); setPracticeState(correct ? "correct" : "wrong"); return correct; }} />
        <div className="axis-board-player axis-board-player-bottom"><span className={`axis-piece-dot ${(flipped ? game.user_color === "w" ? "b" : "w" : game.user_color) === "b" ? "black" : "white"}`}/><strong>{flipped ? (game.user_color === "w" ? t.axis.black : t.axis.white) : (game.user_color === "w" ? t.axis.white : t.axis.black)}</strong><span>{flipped ? game.opponent_name ?? "—" : settings.chesscomUsername || settings.lichessUsername || t.ui.yourGame}</span><span>{(flipped ? game.opponent_rating : game.user_rating) ?? ""}</span></div>
        <div className="axis-move-controls" aria-label={t.axis.move}>
          <button aria-label={t.axis.first} disabled={ply === 0} onClick={() => { setPly(0); setSelectedIssue(null); setShowVariation(false); }}><ChevronsLeft size={20}/></button>
          <button aria-label={t.axis.previous} disabled={ply === 0} onClick={() => { setPly(Math.max(0, ply - 1)); setSelectedIssue(null); setShowVariation(false); }}><ChevronLeft size={20}/></button>
          <span>{t.axis.move} {ply} / {parsed.moves.length}</span>
          <button aria-label={t.axis.next} disabled={ply === parsed.moves.length} onClick={() => { setPly(Math.min(parsed.moves.length, ply + 1)); setSelectedIssue(null); setShowVariation(false); }}><ChevronRight size={20}/></button>
          <button aria-label={t.axis.last} disabled={ply === parsed.moves.length} onClick={() => { setPly(parsed.moves.length); setSelectedIssue(null); setShowVariation(false); }}><ChevronsRight size={20}/></button>
        </div>
        <div className="axis-evaluation"><span>{t.axis.engine}</span><strong>{evalText}</strong></div>
      </section>
      <section className="axis-review-panel">
        <div className="axis-analysis-tabs" role="tablist" aria-label={t.axis.review}>
          <button role="tab" id="moments-tab" aria-controls="moments-panel" aria-selected={tab === "moments"} onClick={() => setTab("moments")}>{t.axis.issues}<span>{analysis?.issues.length ?? 0}</span></button>
          <button role="tab" id="moves-tab" aria-controls="moves-panel" aria-selected={tab === "moves"} onClick={() => setTab("moves")}>{t.ui.moves}<span>{parsed.moves.length}</span></button>
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
        <div id="moves-panel" role="tabpanel" aria-labelledby="moves-tab" hidden={tab !== "moves"} className="axis-analysis-tab-content"><h2>{t.ui.moves}</h2><div className="axis-move-labels"><span></span><span>{t.ui.moveWhite}</span><span>{t.ui.moveBlack}</span></div><div className="axis-moves">{moveRows.map(row => <Fragment key={row.number}><span>{row.number}</span>{(["w", "b"] as const).map(color => { const move = row[color]; return move ? <button key={color} onClick={() => { setPly(move.index + 1); setSelectedIssue(null); setShowVariation(false); }} aria-current={ply === move.index + 1 && !issue ? "step" : undefined} className={ply === move.index + 1 && !issue ? "active" : ""}>{move.san}</button> : <span key={color}>—</span>; })}</Fragment>)}</div>
        </div>
      </section>
        {analysis?.evaluations && <EvaluationGraph evaluations={analysis.evaluations} ply={ply} onSelect={p => { setPly(p); setSelectedIssue(null); setShowVariation(false); }} label={t.axis.evaluation}/>}
    </div>
  </main>;
}

function EvaluationGraph({ evaluations, ply, onSelect, label }: { evaluations: number[]; ply: number; onSelect: (ply: number) => void; label: string }) {
  const width = 600;
  const points = evaluations.map((value, index) => `${(index / Math.max(1, evaluations.length - 1)) * width},${60 - Math.max(-600, Math.min(600, value)) / 10}`).join(" ");
  return <div className="axis-graph"><p>{label}</p><svg viewBox="0 0 600 120" role="img" aria-label={label}><line x1="0" y1="60" x2="600" y2="60" stroke="currentColor" opacity=".25"/><polyline fill="none" stroke="var(--chart-line)" strokeWidth="2.5" points={points}/><line x1={(ply / Math.max(1, evaluations.length - 1)) * width} y1="0" x2={(ply / Math.max(1, evaluations.length - 1)) * width} y2="120" stroke="currentColor" opacity=".7"/></svg><input aria-label={label} type="range" min="0" max={evaluations.length - 1} value={ply} onChange={e => onSelect(Number(e.target.value))}/></div>;
}
