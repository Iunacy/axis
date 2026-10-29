"use client";

import { useState } from "react";
import { ChevronDown, Upload } from "lucide-react";
import { toast } from "sonner";
import { importPgnText } from "@/lib/import-pgn";
import { flushStoredState } from "@/lib/indexed-storage";
import { loadGames, saveGames, upsertGames } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";

export default function PgnImporter({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const [pgn, setPgn] = useState("");
  const [side, setSide] = useState<"w" | "b">("w");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function fileChanged(file?: File) {
    if (!file) return;
    setPgn("");
    if (file.size > 2_000_000 || !file.name.toLowerCase().endsWith(".pgn")) { setError(t.axis.invalidPgn); return; }
    setBusy(true);
    try { setPgn(await file.text()); setError(""); }
    catch { setError(t.axis.invalidPgn); }
    finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const previousIds = new Set(loadGames().map(game => game.id));
    let insertedIds = new Set<string>();
    try {
      const parsed = importPgnText(pgn, side);
      if (!parsed.length) { setError(t.axis.invalidPgn); return; }
      insertedIds = new Set(parsed.filter(game => !previousIds.has(game.id)).map(game => game.id));
      const count = upsertGames(parsed);
      await flushStoredState();
      toast.success(t.axis.imported(count));
      setError("");
      setPgn("");
      setOpen(false);
    } catch (cause) { if (insertedIds.size) saveGames(loadGames().filter(game => !insertedIds.has(game.id))); setError(cause instanceof Error ? cause.message : t.axis.invalidPgn); }
    finally { setBusy(false); }
  }
  return <details className="axis-import" open={open} onToggle={event => setOpen(event.currentTarget.open)}><summary><div><strong>{t.axis.importTitle}</strong><p>{t.ui.importDetails}</p></div><ChevronDown size={18}/></summary><form onSubmit={submit} aria-busy={busy}><p>{t.axis.importHelp}</p>
    <textarea disabled={busy} aria-label={t.axis.paste} placeholder={t.axis.paste} value={pgn} onChange={event => setPgn(event.target.value)} rows={4}/>
    <div className="axis-import-actions"><label className="axis-button secondary"><Upload size={15}/>{t.axis.file}<input disabled={busy} type="file" accept=".pgn,application/x-chess-pgn,text/plain" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void fileChanged(file); }}/></label><label>{t.axis.side}<select disabled={busy} value={side} onChange={event => setSide(event.target.value as "w" | "b")}><option value="w">{t.axis.white}</option><option value="b">{t.axis.black}</option></select></label><button className="axis-button" disabled={busy || !pgn.trim()}>{busy ? t.axis.importing : t.axis.import}</button></div>
    {error && <p className="axis-feedback error" role="alert">{error}</p>}
  </form></details>;
}
