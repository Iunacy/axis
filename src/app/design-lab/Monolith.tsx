"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import FixtureBoard from "./FixtureBoard";
import { FIXTURE_LABEL, moments, notation, positions } from "./fixture";
import type { View } from "./LabPrototype";

function MonoNav() {
  return (
    <header className="mono-nav">
      <Link href="/design-lab/monolith/landing">
        AXIS<span> / MONOLITH</span>
      </Link>
      <span>INTELLIGENCE, GIVEN FORM</span>
      <nav>
        <Link href="/design-lab/monolith/dashboard">Briefing</Link>
        <Link href="/design-lab/monolith/analysis">Game study</Link>
      </nav>
    </header>
  );
}

export default function Monolith({ view }: { view: View }) {
  const [reveal, setReveal] = useState(false);
  const [momentIndex, setMomentIndex] = useState(1);
  const [ply, setPly] = useState(35);
  const moment = moments[momentIndex];
  if (view === "landing")
    return (
      <div className="mono-page">
        <MonoNav />
        <section className={`mono-landing ${reveal ? "is-revealed" : ""}`}>
          <div className="mono-landing-copy">
            <p className="mono-index">AXIS / THE STUDY OF DECISIONS</p>
            <h1>
              Every move
              <br />
              has a <em>before</em>
              <br />
              and an after.
            </h1>
            <p>
              The result is only the surface. AXIS follows the choices that
              shaped it, so the next position feels different.
            </p>
            <button
              type="button"
              className="mono-action"
              onClick={() => setReveal((value) => !value)}
            >
              {reveal ? "Close the trace" : "Trace a decision"}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
          <div className="mono-orbit-stage">
            <Image
              src="/media/axis-orbital-titanium.png"
              alt="Brushed metal bands converging around a central axis"
              width={1254}
              height={1254}
              priority
            />
            <div className="mono-orbit-cross" />
            <div className="mono-orbit-label">INTERSECTION / 18.Bd6</div>
          </div>
          <div className="mono-reveal-panel" aria-live="polite">
            <span>RECORDED POSITION / IMMORTAL GAME</span>
            <strong>18.Bd6</strong>
            <p>
              The bishop enters d6 while the queen remains exposed. Watch how
              the next three moves redefine the board.
            </p>
            <Link href="/design-lab/monolith/analysis">
              Open game study <span>↗</span>
            </Link>
          </div>
          <div className="mono-landing-baseline">
            <span>01 / SEE THE POSITION</span>
            <span>02 / TRACE THE CHOICE</span>
            <span>03 / PRACTICE THE PATTERN</span>
          </div>
        </section>
      </div>
    );
  if (view === "dashboard")
    return (
      <div className="mono-page">
        <MonoNav />
        <div className="mono-fixture">
          {FIXTURE_LABEL} · ILLUSTRATIVE INSIGHT VIEW
        </div>
        <section className="mono-briefing">
          <div className="mono-briefing-story" key={moment.ply}>
            <p className="mono-index">
              DECISION BRIEF / {notation(moment.ply)}
            </p>
            <h1>
              {moment.title}
              <span>.</span>
            </h1>
            <p>{moment.note}</p>
            <Link className="mono-action" href="/design-lab/monolith/analysis">
              Study this position <span>↗</span>
            </Link>
            <div className="mono-briefing-context">
              <span>PERFORMANCE</span>
              <strong>Trace where the initiative changed</strong>
              <p>
                Example analysis of one historical game. A player’s own games
                would replace this fixture after import and analysis.
              </p>
            </div>
          </div>
          <div className="mono-briefing-stage">
            <span className="mono-stage-axis">A / X</span>
            <div className="mono-stage-ring" aria-hidden="true">
              <Image
                src="/media/axis-orbital-titanium.png"
                alt=""
                width={1254}
                height={1254}
              />
            </div>
            <div className="mono-stage-board">
              <FixtureBoard ply={moment.ply} compact />
            </div>
            <span className="mono-stage-coordinate">
              {positions[moment.ply].from} → {positions[moment.ply].to}
            </span>
          </div>
        </section>
        <div className="mono-moment-rail" aria-label="Select a critical moment">
          {moments.map((item, index) => (
            <button
              type="button"
              key={item.ply}
              className={index === momentIndex ? "is-active" : ""}
              onClick={() => setMomentIndex(index)}
            >
              <small>
                0{index + 1} / {notation(item.ply)}
              </small>
              <span>{item.title}</span>
              <i />
            </button>
          ))}
        </div>
      </div>
    );
  return (
    <div className="mono-page">
      <MonoNav />
      <div className="mono-fixture">
        {FIXTURE_LABEL} · RECORDED MOVES, EXPLORABLE BOARD
      </div>
      <div className="mono-analysis">
        <div className="mono-analysis-board">
          <span className="mono-analysis-watermark">
            {String(Math.ceil(ply / 2)).padStart(2, "0")}
          </span>
          <FixtureBoard ply={ply} explore />
          <div className="mono-analysis-controls">
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
        </div>
        <div className="mono-analysis-notes">
          <p className="mono-index">
            POSITION / {String(ply).padStart(2, "0")} OF 45
          </p>
          <h1>
            {moments.find((item) => item.ply === ply)?.title ??
              "Read the position."}
          </h1>
          <p>
            {moments.find((item) => item.ply === ply)?.note ??
              "Step through the recorded Immortal Game. Select a piece on the board to explore a legal continuation."}
          </p>
          <div className="mono-analysis-moves" aria-label="Recorded move list">
            {positions.slice(1).map((position) => (
              <button
                type="button"
                key={position.ply}
                className={ply === position.ply ? "is-active" : ""}
                onClick={() => setPly(position.ply)}
              >
                {notation(position.ply)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
