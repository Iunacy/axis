"use client";

import { useEffect, useRef, useState } from "react";
import { lookupOpeningPosition } from "@/lib/opening-book";
import { Engine } from "@/lib/engine";
import { evaluationLabel, type PositionHistory } from "@/lib/engine-protocol";
import { legalVariation } from "@/lib/analysis";
import { useI18n } from "@/lib/i18n";
import type { PositionEvaluation } from "@/lib/types";

export default function PositionExplorer({ fen, history, initial, onEvaluation, onOpenLine }: { fen: string; history: PositionHistory; initial?: PositionEvaluation; onEvaluation: (result: PositionEvaluation) => void; onOpenLine: (moves: string[]) => void }) {
  const { locale } = useI18n();
  const [deep, setDeep] = useState(false);
  const [depth, setDepth] = useState(16);
  const [multiPv, setMultiPv] = useState(3);
  const identity = JSON.stringify([fen, history]);
  const result = initial;
  const opening = lookupOpeningPosition(fen);
  const [request, setRequest] = useState<{ identity: string; busy: boolean; error: string | null; phase?: "loading" | "calculating" }>({ identity, busy: false, error: null });
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
    engine.current?.destroy();
    const worker = new Engine(deep ? "deep" : "default", status => {
      if (current === generation.current) setRequest(value => value.identity === identity ? { ...value, phase: status === "ready" ? "calculating" : "loading" } : value);
    }); engine.current = worker; running.current = true;
    setRequest({ identity, busy: true, error: null, phase: "loading" });
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
    <details className="axis-opening-reference"><summary>{locale === "fr" ? "Théorie d’ouverture vérifiée" : "Verified opening reference"} · {opening.continuations.length} {locale === "fr" ? "suites" : "continuations"}</summary>
      {opening.openings.map(item => <p key={`${item.eco}:${item.name}`}>{item.eco} · {item.name}</p>)}
      <div className="axis-opening-moves">{opening.continuations.map(uci => <button className="axis-button secondary" type="button" key={uci} onClick={() => onOpenLine([uci])}>{legalVariation(fen, [uci])[0]}</button>)}</div>
      {!opening.continuations.length && <p>{locale === "fr" ? "Aucune suite dans cette source. Cela ne prouve pas que le coup est mauvais." : "No continuations in this source. This does not establish that a move is bad."}</p>}
      <p>{(opening.references.length ? opening.references : [{label: "Lichess chess-openings · CC0", url: `${opening.source.repository}/tree/${opening.source.revision}`}]).map(reference => <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer">{reference.label} ↗ </a>)} · {locale === "fr" ? "Lignes documentées, sans statistiques de popularité." : "Documented lines; no popularity statistics."}</p>
    </details>
    <label><input type="checkbox" checked={deep} disabled={busy} onChange={event => setDeep(event.target.checked)}/> {locale === "fr" ? "Analyse approfondie · téléchargement de 95 Mio · davantage de mémoire" : "Deep analysis · 95 MiB download · higher memory use"}</label>
    <div className="axis-explorer-controls"><label>{locale === "fr" ? "Profondeur visée" : "Target depth"}<select value={depth} disabled={busy} onChange={event => setDepth(Number(event.target.value))}><option value={12}>12</option><option value={16}>16</option><option value={20}>20</option></select></label><label>{locale === "fr" ? "Lignes" : "Lines"}<select value={multiPv} disabled={busy} onChange={event => setMultiPv(Number(event.target.value))}><option value={1}>1</option><option value={3}>3</option><option value={5}>5</option></select></label>{busy ? <button type="button" className="axis-button secondary" onClick={cancel}>{locale === "fr" ? "Annuler" : "Cancel"}</button> : <button type="button" className="axis-button" onClick={() => void analyze()}>{locale === "fr" ? "Analyser la position" : "Analyze position"}</button>}</div>
    {busy && <p role="status">{request.phase === "calculating" ? locale === "fr" ? "Stockfish calcule les lignes…" : "Stockfish is calculating alternatives…" : locale === "fr" ? "Chargement et démarrage de Stockfish… Vous pouvez annuler." : "Loading and starting Stockfish… You can cancel."}</p>}
    {error && <p role="alert" className="axis-feedback error">{error}</p>}
    {result && <><p className="axis-explorer-evidence">{result.engineId?.includes("19.0.1-single") ? "Stockfish 19 · Deep" : result.engineId?.includes("19.0.1") ? "Stockfish 19 · Lite" : "Saved engine evaluation"}{result.cacheHit ? locale === "fr" ? " · résultat conservé" : " · saved evaluation" : ""} · {locale === "fr" ? "profondeur atteinte" : "depth reached"} {result.depth ?? "—"} · {result.nodes?.toLocaleString(locale) ?? "—"} {locale === "fr" ? "nœuds" : "nodes"}</p><div className="axis-engine-lines">{(result.lines ?? []).map((line, index) => <button type="button" key={`${index}:${line.pvUci[0]}`} onClick={() => onOpenLine(line.pvUci)}><span>0{index + 1}</span><strong>{evaluationLabel({ ...line, bestUci: line.pvUci[0] })}</strong><span>{legalVariation(fen, line.pvUci).join(" ")}</span><span aria-hidden="true">↗</span></button>)}</div><small>{locale === "fr" ? "Recherche limitée en nœuds pour préserver les ressources. La profondeur visée n’est pas garantie ; ces lignes ne constituent pas une preuve exhaustive." : "Search is capped to protect device resources. Target depth may not be reached; these lines are not an exhaustive proof."}</small></>}
  </section>;
}
