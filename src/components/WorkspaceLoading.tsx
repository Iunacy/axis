"use client";

import Logo from "./Logo";
import { useI18n } from "@/lib/i18n";

export default function WorkspaceLoading() {
  const { t } = useI18n();
  return <main><div className="axis-loading" role="status"><span className="axis-brand-symbol"><Logo/></span><p>{t.ui.loading}…</p></div></main>;
}
