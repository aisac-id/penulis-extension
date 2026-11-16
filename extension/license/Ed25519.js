export class Ed25519 {
  // Kunci DEMO bawaan repo; ganti untuk build resmi.
  static PUBLIC_KEY = "MCowBQYDK2VwAyEAALc1CMplaumQq5TK0JI7LpupBVkO5RH9mE0Zz8MSEWc=";
  static b64ToBytes(b64) {
    const bin = atob(String(b64).replace(/\s+/g, ""));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  static async importKey(spkiBase64 = Ed25519.PUBLIC_KEY) {
    return crypto.subtle.importKey("spki", Ed25519.b64ToBytes(spkiBase64), { name: "Ed25519" }, false, ["verify"]);
  }
  // Kunci DEMO bawaan repo; ganti untuk build resmi.
  static canonical(payload) {
    return JSON.stringify(payload, Object.keys(payload).sort());
  }
  static async verify(payload, signatureBase64, spkiBase64 = Ed25519.PUBLIC_KEY) {
    try {
      const key = await Ed25519.importKey(spkiBase64);
      const data = new TextEncoder().encode(Ed25519.canonical(payload));
      return await crypto.subtle.verify({ name: "Ed25519" }, key, Ed25519.b64ToBytes(signatureBase64), data);
    } catch {
      return false;
    }
  }
  static supported() {
    return typeof crypto !== "undefined" && !!crypto.subtle;
  }
}
