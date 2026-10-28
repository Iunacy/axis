"use client";

import { Fragment, memo, useEffect, useMemo, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import type { ParsedGame } from "@/lib/pgn";
import type { MoveAssessment } from "@/lib/types";
import MoveBadge from "@/components/MoveBadge";

export default memo(function MoveTimeline({ game, assessments, ply, onSelect, visible }: { game: ParsedGame; assessments: MoveAssessment[]; ply: number | null; onSelect: (ply: number) => void; visible: boolean }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const grades = useMemo(() => new Map(assessments.map(move => [move.ply, move.classification])), [assessments]);
  const rows = useMemo(() => {
    const result: { number: number; w?: number; b?: number }[] = [];
    game.moves.forEach((move, index) => {
      const number = Number(game.fens[index].split(" ")[5]);
      if (result.at(-1)?.number !== number) result.push({ number });
      result.at(-1)![move.color] = index;
    });
    return result;
  }, [game]);
  useEffect(() => {
    if (!visible || ply === null) return;
    const container = ref.current;
    const active = container?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!container || !active) return;
    const outer = container.getBoundingClientRect(); const inner = active.getBoundingClientRect();
    if (inner.top < outer.top) container.scrollTop -= outer.top - inner.top;
    else if (inner.bottom > outer.bottom) container.scrollTop += inner.bottom - outer.bottom;
  }, [ply, visible]);
  return <div className="axis-timeline" ref={ref} tabIndex={0} role="region" aria-label={t.ui.moves}>
    <div className="axis-move-labels"><span></span><span>{t.ui.moveWhite}</span><span>{t.ui.moveBlack}</span></div>
    <div className="axis-moves">{rows.map(row => <Fragment key={row.number}><span>{row.number}.</span>{(["w", "b"] as const).map(color => {
      const index = row[color]; if (index === undefined) return <span key={color}>—</span>;
      const move = game.moves[index]; const grade = grades.get(index + 1);
      return <button key={color} type="button" aria-current={ply === index + 1 ? "step" : undefined} className={ply === index + 1 ? "active" : ""} onClick={() => onSelect(index + 1)} aria-label={`${row.number}${color === "w" ? "." : "..."} ${move.san}`}><span>{move.san}</span>{grade && <MoveBadge classification={grade}/>}</button>;
    })}</Fragment>)}</div>
  </div>;
});
