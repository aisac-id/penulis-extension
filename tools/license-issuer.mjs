#!/usr/bin/env node
/**
 * license-issuer — penerbit kunci lisensi Kalam (Ed25519, offline).
 *
 *   node tools/license-issuer.mjs keygen
 *   node tools/license-issuer.mjs issue --edition pro --email penulis@example.com --days 365
 *   node tools/license-issuer.mjs verify --file docs/lisensi-demo.json
 *
 * Kunci privat JANGAN pernah masuk repo. Simpan di luar folder ekstensi.
 */
import { generateKeyPairSync, sign, verify, createPrivateKey, createPublicKey } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const arg = (name, def = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const cmd = process.argv[2] || "help";
const KEY_PATH = arg("key", "kalam-issuer-private.pem");
const canonical = (payload) => JSON.stringify(payload, Object.keys(payload).sort());

function keygen() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const spki = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  writeFileSync(KEY_PATH, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  console.log("Kunci privat :", KEY_PATH, "(simpan aman, jangan di-commit)");
  console.log("Kunci publik :", spki);
  console.log("Tempelkan ke license/Ed25519.js → PUBLIC_KEY, atau isi Pengaturan → Lanjutan → Kunci publik.");
}

function issue() {
  if (!existsSync(KEY_PATH)) {
    console.error(`Kunci privat ${KEY_PATH} tidak ada. Jalankan: node tools/license-issuer.mjs keygen`);
    process.exit(1);
  }
  const days = Number(arg("days", 365));
  const now = new Date();
  const payload = {
    product: "kalam",
    edition: arg("edition", "pro"),
    bundleId: arg("bundle", "direct"),
    seats: Number(arg("seats", 1)),
    issuedTo: arg("email", "penulis@example.com"),
    issuedAt: now.toISOString(),
    expiry: new Date(now.getTime() + days * 86400000).toISOString(),
  };
  const key = createPrivateKey(readFileSync(KEY_PATH));
  const signature = sign(null, Buffer.from(canonical(payload)), key).toString("base64");
  const out = arg("out", `lisensi-${payload.edition}.json`);
  writeFileSync(out, `${JSON.stringify({ payload, signature }, null, 2)}\n`);
  console.log("Lisensi ditulis:", out);
  console.log("Tempel isinya ke Pengaturan → Lanjutan → Lisensi.");
}

function verifyCmd() {
  const file = arg("file", "docs/lisensi-demo.json");
  const { payload, signature } = JSON.parse(readFileSync(file, "utf8"));
  const spki = arg("pub", null);
  let key;
  if (spki) key = createPublicKey({ key: Buffer.from(spki, "base64"), format: "der", type: "spki" });
  else key = createPublicKey(createPrivateKey(readFileSync(KEY_PATH)));
  const ok = verify(null, Buffer.from(canonical(payload)), key, Buffer.from(signature, "base64"));
  console.log(ok ? "Tanda tangan SAH." : "Tanda tangan TIDAK sah.");
  console.log("Edisi:", payload.edition, "| berlaku sampai:", payload.expiry);
  process.exit(ok ? 0 : 1);
}

if (cmd === "keygen") keygen();
else if (cmd === "issue") issue();
else if (cmd === "verify") verifyCmd();
else console.log("Perintah: keygen | issue | verify (lihat komentar di berkas ini)");