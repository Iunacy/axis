"use client";

import { CLASSIFICATION_META } from "@/lib/classification-meta";
import { useI18n } from "@/lib/i18n";
import type { MoveClassification } from "@/lib/types";
import { BookOpen, Check, Star, ThumbsUp, X } from "lucide-react";

const classificationIcons = { best: Star, excellent: ThumbsUp, good: Check, book: BookOpen, miss: X };

function QuestionMark() {
  return <><path d="M8 7a4 4 0 0 1 8 0c0 3-4 3-4 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><circle cx="12" cy="18" r="1.6"/></>;
}
function ExclamationMark() {
  return <><rect x="10.5" y="3" width="3" height="11" rx="1"/><circle cx="12" cy="18" r="1.6"/></>;
}

// Vector punctuation keeps the familiar annotations crisp and optically centered
// at small sizes, independent of the surrounding text font.
export function MoveSymbol({ classification, x, y, size = 24 }: { classification: MoveClassification; x?: number; y?: number; size?: number }) {
  const Icon = classificationIcons[classification as keyof typeof classificationIcons];
  if (Icon) return <Icon x={x} y={y} width={size} height={size} aria-hidden="true" strokeWidth={classification === "excellent" ? 2 : 3} fill={["best", "excellent"].includes(classification) ? "currentColor" : "none"}/>;
  const single = classification === "great" || classification === "mistake";
  const first = classification === "brilliant" ? <ExclamationMark/> : <QuestionMark/>;
  const second = classification === "blunder" ? <QuestionMark/> : <ExclamationMark/>;
  return <svg x={x} y={y} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {single ? classification === "great" ? <ExclamationMark/> : <QuestionMark/> : <><g transform="translate(-2 2) scale(.8)">{first}</g><g transform="translate(7 2) scale(.8)">{second}</g></>}
  </svg>;
}

export default function MoveBadge({ classification, decorative = false }: { classification: MoveClassification; decorative?: boolean }) {
  const { locale } = useI18n(); const meta = CLASSIFICATION_META[classification];
  return <span className={`axis-move-badge axis-grade-${classification}`} role={decorative ? undefined : "img"} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : meta.name[locale]} title={meta.name[locale]}><MoveSymbol classification={classification}/></span>;
}
