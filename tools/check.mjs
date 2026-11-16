// check.mjs — audit kepatuhan Harness v1.5: batas baris, ukuran, sintaks, dan pola terlarang.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import os from "node:os";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "extension");
const DIST = path.join(ROOT, "dist", "extension");
const MAX_LOC = 300;
const MAX_KB = 500;

const walk = (d) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : [p];
}) : [];

const files = walk(SRC);
const fails = [];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kalam-check-"));
let loc = 0;

for (const f of files) {
  const rel = path.relative(SRC, f);
  const ext = path.extname(f);
  if (![".js", ".css", ".html"].includes(ext)) continue;
  const text = fs.readFileSync(f, "utf8");
  const lines = text.split("\n").length;
  loc += lines;
  if (lines > MAX_LOC) fails.push(`${rel}: ${lines} baris (maks ${MAX_LOC})`);
  if (/[\u4e00-\u9fff]/.test(text)) fails.push(`${rel}: mengandung aksara non-Indonesia`);
  if (ext === ".js") {
    if (/\beval\s*\(|new Function\s*\(/.test(text)) fails.push(`${rel}: eval/new Function`);
    if (/https?:\/\/(cdn|unpkg|jsdelivr)/.test(text)) fails.push(`${rel}: CDN eksternal`);
    if (/\bTODO\b|\bFIXME\b/.test(text)) fails.push(`${rel}: penanda belum selesai`);
    const copy = path.join(tmp, `${path.basename(f, ".js")}.mjs`);
    fs.writeFileSync(copy, text);
    try { execFileSync(process.execPath, ["--check", copy], { stdio: "pipe" }); }
    catch (err) { fails.push(`${rel}: sintaks gagal — ${String(err.stderr).split("\n")[0]}`); }
  }
}

const size = (d) => walk(d).reduce((n, f) => n + fs.statSync(f).size, 0);
const srcKb = size(SRC) / 1024;
const distKb = size(DIST) / 1024;
if (distKb && distKb >= MAX_KB) fails.push(`dist/extension ${distKb.toFixed(1)} KB (maks ${MAX_KB} KB)`);
if (!distKb) fails.push("dist/extension belum dibuat — jalankan: npm run build");

const manifest = JSON.parse(fs.readFileSync(path.join(SRC, "manifest.json"), "utf8"));
if (manifest.manifest_version !== 3) fails.push("manifest bukan MV3");
for (const p of manifest.permissions || []) {
  if (["tabs", "history", "webRequestBlocking", "<all_urls>"].includes(p)) fails.push(`izin berlebihan: ${p}`);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Berkas diperiksa : ${files.length}`);
console.log(`Total baris kode : ${loc}`);
console.log(`Sumber           : ${srcKb.toFixed(1)} KB`);
console.log(`Paket pasang     : ${distKb.toFixed(1)} KB (batas ${MAX_KB} KB)`);
if (fails.length) {
  console.log(`\nGAGAL (${fails.length}):`);
  for (const f of fails) console.log(" -", f);
  process.exitCode = 1;
} else {
  console.log("\nLULUS: semua berkas ≤300 baris, sintaks sah, tanpa eval/CDN/TODO, paket di bawah batas ukuran.");
}