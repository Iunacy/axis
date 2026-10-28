"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, Minimize2, Eye, EyeOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function BoardFocusMode({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState(false);
  const [minimal, setMinimal] = useState(true);
  const nativeActive = useRef(false);

  useEffect(() => {
    const change = () => {
      if (document.fullscreenElement === ref.current) nativeActive.current = true;
      else if (nativeActive.current) { nativeActive.current = false; setActive(false); opener.current?.focus(); }
    };
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);

  useEffect(() => {
    if (!active) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => { document.body.style.overflow = overflow; };
  }, [active]);

  function close() {
    const native = document.fullscreenElement === ref.current;
    nativeActive.current = false;
    setActive(false);
    if (native) void document.exitFullscreen().catch(() => {});
    opener.current?.focus();
  }

  async function enter() {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActive(true);
    try { await ref.current?.requestFullscreen?.(); nativeActive.current = document.fullscreenElement === ref.current; } catch {}
  }

  return <div ref={ref} tabIndex={-1} role={active ? "dialog" : undefined} aria-modal={active || undefined} aria-label={active ? locale === "fr" ? "Échiquier plein écran" : "Fullscreen chessboard" : undefined} className={`axis-board-focus ${active ? "is-immersive" : ""} ${minimal ? "is-minimal" : ""}`} onKeyDown={event => {
    if (!active) return;
    if (event.target instanceof Element && event.target.closest("dialog[open]")) return;
    if (event.key === "Escape") { event.preventDefault(); void close(); }
    if (event.key === "Tab") {
      const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select, input, a[href], [tabindex="0"]') ?? []).filter(element => element.getClientRects().length);
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <div className="axis-focus-toolbar"><span>{active ? locale === "fr" ? "ÉCHIQUIER / CONCENTRATION" : "BOARD / FOCUS" : locale === "fr" ? "ÉCHIQUIER" : "CHESSBOARD"}</span><div>{active && <button type="button" aria-pressed={minimal} onClick={() => setMinimal(value => !value)}>{minimal ? <Eye size={16}/> : <EyeOff size={16}/>}<span>{locale === "fr" ? "Détails" : "Details"}</span></button>}<button type="button" onClick={() => { if (active) void close(); else void enter(); }} title={active ? locale === "fr" ? "Quitter le plein écran" : "Exit fullscreen" : locale === "fr" ? "Plein écran" : "Fullscreen board"} aria-label={active ? locale === "fr" ? "Quitter le plein écran" : "Exit fullscreen" : locale === "fr" ? "Plein écran" : "Fullscreen board"}>{active ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}<span>{active ? locale === "fr" ? "Quitter" : "Exit" : locale === "fr" ? "Plein écran" : "Fullscreen"}</span></button></div></div>
    <div className="axis-focus-content">{children}</div>
  </div>;
}
