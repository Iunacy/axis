"use client";
import Link from "next/link";
import { PageHeader } from "@/components/Workspace";
import { ACADEMY } from "@/lib/academy";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
export default function AcademyPage() {
  const {locale}=useI18n();const completed=useStore(s=>s.academyCompleted);
  return <main className="axis-route axis-academy"><PageHeader title="Chess Academy" description={locale==='fr'?"Un programme autonome, disponible sans importer de parties. Les nouvelles leçons sont en anglais." : "A standalone curriculum. Start immediately, with or without a game history."} actions={<Link className="axis-button secondary" href="/training">{locale==='fr'?'Pratique et recommandations':'Practice & recommendations'}</Link>}/>
    <p className="axis-muted">{locale==='fr'?'Étude enregistrée':'Study recorded'}: {completed.length} / {ACADEMY.length}. {locale==='fr'?'Lire une leçon ne prouve pas la maîtrise.':'Reading a lesson does not establish mastery.'}</p>
    <ol className="axis-academy-index">{ACADEMY.map((lesson,index)=><li key={lesson.id}><span className="axis-academy-number">{String(index+1).padStart(2,'0')}</span><div><p className="axis-muted">{lesson.area} · {lesson.level}</p><Link href={`/academy/${lesson.id}`}><h2>{lesson.title}</h2></Link><p>{lesson.content.concept}</p></div><span>{completed.includes(lesson.id)?locale==='fr'?'Lu':'Studied':'↗'}</span></li>)}</ol>
  </main>;
}
