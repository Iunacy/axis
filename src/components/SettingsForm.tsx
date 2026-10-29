"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ApiKeyField from "./ApiKeyField";
import AppearanceControl from "./AppearanceControl";
import { ChevronDown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BOARD_THEMES } from "@/lib/board-themes";
import { useI18n, type Locale } from "@/lib/i18n";
import { isSpeechSupported, speak, useVoices } from "@/lib/speech";
import { useStoreHydrated } from "@/lib/store";
import { flushStoredState } from "@/lib/indexed-storage";
import { clearAllData, loadSettings, saveSettings } from "@/lib/storage";

export default function SettingsForm() {
  const hydrated = useStoreHydrated();
  if (!hydrated) return null;
  return <SettingsFormInner />;
}

function SettingsFormInner() {
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const voices = useVoices(locale);
  const speechSupported = isSpeechSupported();
  const [form, setForm] = useState(() => loadSettings());
  const [state, setState] = useState<"idle" | "saving" | "saved" | "cleared">("idle");

  const [saveError, setSaveError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (state === "saving") return;
    setState("saving"); setSaveError("");
    saveSettings({
      ...form,
      analyzeLastN: Math.max(10, Math.min(500, Number(form.analyzeLastN) || 50)),
      engineMovetimeMs: Math.max(40, Math.min(2000, Number(form.engineMovetimeMs) || 90)),
    });
    try { await flushStoredState(); setState("saved"); } catch { setState("idle"); setSaveError(locale === "fr" ? "Enregistrement impossible. Libérez de l’espace et réessayez." : "Could not save settings. Free device storage and retry."); }
  }

  function clearData() {
    clearAllData();
    router.push("/");
  }

  const input =
    "axis-field";

  return (
    <form onSubmit={save} className="axis-settings-form" onChange={() => { if (state !== "saving") setState("idle"); setSaveError(""); }}>
      <div className="axis-settings-actions" aria-busy={state === "saving"}>
        <button
          type="submit"
          disabled={state === "saving"}
          className="axis-button"
        >
          {state === "saving" ? locale === "fr" ? "Enregistrement…" : "Saving…" : t.settings.save}
        </button>
        <p className="axis-muted">{locale === "fr" ? "Enregistrez les profils et les préférences d’analyse ici. L’apparence et l’audio s’appliquent immédiatement." : "Save profile and analysis changes here. Appearance and audio apply immediately."}</p>
        {saveError && <p role="alert">{saveError}</p>}
        {state === "saved" && <span role="status" className="text-sm text-emerald-600 dark:text-emerald-400">{t.settings.saved}</span>}
        {state === "cleared" && <span className="text-sm text-amber-600 dark:text-amber-400">{t.settings.cleared}</span>}
      </div>

      <fieldset disabled={state === "saving"} className="axis-panel"><h2>{t.ui.accounts}</h2><p className="axis-muted text-sm leading-6">{t.ui.accountHelp}</p><p className="axis-muted text-sm leading-6">{locale === "fr" ? "À la prochaine importation réussie, changer de joueur remplacera les parties de l’ancien compte sur cette plateforme et ses données d’entraînement. Les fichiers PGN et l’autre plateforme sont conservés." : "On the next successful import, changing a player replaces that platform’s previous account games and their training data. PGN files and the other platform are kept."}</p><label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        {t.settings.chesscom}
        <input
          className={input}
          value={form.chesscomUsername}
          onChange={(e) => setForm({ ...form, chesscomUsername: e.target.value.trim() })}
          placeholder="ln_dev"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        {t.settings.lichess}
        <input
          className={input}
          value={form.lichessUsername}
          onChange={(e) => setForm({ ...form, lichessUsername: e.target.value.trim() })}
          placeholder="ln_dev7"
        />
      </label>

      </fieldset><fieldset className="axis-panel"><h2>{t.ui.boardAppearance}</h2><AppearanceControl/><div role="group" aria-label={t.settings.language} className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        <span>{t.settings.language}</span>
        <div className="flex gap-2">
          {(["fr", "en"] as Locale[]).map((l) => (
            <button
              key={l}
              aria-pressed={locale === l}
              type="button"
              onClick={() => setLocale(l)}
              className="axis-choice"
            >
              {l === "fr" ? "Français" : "English"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        {t.settings.boardTheme}
        <div className="axis-board-themes grid gap-2">
          {BOARD_THEMES.map((th) => {
            const active = form.boardTheme === th.id;
            return (
              <button
                key={th.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setForm({ ...form, boardTheme: th.id });
                  saveSettings({ ...loadSettings(), boardTheme: th.id });
                }}
                className={[
                  "flex flex-col items-center gap-1.5 rounded-lg border p-2 transition",
                  active ? "border-ring bg-accent" : "border-input hover:border-ring/60",
                ].join(" ")}
              >
                <span className="grid grid-cols-2 w-10 h-10 rounded overflow-hidden ring-1 ring-black/30">
                  <span style={{ backgroundColor: th.lightSquare }} />
                  <span style={{ backgroundColor: th.darkSquare }} />
                  <span style={{ backgroundColor: th.darkSquare }} />
                  <span style={{ backgroundColor: th.lightSquare }} />
                </span>
                <span className={`text-[11px] ${active ? "text-foreground" : "text-muted-foreground"}`}>{t.ui.boardThemes[th.id as keyof typeof t.ui.boardThemes]}</span>
              </button>
            );
          })}
        </div>
      </div>

      </fieldset><details className="axis-panel axis-settings-audio"><summary>{t.ui.audio}<ChevronDown size={18}/></summary><div><div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        {t.settings.sound}
        <div className="flex gap-2">
          {([true, false] as const).map((on) => {
            const active = (form.soundEnabled ?? true) === on;
            return (
              <button
                key={String(on)}
                type="button"
                onClick={() => {
                  setForm({ ...form, soundEnabled: on });
                  saveSettings({ ...loadSettings(), soundEnabled: on });
                }}
                aria-pressed={active} className="axis-choice"
              >
                {on ? t.settings.soundOn : t.settings.soundOff}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        {t.settings.voice}
        <div className="flex gap-2">
          {([true, false] as const).map((on) => {
            const active = (form.voiceEnabled ?? true) === on;
            return (
              <button
                key={String(on)}
                type="button"
                onClick={() => {
                  setForm({ ...form, voiceEnabled: on });
                  saveSettings({ ...loadSettings(), voiceEnabled: on });
                }}
                aria-pressed={active} className="axis-choice"
              >
                {on ? t.settings.soundOn : t.settings.soundOff}
              </button>
            );
          })}
        </div>
        {(form.voiceEnabled ?? true) &&
          (!speechSupported ? (
            <p className="text-xs text-muted-foreground">{t.settings.voiceUnsupported}</p>
          ) : (
            <div className="flex gap-2 max-w-md">
              <Select
                value={form.voiceURI ?? "auto"}
                onValueChange={(v) => {
                  const voiceURI = v === "auto" ? undefined : v;
                  setForm({ ...form, voiceURI });
                  saveSettings({ ...loadSettings(), voiceURI });
                }}
              >
                <SelectTrigger className="h-9 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{t.settings.voiceAuto}</SelectItem>
                  {voices.map((v) => (
                    <SelectItem key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => speak("settings-preview", t.app.tagline, locale, form.voiceURI)}
                className="rounded-lg border border-input px-3 h-9 text-sm text-foreground/80 hover:border-ring/60 transition whitespace-nowrap"
              >
                {t.settings.voicePreview}
              </button>
            </div>
          ))}
        {(form.voiceEnabled ?? true) && speechSupported && (
          <label className="flex items-center gap-2 pt-1 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.voiceAutoplay ?? true}
              onChange={(e) => {
                setForm({ ...form, voiceAutoplay: e.target.checked });
                saveSettings({ ...loadSettings(), voiceAutoplay: e.target.checked });
              }}
              className="size-3.5 accent-emerald-600"
            />
            {t.settings.voiceAutoplay}
          </label>
        )}
      </div>

      </div></details><fieldset disabled={state === "saving"} className="axis-panel"><h2>{t.ui.engineSettings}</h2><p className="axis-muted">{locale === "fr" ? "Une revue de partie utilise un budget de calcul fixe. La profondeur et les lignes alternatives se règlent dans l’explorateur de position." : "Game review uses a fixed search budget. Set depth and alternative lines in the position explorer."}</p>

      <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        {t.settings.analyzeLastN}
        <input
          type="number"
          className={input}
          value={form.analyzeLastN}
          onChange={(e) => setForm({ ...form, analyzeLastN: Number(e.target.value) })}
          min={10}
          max={500}
        />
      </label>

      </fieldset><section className="axis-panel"><h2 className="mb-5">{t.ui.advanced}</h2><ApiKeyField /></section>


      <div className="axis-panel axis-settings-data">
        <h2 className="mb-3">{t.ui.data}</h2><p>{t.settings.storageNote}</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="axis-button danger"
            >
              {t.settings.clearData}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.settings.clearTitle}</AlertDialogTitle>
              <AlertDialogDescription>{t.settings.clearDesc}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.lessons.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={clearData}>{t.settings.clearData}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </form>
  );
}
