import { Chess } from "chess.js";

export const OPENING_SOURCE = { repository: "https://github.com/lichess-org/chess-openings", revision: "f06a50d5c7c140e50b068049fa31d289e2c3d347", license: "CC0-1.0" } as const;
export type OpeningEntry = [eco: string, name: string, moves: string[]];

export function parseOpeningTsv(text: string): OpeningEntry[] {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  if (header !== "eco\tname\tpgn") throw new Error("Opening data schema changed.");
  return lines.map((line, index) => {
    const [eco, name, pgn, extra] = line.split("\t");
    if (!/^[A-E]\d{2}$/.test(eco) || !name || !pgn || extra !== undefined) throw new Error(`Invalid opening record ${index + 2}.`);
    const chess = new Chess(); chess.loadPgn(pgn, { strict: true });
    const moves = chess.history({ verbose: true }).map(move => `${move.from}${move.to}${move.promotion ?? ""}`);
    if (!moves.length || moves.length > 100) throw new Error(`Invalid opening line ${eco}.`);
    return [eco, name, moves];
  });
}

export function curatedOpeningSubset(rows: OpeningEntry[]): OpeningEntry[] {
  const selected = new Map<string, OpeningEntry>();
  for (const row of [...rows].sort((a, b) => a[2].length - b[2].length || a[1].length - b[1].length || a[1].localeCompare(b[1], "en") || a[2].join(" ").localeCompare(b[2].join(" "), "en"))) {
    if (!selected.has(row[0])) selected.set(row[0], row);
  }
  return [...selected.values()].sort((a, b) => a[0].localeCompare(b[0], "en"));
}

// Keep every named variation. ECO is a classification, not a unique line ID.
export function completeOpeningReference(rows: OpeningEntry[]): OpeningEntry[] {
  return [...new Map(rows.map(row => [JSON.stringify(row), row])).values()]
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), "en"));
}

export function openingPositionKey(fen: string): string {
  // chess.js emits an en-passant square only when a legal capture exists.
  return new Chess(fen).fen().split(" ").slice(0, 4).join(" ");
}

export function indexOpeningPositions(rows: OpeningEntry[]) {
  const nodes = new Map<string, { moves: Set<string>; openings: Set<number> }>();
  const node = (fen: string) => {
    const key = fen.split(" ").slice(0, 4).join(" ");
    if (!nodes.has(key)) nodes.set(key, { moves: new Set(), openings: new Set() });
    return nodes.get(key)!;
  };
  rows.forEach((row, index) => {
    const chess = new Chess();
    for (const uci of row[2]) {
      node(chess.fen()).moves.add(uci);
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    }
    node(chess.fen()).openings.add(index);
  });
  return [...nodes].map(([key, value]) => [key, [...value.moves].sort(), [...value.openings]] as [string, string[], number[]]);
}
