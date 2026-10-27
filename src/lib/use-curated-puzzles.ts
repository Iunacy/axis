"use client";

import { useEffect, useState } from "react";
import { fetchCuratedPatterns } from "./lichess-puzzles";
import type { PatternDefinition } from "./pattern-catalog";
import { useStore, useStoreHydrated } from "./store";

export function useCuratedPuzzles(patterns: readonly PatternDefinition[]) {
  const hydrated = useStoreHydrated();
  const puzzles = useStore(state => state.puzzles);
  const upsert = useStore(state => state.upsertPuzzles);
  const [error, setError] = useState<string | null>(null);
  const missing = patterns.some(pattern => pattern.ids.some(id => !puzzles.some(puzzle => puzzle.id === `lichess:${id}`)));
  useEffect(() => {
    if (!hydrated || !missing || error) return;
    let active = true;
    fetchCuratedPatterns(patterns).then(rows => { if (active) upsert(rows); }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load curated puzzles.");
    });
    return () => { active = false; };
  }, [hydrated, missing, error, patterns, upsert]);
  return { puzzles, loading: !hydrated || missing && !error, error, retry: () => setError(null) };
}
