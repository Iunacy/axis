"use client";

import { CLASSIFICATION_META } from "@/lib/classification-meta";
import { useI18n } from "@/lib/i18n";
import type { MoveClassification } from "@/lib/types";
import { BookOpen, Check, Star, ThumbsUp, X } from "lucide-react";

const classificationIcons = { best: Star, excellent: ThumbsUp, good: Check, book: BookOpen, miss: X };

export default function MoveBadge({ classification, decorative = false }: { classification: MoveClassification; decorative?: boolean }) {
  const { locale } = useI18n(); const meta = CLASSIFICATION_META[classification];
  const Icon = classificationIcons[classification as keyof typeof classificationIcons];
  return <span className={`axis-move-badge axis-grade-${classification}`} role={decorative ? undefined : "img"} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : meta.name[locale]} title={meta.name[locale]}>{Icon ? <Icon aria-hidden="true" strokeWidth={3} fill={classification === "best" ? "currentColor" : "none"}/> : meta.glyph}</span>;
}
