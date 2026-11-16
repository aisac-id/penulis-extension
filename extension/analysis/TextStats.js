export class TextStats {
  static words(text) {
    const m = String(text || "").match(/[\p{L}\p{N}'’-]+/gu);
    return m ? m.length : 0;
  }
  static sentences(text) {
    return String(text || "").split(/(?<=[.!?…])["'”’)\]]*\s+|\n{2,}/u).map((s) => s.trim()).filter((s) => s.length > 1);
  }
  static paragraphs(text) {
    return String(text || "").split(/\n{2,}|\n(?=\s{2,})/).map((p) => p.trim()).filter(Boolean);
  }
  static syllables(word) {
    const w = String(word).toLowerCase().replace(/[^a-z]/g, "");
    if (!w) return 0;
    const groups = w.match(/[aeiou]+/g);
    return Math.max(1, groups ? groups.length : 1);
  }
  static readability(text) {
    const words = TextStats.words(text);
    if (!words) return 0;
    const sents = TextStats.sentences(text).length || 1;
    const syl = (String(text || "").match(/[\p{L}]+/gu) || []).reduce((a, w) => a + TextStats.syllables(w), 0);
    return Math.max(0, Math.min(100, Math.round(206.835 - 1.015 * (words / sents) - 65.14 * (syl / words))));
  }
  static freq(text, { min = 3, stop = true } = {}) {
    const list = (String(text || "").toLowerCase().match(/[\p{L}'’-]+/gu) || [])
      .filter((w) => w.length >= min && (!stop || !TextStats.STOP.has(w)));
    const map = new Map();
    for (const w of list) map.set(w, (map.get(w) || 0) + 1);
    return [...map.entries()].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count);
  }
  static dialogueRatio(text) {
    const sents = TextStats.sentences(text);
    if (!sents.length) return 0;
    return sents.filter((s) => /^["“”']|["“”]$/.test(s.trim())).length / sents.length;
  }
  static readingMinutes(words, wpm = 220) { return Math.max(1, Math.round(words / wpm)); }
  static stats(text) {
    const t = String(text || "");
    const words = TextStats.words(t);
    const sentences = TextStats.sentences(t);
    const paragraphs = TextStats.paragraphs(t);
    return {
      words,
      chars: t.replace(/\s/g, "").length,
      sentences: sentences.length,
      paragraphs: paragraphs.length,
      avgSentence: sentences.length ? Math.round((words / sentences.length) * 10) / 10 : 0,
      avgParagraph: paragraphs.length ? Math.round(words / paragraphs.length) : 0,
      readability: TextStats.readability(t),
      dialogue: TextStats.dialogueRatio(t),
      minutes: TextStats.readingMinutes(words),
      pages: Math.max(1, Math.round(words / 275)),
      longest: sentences.reduce((a, s) => Math.max(a, TextStats.words(s)), 0),
    };
  }
  static summarize(text, max = 3) {
    const sents = TextStats.sentences(text);
    if (sents.length <= max) return sents.join(" ");
    const weights = new Map(TextStats.freq(text, { min: 4 }).map((f) => [f.word, f.count]));
    return sents.map((s, i) => {
      const ws = s.toLowerCase().match(/[\p{L}]+/gu) || [];
      return { s, i, score: ws.reduce((a, w) => a + (weights.get(w) || 0), 0) / Math.max(6, ws.length) + (i === 0 ? 1.2 : 0) };
    }).sort((a, b) => b.score - a.score).slice(0, max).sort((a, b) => a.i - b.i).map((x) => x.s).join(" ");
  }
  static titleCase(s) {
    return String(s || "").replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  }
  static excerpt(text, n = 160) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
  }
}
TextStats.STOP = new Set(("yang dan di ke dari untuk dengan pada adalah itu ini tidak akan saya aku kamu dia mereka kita " +
  "sudah telah bisa dapat juga atau tapi tetapi karena jika saat ketika ada oleh dalam sebagai lebih hanya " +
  "saja masih harus nya lah kah pun para sebuah seorang satu dua agar supaya begitu seperti antara setelah " +
  "sebelum lalu kemudian namun maka hingga sampai tanpa bukan belum sedang the a an of to in and").split(/\s+/));
