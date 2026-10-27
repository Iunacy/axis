"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, BookOpen, FolderOpen, LayoutDashboard, Menu, Orbit, Settings2, Target, X } from "lucide-react";
import Logo from "./Logo";
import AppearanceControl from "./AppearanceControl";
import { useI18n, type Locale } from "@/lib/i18n";

export default function Nav() {
  const pathname = usePathname();
  const { t, locale, setLocale } = useI18n();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const links = [
    { href: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
    { href: "/games", label: t.nav.games, icon: FolderOpen },
    { href: "/training", label: t.axis.training, icon: Target },
    { href: "/lessons", label: t.nav.lessons, icon: BookOpen },
    { href: "/masters", label: t.nav.masters, icon: Orbit },
    { href: "/settings", label: t.nav.settings, icon: Settings2 },
  ];
  if (pathname === "/") return null;
  return <><header className={`axis-nav ${open ? "is-open" : ""}`}>
    <Link href="/" className="axis-brand" aria-label="AXIS"><span className="axis-brand-symbol"><Logo/></span><span className="axis-wordmark">AXIS<span>{t.ui.brandSub}</span></span></Link>
    <button className="axis-menu-button" onClick={() => setOpenPath(open ? null : pathname)} onKeyDown={event => { if (event.key === "Escape") setOpenPath(null); }} aria-label={t.ui.menu} aria-expanded={open} aria-controls="workspace-navigation">{open ? <X size={20}/> : <Menu size={20}/>}</button>
    <div className="axis-nav-body" id="workspace-navigation">
      <p className="axis-nav-section">{t.ui.workspace}</p><nav aria-label={t.ui.workspace}>{links.map(({ href, label, icon: Icon }) => { const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href) || (href === "/games" && pathname.startsWith("/review/")); return <Link key={href} href={href} onClick={() => setOpenPath(null)} aria-current={active ? "page" : undefined} className={active ? "active" : ""}><Icon size={18} aria-hidden="true"/><span>{label}</span>{active && <ArrowUpRight size={14} className="axis-nav-arrow" aria-hidden="true"/>}</Link>; })}</nav>
      <div className="axis-nav-bottom"><Link href="/" className="axis-home-link">AXIS <ArrowUpRight size={14}/></Link><p>{t.ui.localOnly}</p><AppearanceControl/><label className="axis-language"><span>{t.settings.language}</span><select aria-label={t.settings.language} value={locale} onChange={event => setLocale(event.target.value as Locale)}><option value="en">English</option><option value="fr">Français</option></select></label></div>
    </div>
  </header><nav className="axis-mobile-dock" aria-label={t.ui.workspace}>{links.slice(0, 4).map(({ href, label, icon: Icon }) => { const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href) || (href === "/games" && pathname.startsWith("/review/")); return <Link key={href} href={href} aria-current={active ? "page" : undefined}><Icon size={19} aria-hidden="true"/><span>{label}</span></Link>; })}</nav></>;
}
