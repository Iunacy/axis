import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import fixture from "../tests/fixtures/boden-review.json";
import { parseEngineResult } from "../src/lib/engine-protocol";
import { classifyMove } from "../src/lib/move-classification";

async function main() {
  const engineProcess = spawn(process.execPath, [resolve("node_modules/stockfish/bin/stockfish-18-lite-single.js")], { stdio: ["pipe", "pipe", "pipe"] });
  let buffer = "";
  let pending: { lines: string[]; until: (line: string) => boolean; resolve: (lines: string[]) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  engineProcess.stdout.on("data", chunk => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? "";
    for (const line of lines) if (pending) { pending.lines.push(line); if (pending.until(line)) { const current = pending; pending = null; clearTimeout(current.timer); current.resolve(current.lines); } }
  });
  const fail = (error: Error) => { if (pending) { const current = pending; pending = null; clearTimeout(current.timer); current.reject(error); } };
  engineProcess.on("error", fail);
  engineProcess.on("exit", code => { if (pending) fail(new Error(`Stockfish exited (${code}).`)); });
  const send = (command: string) => engineProcess.stdin.write(`${command}\n`);
  const request = (command: string, until: (line: string) => boolean) => new Promise<string[]>((resolve, reject) => {
    if (pending) { reject(new Error("Concurrent engine commands are not allowed.")); return; }
    const timer = setTimeout(() => { fail(new Error("Stockfish verification timed out.")); engineProcess.kill(); }, 60000);
    pending = { lines: [], until, resolve, reject, timer }; send(command);
  });
  try {
    await request("uci", line => line === "uciok");
    send("setoption name Threads value 1"); send("setoption name Hash value 32"); send("setoption name UCI_ShowWDL value true");
    const analyze = async (search: typeof fixture.searches.before) => {
      send("ucinewgame"); send(`setoption name MultiPV value ${search.multiPv}`);
      await request("isready", line => line === "readyok");
      send(`position fen ${search.fen}`);
      const output = await request(`go depth ${search.depth} nodes ${search.nodes}`, line => line.startsWith("bestmove "));
      return parseEngineResult(search.fen, output, search.multiPv);
    };
    const before = await analyze(fixture.searches.before);
    const after = await analyze(fixture.searches.after);
    const confirmation = await analyze(fixture.searches.confirmation);
    assert.deepEqual(before.pvUci, fixture.source.solution);
    const assessment = classifyMove({ fen: fixture.searches.before.fen, fenAfter: fixture.searches.after.fen, uci: fixture.uci, before, after, confirmation, ply: 1 });
    assert.equal(assessment.classification, "brilliant");
    process.stdout.write(`Real Stockfish verification: ${assessment.classification}, root depth ${before.depth}, confirmation depth ${confirmation.depth}, legal forced-mate sacrifice.\n`);
  } finally {
    const exited = once(engineProcess, "exit"); send("quit");
    const timer = setTimeout(() => engineProcess.kill(), 5000);
    await exited; clearTimeout(timer);
  }
}

main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
