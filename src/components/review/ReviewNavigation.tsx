"use client";

import { ChevronsLeft, ChevronLeft, Play, Pause, ChevronRight, ChevronsRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export type NavigationDirection = "first" | "previous" | "next" | "last";

export default function ReviewNavigation({ index, length, playing, onNavigate, onPlay }: { index: number; length: number; playing: boolean; onNavigate: (direction: NavigationDirection) => void; onPlay: () => void }) {
  const { t, locale } = useI18n();
  return <div className="axis-navigation" role="group" aria-label={locale === "fr" ? "Navigation des coups" : "Move navigation"}>
    {([{ direction: "first", label: t.axis.first, Icon: ChevronsLeft }, { direction: "previous", label: t.axis.previous, Icon: ChevronLeft }] as const).map(({ direction, label, Icon }) => <button key={direction} type="button" title={label} aria-label={label} disabled={index === 0} onClick={() => onNavigate(direction)}><Icon size={20}/></button>)}
    <button type="button" title={playing ? "Pause (Space)" : "Play (Space)"} aria-label={playing ? "Pause" : locale === "fr" ? "Lecture" : "Play"} aria-pressed={playing} disabled={length === 0} onClick={onPlay}>{playing ? <Pause size={18}/> : <Play size={18}/>}</button>
    <output aria-live="off">{index} / {length}</output>
    {([{ direction: "next", label: t.axis.next, Icon: ChevronRight }, { direction: "last", label: t.axis.last, Icon: ChevronsRight }] as const).map(({ direction, label, Icon }) => <button key={direction} type="button" title={label} aria-label={label} disabled={index === length} onClick={() => onNavigate(direction)}><Icon size={20}/></button>)}
  </div>;
}
