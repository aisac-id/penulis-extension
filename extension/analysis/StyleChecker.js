import { TextStats } from "./TextStats.js";
const KLISE = [
  "seolah tak percaya", "tidak percaya dengan apa", "hatinya hancur berkeping", "air mata mengalir", "menarik napas dalam",
  "menghela napas panjang", "diam seribu bahasa", "bagai disambar petir", "seperti disambar petir", "waktu seakan berhenti",
  "senyum mengembang", "bulu kuduk", "jantung berdegup kencang", "dingin menusuk tulang", "bak anak ayam kehilangan induk",
  "bagai pinang dibelah dua", "tak berkutik", "dalam sekejap mata", "hujan deras mengguyur",
];
const FILTER = ["merasa", "melihat", "mendengar", "mencium", "menyadari", "tampak", "terdengar", "terasa", "memikirkan", "mengetahui", "melihat bahwa"];
const ADV = /(\w+nya\b|\w+ sekali\b|secara \w+|dengan \w+nya\b|sangat \w+|begitu \w+)/giu;
const PASSIVE = /\b(di[a-z]{3,})\b/giu;
const CRUTCH = ["sangat", "agak", "cukup", "benar-benar", "sebenarnya", "hanya", "justu", "memang", "sedikit", "begitu"];
const SEV = { high: 0, med: 1, low: 2 };
export class StyleChecker {
  constructor(settings) { this.settings = settings; }
  check(text) {
    const t = String(text || "");
    const findings = [];
    const longLimit = this.settings.num("analisis.kalimatPanjang");
    const paraLimit = this.settings.num("analisis.paragrafPanjang");
    let offset = 0;
    for (const s of TextStats.sentences(t)) {
      const at = t.indexOf(s, offset);
      offset = at >= 0 ? at + s.length : offset;
      const w = TextStats.words(s);
      if (w > longLimit) findings.push(this.f("long", "high", `Kalimat ${w} kata (ambang ${longLimit}).`, s, at, "Pecah jadi dua kalimat, atau buang satu klausa."));
      if (this.settings.bool("analisis.cekPasif")) {
        for (const m of s.matchAll(PASSIVE)) {
          if (["dia", "diri", "diam", "diah", "dia.", "dini", "dini."].includes(m[1].toLowerCase())) continue;
          findings.push(this.f("passive", "low", `Pasif: "${m[1]}"`, s, at + m.index, "Kalau pelakunya penting, jadikan aktif."));
        }
      }
      if (this.settings.bool("analisis.cekAdverbia")) {
        for (const m of s.matchAll(ADV)) {
          if (m[1].length < 6) continue;
          findings.push(this.f("adverb", "low", `Adverbia: "${m[1]}"`, s, at + m.index, "Ganti dengan kata kerja yang lebih tepat."));
        }
      }
      if (this.settings.bool("analisis.cekKlise")) {
        for (const k of KLISE) {
          const i = s.toLowerCase().indexOf(k);
          if (i >= 0) findings.push(this.f("cliche", "high", `Klise: "${k}"`, s, at + i, "Tulis pengamatan khas adegan ini."));
        }
      }
      if (this.settings.bool("analisis.cekFilter")) {
        for (const k of FILTER) {
          const m = new RegExp(`\\b${k}\\b`, "i").exec(s);
          if (m) findings.push(this.f("filter", "med", `Kata penyaring: "${k}"`, s, at + m.index, "Buang penyaringnya, langsung ke yang dialami tokoh."));
        }
      }
      for (const c of CRUTCH) {
        const hits = [...s.matchAll(new RegExp(`\\b${c}\\b`, "gi"))];
        if (hits.length >= 2) findings.push(this.f("crutch", "low", `Kata penopang "${c}" ${hits.length}× dalam satu kalimat.`, s, at + hits[0].index, "Sisakan satu."));
      }
    }
    for (const p of TextStats.paragraphs(t)) {
      const w = TextStats.words(p);
      if (w > paraLimit) findings.push(this.f("paragraph", "med", `Paragraf padat: ${w} kata.`, TextStats.excerpt(p, 120), t.indexOf(p), "Beri jeda: satu paragraf, satu gerakan."));
    }
    const per1000 = this.settings.num("analisis.kataUlang");
    const total = TextStats.words(t) || 1;
    for (const f of TextStats.freq(t, { min: 5 }).slice(0, 40)) {
      const rate = (f.count / total) * 1000;
      if (rate >= per1000 && f.count >= 4) {
        findings.push(this.f("repeat", "med", `"${f.word}" ${f.count}× (${rate.toFixed(1)}/1000 kata).`, "", t.toLowerCase().indexOf(f.word), "Variasikan atau buang sebagian."));
      }
    }
    return findings.sort((a, b) => (SEV[a.sev] - SEV[b.sev]) || a.at - b.at);
  }
  f(kind, sev, title, snippet, at, advice) {
    return { id: `${kind}_${at}`, kind, sev, title, snippet: TextStats.excerpt(snippet, 150), at: Math.max(0, at || 0), advice };
  }
  score(text, findings = null) {
    const words = TextStats.words(text);
    if (!words) return { score: 0, findings: [], stats: TextStats.stats(text) };
    const list = findings || this.check(text);
    const penalty = list.reduce((a, f) => a + ({ high: 3, med: 1.6, low: 0.7 }[f.sev] || 1), 0);
    const per1000 = (penalty / words) * 1000;
    return { score: Math.max(0, Math.min(100, Math.round(100 - per1000 * 1.4))), findings: list, stats: TextStats.stats(text), per1000: Math.round(per1000 * 10) / 10 };
  }
  byKind(findings) {
    const map = new Map();
    for (const f of findings) map.set(f.kind, (map.get(f.kind) || 0) + 1);
    return [...map.entries()].map(([kind, count]) => ({ kind, count, label: StyleChecker.LABELS[kind] || kind }));
  }
  tidy(text) {
    const before = String(text || "");
    const t = before
      .replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").replace(/ {2,}/g, " ")
      .replace(/\s+([,.;:!?])/g, "$1").replace(/([,;:])(?=[^\s\n])/g, "$1 ")
      .replace(/"([^"]*)"/g, "“$1”")
      .replace(/\.\.\./g, "…");
    return { text: t, changed: t !== before };
  }
}
StyleChecker.LABELS = {
  long: "Kalimat panjang", passive: "Kalimat pasif", adverb: "Adverbia", cliche: "Klise",
  filter: "Kata penyaring", crutch: "Kata penopang", paragraph: "Paragraf padat", repeat: "Pengulangan",
};
