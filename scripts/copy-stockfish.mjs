import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const pkgRoot = join(process.cwd(), "node_modules", "stockfish");
const src = ["bin", "src"].map((d) => join(pkgRoot, d)).find((p) => existsSync(p));
const dest = join(process.cwd(), "public", "stockfish");

if (!src) {
  throw new Error("Stockfish package not found. Install dependencies before building.");
}

mkdirSync(dest, { recursive: true });
const files = readdirSync(src);

const entry =
  files.find((f) => f.includes("lite-single") && f.endsWith(".js")) ??
  files.find((f) => f.includes("-single") && f.endsWith(".js")) ??
  files.find((f) => f.endsWith(".js"));

if (!entry) {
  throw new Error(`Stockfish worker not found in ${src}`);
}

const base = entry.replace(/\.js$/, "");
if (!files.some(file => file.startsWith(base) && file.endsWith(".wasm"))) throw new Error("Stockfish WebAssembly asset is missing.");
let copied = 0;
for (const f of files) {
  if (f.startsWith(base)) {
    cpSync(join(src, f), join(dest, f));
    copied++;
  }
}
cpSync(join(pkgRoot, "Copying.txt"), join(dest, "COPYING.txt"));
const deep = files.find(f => /-single\.js$/.test(f) && !f.includes("lite"));
if (!deep) throw new Error("Stockfish deep worker not found.");
for (const file of files.filter(f => f.startsWith(deep.replace(/\.js$/, "")))) cpSync(join(src, file), join(dest, file));
const version = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")).version;
writeFileSync(join(dest, "manifest.json"), JSON.stringify({ version, js: entry, deep }));
console.log(`[copy-stockfish] copied ${copied} file(s), entry: ${entry}`);
