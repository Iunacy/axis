"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import Monolith from "./Monolith";
import Instrument from "./Instrument";
import Editorial from "./Editorial";

export type Direction = "monolith" | "instrument" | "editorial";
export type View = "landing" | "dashboard" | "analysis";

const names: Record<Direction, string> = {
  monolith: "Monolith",
  instrument: "Instrument",
  editorial: "Editorial intelligence",
};
const directions: Direction[] = ["monolith", "instrument", "editorial"];
const views: View[] = ["landing", "dashboard", "analysis"];
const toneEvent = "axis-lab-tone-change";

function defaultTone(direction: Direction): "light" | "dark" {
  return direction === "editorial" ? "light" : "dark";
}

function subscribeToTone(listener: () => void) {
  window.addEventListener(toneEvent, listener);
  return () => window.removeEventListener(toneEvent, listener);
}

function storedTone(direction: Direction): "light" | "dark" {
  const saved = window.sessionStorage.getItem(`axis-lab-tone-${direction}`);
  return saved === "light" || saved === "dark" ? saved : defaultTone(direction);
}

export default function LabPrototype({
  direction,
  view,
}: {
  direction: Direction;
  view: View;
}) {
  const tone = useSyncExternalStore(
    subscribeToTone,
    () => storedTone(direction),
    () => defaultTone(direction),
  );
  function toggleTone() {
    const next = tone === "dark" ? "light" : "dark";
    window.sessionStorage.setItem(`axis-lab-tone-${direction}`, next);
    window.dispatchEvent(new Event(toneEvent));
  }
  return (
    <main className={`axis-lab lab-${direction}`} data-tone={tone}>
      <div className="lab-prototype-bar" aria-label="Design lab controls">
        <Link href="/design-lab" className="lab-prototype-home">
          ← AXIS LAB
        </Link>
        <span className="lab-prototype-marker">
          CONCEPT / {names[direction]}
        </span>
        <nav aria-label="Compare concepts">
          {directions.map((item) => (
            <Link
              key={item}
              href={`/design-lab/${item}/${view}`}
              aria-current={direction === item ? "page" : undefined}
            >
              {names[item]}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          onClick={toggleTone}
          aria-label={`Preview ${tone === "dark" ? "light" : "dark"} mode`}
        >
          {tone === "dark" ? "◐ Light" : "◑ Dark"}
        </button>
      </div>
      <div
        className="lab-prototype-views"
        role="navigation"
        aria-label="Concept screens"
      >
        {views.map((item) => (
          <Link
            key={item}
            href={`/design-lab/${direction}/${item}`}
            aria-current={view === item ? "page" : undefined}
          >
            {item}
          </Link>
        ))}
      </div>
      <div className="lab-concept-canvas" key={`${direction}-${view}`}>
        {direction === "monolith" ? (
          <Monolith view={view} />
        ) : direction === "instrument" ? (
          <Instrument view={view} />
        ) : (
          <Editorial view={view} />
        )}
      </div>
    </main>
  );
}
