import type { Dict } from "./i18n/en";

export type ErrorCode =
  | "network"
  | "unknown"
  | "aiNoKey"
  | "aiAuth"
  | "aiRateLimit"
  | "aiServer"
  | "aiBadResponse"
  | "aiGeneric"
  | "needAnalysis"
  | "noMatchesFilters"
  | "syncUserNotFound"
  | "syncRateLimit"
  | "syncEmpty";

export class AppError extends Error {
  code: ErrorCode;
  detail?: string;
  constructor(code: ErrorCode, detail?: string) {
    super(code);
    this.name = "AppError";
    this.code = code;
    this.detail = detail;
  }
}

export function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError;
}

export function aiCodeFromStatus(status: number): ErrorCode {
  if (status === 401 || status === 403) return "aiAuth";
  if (status === 429) return "aiRateLimit";
  if (status >= 500) return "aiServer";
  return "aiGeneric";
}

export function aiErrorFromStatus(status: number, detail?: string): AppError {
  return new AppError(aiCodeFromStatus(status), detail);
}

export function describeError(e: unknown, t: Dict): string {
  if (e instanceof AppError) {
    const base = t.errors[e.code] ?? t.errors.unknown;
    return e.code === "aiGeneric" && e.detail ? `${base} (${e.detail})` : base;
  }
  if (isNetworkError(e)) return t.errors.network;
  const msg = (e as Error)?.message?.trim();
  return msg || t.errors.unknown;
}
