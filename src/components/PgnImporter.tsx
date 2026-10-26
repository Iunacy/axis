"use client";

import { useState } from "react";
import { toast } from "sonner";
import { importPgnText } from "@/lib/import-pgn";
import { upsertGames } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";

export default function PgnImporter() {
  const { t } = useI18n();
  const [pgn, setPgn] = useState("");
  const [side, setSide] = useState<"w" | "b">("w");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function fileChanged(file?: File) {
    if (!file) return;
    if (file.size > 2_000_000 || !file.name.toLowerCase().endsWith(".pgn")) { setError(t.axis.invalidPgn); return; }
    setPgn(await file.text());
    setError("");
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const parsed = importPgnText(pgn, side);
      if (!parsed.length) { setError(t.axis.invalidPgn); return; }
      const count = upsertGames(parsed);
      toast.success(t.axis.imported(count));
      setError("");
      setPgn("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.axis.invalidPgn); }
    finally { setBusy(false); }
  }
  return <form className="axis-import" onSubmit={submit}>
    <div><h2>{t.axis.importTitle}</h2><p>{t.axis.importHelp}</p></div>
    <textarea aria-label={t.axis.paste} placeholder={t.axis.paste} value={pgn} onChange={event => setPgn(event.target.value)} rows={4}/>
    <div className="axis-import-actions"><label className="axis-button secondary">{t.axis.file}<input type="file" accept=".pgn,application/x-chess-pgn,text/plain" onChange={event => void fileChanged(event.target.files?.[0])}/></label><label>{t.axis.side}<select value={side} onChange={event => setSide(event.target.value as "w" | "b")}><option value="w">{t.axis.white}</option><option value="b">{t.axis.black}</option></select></label><button className="axis-button" disabled={busy || !pgn.trim()}>{busy ? t.axis.importing : t.axis.import}</button></div>
    {error && <p className="axis-feedback error" role="alert">{error}</p>}
  </form>;
}
