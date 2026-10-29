"use client";

import { use } from "react";
import Link from "next/link";
import { LessonContentView } from "@/components/LessonView";
import { ACADEMY } from "@/lib/academy";
import { useI18n } from "@/lib/i18n";
import { useStore, useStoreHydrated } from "@/lib/store";
import WorkspaceLoading from "@/components/WorkspaceLoading";

export default function AcademyLesson({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { locale } = useI18n();
  const lesson = ACADEMY.find(item => item.id === slug);
  const hydrated = useStoreHydrated();
  const completed = useStore(state => state.academyCompleted);
  const mark = useStore(state => state.completeAcademyLesson);
  if (!hydrated) return <WorkspaceLoading />;
  const index = lesson ? ACADEMY.indexOf(lesson) : -1;
  const previous = ACADEMY[index - 1];
  const next = ACADEMY[index + 1];
  return <main className="axis-lesson-reader">
    <Link className="axis-link" href="/academy">← Chess Academy</Link>
    {lesson ? <>
      <LessonContentView key={lesson.id} title={lesson.title} content={lesson.content} initialCompleted={completed.includes(lesson.id)} onComplete={() => mark(lesson.id)} />
      <nav className="axis-academy-next" aria-label={locale === "fr" ? "Navigation des leçons" : "Lesson navigation"}>
        {previous && <Link className="axis-button secondary" href={`/academy/${previous.id}`}>{locale === "fr" ? "Leçon précédente" : "Previous lesson"}: {previous.title}</Link>}
        {next ? <Link className="axis-button secondary" href={`/academy/${next.id}`}>{locale === "fr" ? "Leçon suivante" : "Next lesson"}: {next.title}</Link> : <Link className="axis-button" href="/training">{locale === "fr" ? "Passer à la pratique" : "Continue to practice"}</Link>}
      </nav>
    </> : <><h1>{locale === "fr" ? "Leçon introuvable" : "Lesson not found"}</h1><p>{locale === "fr" ? "Choisissez une leçon dans le programme de l’Academy." : "Choose a lesson from the Academy curriculum."}</p></>}
  </main>;
}
