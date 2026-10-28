import "fake-indexeddb/auto";
import { indexedStorage } from "../src/lib/indexed-storage";
import boden from "./fixtures/boden-review.json";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { buildCurriculum, curriculumQueue, curriculumLesson, issueSkills, practiceEvidence, positionKey } from "../src/lib/curriculum";
import { ENGINE_ID, parseEngineResult } from "../src/lib/engine-protocol";
import { parsePgn } from "../src/lib/pgn";
import { summarizeGame } from "../src/lib/analysis";
import { scheduleReview } from "../src/lib/training";
import { restorePersistedState } from "../src/lib/state-validation";
import { DEFAULT_SETTINGS, useStore } from "../src/lib/store";
import type { AnalysisSummary, GameRow, Motif, MoveIssue, PuzzleRow, PuzzleReview } from "../src/lib/types";

const values = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string,value:string) => values.set(key,value), removeItem: (key:string) => values.delete(key) } });
Object.defineProperty(globalThis, "window", { value: { dispatchEvent() {} } });
const now = new Date("2026-10-28T12:00:00Z");
const pgns = ["1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 1/2-1/2", "1. d4 d5 2. c4 e6 3. Nc3 Nf6 1/2-1/2", "1. c4 e5 2. Nc3 Nf6 3. g3 d5 1/2-1/2", "1. Nf3 d5 2. g3 c5 3. Bg2 Nc6 1/2-1/2", "1. g3 d5 2. Bg2 e5 3. d3 Nf6 1/2-1/2"];

// Deliberately simulated supported engine records. These fixtures test the model,
// while engine:verify and browser:verify test actual Stockfish/chess integration.
function profile(motif: Motif, count = 5, sources = pgns) {
  const games: GameRow[] = [], analyses: Record<string, AnalysisSummary> = {};
  for (let i = 0; i < count; i++) {
    const pgn = sources[i % sources.length];
    const parsed = parsePgn(pgn)!;
    const game = { id: `profile:${motif}:${i}`, pgn, platform: "pgn", external_id: String(i), user_color: "w", analysis_status: "done", played_at: `2026-09-${String(i+1).padStart(2,"0")}T00:00:00Z`, time_class: "rapid", time_control: "600", result: "draw", accuracy_user: null, url: null, opponent_name: `Profile ${i}` } as GameRow;
    const evals = parsed.fens.map((fen, index) => {
      const moves = new Chess(fen).moves({ verbose: true });
      const chosen = moves.find(move => `${move.from}${move.to}${move.promotion ?? ""}` !== parsed.moves[index]?.uci)!;
      const uci = `${chosen.from}${chosen.to}${chosen.promotion ?? ""}`;
      return { ...parseEngineResult(fen, [`info depth 16 score cp 40 nodes 600000 pv ${uci}`, `bestmove ${uci}`]), engineId: ENGINE_ID };
    });
    const summary = summarizeGame({ ...parsed, userColor: "w", engineLabel: "simulated test engine evidence", evals }).summary;
    const issue: MoveIssue = { ply: 3, san: parsed.moves[2].san, uci: parsed.moves[2].uci, fenBefore: parsed.fens[2], severity: "mistake", motif, phase: "middlegame", cpBefore: 50, cpAfter: -150, winDrop: .15, bestUci: evals[2].bestUci, bestSan: null };
    analyses[game.id] = { ...summary, engineId: ENGINE_ID, complete: true, issues: [issue], moveAssessments: parsed.moves.map((move,index) => ({ ply: index+1, color: move.color, classification: index === 2 ? "mistake" : "good", expectedLoss: index === 2 ? .15 : .01, confidence: "supported", reason: "simulated-engine-record", depth:16 })) };
    games.push(game);
  }
  return { games, analyses };
}

const review = (at: string, extra: Partial<PuzzleReview> = {}): PuzzleReview => ({ at, solved: true, hintsUsed: 0, wrongMoves: 0, solutionRevealed: false, elapsedMs: 15000, ...extra });

test("empty, sparse and isolated histories never establish recurring weaknesses", () => {
  const empty = buildCurriculum([], {}, [], now);
  assert.equal(empty.nextSkillId, null);
  assert.ok(empty.items.every(item => item.status === "unassessed"));
  const sparse = profile("hanging_piece", 2);
  const plan = buildCurriculum(sparse.games, sparse.analyses, [], now);
  assert.equal(plan.items.find(item => item.skill.id === "hanging-pieces")?.status, "isolated");
  assert.equal(plan.items.some(item => item.status === "recurring"), false);
});

test("different supported player profiles produce different curricula and legal game exercises", () => {
  for (const [motif, skill] of [["hanging_piece", "hanging-pieces"], ["allowed_fork", "fork-recognition"], ["allowed_mate", "king-safety"], ["bad_trade", "calculation"], ["missed_tactic", "tactical-vision"]] as const) {
    const data = profile(motif);
    const plan = buildCurriculum(data.games, data.analyses, [], now);
    assert.equal(plan.nextSkillId, skill);
    const item = plan.items.find(item => item.skill.id === skill)!;
    assert.equal(item.status, "recurring");
    assert.equal(item.games, 5);
    assert.equal(item.exercises.length, 5);
    for (const puzzle of curriculumQueue(item, now)) assert.doesNotThrow(() => new Chess(puzzle.fen).move(puzzle.solution_san[0]));
  }
});

test("duplicate imports, unsupported, partial and legacy reviews cannot multiply evidence", () => {
  const data = profile("hanging_piece");
  const first = data.games[0];
  const duplicate = { ...first, id: "duplicate", user_color: "b" as const };
  data.games.push(duplicate); data.analyses.duplicate = data.analyses[first.id];
  let plan = buildCurriculum(data.games, data.analyses, [], now);
  assert.equal(plan.analyzedGames, 5);
  data.analyses[data.games[1].id].complete = false;
  data.analyses[data.games[2].id].engineId = undefined;
  data.analyses[data.games[3].id].moveAssessments!.forEach(move => move.confidence = "limited");
  plan = buildCurriculum(data.games, data.analyses, [], now);
  assert.equal(plan.items.find(item => item.skill.id === "hanging-pieces")?.status, "isolated");
  assert.equal(plan.items.find(item => item.skill.id === "hanging-pieces")?.mistakes, 2);
});

test("additional imported games change isolated evidence into a recurring plan without resetting progress", () => {
  const data = profile("allowed_fork");
  const early = buildCurriculum(data.games.slice(0,2), data.analyses, [], now);
  const exercise = early.items.find(item => item.skill.id === "fork-recognition")!.exercises[0];
  exercise.reviews = [review("2026-10-01T00:00:00Z", { firstAttempt: true })];
  const later = buildCurriculum(data.games, data.analyses, [exercise], now).items.find(item => item.skill.id === "fork-recognition")!;
  assert.equal(later.status, "recurring");
  assert.equal(later.practice.unseenSuccesses, 1);
  assert.equal(later.exercises.find(item => item.id === exercise.id)?.reviews?.length, 1);
});

test("skill classification does not invent positional diagnoses, and conversion/endgame use explicit evidence", () => {
  const issue = profile("other").analyses["profile:other:0"].issues[0];
  assert.deepEqual(issueSkills(issue), []);
  assert.deepEqual(issueSkills({ ...issue, phase: "endgame", cpBefore: 300, cpAfter: 0 }), ["endgame-technique", "conversion"]);
});

test("mastery needs distinct unseen positions and delayed independent retrieval; duplicate IDs and hints fail", () => {
  const data = profile("hanging_piece");
  const exercises = buildCurriculum(data.games, data.analyses, [], now).items.find(item => item.skill.id === "hanging-pieces")!.exercises;
  const one = { ...exercises[0], reviews: [review("2026-10-01T00:00:00Z", { firstAttempt:true })] };
  assert.equal(practiceEvidence([one], now).mastery, "learning");
  assert.equal(practiceEvidence([one, {...one,id:"duplicate"}], now).unseenSuccesses, 1);
  const trained = exercises.map((exercise,index) => ({ ...exercise, reviews: [review(`2026-10-0${index+1}T00:00:00Z`, {firstAttempt:true}), review(`2026-10-${index+15}T00:00:00Z`)] }));
  assert.equal(practiceEvidence(trained, now).mastery, "demonstrated");
  const assisted = trained.map(exercise => ({...exercise,reviews:exercise.reviews.map(r=>({...r,hintsUsed:1}))}));
  assert.equal(practiceEvidence(assisted, now).mastery, "learning");
  assert.equal(practiceEvidence(trained.map(p=>({...p,reviews:p.reviews.map(r=>({at:r.at,solved:true}))})),now).independentSuccesses,0);
});

test("early repeats do not extend scheduling; assisted solves reset the interval", () => {
  const data = profile("hanging_piece");
  const puzzle = buildCurriculum(data.games, data.analyses, [], now).items[0].exercises[0];
  const first = scheduleReview(puzzle, true, now, {hintsUsed:0,wrongMoves:0,solutionRevealed:false});
  const early = scheduleReview(first, true, new Date(now.getTime()+1000), {hintsUsed:0});
  assert.equal(early.streak, first.streak); assert.equal(early.due_at, first.due_at);
  const helped = scheduleReview({...early,streak:4},true,new Date(first.due_at!),{hintsUsed:1});
  assert.equal(helped.streak,0); assert.equal(Date.parse(helped.due_at!)-Date.parse(first.due_at!),86400000);
});

test("legacy data migrates with no invented preferences or mastery, and curriculum sessions persist", async () => {
  const data = profile("allowed_mate");
  const puzzle = buildCurriculum(data.games,data.analyses,[],now).items.find(i=>i.skill.id==="king-safety")!.exercises[0];
  const restored = restorePersistedState({...data,puzzles:[puzzle]},DEFAULT_SETTINGS);
  assert.equal(restored.curriculumPreference,null); assert.equal(restored.games.length,5);
  useStore.getState().clearAllAction();useStore.getState().upsertPuzzles([puzzle]);
  useStore.getState().setCurriculumPreference("king-safety");useStore.getState().startTrainingSession([puzzle.id],"king-safety");
  const persisted = restorePersistedState(useStore.getState(),DEFAULT_SETTINGS);
  assert.equal(persisted.curriculumPreference,"king-safety");assert.equal(persisted.trainingSession?.skillId,"king-safety");
  assert.equal(positionKey(persisted.puzzles[0].fen),positionKey(puzzle.fen));
  assert.equal(restorePersistedState({...useStore.getState(),curriculumPreference:"invented"},DEFAULT_SETTINGS).curriculumPreference,null);
  useStore.getState().clearAllAction();
  await indexedStorage.setItem("curriculum-flush", "{}");
});


test("demonstrated foundation gaps influence progression without preventing override", () => {
  const data = profile("allowed_fork");
  for (const game of data.games) {
    const summary = data.analyses[game.id], parsed = parsePgn(game.pgn)!;
    summary.issues.push({ ...summary.issues[0], ply:5, san:parsed.moves[4].san, uci:parsed.moves[4].uci, fenBefore:parsed.fens[4], bestUci:summary.positionEvals![4].bestUci, motif:"hanging_piece" });
  }
  const plan = buildCurriculum(data.games,data.analyses,[],now);
  assert.equal(plan.nextSkillId,"hanging-pieces");
  const fork = plan.items.find(item=>item.skill.id==="fork-recognition")!;
  assert.deepEqual(fork.prerequisites,["hanging-pieces"]);
  assert.ok(curriculumQueue(fork,now).length > 0, "manual override remains available");
});

test("transfer compares like-for-like game pools and reports overlapping uncertainty honestly", () => {
  const sources = Array.from({length:10},(_,seed)=>{
    const chess = new Chess();
    for(let ply=0;ply<18;ply++){const moves=chess.moves();if(!moves.length)break;chess.move(moves[(seed+ply*7)%moves.length]);}
    return chess.pgn();
  });
  const data=profile("hanging_piece",10,sources);
  data.games.forEach((game,index)=>{game.played_at=index<5?`2026-09-0${index+1}T00:00:00Z`:`2026-10-${index+15}T00:00:00Z`;if(index>=5)data.analyses[game.id].issues=[];});
  const first=buildCurriculum(data.games,data.analyses,[],now).items.find(item=>item.skill.id==="hanging-pieces")!.exercises[0];
  first.reviews=[review("2026-10-01T00:00:00Z",{firstAttempt:true})];
  const item=buildCurriculum(data.games,data.analyses,[first],now).items.find(item=>item.skill.id==="hanging-pieces")!;
  assert.equal(item.transfer.beforeGames,5);assert.equal(item.transfer.afterGames,5);
  assert.ok(item.transfer.beforeRate!>item.transfer.afterRate!);
  assert.equal(item.transfer.direction,"uncertain");
  data.games.slice(5).forEach(game=>game.time_class="blitz");
  assert.equal(buildCurriculum(data.games,data.analyses,[first],now).items.find(item=>item.skill.id==="hanging-pieces")!.transfer.direction,"insufficient");
});

test("revealed answers followed by immediate clean retries earn no independent or retention credit", () => {
  const data=profile("hanging_piece");
  const puzzle=buildCurriculum(data.games,data.analyses,[],now).items[0].exercises[0];
  puzzle.reviews=[review("2026-10-01T00:00:00Z",{solved:false,solutionRevealed:true,firstAttempt:true}),review("2026-10-01T00:01:00Z")];
  assert.equal(practiceEvidence([puzzle],now).independentSuccesses,0);
  assert.equal(practiceEvidence([puzzle],now).unseenSuccesses,0);
  assert.equal(practiceEvidence([puzzle],now).retainedPositions,0);
});

test("new repeated game errors reopen previously demonstrated practice", () => {
  const data=profile("hanging_piece");
  const exercises=buildCurriculum(data.games,data.analyses,[],now).items[0].exercises.map((p,index)=>({...p,reviews:[review(`2026-10-0${index+1}T00:00:00Z`,{firstAttempt:true}),review(`2026-10-${index+15}T00:00:00Z`)]}));
  assert.equal(buildCurriculum(data.games,data.analyses,exercises,now).items.find(i=>i.skill.id==="hanging-pieces")!.practice.mastery,"demonstrated");
  data.games.slice(0,3).forEach((game,index)=>game.played_at=`2026-10-${24+index}T00:00:00Z`);
  const item=buildCurriculum(data.games,data.analyses,exercises,now).items.find(i=>i.skill.id==="hanging-pieces")!;
  assert.equal(item.reassessment,true);assert.equal(item.practice.mastery,"learning");
  exercises[0].reviews.push(review("2026-10-27T00:00:00Z"));
  assert.equal(buildCurriculum(data.games,data.analyses,exercises,now).items.find(i=>i.skill.id==="hanging-pieces")!.practice.mastery,"learning");
});


test("focused lesson selection follows demonstrated needs without granting completion mastery", () => {
  const data=profile("allowed_fork");
  const item=buildCurriculum(data.games,data.analyses,[],now).items.find(item=>item.skill.id==="fork-recognition")!;
  const lesson=curriculumLesson(item,"en");
  assert.equal(lesson.title,"Fork recognition");assert.equal(lesson.concept,item.skill.concept);
  assert.ok(lesson.sections.some(section=>section.type==="text"&&section.body.includes("no mastery credit")));
  assert.equal(curriculumLesson(item,"fr").title,"Reconnaissance des fourchettes");
});

test("reassessment schedules fresh practice without deleting history or replacing an active session", async () => {
  const data=profile("hanging_piece");
  const puzzle=buildCurriculum(data.games,data.analyses,[],now).items[0].exercises[0];
  const historical={...puzzle,streak:4,due_at:"2026-11-20T00:00:00Z",last_reviewed_at:"2026-10-01T00:00:00Z",reviews:[review("2026-10-01T00:00:00Z",{firstAttempt:true})],attempts:1};
  useStore.getState().clearAllAction();useStore.getState().upsertPuzzles([historical]);
  useStore.getState().prepareCurriculumSession([historical],"hanging-pieces","2026-10-26T00:00:00Z");
  const saved=useStore.getState().puzzles[0];
  assert.equal(saved.streak,0);assert.equal(saved.due_at,undefined);assert.deepEqual(saved.reviews,historical.reviews);assert.equal(saved.attempts,1);
  const session=useStore.getState().trainingSession;
  useStore.getState().prepareCurriculumSession([historical],"calculation");
  assert.equal(useStore.getState().trainingSession,session);
  useStore.getState().clearAllAction();await indexedStorage.setItem("curriculum-reset-flush","{}");
});

test("related source-validated mating examples follow personal positions and do not create weakness evidence", () => {
  const data=profile("missed_tactic"), chess=new Chess(boden.searches.before.fen);
  const san=boden.source.solution.map(uci=>chess.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]}).san);
  const related: PuzzleRow={id:"lichess:5SmZW",game_id:"curated:5SmZW",fen:boden.searches.before.fen,user_side:"b",source:"lichess",pattern:"boden",license:"CC0-1.0",source_url:boden.source.url,solution_lines_uci:[boden.source.solution],solution_san:san.filter((_,i)=>i%2===0),reply_san:san.filter((_,i)=>i%2===1),theme:"other",attempts:0,solved:false,created_at:now.toISOString()};
  const item=buildCurriculum(data.games,data.analyses,[related,{...related,id:"lichess:duplicate"}],now).items.find(i=>i.skill.id==="tactical-vision")!;
  assert.equal(item.games,5);assert.equal(item.mistakes,5);assert.equal(item.exercises.length,6);
  assert.equal(curriculumQueue(item,now).at(-1)?.source,"lichess");
});
