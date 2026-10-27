"use client";

import { CLASSIFICATION_META } from "@/lib/classification-meta";
import { useI18n } from "@/lib/i18n";
import type { MoveClassification } from "@/lib/types";

export default function MoveBadge({ classification, decorative = false }: { classification: MoveClassification; decorative?: boolean }) {
  const { locale } = useI18n(); const meta = CLASSIFICATION_META[classification];
  return <span className={`axis-move-badge axis-grade-${classification}`} role={decorative ? undefined : "img"} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : meta.name[locale]} title={meta.name[locale]}>{meta.glyph}</span>;
}
