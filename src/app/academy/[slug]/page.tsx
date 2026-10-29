"use client";
import { use } from "react";
import Link from "next/link";
import { LessonContentView } from "@/components/LessonView";
import { ACADEMY } from "@/lib/academy";
import { useStore, useStoreHydrated } from "@/lib/store";
import WorkspaceLoading from "@/components/WorkspaceLoading";
export default function AcademyLesson({params}:{params:Promise<{slug:string}>}) {
  const {slug}=use(params);const lesson=ACADEMY.find(item=>item.id===slug);
  const hydrated=useStoreHydrated();const completed=useStore(s=>s.academyCompleted);const mark=useStore(s=>s.completeAcademyLesson);
  if(!hydrated)return <WorkspaceLoading/>;
  return <main className="axis-lesson-reader"><Link className="axis-link" href="/academy">← Chess Academy</Link>{lesson?<><LessonContentView key={lesson.id} title={lesson.title} content={lesson.content} initialCompleted={completed.includes(lesson.id)} onComplete={()=>mark(lesson.id)}/><nav className="axis-academy-next" aria-label="Lesson navigation">{ACADEMY[ACADEMY.indexOf(lesson)+1]&&<Link className="axis-button secondary" href={`/academy/${ACADEMY[ACADEMY.indexOf(lesson)+1].id}`}>Next lesson: {ACADEMY[ACADEMY.indexOf(lesson)+1].title}</Link>}</nav></>:<h1>Lesson not found</h1>}</main>;
}
