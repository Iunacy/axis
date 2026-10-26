"use client";

import { PageHeader } from "@/components/Workspace";
import SettingsForm from "@/components/SettingsForm";
import { useI18n } from "@/lib/i18n";

export default function SettingsPage() {
  const { t } = useI18n();
  return (
    <main className="axis-route">
      <PageHeader title={t.settings.title} description={t.ui.settingsHelp}/>
      <SettingsForm />
    </main>
  );
}
