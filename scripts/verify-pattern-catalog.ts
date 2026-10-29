import { fetchCuratedPatterns } from "../src/lib/lichess-puzzles";
import { PATTERNS } from "../src/lib/pattern-catalog";

async function main() {
  const rows = await fetchCuratedPatterns();
  if (rows.length !== PATTERNS.reduce((sum, pattern) => sum + pattern.ids.length, 0) || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error("The curated pattern catalog is incomplete.");
  if (new Set(rows.map(row => row.fen.split(" ").slice(0, 4).join(" "))).size !== rows.length) throw new Error("Duplicate puzzle positions.");
  for (const pattern of PATTERNS) {
    const selected = rows.filter(row => row.pattern === pattern.id);
    if (selected.length < 10) throw new Error(`Missing positions for ${pattern.id}.`);
    process.stdout.write(`${pattern.id}: ${selected.map(row => `${row.id} (${row.rating})`).join(", ")}\n`);
  }
}

main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
