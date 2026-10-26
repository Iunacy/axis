"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Logo from "./Logo";
import { useI18n } from "@/lib/i18n";
import { useOnboardedFlag, useSettings, useStoreHydrated } from "@/lib/store";
import { loadSettings, saveSettings, setOnboarded } from "@/lib/storage";
import { syncGames } from "@/lib/sync";

export default function OnboardingModal() {
  const { t } = useI18n();
  const router = useRouter();
  const hydrated = useStoreHydrated();
  const onboardedFlag = useOnboardedFlag();
  const settings = useSettings();
  const [chesscom, setChesscom] = useState("");
  const [lichess, setLichess] = useState("");
  const [error, setError] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const open = hydrated && !(onboardedFlag || settings.chesscomUsername || settings.lichessUsername);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (syncing) return;
    const c = chesscom.trim();
    const l = lichess.trim();
    if (!c && !l) {
      setError(true);
      return;
    }
    setSyncing(true);
    try {
      await syncGames({ chesscomUsername: c, lichessUsername: l });
    } catch {
    }
    saveSettings({ ...loadSettings(), chesscomUsername: c, lichessUsername: l });
    setOnboarded();
  }

  const input =
    "h-10 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 outline-none w-full";

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <Logo className="w-6 h-6" />
            <AlertDialogTitle>{t.onboarding.title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription>{t.onboarding.desc}</AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {t.settings.chesscom}
            <input
              className={input}
              value={chesscom}
              onChange={(e) => {
                setChesscom(e.target.value);
                setError(false);
              }}
              placeholder="ln_dev"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {t.settings.lichess}
            <input
              className={input}
              value={lichess}
              onChange={(e) => {
                setLichess(e.target.value);
                setError(false);
              }}
              placeholder="ln_dev7"
            />
          </label>

          {error && <p className="text-sm text-red-500">{t.onboarding.required}</p>}

          <button type="button" className="axis-link self-start" onClick={() => { setOnboarded(); router.push("/games"); }}>{t.axis.importTitle} →</button>
          <button
            type="submit"
            disabled={syncing}
            className="self-end rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-5 py-2.5 text-sm font-medium text-white transition"
          >
            {syncing ? t.onboarding.syncing : t.onboarding.start}
          </button>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
