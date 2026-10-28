import { Chess } from "chess.js";
import type { ParsedGame } from "./pgn";
import type { PositionHistory } from "./engine-protocol";
import type { MoveIssue } from "./types";
import { playPuzzleMove } from "./puzzle-solution";

export interface ReviewNode {
  id: string;
  parent: string | null;
  children: string[];
  fen: string;
  san: string;
  uci: string;
  gamePly: number | null;
}

export interface ReviewPractice {
  issue: MoveIssue;
  status: "ready" | "wrong" | "correct" | "revealed";
  startedAt: number;
  wrongMoves: number;
}

export interface ReviewPositionState {
  nodes: Record<string, ReviewNode>;
  mainline: string[];
  cursor: string;
  tip: string;
  nextId: number;
  practice: ReviewPractice | null;
}

export interface SavedReviewBranch { ply: number; moves: string[] }

export function serializeReviewBranches(state: Pick<ReviewPositionState, "nodes">): SavedReviewBranch[] {
  return Object.values(state.nodes).filter(node => node.gamePly === null && node.children.length === 0).slice(-64).map(node => {
    const path = nodePath(state, node.id);
    const anchor = path.findLastIndex(item => item.gamePly !== null);
    return { ply: path[anchor].gamePly!, moves: path.slice(anchor + 1).map(item => item.uci) };
  });
}

export function restoreReviewBranches(state: ReviewPositionState, saved: unknown): ReviewPositionState {
  if (!Array.isArray(saved)) return state;
  let restored = state;
  for (const branch of saved.slice(-64)) {
    if (!branch || !Number.isInteger(branch.ply) || branch.ply < 0 || branch.ply >= state.mainline.length || !Array.isArray(branch.moves) || !branch.moves.length || branch.moves.length > 256 || !branch.moves.every((move: unknown) => typeof move === "string")) continue;
    const root = reviewPositionReducer(restored, { type: "game", ply: branch.ply });
    const next = reviewPositionReducer(root, { type: "line", moves: branch.moves });
    if (next !== root) restored = next;
  }
  return { ...restored, cursor: state.cursor, tip: state.tip, practice: null };
}

export type ReviewAction =
  | { type: "game"; ply: number }
  | { type: "select"; id: string; tip?: string }
  | { type: "navigate"; direction: "first" | "previous" | "next" | "last" }
  | { type: "line"; moves: string[]; advance?: "first" | "last" }
  | { type: "practice"; issue: MoveIssue; now: number }
  | { type: "attempt"; san: string }
  | { type: "reveal" }
  | { type: "retry"; now: number };

export function createReviewPosition(game: ParsedGame, resumePly = 0): ReviewPositionState {
  const mainline = game.fens.map((_, index) => `g${index}`);
  const nodes = Object.fromEntries(game.fens.map((fen, index) => [mainline[index], {
    id: mainline[index], parent: mainline[index - 1] ?? null,
    children: mainline[index + 1] ? [mainline[index + 1]] : [], fen,
    san: game.moves[index - 1]?.san ?? "", uci: game.moves[index - 1]?.uci ?? "", gamePly: index,
  }]));
  return { nodes, mainline, cursor: mainline[Math.max(0, Math.min(game.moves.length, Math.trunc(resumePly) || 0))], tip: mainline.at(-1)!, nextId: 0, practice: null };
}

export function nodePath(state: Pick<ReviewPositionState, "nodes">, id: string): ReviewNode[] {
  const path: ReviewNode[] = [];
  let node: ReviewNode | undefined = state.nodes[id];
  while (node) { path.push(node); node = node.parent ? state.nodes[node.parent] : undefined; }
  return path.reverse();
}

export function reviewView(state: ReviewPositionState) {
  const node = state.nodes[state.cursor];
  const path = nodePath(state, state.cursor);
  const line = nodePath(state, state.tip);
  const index = path.length - 1;
  const gamePly = path.findLast(item => item.gamePly !== null)?.gamePly ?? 0;
  const history: PositionHistory = { initialFen: path[0].fen, moves: path.slice(1).map(item => item.uci) };
  let fen = node.fen;
  let lastUci = node.uci;
  if (state.practice?.status === "correct" && state.practice.issue.bestUci) {
    const chess = new Chess(fen); const uci = state.practice.issue.bestUci;
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    fen = chess.fen(); lastUci = uci; history.moves.push(uci);
  }
  return { node, path, line, index, gamePly, fen, lastUci, history, isVariation: state.nodes[state.tip].gamePly === null, identity: JSON.stringify([fen, history]) };
}

export function reviewPositionReducer(state: ReviewPositionState, action: ReviewAction): ReviewPositionState {
  if (action.type === "game") {
    const ply = Math.max(0, Math.min(state.mainline.length - 1, Math.trunc(action.ply) || 0));
    return { ...state, cursor: state.mainline[ply], tip: state.mainline.at(-1)!, practice: null };
  }
  if (action.type === "select") {
    if (!state.nodes[action.id]) return state;
    const tip = action.tip ?? action.id;
    if (!nodePath(state, tip).some(node => node.id === action.id)) return state;
    return { ...state, cursor: action.id, tip, practice: null };
  }
  if (action.type === "navigate") {
    const line = nodePath(state, state.tip);
    const index = line.findIndex(node => node.id === state.cursor);
    const next = action.direction === "first" ? 0 : action.direction === "last" ? line.length - 1 : Math.max(0, Math.min(line.length - 1, index + (action.direction === "previous" ? -1 : 1)));
    return { ...state, cursor: line[next].id, practice: null };
  }
  if (action.type === "line") {
    if (!action.moves.length) return state;
    // Validate the whole line before publishing any branch or changing the cursor.
    try {
      const chess = new Chess(state.nodes[state.cursor].fen);
      const nodes = { ...state.nodes };
      let parent = nodes[state.cursor]; let nextId = state.nextId;
      const inserted: string[] = [];
      for (const uci of action.moves) {
        if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return state;
        const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
        let child = parent.children.map(id => nodes[id]).find(node => node.uci === uci);
        if (!child) {
          const id = `v${nextId++}`;
          child = { id, parent: parent.id, children: [], fen: chess.fen(), uci, san: move.san, gamePly: null };
          nodes[id] = child; nodes[parent.id] = { ...parent, children: [...parent.children, id] };
        }
        inserted.push(child.id); parent = child;
      }
      const end = inserted.at(-1)!;
      const tip = nodes[end].gamePly !== null ? state.mainline.at(-1)! : nodePath(state, state.tip).some(node => node.id === end) ? state.tip : end;
      return { ...state, nodes, nextId, cursor: action.advance === "first" ? inserted[0] : end, tip, practice: null };
    } catch { return state; }
  }
  if (action.type === "practice") {
    const id = state.mainline[action.issue.ply - 1];
    const uci = action.issue.bestUci;
    if (!id || state.nodes[id].fen !== action.issue.fenBefore || !uci) return state;
    try { const chess = new Chess(action.issue.fenBefore); chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); } catch { return state; }
    return { ...state, cursor: id, tip: state.mainline.at(-1)!, practice: { issue: action.issue, status: "ready", startedAt: action.now, wrongMoves: 0 } };
  }
  if (action.type === "attempt" && state.practice && ["ready", "wrong"].includes(state.practice.status)) {
    try {
      const issue = state.practice.issue;
      const result = playPuzzleMove({ fen: issue.fenBefore, lines: [{ uci: [issue.bestUci!], san: [issue.bestSan ?? ""] }] }, [], issue.fenBefore, action.san);
      const correct = result.status === "solved";
      return { ...state, practice: { ...state.practice, status: correct ? "correct" : "wrong", wrongMoves: state.practice.wrongMoves + (correct ? 0 : 1) } };
    } catch { return state; }
  }
  if (action.type === "reveal" && state.practice && ["ready", "wrong"].includes(state.practice.status)) return { ...state, practice: { ...state.practice, status: "revealed" } };
  if (action.type === "retry" && state.practice) return { ...state, practice: { ...state.practice, status: "ready", startedAt: action.now, wrongMoves: 0 } };
  return state;
}

export function reviewShortcut(key: string, context: { prevented?: boolean; modified?: boolean; editable?: boolean; dialog?: boolean; board?: boolean; button?: boolean } = {}) {
  if (context.prevented || context.modified || context.editable || context.dialog || context.board || key === " " && context.button) return null;
  const actions: Record<string, "previous" | "next" | "first" | "last" | "play" | "return"> = { ArrowLeft: "previous", ArrowRight: "next", Home: "first", End: "last", " ": "play", Escape: "return" };
  return actions[key] ?? null;
}
