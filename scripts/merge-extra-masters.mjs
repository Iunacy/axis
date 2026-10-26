import { readFileSync, writeFileSync } from "node:fs";
import { buildExtraEntries, overlayIconicFor, sortCatalog, SEED, OUT } from "./build-masters.mjs";

const catalog = JSON.parse(readFileSync(OUT, "utf8"));
const extraIds = new Set((SEED.extraGames || []).map((g) => g.id));

const historic = catalog.filter((e) => !extraIds.has(e.id));
for (const e of historic) e.iconic = overlayIconicFor(e, SEED);

const seenIds = new Set(historic.map((e) => e.id));
const extras = buildExtraEntries(SEED, seenIds);

const merged = sortCatalog([...historic, ...extras]);
writeFileSync(OUT, JSON.stringify(merged, null, 2) + "\n");

console.log(`Merged ${extras.length} curated modern game(s).`);
console.log(`Catalog now has ${merged.length} games (${historic.length} historic + ${extras.length} modern).`);
console.log(`Top 5 by iconic: ${merged.slice(0, 5).map((g) => `${g.title} (${g.iconic})`).join(" · ")}`);
