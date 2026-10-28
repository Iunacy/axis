"use client";

import { useEffect, useRef, useState } from "react";
import { Engine } from "@/lib/engine";
import { evaluationLabel, type PositionHistory } from "@/lib/engine-protocol";
import { legalVariation } from "@/lib/analysis";
import { useI18n } from "@/lib/i18n";
import type { PositionEvaluation } from "@/lib/types";

export default function PositionExplorer({ fen, history, initial, onEvaluation, onOpenLine }: { fen: string; history: PositionHistory; initial?: PositionEvaluation; onEvaluation: (result: PositionEvaluation) => void; onOpenLine: (moves: string[]) => void }) {
  const { locale } = useI18n();
  const [depth, setDepth] = useState(16);
  const [multiPv, setMultiPv] = useState(3);
  const identity = JSON.stringify([fen, history]);
  const result = initial;
  const [request, setRequest] = useState<{ identity: string; busy: boolean; error: string | null }>({ identity, busy: false, error: null });
  if (request.identity !== identity) setRequest({ identity, busy: false, error: null });
  const busy = request.identity === identity && request.busy;
  const error = request.identity === identity ? request.error : null;
  const running = useRef(false);
  const engine = useRef<Engine | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; engine.current?.destroy(); }, []);
  useEffect(() => () => {
    generation.current += 1;
    if (running.current) { engine.current?.destroy(); engine.current = null; running.current = false; }
  }, [identity]);

  function cancel() { generation.current += 1; engine.current?.destroy(); engine.current = null; running.current = false; setRequest({ identity, busy: false, error: null }); }

  async function analyze() {
    if (running.current) return;
    const current = ++generation.current;
    const worker = engine.current ?? new Engine(); engine.current = worker; running.current = true;
    setRequest({ identity, busy: true, error: null });
    try {
      const value = await worker.analyze(fen, { depth, nodes: depth === 12 ? 150000 : depth === 16 ? 500000 : 1000000, multiPv }, history);
      if (current !== generation.current) return;
      onEvaluation(value);
    } catch (cause) { if (current === generation.current) { engine.current = null; setRequest({ identity, busy: false, error: cause instanceof Error ? cause.message : "Stockfish is unavailable." }); } }
    finally { if (current === generation.current) { running.current = false; setRequest(value => value.identity === identity ? { ...value, busy: false } : value); } }
  }

  return <section className="axis-position-explorer" aria-label={locale === "fr" ? "Explorateur de position" : "Position explorer"}>
    <div className="axis-explorer-heading"><h2>{locale === "fr" ? "Explorateur de position" : "Position explorer"}</h2><strong>{result ? evaluationLabel(result) : "—"}</strong></div>
    <p>{locale === "fr" ? "Explorez des variantes sans modifier la partie enregistrée. L’évaluation est toujours donnée du point de vue des Blancs." : "Explore alternatives without changing the recorded game. Evaluations always use White’s perspective."}</p>
    <div className="axis-explorer-controls"><label>{locale === "fr" ? "Profondeur visée" : "Target depth"}<select value={depth} disabled={busy} onChange={event => setDepth(Number(event.target.value))}><option value={12}>12</option><option value={16}>16</option><option value={20}>20</option></select></label><label>{locale === "fr" ? "Lignes" : "Lines"}<select value={multiPv} disabled={busy} onChange={event => setMultiPv(Number(event.target.value))}><option value={1}>1</option><option value={3}>3</option><option value={5}>5</option></select></label>{busy ? <button type="button" className="axis-button secondary" onClick={cancel}>{locale === "fr" ? "Annuler" : "Cancel"}</button> : <button type="button" className="axis-button" onClick={() => void analyze()}>{locale === "fr" ? "Analyser la position" : "Analyze position"}</button>}</div>
    {busy && <p role="status">{locale === "fr" ? "Stockfish calcule les lignes…" : "Stockfish is calculating alternatives…"}</p>}
    {error && <p role="alert" className="axis-feedback error">{error}</p>}
    {result && <><p className="axis-explorer-evidence">Stockfish 18{result.cacheHit ? locale === "fr" ? " · résultat conservé" : " · saved evaluation" : ""} · {locale === "fr" ? "profondeur atteinte" : "depth reached"} {result.depth ?? "—"} · {result.nodes?.toLocaleString(locale) ?? "—"} {locale === "fr" ? "nœuds" : "nodes"}</p><div className="axis-engine-lines">{(result.lines ?? []).map((line, index) => <button type="button" key={`${index}:${line.pvUci[0]}`} onClick={() => onOpenLine(line.pvUci)}><span>0{index + 1}</span><strong>{evaluationLabel({ ...line, bestUci: line.pvUci[0] })}</strong><span>{legalVariation(fen, line.pvUci).join(" ")}</span><span aria-hidden="true">↗</span></button>)}</div><small>{locale === "fr" ? "Recherche limitée en nœuds pour préserver les ressources. La profondeur visée n’est pas garantie ; ces lignes ne constituent pas une preuve exhaustive." : "Search is capped to protect device resources. Target depth may not be reached; these lines are not an exhaustive proof."}</small></>}
  </section>;
}
