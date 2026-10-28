"use client";

import { useEffect, useRef, useState } from "react";
import { CLASSIFICATION_META } from "@/lib/classification-meta";
import type { MoveAssessment } from "@/lib/types";

export default function EvaluationGraph({ evaluations, assessments, locale, ply, onSelect, label }: { evaluations: number[]; assessments: MoveAssessment[]; locale: "en" | "fr"; ply: number; onSelect: (ply: number) => void; label: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(40, entries[0].contentRect.width)));
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const x = (index: number) => 10 + index / Math.max(1, evaluations.length - 1) * (width - 20);
  const y = (value: number) => 22 - Math.max(-600, Math.min(600, value)) / 600 * 14;
  const points = evaluations.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const selected = Math.min(ply, evaluations.length - 1);
  return <div className="axis-graph"><p>{label}</p><svg ref={ref} viewBox={`0 0 ${width} 44`} role="group" aria-label={label}>
    <line x1="10" y1="22" x2={width - 10} y2="22" stroke="currentColor" opacity=".25"/>
    <polyline fill="none" stroke="var(--chart-line)" strokeWidth="1.5" points={points}/>
    <line x1={x(selected)} y1="0" x2={x(selected)} y2="44" stroke="currentColor" opacity=".7"/>
    {assessments.filter(move => move.classification && ["brilliant", "great", "inaccuracy", "mistake", "miss", "blunder"].includes(move.classification) && move.ply < evaluations.length).map(move => {
      const meta = CLASSIFICATION_META[move.classification!];
      return <g key={move.ply} transform={`translate(${x(move.ply)} ${y(evaluations[move.ply])})`} className={`axis-graph-grade axis-grade-${move.classification}`} role="button" tabIndex={0} aria-label={`${locale === "fr" ? "Demi-coup" : "Ply"} ${move.ply}: ${meta.name[locale]}`} onClick={() => onSelect(move.ply)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(move.ply); } }}><title>{meta.name[locale]}</title><circle r="7"/><text textAnchor="middle" dominantBaseline="central" style={{ fontSize: 8 }}>{meta.glyph}</text></g>;
    })}
    </svg><input aria-label={label} type="range" min="0" max={Math.max(0, evaluations.length - 1)} value={Math.max(0, selected)} onChange={event => onSelect(Number(event.target.value))}/></div>;
}
