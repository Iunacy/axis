"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import MasterGameView from "@/components/MasterGameView";
import { Folio } from "@/components/EditorialFrame";
import { useI18n } from "@/lib/i18n";
import { getMasterGame } from "@/lib/masters-catalog";

export default function MasterGamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { t } = useI18n();
  const game = getMasterGame(slug);

  return (
    <main className="axis-master-study">
      <Folio label="THE ARCHIVE / MASTER GAMES" detail={game?.title} number={String(game?.year ?? "")} />
      <Link
        href="/masters"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit"
      >
        <ChevronLeft className="size-4" />
        {t.masters.back}
      </Link>
      {game ? (
        <MasterGameView game={game} />
      ) : (
        <p className="text-muted-foreground">{t.masters.notFound}</p>
      )}
    </main>
  );
}
