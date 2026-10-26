"use client";

import { useSyncExternalStore } from "react";


export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function bcp47(locale: string): string {
  return locale === "fr" ? "fr-FR" : "en-US";
}

const QUALITY = /(enhanced|premium|natural|neural|siri|google|wavenet|amélior)/i;

export function pickVoice(locale: string, preferredURI?: string): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const base = locale.slice(0, 2).toLowerCase();
  const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  const pool = matching.length ? matching : voices;
  if (preferredURI) {
    const exact = pool.find((v) => v.voiceURI === preferredURI);
    if (exact) return exact;
  }
  const score = (v: SpeechSynthesisVoice) => (v.localService ? 1 : 0) + (QUALITY.test(v.name) ? 3 : 0);
  return [...pool].sort((a, b) => score(b) - score(a))[0] ?? null;
}

let activeId: string | null = null;
const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}

interface SpeakTarget {
  el: HTMLElement;
  play: () => void;
}
const targets = new Map<string, SpeakTarget>();

let chainEnabled = true;
export function setSpeechChaining(on: boolean): void {
  chainEnabled = on;
}

export function registerSpeakTarget(id: string, el: HTMLElement, play: () => void): () => void {
  targets.set(id, { el, play });
  return () => {
    if (targets.get(id)?.el === el) targets.delete(id);
  };
}

function nextTargetAfter(id: string): SpeakTarget | null {
  const cur = targets.get(id);
  if (!cur || !cur.el.isConnected) return null;
  let best: SpeakTarget | null = null;
  for (const t of targets.values()) {
    if (t.el === cur.el || !t.el.isConnected) continue;
    const pos = cur.el.compareDocumentPosition(t.el);
    if (!(pos & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
    if (!best || best.el.compareDocumentPosition(t.el) & Node.DOCUMENT_POSITION_PRECEDING) {
      best = t;
    }
  }
  return best;
}

let current: SpeechSynthesisUtterance | null = null;
let keepAlive: ReturnType<typeof setInterval> | null = null;
let watchdog: ReturnType<typeof setTimeout> | null = null;

function clearTimers() {
  if (keepAlive) {
    clearInterval(keepAlive);
    keepAlive = null;
  }
  if (watchdog) {
    clearTimeout(watchdog);
    watchdog = null;
  }
}

function startUtterance(id: string, text: string, locale: string, voiceURI?: string): void {
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = bcp47(locale);
  const voice = pickVoice(locale, voiceURI);
  if (voice) u.voice = voice;
  u.rate = 1;
  u.pitch = 1;
  u.volume = 1;
  current = u;

  const finish = (natural: boolean) => {
    clearTimers();
    current = null;
    const wasActive = activeId === id;
    if (wasActive) {
      activeId = null;
      emit();
    }
    if (natural && wasActive && chainEnabled) {
      const next = nextTargetAfter(id);
      if (next) {
        next.el.scrollIntoView({ behavior: "smooth", block: "center" });
        next.play();
      }
    }
  };
  u.onend = () => finish(true);
  u.onerror = () => finish(false);
  u.onstart = () => {
    if (watchdog) {
      clearTimeout(watchdog);
      watchdog = null;
    }
  };

  activeId = id;
  emit();
  synth.speak(u);

  keepAlive = setInterval(() => {
    if (!synth.speaking) {
      clearTimers();
      return;
    }
    synth.resume();
  }, 10000);

  watchdog = setTimeout(() => {
    if (current === u && activeId === id && !synth.speaking) finish(false);
  }, 3500);
}

export function speak(id: string, text: string, locale: string, voiceURI?: string): void {
  if (!isSpeechSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  clearTimers();
  synth.cancel();

  const begin = () => startUtterance(id, text, locale, voiceURI);

  if (!synth.getVoices().length) {
    const onVoices = () => {
      synth.removeEventListener("voiceschanged", onVoices);
      begin();
    };
    synth.addEventListener("voiceschanged", onVoices);
    setTimeout(() => {
      synth.removeEventListener("voiceschanged", onVoices);
      if (activeId !== id) begin();
    }, 300);
    return;
  }

  setTimeout(begin, 0);
}

export function stopSpeech(): void {
  if (!isSpeechSupported()) return;
  clearTimers();
  window.speechSynthesis.cancel();
  current = null;
  activeId = null;
  emit();
}

function subscribeActive(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useActiveSpeechId(): string | null {
  return useSyncExternalStore(
    subscribeActive,
    () => activeId,
    () => null
  );
}

let voicesCache: SpeechSynthesisVoice[] = [];
let voicesSig = "";
const EMPTY_VOICES: SpeechSynthesisVoice[] = [];

function voicesSnapshot(): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return EMPTY_VOICES;
  const v = window.speechSynthesis.getVoices();
  const sig = v.map((x) => x.voiceURI).join("|");
  if (sig !== voicesSig) {
    voicesSig = sig;
    voicesCache = v;
  }
  return voicesCache;
}

function subscribeVoices(cb: () => void) {
  if (!isSpeechSupported()) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", cb);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", cb);
}

export function useVoices(locale: string): SpeechSynthesisVoice[] {
  const all = useSyncExternalStore(subscribeVoices, voicesSnapshot, () => EMPTY_VOICES);
  const base = locale.slice(0, 2).toLowerCase();
  const matching = all.filter((v) => v.lang.toLowerCase().startsWith(base));
  return matching.length ? matching : all;
}
