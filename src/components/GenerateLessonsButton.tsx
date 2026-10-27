"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { generateLessons } from "@/lib/lessons";
import { buildWeaknessProfile } from "@/lib/stats";
import { loadAnalyses, loadGames, loadLessons, loadPuzzles, saveLessons } from "@/lib/storage";

export default function GenerateLessonsButton({ onGenerated }: { onGenerated?: () => void }) {
  const { t } = useI18n();
  const [msg, setMsg] = useState("");

  function generate() {
    setMsg("");
    const analyses = Object.values(loadAnalyses()).filter(summary => summary.complete !== false);
    if (!analyses.length) {
      setMsg(t.lessons.needAnalysis);
      return;
    }
    const profile = buildWeaknessProfile(loadGames(), analyses);
    const fresh = generateLessons(profile, loadPuzzles());
    if (!fresh.length) {
      setMsg(t.lessons.needAnalysis);
      return;
    }
    const existing = new Map(loadLessons().map((l) => [l.slug, l]));
    for (const l of fresh) {
      const prev = existing.get(l.slug);
      if (prev?.completed) l.completed = true;
    }
    saveLessons(fresh);
    onGenerated?.();
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        onClick={generate}
        className="axis-button w-fit"
      >
        {t.lessons.generate}
      </button>
      {msg && <span role="status" className="axis-muted text-sm">{msg}</span>}
    </div>
  );
}
