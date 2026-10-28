"use client";

import { useMemo } from "react";
import { Undo2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { nodePath, type ReviewPositionState, type ReviewAction } from "@/lib/review-position";

export default function ReviewVariations({ state, dispatch }: { state: ReviewPositionState; dispatch: (action: ReviewAction) => void }) {
  const { locale } = useI18n();
  const leaves = useMemo(() => Object.values(state.nodes).filter(node => node.gamePly === null && node.children.length === 0), [state.nodes]);
  if (!leaves.length) return null;
  return <section className="axis-variations" aria-label={locale === "fr" ? "Variantes conservées" : "Saved variations"}>
    <header><h2>{locale === "fr" ? "Variantes" : "Variations"}</h2><button type="button" onClick={() => dispatch({ type: "game", ply: nodePath(state, state.cursor).findLast(node => node.gamePly !== null)?.gamePly ?? 0 })}><Undo2 size={14}/>{locale === "fr" ? "Partie" : "Main game"}</button></header>
    {leaves.map((leaf, index) => {
      const path = nodePath(state, leaf.id);
      const start = path.findIndex(node => node.gamePly === null);
      const branch = path.slice(start - 1);
      return <div key={leaf.id} className={state.tip === leaf.id ? "active" : ""}>
        <span>{String.fromCharCode(65 + index % 26)}</span>
        {branch.map((node, moveIndex) => <button key={node.id} type="button" aria-current={state.cursor === node.id && state.tip === leaf.id ? "step" : undefined} onClick={() => dispatch({ type: "select", id: node.id, tip: leaf.id })}>{moveIndex === 0 ? locale === "fr" ? "Début" : "Start" : `${node.fen.split(" ")[1] === "b" ? `${node.fen.split(" ")[5]}.` : `${Number(node.fen.split(" ")[5]) - 1}...`} ${node.san}`}</button>)}
      </div>;
    })}
  </section>;
}
