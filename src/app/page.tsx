"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Board from "@/components/Board";
import { Folio } from "@/components/EditorialFrame";
import { useI18n } from "@/lib/i18n";
import { MASTER_GAMES } from "@/lib/masters-catalog";
import { parsePgn } from "@/lib/pgn";

const study = MASTER_GAMES[0];
const chapters = [
  { ply: 34, en: "The material question", fr: "La question matérielle" },
  { ply: 35, en: "The initiative", fr: "L’initiative" },
  { ply: 43, en: "The consequence", fr: "La conséquence" },
];

export default function LandingPage() {
  const { locale } = useI18n();
  const fr = locale === "fr";
  const [chapter, setChapter] = useState(1);
  const parsed = useMemo(() => parsePgn(study.pgn), []);
  const selected = chapters[chapter];
  const move = parsed?.moves[selected.ply - 1];
  const notation = move ? `${Math.ceil(selected.ply / 2)}${move.color === "w" ? "." : "..."}${move.san}` : "";
  return <main className="edit-public-page">
    <Folio label={fr ? "PRÉSENTATION / AXIS" : "INTRODUCING / AXIS"} detail={fr ? "DÉCISIONS / EXPLICATIONS / PRATIQUE" : "DECISIONS / EXPLANATIONS / PRACTICE"} number="01 — 03"/>
    <section className="edit-cover" aria-labelledby="edit-cover-title">
      <div className="edit-cover-copy">
        <p className="edit-kicker">{fr ? "LES ÉCHECS SONT UNE SUITE DE CHOIX." : "CHESS IS A SERIES OF CHOICES."}</p>
        <h1 id="edit-cover-title">{fr ? <>Lisez votre<br/>partie <em>autrement.</em></> : <>Read your<br/>game <em>differently.</em></>}</h1>
        <p className="edit-intro">{fr ? "AXIS transforme vos parties en une étude de décisions : les positions qui comptent, les idées qui les traversent et ce qu’il faut travailler ensuite." : "AXIS turns your game record into a study of decisions: the positions that mattered, the ideas behind them, and what to examine next."}</p>
        <Link className="edit-text-link" href="/dashboard">{fr ? "Ouvrir mon espace" : "Open my journal"} <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="edit-cover-plate">
        <div className="edit-plate-top"><span>PLATE 01 / {study.title.toUpperCase()}</span><span>{study.year}</span></div>
        <div className="edit-plate-board">{parsed && <Board fen={parsed.fens[selected.ply]} size="sm" showOverlayControls={false}/>}</div>
        <div className="edit-plate-caption"><span>{notation}</span><strong>{fr ? selected.fr : selected.en}</strong></div>
      </div>
      <div className="edit-cover-deco">{fr ? <>Une étude<br/>en trois<br/>décisions.</> : <>A study<br/>in three<br/>decisions.</>}</div>
    </section>
    <div className="edit-chapter-strip" aria-label={fr ? "Parcourir les chapitres" : "Explore story chapters"}>
      {chapters.map((item, index) => <button type="button" key={item.ply} className={chapter === index ? "is-active" : ""} aria-pressed={chapter === index} onClick={() => setChapter(index)}><span>0{index + 1} / {fr ? "LA PARTIE" : "THE GAME"}</span><strong>{fr ? item.fr : item.en}</strong><small>{index === chapter ? notation : "↗"}</small></button>)}
    </div>
    <div className="edit-public-note"><span>{fr ? "Partie historique / Anderssen — Kieseritzky, 1851" : "Historical study / Anderssen — Kieseritzky, 1851"}</span><Link href={`/masters/${study.id}`}>{fr ? "Étudier la partie" : "Study the game"} ↗</Link></div>
    <section className="edit-method">
      <div><span className="edit-kicker">AXIS / METHOD</span><h2>{fr ? <>Votre jeu,<br/><em>examiné.</em></> : <>Your game,<br/><em>examined.</em></>}</h2></div>
      <ol>
        <li><span>01</span><div><h3>{fr ? "Importez vos parties" : "Bring your games"}</h3><p>{fr ? "Reliez Chess.com ou Lichess, ou importez un fichier PGN." : "Connect Chess.com or Lichess, or import a PGN."}</p></div></li>
        <li><span>02</span><div><h3>{fr ? "Revenez aux décisions" : "Return to the decisions"}</h3><p>{fr ? "Stockfish examine les positions critiques directement dans le navigateur." : "Stockfish examines critical positions directly in your browser."}</p></div></li>
        <li><span>03</span><div><h3>{fr ? "Travaillez ce qui compte" : "Practice what matters"}</h3><p>{fr ? "Les positions de vos parties deviennent des exercices et des révisions." : "Positions from your games become exercises and reviews."}</p></div></li>
      </ol>
    </section>
  </main>;
}
