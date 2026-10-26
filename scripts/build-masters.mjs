import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Chess } from "chess.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
export const SEED = JSON.parse(readFileSync(join(__dirname, "masters-seed.json"), "utf8"));
export const OUT = join(ROOT, "src/lib/masters/catalog.json");

const MIN_PLIES = 10;

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function lastName(full) {
  const parts = full.trim().split(/\s+/);
  return parts[parts.length - 1] || full;
}

function splitGames(pgn) {
  const lines = pgn.split(/\r?\n/);
  const games = [];
  let cur = [];
  let sawMoves = false;
  for (const line of lines) {
    const isHeader = /^\s*\[/.test(line);
    if (isHeader && sawMoves) {
      games.push(cur.join("\n").trim());
      cur = [];
      sawMoves = false;
    }
    if (!isHeader && line.trim()) sawMoves = true;
    cur.push(line);
  }
  if (cur.join("").trim()) games.push(cur.join("\n").trim());
  return games.filter((g) => /\[Event/i.test(g));
}

function parseHeaders(game) {
  const headers = {};
  for (const m of game.matchAll(/\[(\w+)\s+"([^"]*)"\]/g)) headers[m[1]] = m[2];
  return headers;
}

function validate(game, headers) {
  const chess = new Chess();
  chess.loadPgn(game, { strict: false });
  const verbose = chess.history({ verbose: true });
  if (verbose.length < MIN_PLIES) throw new Error(`only ${verbose.length} plies`);
  const replay = new Chess(headers.FEN || undefined);
  for (const mv of verbose) {
    const made = replay.move(mv.san);
    if (!made) throw new Error(`illegal move ${mv.san}`);
  }
  const lastSan = verbose[verbose.length - 1].san;
  if (lastSan.includes("#") && !replay.isCheckmate()) throw new Error("claims mate but not checkmate");
  return verbose.length;
}

function findOverlay(headers) {
  const w = (headers.White || "").toLowerCase();
  const b = (headers.Black || "").toLowerCase();
  return SEED.overlays.find(
    (o) => w.includes(o.white.toLowerCase()) && b.includes(o.black.toLowerCase())
  );
}

export function overlayIconicFor(entry, seed = SEED) {
  const w = (entry.white || "").toLowerCase();
  const b = (entry.black || "").toLowerCase();
  const o = (seed.overlays || []).find(
    (ov) => w.includes(ov.white.toLowerCase()) && b.includes(ov.black.toLowerCase())
  );
  return o?.iconic ?? 0;
}

function yearOf(headers) {
  const y = Number((headers.Date || headers.EventDate || "").slice(0, 4));
  return Number.isFinite(y) && y > 1400 ? y : null;
}

function winnerSide(result) {
  if (result === "1-0") return "w";
  if (result === "0-1") return "b";
  return "w";
}

export function sortCatalog(catalog) {
  return catalog.sort(
    (a, b) => (b.iconic ?? 0) - (a.iconic ?? 0) || (a.year ?? 0) - (b.year ?? 0) || a.id.localeCompare(b.id)
  );
}

function extraPgn(extra) {
  const date = extra.year ? `${extra.year}.??.??` : "????.??.??";
  const headers = [
    `[Event "${extra.event ?? "?"}"]`,
    `[Site "?"]`,
    `[Date "${date}"]`,
    `[Round "?"]`,
    `[White "${extra.white}"]`,
    `[Black "${extra.black}"]`,
    `[Result "${extra.result ?? "*"}"]`,
  ].join("\n");
  return `${headers}\n\n${extra.moves.trim()}\n`;
}

function buildExtraEntry(extra, seenIds) {
  const pgn = extraPgn(extra);
  validate(pgn, { White: extra.white, Black: extra.black, Result: extra.result });
  const id = extra.id || slugify(`${lastName(extra.white)}-${lastName(extra.black)}-${extra.year ?? "x"}`);
  if (seenIds.has(id)) throw new Error(`duplicate id "${id}" for ${extra.white} vs ${extra.black}`);
  seenIds.add(id);
  return {
    id,
    pgn,
    title: extra.title ?? `${extra.white} vs ${extra.black}`,
    white: extra.white,
    black: extra.black,
    event: extra.event ?? null,
    year: extra.year ?? 0,
    result: extra.result ?? "*",
    studySide: extra.studySide ?? winnerSide(extra.result),
    tags: extra.tags ?? [],
    sourceUrl: extra.sourceUrl ?? null,
    teaser: {
      en: extra.teaser_en ?? `${extra.white} vs ${extra.black}${extra.year ? ` — ${extra.year}` : ""}.`,
      fr: extra.teaser_fr ?? `${extra.white} contre ${extra.black}${extra.year ? ` — ${extra.year}` : ""}.`,
    },
    iconic: extra.iconic ?? 0,
  };
}

export function buildExtraEntries(seed = SEED, seenIds = new Set()) {
  return (seed.extraGames || []).map((extra) => buildExtraEntry(extra, seenIds));
}

async function main() {
  console.log(`Fetching ${SEED.source} …`);
  const res = await fetch(SEED.source, { headers: { Accept: "application/x-chess-pgn, text/plain" } });
  if (!res.ok) throw new Error(`source fetch failed: HTTP ${res.status}`);
  const pgn = await res.text();

  const games = splitGames(pgn);
  console.log(`Found ${games.length} games; validating…`);

  const catalog = [];
  const seenIds = new Set();
  const errors = [];

  for (const game of games) {
    const headers = parseHeaders(game);
    const white = headers.White?.trim();
    const black = headers.Black?.trim();
    if (!white || !black) continue;
    try {
      validate(game, headers);
    } catch (e) {
      errors.push(`${white} vs ${black}: ${e.message}`);
      continue;
    }
    const year = yearOf(headers);
    const overlay = findOverlay(headers);
    const result = headers.Result || "*";

    let id = slugify(`${lastName(white)}-${lastName(black)}-${year ?? "x"}`);
    let n = 2;
    while (seenIds.has(id)) id = slugify(`${lastName(white)}-${lastName(black)}-${year ?? "x"}-${n++}`);
    seenIds.add(id);

    const title = overlay?.title ?? `${white} vs ${black}`;
    catalog.push({
      id,
      pgn: game.trim() + "\n",
      title,
      white,
      black,
      event: headers.Event?.trim() || null,
      year: year ?? 0,
      result,
      studySide: overlay?.studySide ?? winnerSide(result),
      tags: overlay?.tags ?? [],
      sourceUrl: headers.Site && /^https?:/.test(headers.Site) ? headers.Site : null,
      teaser: {
        en: overlay?.teaser_en ?? `${white} vs ${black}${year ? ` — ${year}` : ""}.`,
        fr: overlay?.teaser_fr ?? `${white} contre ${black}${year ? ` — ${year}` : ""}.`,
      },
      iconic: overlay?.iconic ?? 0,
    });
  }

  const extras = buildExtraEntries(SEED, seenIds);
  catalog.push(...extras);

  if (!catalog.length) throw new Error("no valid games produced");
  sortCatalog(catalog);

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(catalog, null, 2) + "\n");
  console.log(`\nWrote ${catalog.length} games → ${OUT}`);
  console.log(`  historic: ${catalog.length - extras.length} · curated modern: ${extras.length}`);
  console.log(`  with an iconic score: ${catalog.filter((g) => g.iconic > 0).length}`);
  if (errors.length) {
    console.log(`\nSkipped ${errors.length} unparseable game(s):`);
    for (const e of errors) console.log(`  - ${e}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error("BUILD FAILED:", e.message);
    process.exit(1);
  });
}
