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
