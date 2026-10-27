"use client";

import Link from "next/link";
import { useState } from "react";
import FixtureBoard from "./FixtureBoard";
import { FIXTURE_LABEL, moments, notation, positions } from "./fixture";
import type { View } from "./LabPrototype";

const chapters = [
  {
    title: "The material question",
    kicker: "01 / THE SETUP",
    ply: 34,
    text: "After 17...Qxb2, the queen has taken a pawn. The board asks a more interesting question: what can White do with the time this creates?",
  },
  {
    title: "The initiative",
    kicker: "02 / THE TURN",
    ply: 35,
    text: "18.Bd6 places the bishop on a powerful diagonal. Read the move beside the board, then follow the reply in the recorded game.",
  },
  {
    title: "The final sequence",
    kicker: "03 / THE CONSEQUENCE",
    ply: 43,
    text: "The last moves narrow the choices. This is a recorded sequence, offered here as a study in how one decision leads to the next.",
  },
] as const;

function EditorialHeader() {
  return (
    <header className="edit-header">
      <Link className="edit-brand" href="/design-lab/editorial/landing">
        AXIS<span>®</span>
      </Link>
      <span className="edit-publication">
        A journal of decisions / Issue 001
      </span>
      <nav aria-label="Editorial navigation">
        <Link href="/design-lab/editorial/dashboard">Read the briefing</Link>
        <Link href="/design-lab/editorial/analysis">Open the study</Link>
      </nav>
    </header>
  );
}

export default function Editorial({ view }: { view: View }) {
  const [chapter, setChapter] = useState(1);
  const [ply, setPly] = useState(35);
  const selected = chapters[chapter];
  const activeMoment = moments.find((item) => item.ply === ply);

  if (view === "landing")
    return (
      <div className="edit-page">
        <EditorialHeader />
        <div className="edit-issue-line">
          <span>INTRODUCING AXIS</span>
          <span>DECISIONS / EXPLANATIONS / PRACTICE</span>
          <span>01 — 03</span>
        </div>
        <section className="edit-cover">
          <div className="edit-cover-copy">
            <p className="edit-eyebrow">CHESS IS A SERIES OF CHOICES.</p>
            <h1>
              Read your
              <br />
              game <em>differently.</em>
            </h1>
            <p className="edit-intro">
              AXIS turns a game record into a study of decisions: the positions
              that mattered, the ideas behind them, and what to examine next.
            </p>
            <Link
              className="edit-text-link"
              href="/design-lab/editorial/dashboard"
            >
              Enter the first issue <span>↗</span>
            </Link>
          </div>
          <div className="edit-cover-plate">
            <div className="edit-plate-top">
              <span>PLATE 01 / IMMORTAL GAME</span>
              <span>1851</span>
            </div>
            <FixtureBoard ply={selected.ply} compact />
            <div className="edit-plate-caption">
              <span>{notation(selected.ply)}</span>
              <strong>{selected.title}</strong>
            </div>
          </div>
          <div className="edit-cover-deco">
            A study
            <br />
            in three
            <br />
            decisions.
          </div>
        </section>
        <div className="edit-chapter-strip" aria-label="Explore story chapters">
          {chapters.map((item, index) => (
            <button
              type="button"
              key={item.title}
              className={chapter === index ? "is-active" : ""}
              onClick={() => setChapter(index)}
            >
              <span>{item.kicker}</span>
              <strong>{item.title}</strong>
              <small>{notation(item.ply)} ↗</small>
            </button>
          ))}
        </div>
        <div className="edit-fixture">
          {FIXTURE_LABEL} · CHAPTERS ARE A DESIGN PREVIEW
        </div>
      </div>
    );

  if (view === "dashboard")
    return (
      <div className="edit-page">
        <EditorialHeader />
        <div className="edit-issue-line">
          <span>THE BRIEFING</span>
          <span>{FIXTURE_LABEL}</span>
          <span>01 / 03</span>
        </div>
        <div className="edit-briefing">
          <aside className="edit-folio-rail">
            <span>CONTENTS</span>
            {chapters.map((item, index) => (
              <button
                type="button"
                key={item.title}
                className={chapter === index ? "is-active" : ""}
                onClick={() => setChapter(index)}
              >
                <small>0{index + 1}</small>
                <strong>{item.title}</strong>
              </button>
            ))}
            <span className="edit-rail-note">
              In a connected library, these chapters would be assembled from the
              player’s analyzed games.
            </span>
          </aside>
          <article className="edit-lead" key={chapter}>
            <div className="edit-lead-meta">
              <span>THE DECISION JOURNAL</span>
              <span>{selected.kicker}</span>
            </div>
            <h1>
              {selected.title}
              <span>.</span>
            </h1>
            <p>{selected.text}</p>
            <blockquote>
              “The result tells you what happened. The position shows you what
              was possible.”
            </blockquote>
            <Link
              className="edit-text-link"
              href="/design-lab/editorial/analysis"
            >
              Study the recorded line <span>↗</span>
            </Link>
            <div className="edit-lead-foot">
              <span>POSITION / {notation(selected.ply)}</span>
              <span>READING TIME / ~1 MIN</span>
            </div>
          </article>
          <aside className="edit-dossier">
            <div className="edit-dossier-top">
              <span>POSITION DOSSIER</span>
              <span>01 — 03</span>
            </div>
            <FixtureBoard ply={selected.ply} compact />
            <div className="edit-dossier-caption">
              <span>{notation(selected.ply)}</span>
              <strong>{selected.title}</strong>
              <p>Choose a chapter to move the board and follow the story.</p>
            </div>
          </aside>
        </div>
        <div className="edit-bottom-index">
          <span>WHAT AXIS WOULD CONNECT</span>
          <div>
            <strong>01</strong>
            <span>Recurring choices across analyzed games</span>
          </div>
          <div>
            <strong>02</strong>
            <span>Positions where the pattern appears</span>
          </div>
          <div>
            <strong>03</strong>
            <span>A practice session justified by those positions</span>
          </div>
        </div>
      </div>
    );

  return (
    <div className="edit-page">
      <EditorialHeader />
      <div className="edit-issue-line">
        <span>THE GAME STUDY</span>
        <span>{FIXTURE_LABEL}</span>
        <span>1851 / LONDON</span>
      </div>
      <div className="edit-analysis">
        <aside className="edit-analysis-chapters">
          <span>THE RECORD</span>
          <h1>
            Every choice
            <br />
            has a context.
          </h1>
          <p>
            The Immortal Game is a historical development fixture. Browse its
            recorded moves; use the board to try legal continuations.
          </p>
          <div className="edit-analysis-jumps">
            {chapters.map((item) => (
              <button
                type="button"
                key={item.title}
                onClick={() => setPly(item.ply)}
                className={ply === item.ply ? "is-active" : ""}
              >
                <span>{notation(item.ply)}</span>
                <strong>{item.title}</strong>
                <span>↗</span>
              </button>
            ))}
          </div>
        </aside>
        <section className="edit-analysis-board">
          <div className="edit-board-head">
            <span>PLATE / {String(ply).padStart(2, "0")}</span>
            <span>ANDERSSEN — KIESERITZKY</span>
          </div>
          <FixtureBoard ply={ply} explore />
          <div className="edit-analysis-step">
            <button
              type="button"
              onClick={() => setPly((value) => Math.max(0, value - 1))}
              disabled={ply === 0}
            >
              ← Previous
            </button>
            <strong>{notation(ply)}</strong>
            <button
              type="button"
              onClick={() =>
                setPly((value) => Math.min(positions.length - 1, value + 1))
              }
              disabled={ply === positions.length - 1}
            >
              Next →
            </button>
          </div>
        </section>
        <aside className="edit-analysis-margin">
          <span>NOTES ON THE POSITION</span>
          <h2>{activeMoment?.title ?? "Follow the line."}</h2>
          <p>
            {activeMoment?.note ??
              "The board follows the recorded game. The note changes at a marked decision; other positions remain open for exploration."}
          </p>
          <div className="edit-move-index">
            <span>MOVE INDEX</span>
            <div>
              {positions.slice(1).map((position) => (
                <button
                  type="button"
                  key={position.ply}
                  onClick={() => setPly(position.ply)}
                  className={ply === position.ply ? "is-active" : ""}
                >
                  {notation(position.ply)}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
