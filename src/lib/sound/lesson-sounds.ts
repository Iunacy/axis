"use client";

import { useCallback } from "react";
import { loadSettings } from "@/lib/storage";
import { confirmation002Sound } from "./assets/confirmation-002";
import { error001Sound } from "./assets/error-001";
import { successChimeSound } from "./assets/success-chime";
import { useSound } from "./use-sound";

export function useLessonSounds() {
  const [playCorrect] = useSound(successChimeSound, { volume: 0.5 });
  const [playWrong] = useSound(error001Sound, { volume: 0.45 });
  const [playComplete] = useSound(confirmation002Sound, { volume: 0.55 });

  return {
    correct: useCallback(() => {
      if (loadSettings().soundEnabled !== false) playCorrect();
    }, [playCorrect]),
    wrong: useCallback(() => {
      if (loadSettings().soundEnabled !== false) playWrong();
    }, [playWrong]),
    complete: useCallback(() => {
      if (loadSettings().soundEnabled !== false) playComplete();
    }, [playComplete]),
  };
}
