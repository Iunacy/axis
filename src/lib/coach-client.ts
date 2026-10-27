"use client";

import { buildUserContent, parseModelText, sanitize, SYSTEM_PROMPT } from "./coach";
import type { CoachingDossier } from "./dossier";
import { AppError, aiErrorFromStatus } from "./errors";
import { getProvider } from "./providers";
import { useApiKey, useStoreHydrated } from "./store";
import { loadAiKey } from "./storage";
import type { LessonContent } from "./types";

export interface CoachRequest {
  dossier: CoachingDossier;
  locale: "en" | "fr";
  pastLessonTitles?: string[];
  focus?: string;
}

export function useCoachAvailability(): { available: boolean; viaUserKey: boolean; ready: boolean } {
  const apiKey = useApiKey();
  const hydrated = useStoreHydrated();
  const viaUserKey = Boolean(apiKey);
  return {
    available: viaUserKey,
    viaUserKey,
    ready: hydrated,
  };
}

export async function requestAiLesson(args: CoachRequest): Promise<LessonContent & { title: string }> {
  const stored = loadAiKey();

  if (!stored) throw new AppError("aiNoKey");

  const provider = getProvider(stored.provider);
  const { url, headers, body } = provider.buildRequest({
    key: stored.key,
    system: SYSTEM_PROMPT,
    user: buildUserContent(args),
    browser: true,
  });

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw aiErrorFromStatus(res.status, `${provider.label} ${res.status}: ${detail.slice(0, 120)}`);
  }

  const data = await res.json();
  const text = provider.extractText(data);
  const parsed = parseModelText(text);
  if (!parsed) throw new AppError("aiBadResponse");
  const lesson = sanitize(parsed, args.dossier);
  if (!lesson) throw new AppError("aiBadResponse");
  return lesson;
}
