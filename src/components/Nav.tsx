"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import AppearanceControl from "./AppearanceControl";
import { useI18n, type Locale } from "@/lib/i18n";

export default function Nav() {
  const pathname = usePathname();
  const { t, locale, setLocale } = useI18n();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const links = [
    { href: "/dashboard", label: t.nav.dashboard },
    { href: "/games", label: t.nav.games },
    { href: "/training", label: t.axis.training },
    { href: "/patterns", label: locale === "fr" ? "Motifs" : "Patterns" },
    { href: "/lessons", label: t.nav.lessons },
    { href: "/masters", label: t.nav.masters },
    { href: "/settings", label: t.nav.settings },
  ];
  return <header className="edit-site-header">
    <Link href="/" className="edit-site-brand" aria-label="AXIS home">AXIS<span>®</span></Link>
    <span className="edit-site-edition">{locale === "fr" ? "Un journal de décisions" : "A journal of decisions"}</span>
    <button className="edit-site-menu" type="button" onClick={() => setOpenPath(open ? null : pathname)} aria-label={t.ui.menu} aria-expanded={open} aria-controls="editorial-navigation">{open ? <X size={22}/> : <Menu size={22}/>}</button>
    <div id="editorial-navigation" className={`edit-site-navigation${open ? " is-open" : ""}`}>
      <nav aria-label={t.ui.workspace}>{links.map(({ href, label }) => {
        const active = href === "/games" ? pathname.startsWith("/games") || pathname.startsWith("/review/") : pathname === href || pathname.startsWith(`${href}/`);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} onClick={() => setOpenPath(null)}>{label}</Link>;
      })}</nav>
      <div className="edit-site-controls"><AppearanceControl/><label className="edit-site-language"><span className="sr-only">{t.settings.language}</span><select aria-label={t.settings.language} value={locale} onChange={event => setLocale(event.target.value as Locale)}><option value="en">EN</option><option value="fr">FR</option></select></label></div>
    </div>
  </header>;
}
