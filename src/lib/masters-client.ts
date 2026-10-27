"use client";

import {
  buildMasterPlies,
  buildMastersUserContent,
  MASTERS_MAX_TOKENS,
  MASTERS_SYSTEM_PROMPT,
  parseMastersText,
  sanitizeMasterAnnotation,
} from "./masters";
import { AppError, aiErrorFromStatus } from "./errors";
import { getProvider } from "./providers";
import { loadAiKey } from "./storage";
import type { MasterAnnotation, MasterGame } from "./types";

export async function requestMasterAnnotation(args: {
  game: MasterGame;
  locale: "en" | "fr";
}): Promise<MasterAnnotation> {
  const { game, locale } = args;
  const plies = buildMasterPlies(game);
  if (!plies.length) throw new Error("Could not read this game.");

  const stored = loadAiKey();

  if (!stored) throw new AppError("aiNoKey");

  const provider = getProvider(stored.provider);
  const { url, headers, body } = provider.buildRequest({
    key: stored.key,
    system: MASTERS_SYSTEM_PROMPT,
    user: buildMastersUserContent({ game, plies, locale }),
    maxTokens: MASTERS_MAX_TOKENS,
    browser: true,
  });

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const detail = await res.text();
    throw aiErrorFromStatus(res.status, `${provider.label} ${res.status}: ${detail.slice(0, 120)}`);
  }

  const data = await res.json();
  const parsed = parseMastersText(provider.extractText(data));
  if (!parsed) throw new AppError("aiBadResponse");
  const annotation = sanitizeMasterAnnotation(parsed, {
    gameId: game.id,
    locale,
    plyCount: plies.length,
    createdAt: new Date().toISOString(),
  });
  if (!annotation) throw new AppError("aiBadResponse");
  return annotation;
}
