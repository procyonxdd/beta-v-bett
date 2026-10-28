// Downloads each game's source from GitHub and installs its web build into games/<slug>/.
// Games with no runnable index.html (native/source-only repos) are skipped.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const run = promisify(execFile);
const list = JSON.parse(await fs.readFile("games-source.json", "utf8"));
const OUT = "games", MAX_GAME_KB = 40 * 1024, MAX_TOTAL_KB = 600 * 1024, CONC = 8;
const SKIP = new Set([".git", "node_modules"]);
let status = {};
try { status = JSON.parse(await fs.readFile(path.join(OUT, "_status.json"), "utf8")); } catch {}
let totalKB = 0;

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function hasIndex(d) {
  try { const h = await fs.readFile(path.join(d, "index.html"), "utf8");
    return h.length > 150 && !/<script[^>]+src=["']\/?src\/[^"']+\.(tsx?|jsx)["']/i.test(h); } catch { return false; }
}
async function findRoot(base) {
  for (const s of ["", "docs", "dist", "build", "public", "web", "www", "html", "WebGL", "export"]) {
    const d = path.join(base, s); if (await hasIndex(d)) return d;
  }
  let level = [base];
  for (let depth = 0; depth < 3; depth++) {
    const next = [];
    for (const d of level) {
      let ents; try { ents = await fs.readdir(d, { withFileTypes: true }); } catch { continue; }
      for (const e of ents) if (e.isDirectory() && !SKIP.has(e.name)) { const p = path.join(d, e.name); if (await hasIndex(p)) return p; next.push(p); }
    }
    level = next;
  }
  return null;
}
async function sizeKB(d) { const { stdout } = await run("du", ["-sk", d]); return parseInt(stdout, 10); }

async function doRepo(all) {
  const entries = [];
  for (const e of all) {
    if (status[e.slug] && status[e.slug] !== "ok") continue;
    if (await exists(path.join(OUT, e.slug, "index.html"))) { status[e.slug] = "ok"; totalKB += await sizeKB(path.join(OUT, e.slug)); } else entries.push(e);
  }
  if (!entries.length) return;
  const { owner, repo } = entries[0];
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "g-"));
  try {
    const subs = [...new Set(entries.map((e) => e.sub).filter(Boolean))];
    const whole = entries.some((e) => !e.sub);
    const ref = entries.find((e) => e.ref)?.ref;
    const args = ["clone", "--depth", "1", "--quiet", ...(ref ? ["--branch", ref] : []), ...(!whole ? ["--filter=blob:none", "--sparse"] : []), `https://github.com/${owner}/${repo}.git`, tmp + "/r"];
    await run("git", args, { timeout: 180000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
    if (!whole) await run("git", ["-C", tmp + "/r", "sparse-checkout", "set", ...subs], { timeout: 180000 });
    for (const e of entries) {
      try {
        const root = await findRoot(path.join(tmp, "r", e.sub));
        if (!root) { status[e.slug] = "no web build"; continue; }
        const dest = path.join(OUT, e.slug);
        await fs.rm(dest, { recursive: true, force: true });
        await fs.cp(root, dest, { recursive: true, filter: (s) => !SKIP.has(path.basename(s)) });
        const kb = await sizeKB(dest);
        if (kb > MAX_GAME_KB || totalKB + kb > MAX_TOTAL_KB) { await fs.rm(dest, { recursive: true, force: true }); status[e.slug] = "too big"; continue; }
        const idx = path.join(dest, "index.html");
        let h = await fs.readFile(idx, "utf8");
        h = h.replace(/(\s(?:src|href))=(["'])\/(?!\/)/gi, "$1=$2./");
        await fs.writeFile(idx, h);
        totalKB += kb; status[e.slug] = "ok";
      } catch (err) { status[e.slug] = "error: " + String(err.message).slice(0, 60); }
    }
  } catch (err) { for (const e of entries) status[e.slug] = "clone failed"; }
  finally { await fs.rm(tmp, { recursive: true, force: true }); }
}

await fs.mkdir(OUT, { recursive: true });
const byRepo = new Map();
for (const e of list) { const k = e.owner + "/" + e.repo; if (!byRepo.has(k)) byRepo.set(k, []); byRepo.get(k).push(e); }
const queue = [...byRepo.values()]; let done = 0;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (queue.length) { await doRepo(queue.shift()); await fs.writeFile(path.join(OUT, "_status.json"), JSON.stringify(status)); if (++done % 20 === 0) console.log(`${done}/${byRepo.size} repos`); }
}));
await fs.writeFile(path.join(OUT, "_status.json"), JSON.stringify(status));
const ok = Object.values(status).filter((v) => v === "ok").length;
console.log(`done: ${ok} games installed, ${Math.round(totalKB / 1024)} MB`);
