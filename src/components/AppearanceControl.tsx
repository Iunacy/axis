"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useHydrated } from "@/lib/use-hydrated";
import { useI18n } from "@/lib/i18n";

export default function AppearanceControl() {
  const { theme, setTheme } = useTheme();
  const ready = useHydrated();
  const { t } = useI18n();
  const Icon = ready && theme === "light" ? Sun : ready && theme === "dark" ? Moon : Monitor;
  return <label className="axis-appearance"><Icon size={16} aria-hidden="true"/><select aria-label={t.ui.appearance} value={ready ? theme ?? "system" : "system"} disabled={!ready} onChange={event => setTheme(event.target.value)}><option value="system">{t.ui.system}</option><option value="dark">{t.ui.dark}</option><option value="light">{t.ui.light}</option></select></label>;
}
