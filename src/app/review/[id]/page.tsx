"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import Board from "@/components/Board";
import AnalysisRunner from "@/components/AnalysisRunner";
import { parsePgn } from "@/lib/pgn";
import { useI18n } from "@/lib/i18n";
import { useAnalyses, useGames, useStoreHydrated } from "@/lib/store";
import type { MoveIssue } from "@/lib/types";

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, locale } = useI18n();
  const hydrated = useStoreHydrated();
  const game = useGames().find(g => g.id === decodeURIComponent(id));
  const analysis = useAnalyses()[decodeURIComponent(id)];
  const parsed = useMemo(() => game ? parsePgn(game.pgn) : null, [game]);
  const [ply, setPly] = useState(0);
  const [selectedIssue, setSelectedIssue] = useState<MoveIssue | null>(null);
  const [practiceState, setPracticeState] = useState<"idle" | "wrong" | "correct" | "revealed">("idle");
  const [variation, setVariation] = useState(0);
  const [showVariation, setShowVariation] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!parsed || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); setPly(p => Math.max(0, p - 1)); setSelectedIssue(null); }
      if (event.key === "ArrowRight") { event.preventDefault(); setPly(p => Math.min(parsed.moves.length, p + 1)); setSelectedIssue(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [parsed]);

  if (!hydrated) return <main className="axis-shell"><p className="axis-muted">{t.analysis.title}…</p></main>;
  if (!game || !parsed) return <main className="axis-shell"><p>{t.axis.noGame}</p><Link href="/games" className="axis-link">{t.axis.backGames}</Link></main>;

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
  const uci = last?.uci;
  const currentEval = analysis?.evaluations?.[ply];
  const evalText = currentEval == null ? "—" : Math.abs(currentEval) >= 9000
    ? `M${Math.max(1, 10000 - Math.abs(currentEval))} ${currentEval > 0 ? "White" : "Black"}`
    : `${currentEval >= 0 ? "+" : ""}${(currentEval / 100).toFixed(2)}`;

  function selectIssue(next: MoveIssue) {
    setSelectedIssue(next);
    setPly(next.ply - 1);
    setPracticeState("idle");
    setShowVariation(false);
    setVariation(0);
  }

  return <main className="axis-shell axis-review">
    <Link href="/games" className="axis-link inline-flex items-center gap-2"><ArrowLeft size={16}/>{t.axis.backGames}</Link>
    <div className="axis-page-head"><div><h1>{game.opponent_name ?? t.axis.review}</h1><p>{new Date(game.played_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB")} · {game.opening_name ?? game.eco ?? game.time_class} · {t.games.results[game.result]}</p></div><span className="axis-tag">{game.platform === "pgn" ? "PGN" : game.platform === "chesscom" ? "Chess.com" : "Lichess"}</span></div>
    <div className="axis-review-grid">
      <section className="axis-board-column">
        <Board key={`${id}:${ply}:${showVariation ? variation : "game"}:${practiceState === "idle"}`} fen={displayedFen} orientation={game.user_color} size="lg" showOverlayControls={false}
          lastMove={uci ? { from: uci.slice(0, 2), to: uci.slice(2, 4) } : null}
          interactive={Boolean(issue && !showVariation && (practiceState === "idle" || practiceState === "wrong"))}
          onTryMove={san => { if (!issue?.bestSan) return false; const correct = san.replace(/[+#?!]/g, "") === issue.bestSan.replace(/[+#?!]/g, ""); setPracticeState(correct ? "correct" : "wrong"); return correct; }} />
        <div className="axis-move-controls" aria-label={t.axis.move}>
          <button aria-label={t.axis.first} onClick={() => { setPly(0); setSelectedIssue(null); setShowVariation(false); }}><ChevronsLeft size={20}/></button>
          <button aria-label={t.axis.previous} onClick={() => { setPly(Math.max(0, ply - 1)); setSelectedIssue(null); setShowVariation(false); }}><ChevronLeft size={20}/></button>
          <span>{t.axis.move} {ply} / {parsed.moves.length}</span>
          <button aria-label={t.axis.next} onClick={() => { setPly(Math.min(parsed.moves.length, ply + 1)); setSelectedIssue(null); setShowVariation(false); }}><ChevronRight size={20}/></button>
          <button aria-label={t.axis.last} onClick={() => { setPly(parsed.moves.length); setSelectedIssue(null); setShowVariation(false); }}><ChevronsRight size={20}/></button>
        </div>
        <div className="axis-evaluation"><span>{t.axis.engine}</span><strong>{evalText}</strong></div>
        {analysis?.evaluations && <EvaluationGraph evaluations={analysis.evaluations} ply={ply} onSelect={p => { setPly(p); setSelectedIssue(null); setShowVariation(false); }} label={t.axis.evaluation}/>}
      </section>
      <section className="axis-review-panel">
        {game.analysis_status !== "done" && <AnalysisRunner pendingCount={1} gameId={game.id}/>}
        {!analysis && <p className="axis-muted">{t.axis.unanalysed}</p>}
        {issue && <div className="axis-issue-detail" aria-live="polite">
          <span className="axis-tag">{t.axis.move} {Math.ceil(issue.ply / 2)} · {issue.severity}</span>
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
          {showVariation && <div className="axis-move-controls"><button onClick={() => setVariation(v => Math.max(0, v - 1))} aria-label={t.axis.previous}><ChevronLeft size={18}/></button><span>{variation} / {variationPositions.length - 1}</span><button onClick={() => setVariation(v => Math.min(variationPositions.length - 1, v + 1))} aria-label={t.axis.next}><ChevronRight size={18}/></button></div>}
        </div>}
        <h2>{t.axis.issues} <span className="axis-muted">{analysis?.issues.length ?? 0}</span></h2>
        {analysis && analysis.issues.length === 0 && <p className="axis-muted">{t.axis.noIssues}</p>}
        {analysis && <div className="axis-issue-list">{analysis.issues.map(item => <button key={item.ply} onClick={() => selectIssue(item)} className={item.ply === issue?.ply ? "active" : ""}><span>{Math.ceil(item.ply / 2)}{item.ply % 2 ? "." : "..."} {item.san}</span><span>{item.severity} · {t.motifs[item.motif].split(" (")[0]}</span></button>)}</div>}
        <h2>{t.axis.move}</h2><div className="axis-moves">{parsed.moves.map((move, index) => <button key={index} onClick={() => { setPly(index + 1); setSelectedIssue(null); setShowVariation(false); }} className={ply === index + 1 && !issue ? "active" : ""}>{index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ` : ""}{move.san}</button>)}</div>
      </section>
    </div>
  </main>;
}

function EvaluationGraph({ evaluations, ply, onSelect, label }: { evaluations: number[]; ply: number; onSelect: (ply: number) => void; label: string }) {
  const width = 600;
  const points = evaluations.map((value, index) => `${(index / Math.max(1, evaluations.length - 1)) * width},${80 - Math.max(-600, Math.min(600, value)) / 7.5}`).join(" ");
  return <div className="axis-graph"><p>{label}</p><svg viewBox="0 0 600 160" role="img" aria-label={label}><line x1="0" y1="80" x2="600" y2="80" stroke="currentColor" opacity=".25"/><polyline fill="none" stroke="#d9b778" strokeWidth="2.5" points={points}/><line x1={(ply / Math.max(1, evaluations.length - 1)) * width} y1="0" x2={(ply / Math.max(1, evaluations.length - 1)) * width} y2="160" stroke="currentColor" opacity=".7"/></svg><input aria-label={label} type="range" min="0" max={evaluations.length - 1} value={ply} onChange={e => onSelect(Number(e.target.value))}/></div>;
}
