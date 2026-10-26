"use client";

import { toast } from "sonner";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { hydrateStore } from "@/lib/store";
import { stopSpeech } from "@/lib/speech";

export default function StoreHydrator() {
  const pathname = usePathname();

  useEffect(() => {
    hydrateStore();
  }, []);

  useEffect(() => () => stopSpeech(), [pathname]);

  useEffect(() => {
    const onStorageError = () => toast.error("Browser storage is unavailable. Your progress may not be saved.");
    window.addEventListener("axis:storage-error", onStorageError);
    return () => window.removeEventListener("axis:storage-error", onStorageError);
  }, []);

  return null;
}
