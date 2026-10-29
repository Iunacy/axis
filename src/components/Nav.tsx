"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import AppearanceControl from "./AppearanceControl";
import { useI18n, type Locale } from "@/lib/i18n";

export default function Nav() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const { t, locale, setLocale } = useI18n();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const learning = ["/lessons", "/patterns", "/masters"].some(route => pathname.startsWith(route));
  const links = [
    { href: "/dashboard", label: locale === "fr" ? "Accueil" : "Home", active: pathname === "/dashboard" },
    { href: "/games", label: locale === "fr" ? "Mes parties" : "My Games", active: pathname.startsWith("/games") || pathname.startsWith("/review/") },
    { href: "/training", label: locale === "fr" ? "S’entraîner" : "Train", active: pathname === "/training" },
    { href: "/lessons", label: locale === "fr" ? "Apprendre" : "Learn", active: learning },
  ];
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const observer = new ResizeObserver(() => document.documentElement.style.setProperty("--axis-header-height", `${header.getBoundingClientRect().height}px`));
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpenPath(null); headerRef.current?.querySelector<HTMLButtonElement>(".edit-site-menu")?.focus(); } };
    if (open) window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  return <><header ref={headerRef} className="edit-site-header">
    <Link href="/" className="edit-site-brand" aria-label="AXIS home">AXIS<span>®</span></Link>
    <span className="edit-site-edition">{locale === "fr" ? "Un journal de décisions" : "A journal of decisions"}</span>
    <button className="edit-site-menu" type="button" onClick={() => setOpenPath(open ? null : pathname)} aria-label={t.ui.menu} aria-expanded={open} aria-controls="editorial-controls">{open ? <X size={22}/> : <Menu size={22}/>}</button>
    <div id="editorial-navigation" className={`edit-site-navigation${open ? " is-open" : ""}`}>
      <nav aria-label={t.ui.workspace}>{links.map(({ href, label, active }) => {
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} onClick={() => setOpenPath(null)}>{label}</Link>;
      })}</nav>
      <div id="editorial-controls" className="edit-site-controls"><Link href="https://github.com/Iunacy/axis/releases/tag/v4.0.1" className="axis-version" aria-label="AXIS version 4.0.1 release notes">v4.0.1</Link><Link href="/settings" aria-current={pathname === "/settings" ? "page" : undefined}>{t.nav.settings}</Link><AppearanceControl/><label className="edit-site-language"><span className="sr-only">{t.settings.language}</span><select aria-label={t.settings.language} value={locale} onChange={event => setLocale(event.target.value as Locale)}><option value="en">EN</option><option value="fr">FR</option></select></label></div>
    </div>
  </header>{learning && <nav className="axis-learn-navigation" aria-label={locale === "fr" ? "Apprendre" : "Learning resources"}>
    {[{ href: "/lessons", label: t.nav.lessons }, { href: "/patterns", label: locale === "fr" ? "Motifs" : "Patterns" }, { href: "/masters", label: t.nav.masters }].map(link => <Link key={link.href} href={link.href} aria-current={pathname.startsWith(link.href) ? "page" : undefined}>{link.label}</Link>)}
  </nav>}</>;
}
