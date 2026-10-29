"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { describeError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { NoUsernamesError, syncGames } from "@/lib/sync";

export default function SyncButton({ onSynced }: { onSynced?: () => void }) {
  const { t, locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const controller = useRef<AbortController | null>(null);

  async function sync(fullHistory = false) {
    setBusy(true);
    controller.current = new AbortController();
    setProgress(locale === "fr" ? "Recherche des archives…" : "Finding game archives…");
    try {
      const { inserted, chesscom, lichess } = await syncGames(undefined, { fullHistory, signal: controller.current.signal, onProgress: value => setProgress(value.retrySeconds ? locale === "fr" ? `Limite du service · nouvel essai dans ${value.retrySeconds} s` : `Rate limited · retrying in ${value.retrySeconds}s` : locale === "fr" ? `${value.imported} nouvelles parties · ${value.pages} pages enregistrées` : `${value.imported} new games · ${value.pages} pages saved`) });
      const message = t.sync.result(inserted, chesscom, lichess);
      setProgress(message);
      toast.success(message);
      onSynced?.();
    } catch (e) {
      const message = controller.current?.signal.aborted
        ? locale === "fr" ? "Import arrêté. Les pages enregistrées seront reprises." : "Import stopped. Saved pages will resume next time."
        : e instanceof NoUsernamesError ? t.sync.noUsernames : describeError(e, t);
      setProgress(message);
      if (controller.current?.signal.aborted) toast.info(message);
      else toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="axis-sync-control"><button
      onClick={() => void sync()}
      disabled={busy}
      className="axis-button"
    >
      {busy ? t.sync.syncing : t.sync.button}
    </button><button className="axis-button secondary" disabled={busy} onClick={() => void sync(true)}>{locale === "fr" ? "Revérifier tout l’historique" : "Recheck full history"}</button>{busy && <button className="axis-button secondary" onClick={() => controller.current?.abort()}>{locale === "fr" ? "Annuler l’import" : "Cancel import"}</button>}{progress && <span role="status" aria-live="polite">{progress}</span>}</div>
  );
}
