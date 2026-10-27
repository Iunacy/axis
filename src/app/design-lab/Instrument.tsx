"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import FixtureBoard from "./FixtureBoard";
import {
  FIXTURE_LABEL,
  moments,
  notation,
  positions,
  sampleSignals,
} from "./fixture";
import type { View } from "./LabPrototype";

const phases = [
  {
    name: "Opening",
    interval: "01—14",
    signal: "Establishing the center",
    firstPly: 1,
    lastPly: 28,
  },
  {
    name: "Middlegame",
    interval: "15—20",
    signal: "Material versus initiative",
    firstPly: 29,
    lastPly: 40,
  },
  {
    name: "Finish",
    interval: "21—23",
    signal: "The mating sequence",
    firstPly: 41,
    lastPly: 45,
  },
] as const;

function InstrumentHeader() {
  return (
    <header className="inst-header">
      <Link href="/design-lab/instrument/landing" className="inst-brand">
        AXIS<span> / INSTRUMENT</span>
      </Link>
      <span>DECISION SYSTEM / FIELD STUDY</span>
      <span className="inst-live">
        <i /> HISTORICAL GAME LOADED
      </span>
    </header>
  );
}
function InstrumentRail() {
  return (
    <nav className="inst-rail" aria-label="Instrument navigation">
      <Link href="/design-lab/instrument/landing" title="Overview">
        A
      </Link>
      <Link href="/design-lab/instrument/dashboard" title="Signals">
        ≋
      </Link>
      <Link href="/design-lab/instrument/analysis" title="Analysis">
        ⌖
      </Link>
      <span>AX / 02</span>
    </nav>
  );
}
function PhaseTrace({ selected }: { selected: number }) {
  const { firstPly, lastPly, name } = phases[selected];
  const plies = Array.from(
    { length: lastPly - firstPly + 1 },
    (_, index) => firstPly + index,
  );
  return (
    <div
      className="inst-trace"
      role="img"
      aria-label={`${name}: each tick is one recorded move; taller ticks are positions marked for study`}
    >
      <div className="inst-trace-line" />
      {plies.map((ply, index) => (
        <span
          className={
            moments.some((moment) => moment.ply === ply) ? "major" : ""
          }
          key={ply}
          style={{
            left: `${(index / Math.max(1, plies.length - 1)) * 98}%`,
            animationDelay: `${Math.min(index * 25, 420)}ms`,
          }}
        />
      ))}
    </div>
  );
}

export default function Instrument({ view }: { view: View }) {
  const [phase, setPhase] = useState(1);
  const [incident, setIncident] = useState<number | null>(1);
  const [ply, setPly] = useState(35);
  const activeMoveRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (view !== "analysis") return;
    activeMoveRef.current?.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [ply, view]);
  const activeMoment =
    incident === null
      ? phase === 0
        ? {
            ply: 15,
            title: "Establishing the center",
            note: "The opening channel starts with recorded moves. This position follows 8.Nh4; later marked decisions occur in the middlegame.",
          }
        : {
            ply: 43,
            title: "The mating sequence",
            note: "After 22.Qf6+, the recorded game is close to its conclusion. Step through the line in the analysis workspace.",
          }
      : moments[incident];
  if (view === "landing")
    return (
      <div className="inst-page">
        <InstrumentHeader />
        <InstrumentRail />
        <section className="inst-landing">
          <div className="inst-landing-top">
            <span>AXIS / DECISION INSTRUMENT</span>
            <span>01 / CALIBRATE WHAT YOU SEE</span>
          </div>
          <div className="inst-landing-grid">
            <div>
              <h1>
                The result is
                <br />
                one reading.
                <br />
                <em>
                  The decisions
                  <br />
                  are the signal.
                </em>
              </h1>
              <p>
                AXIS connects the moves in your games to the decisions you can
                practice. The interface is built for careful inspection, not a
                score to chase.
              </p>
              <Link
                className="inst-action"
                href="/design-lab/instrument/dashboard"
              >
                Open instrument <span>↗</span>
              </Link>
            </div>
            <div className="inst-landing-display">
              <div className="inst-display-head">
                <span>GAME TRACE / IMMORTAL GAME</span>
                <span>45 PLIES</span>
              </div>
              <div className="inst-landing-channels">
                {phases.map((item, index) => (
                  <button
                    type="button"
                    key={item.name}
                    className={phase === index ? "is-active" : ""}
                    onClick={() => setPhase(index)}
                  >
                    <span>CH–0{index + 1}</span>
                    <strong>{item.name}</strong>
                    <small>{item.interval}</small>
                    <PhaseTrace selected={index} />
                  </button>
                ))}
              </div>
              <div className="inst-display-reading" key={phase}>
                <span>SELECTED CHANNEL</span>
                <strong>{phases[phase].signal}</strong>
                <p>
                  {phase === 1
                    ? "Inspect how a material decision leads into a tactical sequence."
                    : "Inspect recorded moves in context. This preview does not claim engine evaluation."}
                </p>
              </div>
            </div>
          </div>
          <div className="inst-landing-foot">{FIXTURE_LABEL}</div>
        </section>
      </div>
    );
  if (view === "dashboard")
    return (
      <div className="inst-page">
        <InstrumentHeader />
        <InstrumentRail />
        <div className="inst-fixture">
          {FIXTURE_LABEL} · SIGNAL COUNTS ARE ILLUSTRATIVE
        </div>
        <div className="inst-dashboard">
          <section className="inst-fingerprint">
            <div className="inst-section-head">
              <span>01 / DECISION MAP</span>
              <span>SELECT A CHANNEL</span>
            </div>
            <h1>
              Where the game
              <br />
              changes shape.
            </h1>
            <p>
              Each tick is a recorded move; tall ticks are marked positions.
              Switch phases to inspect a position and the next question.
            </p>
            <div className="inst-channel-list">
              {phases.map((item, index) => (
                <button
                  type="button"
                  key={item.name}
                  className={phase === index ? "is-active" : ""}
                  onClick={() => {
                    setPhase(index);
                    setIncident(index === 1 ? 1 : null);
                  }}
                >
                  <span>
                    0{index + 1}
                    <br />
                    {item.interval}
                  </span>
                  <strong>{item.name}</strong>
                  <PhaseTrace selected={index} />
                  <span>{index === phase ? "ACTIVE" : "INSPECT"}</span>
                </button>
              ))}
            </div>
            <div className="inst-signal-bottom">
              <span>ILLUSTRATIVE TRAINING THEMES</span>
              {sampleSignals.map((signal) => (
                <div key={signal.label}>
                  <strong>{signal.count.toString().padStart(2, "0")}</strong>
                  <span>{signal.label}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="inst-inspection">
            <div className="inst-section-head">
              <span>02 / SELECTED POSITION</span>
              <span>{notation(activeMoment.ply)}</span>
            </div>
            <div className="inst-inspection-board">
              <FixtureBoard ply={activeMoment.ply} compact />
            </div>
            <h2>{activeMoment.title}</h2>
            <p>{activeMoment.note}</p>
            <Link
              href="/design-lab/instrument/analysis"
              className="inst-action"
            >
              Inspect recorded line <span>↗</span>
            </Link>
          </section>
          <aside className="inst-queue">
            <div className="inst-section-head">
              <span>03 / POSITION QUEUE</span>
              <span>04</span>
            </div>
            {moments.map((item, index) => (
              <button
                type="button"
                className={incident === index ? "is-active" : ""}
                onClick={() => {
                  setIncident(index);
                  setPhase(1);
                }}
                key={item.ply}
              >
                <small>{notation(item.ply)}</small>
                <strong>{item.title}</strong>
                <span>
                  {index === incident ? "↖ IN FOCUS" : "SELECT POSITION"}
                </span>
              </button>
            ))}
            <div className="inst-queue-foot">
              Training recommendation would use actual analyzed issues when
              connected to the player’s library.
            </div>
          </aside>
        </div>
      </div>
    );
  return (
    <div className="inst-page">
      <InstrumentHeader />
      <InstrumentRail />
      <div className="inst-fixture">
        {FIXTURE_LABEL} · RECORDED MOVES, EXPLORABLE BOARD
      </div>
      <div className="inst-analysis">
        <aside className="inst-analysis-left">
          <span>MOVE RECORD / 1851</span>
          <h1>
            Anderssen
            <br />— Kieseritzky
          </h1>
          <div className="inst-move-stack">
            {positions.slice(1).map((position) => (
              <button
                type="button"
                key={position.ply}
                ref={position.ply === ply ? activeMoveRef : undefined}
                onClick={() => setPly(position.ply)}
                className={position.ply === ply ? "is-active" : ""}
              >
                <span>{String(position.ply).padStart(2, "0")}</span>
                <strong>{notation(position.ply)}</strong>
                <span>
                  {position.from} → {position.to}
                </span>
              </button>
            ))}
          </div>
        </aside>
        <section className="inst-analysis-center">
          <div className="inst-section-head">
            <span>POSITION / {String(ply).padStart(2, "0")}</span>
            <span>LIVE LEGAL-MOVE EXPLORATION</span>
          </div>
          <FixtureBoard ply={ply} explore />
          <div className="inst-analysis-step">
            <button
              type="button"
              onClick={() => setPly((value) => Math.max(0, value - 1))}
              disabled={ply === 0}
            >
              ←
            </button>
            <span>{notation(ply)}</span>
            <button
              type="button"
              onClick={() => setPly((value) => Math.min(45, value + 1))}
              disabled={ply === 45}
            >
              →
            </button>
          </div>
        </section>
        <aside className="inst-analysis-right">
          <span>CONTEXT / RECORDED LINE</span>
          <h2>
            {moments.find((item) => item.ply === ply)?.title ??
              "Inspect the decision."}
          </h2>
          <p>
            {moments.find((item) => item.ply === ply)?.note ??
              "Use the move record to inspect each position. Board moves open a legal variation and can be reset to the recorded line."}
          </p>
          <div className="inst-phase-map">
            <span>PHASE MAP</span>
            {phases.map((item, index) => (
              <button
                type="button"
                key={item.name}
                className={phase === index ? "is-active" : ""}
                onClick={() => {
                  setPhase(index);
                  setPly(index === 0 ? 15 : index === 1 ? 35 : 43);
                }}
              >
                <span>0{index + 1}</span>
                <strong>{item.name}</strong>
                <small>{item.interval}</small>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
