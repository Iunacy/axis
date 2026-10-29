import { mkdir, readFile, writeFile } from "node:fs/promises";
import { OPENING_SOURCE, parseOpeningTsv, completeOpeningReference, indexOpeningPositions } from "../src/lib/opening-import";

async function main() {
  const tables = await Promise.all(["a", "b", "c", "d", "e"].map(async volume => {
    const response = await fetch(`https://raw.githubusercontent.com/lichess-org/chess-openings/${OPENING_SOURCE.revision}/${volume}.tsv`);
    if (!response.ok) throw new Error(`Opening source returned ${response.status}.`);
    return parseOpeningTsv(await response.text());
  }));
  const rows = completeOpeningReference(tables.flat());
  if (new Set(rows.map(row => row[0])).size !== 500) throw new Error(`Expected 500 ECO references; found ${rows.length}.`);
  const content = `${JSON.stringify({ source: OPENING_SOURCE, rows, positions: indexOpeningPositions(rows) })}\n`;
  const path = "src/lib/data/openings.json";
  if (process.argv.includes("--check")) {
    if (await readFile(path, "utf8") !== content) throw new Error("Opening reference does not match the verified source.");
  } else { await mkdir("src/lib/data", { recursive: true }); await writeFile(path, content); }
  process.stdout.write(`Verified ${tables.flat().length} legal opening lines; retained ${rows.length} ECO references (${Buffer.byteLength(content)} bytes).\n`);
}

main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
