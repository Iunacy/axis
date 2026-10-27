import { fetchCuratedPatterns } from "../src/lib/lichess-puzzles";
import { PATTERNS } from "../src/lib/pattern-catalog";

async function main() {
  const rows = await fetchCuratedPatterns();
  if (rows.length !== PATTERNS.length * 3 || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error("The curated pattern catalog is incomplete.");
  for (const pattern of PATTERNS) {
    const selected = rows.filter(row => row.pattern === pattern.id);
    if (selected.length !== 3) throw new Error(`Missing positions for ${pattern.id}.`);
    process.stdout.write(`${pattern.id}: ${selected.map(row => `${row.id} (${row.rating})`).join(", ")}\n`);
  }
}

main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
