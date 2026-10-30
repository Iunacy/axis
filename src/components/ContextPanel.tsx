"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { motionTiming } from "@/lib/ui-motion";
import { useI18n } from "@/lib/i18n";
import { X } from "lucide-react";

/** Native modal semantics provide focus containment, Escape and focus restoration. */
export default function ContextPanel({ open, onClose, title, children, drawer = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; drawer?: boolean }) {
  const { locale } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const interruptedFrame = useRef<Keyframe | null>(null);
  const titleId = useId();
  const [present, setPresent] = useState(open);
  // Keep content mounted through exit; reopening cancels exit without losing state.
  if (open && !present) setPresent(true);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!open && !dialog.open) return;
    const timing = motionTiming(dialog, open ? "panel" : "exit");
    const displaced = drawer ? "translateX(24px)" : "translateY(8px)";
    const frames = [{ opacity: 0, transform: displaced }, { opacity: 1, transform: "none" }];
    const from = interruptedFrame.current ?? (open ? frames[0] : frames[1]);
    interruptedFrame.current = null;
    let animation: Animation | undefined;
    let cancelled = false;
    const finish = () => {
      if (cancelled || open) return;
      dialog.close();
      setPresent(false);
    };
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[autofocus]")?.focus();
    }
    if (timing.duration && typeof dialog.animate === "function") {
      animation = dialog.animate([from, open ? frames[1] : frames[0]], { ...timing, fill: "both" });
      void animation.finished.then(finish, () => {});
    } else finish();
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const settle = () => { if (preference.matches) { animation?.finish(); finish(); } };
    preference.addEventListener("change", settle);
    return () => {
      cancelled = true;
      if (dialog.open && animation?.playState === "running") {
        const current = getComputedStyle(dialog);
        interruptedFrame.current = { opacity: current.opacity, transform: current.transform };
      }
      animation?.cancel();
      preference.removeEventListener("change", settle);
    };
  }, [open, drawer]);
  return <dialog ref={ref} aria-labelledby={titleId} aria-label={title} className={`axis-context-panel${drawer ? " is-drawer" : ""}`} onCancel={event => { event.preventDefault(); onClose(); }} onClose={event => { if (open && !event.currentTarget.open) onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose(); } }}>
    <header><h2 id={titleId}>{title}</h2><button type="button" aria-label={locale === "fr" ? "Fermer le panneau" : "Close panel"} onClick={onClose}><X size={20}/></button></header>
    <div className="axis-context-body">{present ? children : null}</div>
  </dialog>;
}
