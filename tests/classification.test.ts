import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import fixture from "./fixtures/boden-review.json";
import { parseEngineResult } from "../src/lib/engine-protocol";
import { classifyMove, sustainedSacrifice } from "../src/lib/move-classification";
import { isBookMove } from "../src/lib/opening-book";
import type { PositionEvaluation } from "../src/lib/types";

const start = new Chess().fen();
const e4 = new Chess(); e4.move("e4");

function simulated(fen: string, pv: string[], wdlWhite: [number, number, number], depth = 20, alternative?: { pv: string[]; wdl: [number, number, number] }): PositionEvaluation {
  const black = new Chess(fen).turn() === "b";
  const line = (index: number, moves: string[], wdl: number[]) => `info depth ${depth} multipv ${index} score cp 0 wdl ${(black ? [...wdl].reverse() : wdl).join(" ")} nodes 500000 pv ${moves.join(" ")}`;
  return parseEngineResult(fen, [line(1, pv, wdlWhite), ...(alternative ? [line(2, alternative.pv, alternative.wdl)] : []), `bestmove ${pv[0]}`], alternative ? 2 : 1);
}

test("expected-outcome policy distinguishes excellent, good, inaccuracy, mistake and blunder", () => {
  const before = simulated(start, ["d2d4", "d7d5"], [100, 800, 100]);
  const cases = [
    ["excellent", [90, 810, 100]], ["good", [60, 830, 110]], ["inaccuracy", [40, 800, 160]], ["mistake", [0, 760, 240]], ["blunder", [0, 500, 500]],
  ] as const;
  for (const [classification, wdl] of cases) {
    const after = simulated(e4.fen(), ["e7e5", "g1f3"], [...wdl]);
    assert.equal(classifyMove({ fen: start, fenAfter: e4.fen(), uci: "e2e4", before, after, ply: 1 }).classification, classification);
  }
});

test("best and book use exact move identity and a real opening reference", () => {
  const before = simulated(start, ["e2e4", "e7e5"], [100, 800, 100]);
  const after = simulated(e4.fen(), ["e7e5", "g1f3"], [0, 500, 500]);
  const input = { fen: start, fenAfter: e4.fen(), uci: "e2e4", before, after, ply: 1 };
  assert.equal(classifyMove(input).classification, "best");
  assert.equal(classifyMove(input).expectedLoss, 0);
  assert.equal(isBookMove(start, ["e2e4"]), true);
  assert.equal(classifyMove({ ...input, book: isBookMove(start, ["e2e4"]) }).classification, "book");
});

test("great requires a larger confirming search and a meaningful second-choice gap", () => {
  const alternative = { pv: ["d2d4", "d7d5"], wdl: [100, 400, 500] as [number, number, number] };
  const before = simulated(start, ["e2e4", "e7e5"], [300, 600, 100], 18, alternative);
  const after = simulated(e4.fen(), ["e7e5", "g1f3"], [300, 600, 100]);
  const confirmation = simulated(start, ["e2e4", "e7e5"], [300, 600, 100], 20, alternative);
  const input = { fen: start, fenAfter: e4.fen(), uci: "e2e4", before, after, ply: 1 };
  assert.equal(classifyMove(input).classification, "best");
  assert.equal(classifyMove({ ...input, confirmation }).classification, "great");
  assert.equal(classifyMove({ ...input, confirmation: { ...confirmation, bestUci: "d2d4" } }).classification, "best");
  const closeAlternative = simulated(start, ["e2e4", "e7e5"], [300, 600, 100], 20, { ...alternative, wdl: [290, 600, 110] });
  assert.equal(classifyMove({ ...input, confirmation: closeAlternative }).classification, "best");
});

test("a missed legal forced mate is distinguished from an ordinary outcome loss", () => {
  const chess = new Chess(); for (const move of ["f3", "e5", "g4"]) chess.move(move);
  const fen = chess.fen();
  const before = parseEngineResult(fen, ["info depth 20 score mate 1 wdl 1000 0 0 nodes 50000 pv d8h4", "bestmove d8h4"]);
  chess.move("a6");
  const after = simulated(chess.fen(), ["e2e4", "b8c6"], [100, 800, 100]);
  assert.equal(classifyMove({ fen, fenAfter: chess.fen(), uci: "a7a6", before, after, ply: 4 }).classification, "miss");
  const stillWinning = simulated(chess.fen(), ["e2e4", "b8c6"], [0, 20, 980]);
  const missedQuickMate = classifyMove({ fen, fenAfter: chess.fen(), uci: "a7a6", before, after: stillWinning, ply: 4 });
  assert.equal(missedQuickMate.classification, "miss");
  assert.equal(missedQuickMate.reason, "missed-mate-in-one");
  assert.equal(missedQuickMate.expectedLoss, .01);
});

test("brilliant is backed by recorded Stockfish searches on the real Lichess Boden sacrifice", () => {
  const source = fixture.searches;
  const before = parseEngineResult(source.before.fen, source.before.output, source.before.multiPv);
  const after = parseEngineResult(source.after.fen, source.after.output, source.after.multiPv);
  const confirmation = parseEngineResult(source.confirmation.fen, source.confirmation.output, source.confirmation.multiPv);
  assert.deepEqual(before.pvUci, fixture.source.solution);
  assert.equal(sustainedSacrifice(source.before.fen, before.pvUci), true);
  const assessment = classifyMove({ fen: source.before.fen, fenAfter: source.after.fen, uci: fixture.uci, before, after, confirmation, ply: 1 });
  assert.equal(assessment.classification, "brilliant");
  assert.equal(assessment.confidence, "confirmed");
});

test("temporary material losses, insufficient depth and contradictory position evidence do not earn awards", () => {
  const exchange = "3rk2q/8/8/3p4/4B3/8/8/1N1QK3 w - - 0 1";
  const line = ["e4d5", "d8d5", "d1d5", "e8f8", "d5e4", "f8g8", "e1f2", "g8f7"];
  assert.equal(sustainedSacrifice(exchange, line, false), true);
  assert.equal(sustainedSacrifice(exchange, line), false);
  const before = simulated(start, ["e2e4", "e7e5"], [100, 800, 100], 8);
  const after = simulated(e4.fen(), ["e7e5", "g1f3"], [100, 800, 100]);
  const input = { fen: start, fenAfter: e4.fen(), uci: "e2e4", before, after, ply: 1 };
  assert.equal(classifyMove(input).classification, null);
  assert.equal(classifyMove({ ...input, before: { ...before, cpWhite: NaN, depth: 20 } }).classification, null);
  assert.equal(classifyMove({ ...input, fenAfter: start }).classification, null);
});

test("selective verification includes uncertain positions without awarding unsupported labels", async () => {
  const { verificationCandidates } = await import("../src/lib/move-classification");
  const before = simulated(start, ["e2e4", "e7e5"], [100, 800, 100], 8);
  const after = simulated(e4.fen(), ["e7e5", "g1f3"], [100, 800, 100], 8);
  assert.deepEqual(verificationCandidates([start, e4.fen()], [{ uci: "e2e4", color: "w" }], [before, after]), [0]);
  assert.equal(classifyMove({ fen: start, fenAfter: e4.fen(), uci: "e2e4", before, after, ply: 1 }).classification, null);
});

test("rating coverage fills every shallow position instead of only six decisions", async () => {
  const { ratingCoverageCandidates } = await import("../src/lib/move-classification");
  const chess = new Chess();
  const fens = [chess.fen()];
  for (const san of ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "d3", "Nf6", "Nc3", "d6"]) { chess.move(san); fens.push(chess.fen()); }
  const evaluations = fens.map(fen => ({ ...simulated(fen, [new Chess(fen).moves({verbose:true})[0]].map(move => `${move.from}${move.to}${move.promotion ?? ""}`), [100,800,100], 9) }));
  assert.deepEqual(ratingCoverageCandidates(fens, evaluations), fens.map((_,index) => index));
  evaluations[3].depth = 12;
  assert.equal(ratingCoverageCandidates(fens,evaluations).includes(3), false);
  // Coverage planning never weakens the actual classification threshold.
  const shallow = classifyMove({fen:start,fenAfter:e4.fen(),uci:"e2e4",before:evaluations[0],after:evaluations[1],ply:1});
  assert.equal(shallow.classification,null);
});

test("exact terminal positions require no depth or repeated coverage search", async () => {
  const { ratingCoverageCandidates } = await import("../src/lib/move-classification");
  const chess = new Chess(); for (const move of ["f3","e5","g4","Qh4#"]) chess.move(move);
  const terminal = parseEngineResult(chess.fen(), []);
  assert.deepEqual(ratingCoverageCandidates([chess.fen()],[terminal]), []);
});

test("documented book provenance survives shallow or unavailable engine evidence without inflating accuracy", async () => {
  const { summarizeGame } = await import('../src/lib/analysis');
  const { parsePgn } = await import('../src/lib/pgn');
  const parsed=parsePgn('1. e4 e5 1/2-1/2')!;
  const before=simulated(start,['e2e4','e7e5'],[100,800,100],8);
  const after=simulated(e4.fen(),['e7e5','g1f3'],[100,800,100],8);
  assert.equal(classifyMove({fen:start,fenAfter:e4.fen(),uci:'e2e4',before:{...before,cpWhite:NaN},after,ply:1,book:true}).classification,'book');
  const summary=summarizeGame({fens:parsed.fens.slice(0,2),moves:parsed.moves.slice(0,1),userColor:'w',evals:[before,after],engineLabel:'shallow regression'}).summary;
  assert.equal(summary.moveAssessments?.[0].classification,'book');
  assert.equal(summary.accuracyByColor?.w,null);
  assert.equal(summary.accuracySamples?.w,0);
  // A caller cannot invent provenance by passing book=true for an off-book move.
  const off=new Chess('7k/8/8/8/8/8/P7/7K w - - 0 1');const offFen=off.fen();off.move('a3');
  assert.notEqual(classifyMove({fen:offFen,fenAfter:off.fen(),uci:'a2a3',before,after,ply:1,book:true}).classification,'book');
});

test("documented opening mistakes retain provenance but still create review issues",async()=>{
 const {summarizeGame}=await import('../src/lib/analysis');
 const before=simulated(start,['d2d4','d7d5'],[300,600,100]);
 const after=simulated(e4.fen(),['e7e5','g1f3'],[0,400,600]);
 const summary=summarizeGame({fens:[start,e4.fen()],moves:[{san:'e4',uci:'e2e4',color:'w'}],userColor:'w',evals:[before,after],engineLabel:'synthetic provenance regression'}).summary;
 assert.equal(summary.moveAssessments?.[0].classification,'book');
 assert.equal(summary.issues.length,1);assert.equal(summary.issues[0].severity,'blunder');assert.ok(summary.accuracy<100);
});
