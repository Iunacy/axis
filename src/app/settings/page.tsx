"use client";

import SettingsForm from "@/components/SettingsForm";
import { useI18n } from "@/lib/i18n";

export default function SettingsPage() {
  const { t } = useI18n();
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 flex flex-col gap-6">
      <div className="axis-page-head"><div><h1>{t.settings.title}</h1><p>{t.ui.settingsHelp}</p></div></div>
      <SettingsForm />
    </main>
  );
}
