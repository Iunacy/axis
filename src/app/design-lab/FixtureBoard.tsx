"use client";

import { useState } from "react";
import Board from "@/components/Board";
import { notation, positions } from "./fixture";

export default function FixtureBoard({
  ply,
  compact = false,
  explore = false,
}: {
  ply: number;
  compact?: boolean;
  explore?: boolean;
}) {
  const [reset, setReset] = useState(0);
  const [variation, setVariation] = useState<string[]>([]);
  const position = positions[Math.max(0, Math.min(ply, positions.length - 1))];
  return (
    <div className={`lab-fixture-board ${compact ? "is-compact" : ""}`}>
      <Board
        key={`${ply}-${reset}`}
        fen={position.fen}
        size={compact ? "sm" : "lg"}
        showOverlayControls={false}
        lastMove={
          position.ply ? { from: position.from, to: position.to } : null
        }
        interactive={explore}
        onTryMove={(san) => {
          setVariation((previous) => [...previous, san]);
          return true;
        }}
      />
      {explore && (
        <div className="lab-explore-status">
          <span>
            {variation.length
              ? `Exploring: ${variation.join(" ")}`
              : `Recorded position after ${notation(ply)} · select a piece to explore`}
          </span>
          {variation.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setVariation([]);
                setReset((value) => value + 1);
              }}
            >
              Return to record
            </button>
          )}
        </div>
      )}
    </div>
  );
}
