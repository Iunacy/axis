"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { X } from "lucide-react";

/** Native modal semantics provide focus containment, Escape and focus restoration. */
export default function ContextPanel({ open, onClose, title, children, drawer = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; drawer?: boolean }) {
  const { locale } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) { dialog.showModal(); dialog.querySelector<HTMLElement>("[autofocus]")?.focus(); }
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} aria-labelledby={titleId} aria-label={title} className={`axis-context-panel${drawer ? " is-drawer" : ""}`} onCancel={onClose} onClose={onClose} onClick={event => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose(); } }}>
    <header><h2 id={titleId}>{title}</h2><button type="button" aria-label={locale === "fr" ? "Fermer le panneau" : "Close panel"} onClick={onClose}><X size={20}/></button></header>
    <div className="axis-context-body">{open ? children : null}</div>
  </dialog>;
}
