import { ImageResponse } from "next/og";
import { AXIS_MARK_PATH } from "./brand";

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";
export const ogAlt =
  "AXIS — Analyze. Understand. Improve.";

const BG = "#0d1016";
const ACCENT = "#c2cfdf";
const MUTED = "#a1a1aa";
const BORDER = "#27272a";

function Pill({ children }: { children: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 22px",
        borderRadius: 999,
        border: `1px solid ${BORDER}`,
        background: "rgba(255,255,255,0.02)",
        color: MUTED,
        fontSize: 26,
      }}
    >
      {children}
    </div>
  );
}

export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          padding: 72,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 92,
              height: 92,
              borderRadius: 22,
              background: "#111113",
              border: `1px solid ${BORDER}`,
            }}
          >
            <svg width="56" height="56" viewBox="0 0 32 32" fill={ACCENT}><path d={AXIS_MARK_PATH}/></svg>
          </div>
          <span style={{ fontSize: 40, fontWeight: 700, color: "#fafafa" }}>
            AXIS
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 800,
              color: "#fafafa",
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 920,
            }}
          >
            Lessons built from your own games.
          </div>
          <div style={{ display: "flex", fontSize: 32, color: MUTED, maxWidth: 880 }}>
            Import your Chess.com & Lichess games, analyze them with Stockfish in
            your browser, and train on the mistakes that actually cost you.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <Pill>Chess.com + Lichess</Pill>
            <Pill>Stockfish in-browser</Pill>
            <Pill>Learn from the masters</Pill>
            <Pill>Private · no account</Pill>
          </div>
          <div style={{ display: "flex", height: 6, gap: 8 }}>
            <div style={{ flex: 1, background: ACCENT, borderRadius: 999, display: "flex" }} />
            <div style={{ width: 80, background: BORDER, borderRadius: 999, display: "flex" }} />
            <div style={{ width: 40, background: BORDER, borderRadius: 999, display: "flex" }} />
          </div>
        </div>
      </div>
    ),
    { ...ogSize }
  );
}
