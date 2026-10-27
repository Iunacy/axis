import { Chess } from "chess.js";

export const FIXTURE_LABEL = "DEVELOPMENT FIXTURE · THE IMMORTAL GAME, 1851";
export const fixturePgn = `1.e4 e5 2.f4 exf4 3.Bc4 Qh4+ 4.Kf1 b5 5.Bxb5 Nf6 6.Nf3 Qh6 7.d3 Nh5 8.Nh4 Qg5 9.Nf5 c6 10.g4 Nf6 11.Rg1 cxb5 12.h4 Qg6 13.h5 Qg5 14.Qf3 Ng8 15.Bxf4 Qf6 16.Nc3 Bc5 17.Nd5 Qxb2 18.Bd6 Bxg1 19.e5 Qxa1+ 20.Ke2 Na6 21.Nxg7+ Kd8 22.Qf6+ Nxf6 23.Be7# 1-0`;

const game = new Chess();
game.loadPgn(fixturePgn);
const history = game.history({ verbose: true });
const replay = new Chess();

export const positions = [
  { ply: 0, san: "Start", fen: replay.fen(), from: "", to: "" },
  ...history.map((move, index) => {
    replay.move(move.san);
    return {
      ply: index + 1,
      san: move.san,
      fen: replay.fen(),
      from: move.from,
      to: move.to,
    };
  }),
];

export function notation(ply: number) {
  if (ply === 0) return "Start";
  return `${Math.ceil(ply / 2)}${ply % 2 ? "." : "..."}${positions[ply].san}`;
}

export const moments = [
  {
    ply: 34,
    title: "The queen takes b2",
    note: "Black takes a pawn and draws the queen away from the king. The record shows the move; no engine judgment is implied.",
  },
  {
    ply: 35,
    title: "The bishop steps to d6",
    note: "White continues the initiative with Bd6 while material remains under threat.",
  },
  {
    ply: 36,
    title: "A critical capture",
    note: "Black chooses Bxg1 and captures the rook. Follow the recorded continuation to see how White responds.",
  },
  {
    ply: 37,
    title: "The center advances",
    note: "White plays e5, making the next threats concrete. Continue through the recorded line.",
  },
] as const;

export const sampleSignals = [
  {
    label: "King safety",
    count: 4,
    phase: "Middlegame",
    description: "Illustrative training theme linked to king exposure.",
  },
  {
    label: "Loose pieces",
    count: 3,
    phase: "Middlegame",
    description: "Illustrative training theme linked to undefended pieces.",
  },
  {
    label: "Conversion",
    count: 2,
    phase: "Endgame",
    description: "Illustrative training theme linked to winning positions.",
  },
] as const;
