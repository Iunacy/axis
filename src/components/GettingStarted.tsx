"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDown, Upload, ScanLine, Target } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { describeError } from "@/lib/errors";
import { loadSettings, saveSettings } from "@/lib/storage";
import { syncGames } from "@/lib/sync";

export default function GettingStarted() {
  const { t } = useI18n();
  const [chesscom, setChesscom] = useState(() => loadSettings().chesscomUsername);
  const [lichess, setLichess] = useState(() => loadSettings().lichessUsername);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function connect(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const names = { chesscomUsername: chesscom.trim(), lichessUsername: lichess.trim() };
      const result = await syncGames(names);
      saveSettings({ ...loadSettings(), ...names });
      if (!result.chesscom && !result.lichess) setError(t.errors.syncEmpty);
    } catch (cause) { setError(describeError(cause, t)); }
    finally { setBusy(false); }
  }
  return <section className="axis-welcome"><div className="axis-welcome-story"><h2>{t.ui.startTitle}</h2><p>{t.ui.startHelp}</p><ol className="axis-workflow"><li><Upload size={18}/><span>{t.ui.importStep}</span></li><li aria-hidden="true"><ArrowDown size={14}/></li><li><ScanLine size={18}/><span>{t.ui.analysisStep}</span></li><li aria-hidden="true"><ArrowDown size={14}/></li><li><Target size={18}/><span>{t.ui.practiceStep}</span></li></ol></div><form className="axis-connect-form" onSubmit={connect} aria-busy={busy}><label>{t.settings.chesscom}<input className="axis-field" autoComplete="off" value={chesscom} onChange={event => setChesscom(event.target.value)} placeholder="Chess.com" disabled={busy}/></label><label>{t.settings.lichess}<input className="axis-field" autoComplete="off" value={lichess} onChange={event => setLichess(event.target.value)} placeholder="Lichess" disabled={busy}/></label><p>{t.ui.accountHelp}</p><button className="axis-button" disabled={busy || (!chesscom.trim() && !lichess.trim())}>{busy ? t.sync.syncing : t.ui.connect}<ArrowUpRight size={16}/></button><Link href="/games" className="axis-link text-sm">{t.ui.importInstead}</Link>{error && <p className="axis-feedback error" role="alert">{error}</p>}</form></section>;
}
