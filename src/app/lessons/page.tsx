"use client";

import Link from "next/link";
import { BookOpen, Check } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/Workspace";
import WorkspaceLoading from "@/components/WorkspaceLoading";
import AiLessonGenerator from "@/components/AiLessonGenerator";
import ApiKeyField from "@/components/ApiKeyField";
import DeleteLessonButton from "@/components/DeleteLessonButton";
import GenerateLessonsButton from "@/components/GenerateLessonsButton";
import { useI18n } from "@/lib/i18n";
import { lessonConcept, lessonTitle } from "@/lib/lessons";
import { useCoachAvailability } from "@/lib/coach-client";
import { useAiLessons, useLessons, useStoreHydrated } from "@/lib/store";
import { removeAiLesson, removeLesson } from "@/lib/storage";

export default function LessonsPage() {
  const { t, locale } = useI18n();
  const hydrated = useStoreHydrated();
  const { available: aiAvailable } = useCoachAvailability();

  const lessons = useLessons();
  const aiLessons = useAiLessons();

  if (!hydrated) return <WorkspaceLoading/>;

  return (
    <main className="axis-route axis-lessons">
      <PageHeader title={t.lessons.title} description={t.lessons.classicSub} actions={<GenerateLessonsButton/>}/>


      <section className="flex flex-col gap-5">
        {lessons.length === 0 ? (
          <EmptyState icon={<BookOpen size={28}/>} title={t.lessons.empty} description={t.axis.noTraining}><Link href="/games" className="axis-button">{t.ui.reviewGame}</Link></EmptyState>
        ) : (
          <ul className="axis-catalog">
            {lessons.map((l) => (
              <li key={l.slug} className="relative">
                <DeleteLessonButton onConfirm={() => removeLesson(l.slug)} />
                <Link
                  href={`/lessons/${l.slug}`}
                  className="axis-lesson-link"
                >
                  <p className="text-xs text-muted-foreground mb-1">
                    {t.lessons.lesson}
                    {l.completed && <span className="text-emerald-600 dark:text-emerald-400 ml-2"><Check size={13} className="inline"/> {t.lessons.completed}</span>}
                  </p>
                  <h3 className="font-medium text-foreground">{lessonTitle(l.slug, locale)}</h3>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{lessonConcept(l.slug, locale)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>      <details className="axis-panel"><summary className="font-medium">{t.ui.advanced}</summary><div className="flex flex-col gap-5 pt-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium text-violet-700 dark:text-violet-200">{t.lessons.personalized}</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">{t.lessons.personalizedSub}</p>
        </div>

        <AiLessonGenerator />

        {!aiAvailable && <ApiKeyField />}

        {aiLessons.length > 0 && (
          <ul className="axis-catalog">
            {aiLessons.map((l) => (
              <li key={l.id} className="relative">
                <DeleteLessonButton onConfirm={() => removeAiLesson(l.id)} />
                <Link
                  href={`/lessons/${l.id}`}
                  className="axis-lesson-link"
                >
                  <p className="text-xs text-violet-600 dark:text-violet-400 mb-1">
                    {new Date(l.created_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB")}
                    {l.completed && <span className="text-emerald-600 dark:text-emerald-400 ml-2"><Check size={13} className="inline"/> {t.lessons.completed}</span>}
                  </p>
                  <h3 className="font-medium text-foreground">{l.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{l.content.concept}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div></details>

    </main>
  );
}
