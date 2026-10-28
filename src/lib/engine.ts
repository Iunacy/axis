"use client";

import { cachedEvaluation, cacheEvaluation, evaluationCacheEpoch } from "./evaluation-cache";
import { engineIdentity, type EngineProfile, evaluationKey, parseEngineResult, positionCommand, searchLimits, type PositionHistory, type SearchOptions } from "./engine-protocol";
import type { PositionEvaluation } from "./types";

export class Engine {
  constructor(private profile: EngineProfile = "default") {}

  private worker: Worker | null = null;
  private ready = false;
  private destroyed = false;
  private hashMb = 32;
  private initializing: Promise<void> | null = null;
  private pendingReject: ((error: Error) => void) | null = null;
  private lifecycle = new AbortController();
  private queue: Promise<unknown> = Promise.resolve();
  private pending = new Map<string, Promise<PositionEvaluation>>();

  init(hashMb = 32): Promise<void> {
    if (this.destroyed) return Promise.reject(new Error("Analysis cancelled."));
    if (this.ready) return Promise.resolve();
    if (this.initializing) return this.initializing;
    this.hashMb = Math.max(16, Math.min(128, Math.round(hashMb)));
    this.initializing = this.initialize();
    return this.initializing;
  }

  private async initialize() {
    if (typeof Worker === "undefined" || typeof WebAssembly === "undefined") throw new Error("This browser cannot run Stockfish. Try a current browser with WebAssembly support.");
    const response = await fetch("/stockfish/manifest.json", { signal: AbortSignal.any([AbortSignal.timeout(15000), this.lifecycle.signal]) });
    if (!response.ok) throw new Error("Stockfish is unavailable. Reconnect and try again.");
    const manifest = await response.json();
    const entry = this.profile === "deep" ? manifest.deep : manifest.js;
    if (manifest.version !== "19.0.1") throw new Error("Stockfish assets are outdated. Reload the app and retry.");
    if (typeof entry !== "string" || !/^stockfish-[\w.-]+\.js$/.test(entry)) throw new Error("Stockfish assets could not be verified.");
    if (this.destroyed) throw new Error("Analysis cancelled.");
    this.worker = new Worker(`/stockfish/${entry}`);
    await this.send("uci", line => line === "uciok");
    await this.send("setoption name Threads value 1");
    await this.send(`setoption name Hash value ${this.hashMb}`);
    await this.send("setoption name UCI_ShowWDL value true");
    await this.send("isready", line => line === "readyok");
    this.ready = true;
  }

  private send(cmd: string, until?: (line: string) => boolean, timeoutMs = 45000): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const worker = this.worker;
      if (!worker || this.destroyed) { reject(new Error("Analysis cancelled.")); return; }
      if (!until) { worker.postMessage(cmd); resolve([]); return; }
      const lines: string[] = [];
      const cleanup = () => { clearTimeout(timer); worker.removeEventListener("message", onMessage); worker.removeEventListener("error", onError); this.pendingReject = null; };
      const fail = (error: Error) => { cleanup(); reject(error); };
      const onError = () => fail(new Error("Stockfish stopped. Close other tabs and retry analysis."));
      const timer = setTimeout(() => fail(new Error("Stockfish timed out. Retry this position with a smaller search budget.")), timeoutMs);
      const onMessage = (event: MessageEvent) => {
        if (typeof event.data !== "string") return;
        for (const line of event.data.split(/\r?\n/)) {
          lines.push(line);
          if (until(line)) { cleanup(); resolve(lines); return; }
        }
      };
      this.pendingReject = fail;
      worker.addEventListener("error", onError);
      worker.addEventListener("message", onMessage);
      worker.postMessage(cmd);
    });
  }

  evaluate(fen: string, movetimeMs: number, history?: PositionHistory): Promise<PositionEvaluation> {
    return this.analyze(fen, { movetimeMs, multiPv: 1 }, history);
  }

  analyze(fen: string, options: SearchOptions = {}, history?: PositionHistory): Promise<PositionEvaluation> {
    if (this.destroyed) return Promise.reject(new Error("Analysis cancelled."));
    const limits = searchLimits(options);
    const context = history ? structuredClone(history) : undefined;
    let key: string;
    try { key = evaluationKey(fen, limits, context, this.hashMb, engineIdentity(this.profile)); } catch (error) { return Promise.reject(error); }
    const existing = this.pending.get(key);
    if (existing) return existing;
    const epoch = evaluationCacheEpoch();
    const task = this.queue.then(async () => {
      if (this.destroyed) throw new Error("Analysis cancelled.");
      const cached = await cachedEvaluation(key, fen);
      if (this.destroyed) throw new Error("Analysis cancelled.");
      if (cached) return { ...cached, cacheHit: true };
      await this.init(this.hashMb);
      await this.send("ucinewgame");
      await this.send(`setoption name MultiPV value ${limits.multiPv}`);
      await this.send("isready", line => line === "readyok");
      await this.send(positionCommand(fen, context));
      const command = limits.movetimeMs ? `go movetime ${limits.movetimeMs}` : `go depth ${limits.depth} nodes ${limits.nodes}`;
      const lines = await this.send(command, line => line.startsWith("bestmove "), 120000);
      let result: PositionEvaluation;
      try { result = parseEngineResult(fen, lines, limits.multiPv, context); }
      catch (error) {
        // A node/time cap can stop an iteration after its best move changes,
        // before an exact score (or every MultiPV line) has been emitted.
        // Keep the evidence checks strict and repeat once with a bounded larger
        // budget on the same worker, rather than saving a bound as an evaluation.
        if (!(error instanceof Error) || !error.message.includes("incomplete evaluation")) throw error;
        await this.send(positionCommand(fen, context));
        const retry = await this.send(`go depth ${Math.max(16, limits.depth)} nodes ${Math.min(2000000, Math.max(160000, limits.nodes * 4))}`, line => line.startsWith("bestmove "), 120000);
        result = parseEngineResult(fen, retry, limits.multiPv, context);
      }
      result.engineId = engineIdentity(this.profile);
      await cacheEvaluation(key, fen, result, epoch);
      return result;
    }).catch(error => { this.destroy(); throw error; });
    const result = task.finally(() => this.pending.delete(key));
    this.pending.set(key, result);
    this.queue = result.catch(() => {});
    return result;
  }

  destroy() {
    this.destroyed = true;
    this.lifecycle.abort();
    this.pendingReject?.(new Error("Analysis cancelled."));
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
  }
}
