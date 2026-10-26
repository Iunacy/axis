"use client";

import type { PositionEval } from "./analysis";

/**
 * Thin UCI wrapper around a Stockfish WASM worker served from /stockfish/.
 * The postinstall script (scripts/copy-stockfish.mjs) copies a single-threaded
 * build there and writes manifest.json with the entry filename.
 * Single-threaded build = no COOP/COEP headers needed.
 */
export class Engine {
  private worker: Worker | null = null;
  private ready = false;
  private pendingReject: ((error: Error) => void) | null = null;

  async init(hashMb = 32): Promise<void> {
    if (this.ready) return;
    if (typeof Worker === "undefined" || typeof WebAssembly === "undefined") throw new Error("This browser cannot run Stockfish. Try a current browser with WebAssembly support.");
    const response = await fetch("/stockfish/manifest.json", { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Stockfish is unavailable. Reconnect and try again.");
    const manifest = await response.json();
    this.worker = new Worker(`/stockfish/${manifest.js}`);
    await this.send("uci", (line) => line === "uciok");
    await this.send("setoption name Threads value 1");
    await this.send(`setoption name Hash value ${Math.max(16, Math.round(hashMb))}`);
    await this.send("isready", (line) => line === "readyok");
    this.ready = true;
  }

  private send(cmd: string, until?: (line: string) => boolean): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const w = this.worker!;
      if (!until) {
        w.postMessage(cmd);
        resolve([]);
        return;
      }
      const lines: string[] = [];
      const cleanup = () => {
        clearTimeout(timer);
        w.removeEventListener("message", onMsg);
        w.removeEventListener("error", onError);
        this.pendingReject = null;
      };
      const fail = (error: Error) => { cleanup(); reject(error); };
      const onError = () => fail(new Error("Stockfish stopped. Close other tabs and retry with fast analysis."));
      const timer = setTimeout(() => fail(new Error("Stockfish timed out. Retry with fast analysis.")), 45000);
      this.pendingReject = fail;
      w.addEventListener("error", onError);
      const onMsg = (e: MessageEvent) => {
        const line = typeof e.data === "string" ? e.data : "";
        lines.push(line);
        if (until(line)) {
          cleanup();
          resolve(lines);
        }
      };
      w.addEventListener("message", onMsg);
      w.postMessage(cmd);
    });
  }

  /** Evaluate a FEN. Returns eval from White's POV. */
  async evaluate(fen: string, movetimeMs: number): Promise<PositionEval> {
    if (!this.ready) await this.init();
    await this.send("position fen " + fen);
    const lines = await this.send(`go movetime ${movetimeMs}`, (l) => l.startsWith("bestmove"));

    const sideToMove = fen.split(" ")[1] === "w" ? 1 : -1;
    let cp: number | null = null;
    let pv: string[] = [];
    for (const line of lines) {
      if (!line.startsWith("info") || !line.includes(" score ")) continue;
      const mMate = line.match(/score mate (-?\d+)/);
      const mCp = line.match(/score cp (-?\d+)/);
      if (mMate) {
        const n = parseInt(mMate[1], 10);
        cp = (n > 0 ? 10000 - Math.abs(n) : -10000 + Math.abs(n)) * 1;
      } else if (mCp) {
        cp = parseInt(mCp[1], 10);
      }
      const mPv = line.match(/ pv (.+)$/);
      if (mPv) pv = mPv[1].trim().split(/\s+/);
    }
    const best = lines.find((l) => l.startsWith("bestmove"))?.split(/\s+/)[1] ?? null;

    if (cp === null) {
      const { Chess } = await import("chess.js");
      const position = new Chess(fen);
      if (position.isCheckmate()) cp = -10000;
      else if (position.isDraw()) cp = 0;
      else throw new Error("Stockfish returned no evaluation. Please retry analysis.");
    }
    return {
      cpWhite: cp * sideToMove,
      bestUci: best && best !== "(none)" ? best : null,
      pvUci: pv,
    };
  }

  destroy() {
    this.pendingReject?.(new Error("Analysis cancelled."));
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
  }
}
