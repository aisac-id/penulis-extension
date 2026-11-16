// build.mjs — memadatkan extension/ menjadi dist/extension tanpa bundler.
// Struktur berkas, nama class, nama metode, dan urutan modul TETAP sama; yang dibuang
// hanya spasi, komentar, dan titik-koma berlebih. Sumber terbaca tetap di extension/.
import fs from "node:fs";
import path from "node:path";
import { minify } from "terser";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "extension");
const OUT = path.join(ROOT, "dist", "extension");

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : [p];
});

const bytes = (files) => files.reduce((n, f) => n + fs.statSync(f).size, 0);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

async function packJs(code, name) {
  const r = await minify(code, {
    module: true,
    ecma: 2022,
    compress: { passes: 2, unsafe: false },
    mangle: { toplevel: false, keep_classnames: true, keep_fnames: true },
    format: { comments: false, semicolons: true, wrap_func_args: false },
  });
  if (!r.code) throw new Error(`Gagal memadatkan ${name}`);
  return r.code;
}

function packCss(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s*\n\s*/g, "")
    .replace(/\s*([{}:;,>])\s*/g, "$1")
    .replace(/;}/g, "}")
    .replace(/#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3\b/gi, "#$1$2$3")
    .replace(/\b0(?:px|em|rem|%|vh|vw|s|ms)\b/g, "0")
    .replace(/(:|,)0\./g, "$1.")
    .trim();
}

// HTML: buang komentar & whitespace antar-tag; isi <pre>/<textarea>/<script>/<style> utuh.
function packHtml(code) {
  const keep = [];
  let out = code.replace(/<(pre|textarea|script|style)\b[\s\S]*?<\/\1>/gi, (m) => `\u0000${keep.push(m) - 1}\u0000`);
  out = out.replace(/<!--[\s\S]*?-->/g, "").replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").replace(/>\s+</g, "><").trim();
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[Number(i)]);
}

const files = walk(SRC);
fs.rmSync(path.join(ROOT, "dist"), { recursive: true, force: true });
let before = 0;
let after = 0;
for (const file of files) {
  const rel = path.relative(SRC, file);
  // Companion desktop dipasang ke sistem operasi, bukan dibaca Chrome: ikut paket rilis,
  // tetapi di luar folder extension agar tidak menambah ukuran unpacked.
  const dest = rel.startsWith(`connectors${path.sep}native-host`)
    ? path.join(ROOT, "dist", "companion", path.basename(rel))
    : path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const size = fs.statSync(file).size;
  before += size;
  const ext = path.extname(file);
  if (ext === ".js") {
    const out = await packJs(fs.readFileSync(file, "utf8"), rel);
    fs.writeFileSync(dest, out);
  } else if (ext === ".css") {
    fs.writeFileSync(dest, packCss(fs.readFileSync(file, "utf8")));
  } else if (ext === ".html") {
    fs.writeFileSync(dest, packHtml(fs.readFileSync(file, "utf8")));
  } else {
    fs.copyFileSync(file, dest);
  }
  if (dest.startsWith(OUT)) after += fs.statSync(dest).size;
}

const outFiles = walk(OUT);
console.log(`Sumber  extension/     ${kb(bytes(files))} (${files.length} berkas)`);
console.log(`Padat   dist/extension ${kb(bytes(outFiles))} (${outFiles.length} berkas)`);
console.log(`Hemat   ${kb(before - after)} · batas Harness 500 KB: ${after < 500 * 1024 ? "LULUS" : "GAGAL"}`);
if (after >= 500 * 1024) process.exitCode = 1;