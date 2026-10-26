import type { AnalysisMode, Settings } from "./types";


export const DEEP_MOVETIME_MS = 500;

const FAST_HASH_MB = 32;
const DEEP_HASH_MB = 64;
const FAST_MIN_MOVETIME_MS = 40;
const FAST_DEFAULT_MOVETIME_MS = 90;

export interface AnalysisParams {
  mode: AnalysisMode;
  movetimeMs: number;
  hashMb: number;
  label: string;
}

export function resolveAnalysisParams(settings: Settings, mode: AnalysisMode): AnalysisParams {
  if (mode === "deep") {
    return {
      mode,
      movetimeMs: DEEP_MOVETIME_MS,
      hashMb: DEEP_HASH_MB,
      label: `deep · movetime ${DEEP_MOVETIME_MS}ms`,
    };
  }
  const movetimeMs = Math.max(FAST_MIN_MOVETIME_MS, settings.engineMovetimeMs || FAST_DEFAULT_MOVETIME_MS);
  return {
    mode: "fast",
    movetimeMs,
    hashMb: FAST_HASH_MB,
    label: `fast · movetime ${movetimeMs}ms`,
  };
}

export function defaultMode(settings: Settings): AnalysisMode {
  return settings.analysisMode ?? "fast";
}
