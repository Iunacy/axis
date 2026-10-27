"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, Menu, X } from "lucide-react";
import { useState } from "react";
import Logo from "@/components/Logo";
import AxisSculpture from "@/components/AxisSculpture";
import AppearanceControl from "@/components/AppearanceControl";
import { useI18n } from "@/lib/i18n";

export default function LandingPage() {
  const { locale } = useI18n();
  const fr = locale === "fr";
  const [menu, setMenu] = useState(false);
  const steps = fr ? [
    { title: "Vos parties. Le point de départ.", text: "Importez vos parties de Chess.com, Lichess ou un fichier PGN. Votre historique devient votre programme d’entraînement.", detail: "Chess.com · Lichess · PGN" },
    { title: "La décision qui change tout.", text: "Stockfish repère les moments critiques. Revenez sur vos choix, explorez les variantes et trouvez une meilleure suite.", detail: "Analyse Stockfish dans votre navigateur" },
    { title: "La prochaine fois, voyez-le.", text: "Transformez vos erreurs en exercices ciblés. Pratiquez vos faiblesses et retrouvez-les grâce aux révisions espacées.", detail: "Exercices personnels · Révisions espacées" },
  ] : [
    { title: "Your games. Your starting point.", text: "Bring your games from Chess.com, Lichess, or a PGN file. Your own decisions become the material for your improvement.", detail: "Chess.com · Lichess · PGN" },
    { title: "Find the moment that mattered.", text: "Stockfish identifies the turning points. Revisit your decisions, explore the continuation, and find a stronger move.", detail: "Stockfish analysis, in your browser" },
    { title: "See it next time.", text: "Turn missed opportunities into focused exercises. Practice your recurring weaknesses and revisit them with spaced reviews.", detail: "Personal exercises · Spaced practice" },
  ];
  return <main className="axis-landing">
    <header className="axis-site-nav">
      <Link href="/" className="axis-site-brand" aria-label="AXIS home"><Logo className="size-8"/><span>AXIS</span></Link>
      <button className="axis-site-menu" aria-label={fr ? "Menu de navigation" : "Navigation menu"} aria-expanded={menu} aria-controls="site-links" onClick={() => setMenu(!menu)}>{menu ? <X size={22}/> : <Menu size={22}/>}</button>
      <nav id="site-links" className={menu ? "is-open" : ""} aria-label={fr ? "Navigation principale" : "Main navigation"}>
        <a href="#method" onClick={() => setMenu(false)}>{fr ? "La méthode" : "The method"}</a>
        <Link href="/masters">{fr ? "Étudier" : "Study"}</Link>
        <AppearanceControl/>
        <Link href="/dashboard" className="axis-site-enter">{fr ? "Ouvrir AXIS" : "Open workspace"}<ArrowUpRight size={16}/></Link>
      </nav>
    </header>
    <section className="axis-hero" aria-labelledby="hero-heading">
      <div className="axis-hero-copy"><span className="axis-hero-index" aria-hidden="true">AXIS / 01</span><h1 id="hero-heading">{fr ? <><span>Chaque coup</span><span>laisse une trace.</span></> : <><span>Every move</span><span>leaves a pattern.</span></>}</h1><p>{fr ? "Comprenez vos décisions. Entraînez ce qui compte." : "Understand your decisions. Train what matters."}</p>
        <Link href="/dashboard" className="axis-button axis-hero-cta">{fr ? "Analyser mes parties" : "Analyze your games"}<ArrowUpRight size={19}/></Link>
      </div>
      <AxisSculpture/>
      <div className="axis-hero-geometry" aria-hidden="true"><span>ORBITAL / 45°</span><i/></div>
      <div className="axis-hero-caption"><span>{fr ? "L’intelligence de votre jeu." : "Intelligence for your game."}</span><a href="#method">{fr ? "Explorer la méthode" : "Explore the method"}<ArrowDownRight size={17}/></a><span>{fr ? "Privé par conception" : "Private by design"}</span></div>
    </section>
    <section id="method" className="axis-method" aria-labelledby="method-heading">
      <div className="axis-method-intro"><h2 id="method-heading">{fr ? <>Moins de bruit.<br/>Plus de perspective.</> : <>Less noise.<br/>More insight.</>}</h2><p>{fr ? "Pas un autre score à poursuivre. Un regard précis sur votre façon de jouer, et un chemin pour progresser." : "Beyond another score to chase. A closer look at how you play, and a clear path to getting better."}</p></div>
      <div className="axis-method-steps">{steps.map((step, i) => <article key={step.title}><span className="axis-step-index">0{i + 1}</span><div><h3>{step.title}</h3><p>{step.text}</p><span className="axis-method-detail">{step.detail}</span></div><ArrowUpRight aria-hidden="true" size={23}/></article>)}</div>
    </section>
    <section className="axis-workspace-story">
      <div className="axis-story-title"><h2>{fr ? <>Toute votre attention.<br/>Sur le bon coup.</> : <>A clearer view.<br/>A stronger move.</>}</h2><p>{fr ? "Un espace d’analyse conçu pour réfléchir. L’échiquier au centre, l’essentiel à portée de main." : "An analysis workspace built for thinking. The board at the center, the details within reach."}</p><Link href="/masters" className="axis-link">{fr ? "Explorer une partie de maître" : "Explore a master game"}<ArrowUpRight size={16}/></Link></div>
      <div className="axis-position-study" aria-label={fr ? "Diagramme de la fourchette de cavalier" : "Illustrative knight fork diagram"}><div className="axis-study-top"><span>{fr ? "Étude de motif" : "Pattern study"}</span><span>{fr ? "Fourchette" : "Knight fork"}</span></div><svg viewBox="0 0 480 290" fill="none" role="img" aria-label={fr ? "Un cavalier attaque deux cibles" : "A knight attacks two targets"}><defs><pattern id="study-grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="currentColor" strokeOpacity=".14"/></pattern></defs><rect x="48" y="24" width="384" height="240" fill="url(#study-grid)"/><path d="m240 216-96-144m96 144 96-144" stroke="var(--signature)" strokeWidth="1.5" strokeDasharray="5 5"/><circle cx="240" cy="216" r="27" fill="var(--signature)"/><path d="m228 228 2-11 8-12-2-6 11 5 7 15v9h-26Zm2 5h25" stroke="var(--signature-ink)" strokeWidth="3" strokeLinejoin="round"/><rect x="121" y="49" width="46" height="46" rx="2" stroke="currentColor"/><rect x="313" y="49" width="46" height="46" rx="2" stroke="currentColor"/><path d="M144 61v22m-8-16h16M326 62h20v7h-20zm3 7v13h14V69m-17 16h20" stroke="currentColor" strokeWidth="2"/><text x="52" y="282" fill="currentColor" fontSize="11" opacity=".65">a</text><text x="388" y="282" fill="currentColor" fontSize="11" opacity=".65">h</text></svg><div className="axis-study-bottom"><span>{fr ? "Une décision. Deux menaces." : "One decision. Two threats."}</span><Check size={17}/></div></div>
    </section>
    <section className="axis-final-call"><Logo className="size-12"/><h2>{fr ? <>Votre prochain coup<br/>commence ici.</> : <>Your next move<br/>starts here.</>}</h2><div><Link href="/dashboard" className="axis-button">{fr ? "Ouvrir mon espace" : "Find your pattern"}<ArrowRight size={19}/></Link><p>{fr ? "Gratuit. Sans compte. Vos parties restent sur cet appareil." : "Free. No account. Your games stay on this device."}</p></div></section>
  </main>;
}
