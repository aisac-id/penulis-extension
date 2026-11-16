import { h, num } from "./Dom.js";

const NS = "http://www.w3.org/2000/svg";
const s = (tag, attrs = {}, kids = []) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, String(v));
  for (const k of kids) el.append(k);
  return el;
};
const txt = (x, y, str, attrs = {}) => Object.assign(s("text", { x, y, ...attrs }), { textContent: str });
const titled = (el, str) => (el.append(Object.assign(s("title"), { textContent: str })), el);

export const SERIES = ["cyan", "amber", "magenta", "lime", "violet", "red", "blue", "teal"];
const VAR = (i) => `var(--c-${SERIES[i % SERIES.length]})`;

export class Chart {
  static frame(w, h2, cls = "") {
    return s("svg", { viewBox: `0 0 ${w} ${h2}`, width: w, height: h2, class: `chart ${cls}`, preserveAspectRatio: "xMidYMid meet", role: "img" });
  }

  static bars(days, { goal = 0, height = 168, width = 620 } = {}) {
    const pad = { l: 30, r: 8, t: 14, b: 22 };
    const svg = Chart.frame(width, height, "chart--bars");
    const max = Math.max(goal * 1.15, ...days.map((d) => d.words), 10);
    const iw = width - pad.l - pad.r;
    const ih = height - pad.t - pad.b;
    const bw = Math.max(3, (iw / days.length) * 0.66);
    for (let g = 0; g <= 2; g++) {
      const y = pad.t + (ih * g) / 2;
      svg.append(s("line", { x1: pad.l, y1: y, x2: width - pad.r, y2: y, class: "chart__grid" }));
      svg.append(txt(pad.l - 6, y + 3, num(max * (1 - g / 2)), { class: "chart__tick", "text-anchor": "end" }));
    }
    if (goal > 0) {
      const gy = pad.t + ih * (1 - goal / max);
      svg.append(s("line", { x1: pad.l, y1: gy, x2: width - pad.r, y2: gy, class: "chart__goal" }));
      svg.append(txt(width - pad.r, gy - 4, `target ${num(goal)}`, { class: "chart__goal-t", "text-anchor": "end" }));
    }
    const best = days.reduce((a, b) => (b.words > a.words ? b : a), days[0] || { words: 0 });
    days.forEach((d, i) => {
      const x = pad.l + (iw * (i + 0.5)) / days.length - bw / 2;
      const bh = Math.max(d.words > 0 ? 2 : 0, ih * (d.words / max));
      const hit = goal > 0 && d.words >= goal;
      const rect = titled(s("rect", {
        x, y: pad.t + ih - bh, width: bw, height: bh, rx: Math.min(3, bw / 2),
        class: `chart__bar ${hit ? "is-hit" : ""} ${d.isToday ? "is-today" : ""}`,
        fill: hit ? VAR(3) : d.isToday ? VAR(1) : VAR(0),
      }), `${d.label}: ${num(d.words)} kata`);
      svg.append(rect);
      if (d === best && d.words > 0) svg.append(txt(x + bw / 2, pad.t + ih - bh - 4, num(d.words), { class: "chart__val", "text-anchor": "middle" }));
      if (i % Math.ceil(days.length / 7) === 0 || d.isToday) {
        svg.append(txt(x + bw / 2, height - 6, d.short, { class: "chart__tick", "text-anchor": "middle" }));
      }
    });
    return svg;
  }

  static line(values, { height = 96, width = 620, tone = 4, label = "" } = {}) {
    const svg = Chart.frame(width, height, "chart--line");
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const pts = values.map((v, i) => {
      const x = 6 + ((width - 12) * i) / Math.max(1, values.length - 1);
      const y = height - 12 - ((height - 24) * (v - min)) / Math.max(1, max - min);
      return [x, y];
    });
    const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    svg.append(s("path", { d: `${d} L${pts.at(-1)[0]},${height - 6} L${pts[0][0]},${height - 6} Z`, fill: VAR(tone), opacity: 0.14 }));
    svg.append(s("path", { d, fill: "none", stroke: VAR(tone), "stroke-width": 2, "stroke-linejoin": "round" }));
    pts.forEach(([x, y], i) => {
      svg.append(titled(s("circle", { cx: x, cy: y, r: i === pts.length - 1 ? 3.4 : 1.8, fill: VAR(tone) }), `${i + 1}: ${num(values[i])}`));
    });
    if (label) svg.append(txt(8, 12, label, { class: "chart__tick" }));
    return svg;
  }

  static donut(parts, { size = 148, thickness = 20, center = "" } = {}) {
    const total = parts.reduce((a, p) => a + p.value, 0) || 1;
    const svg = s("svg", { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: "chart chart--donut", preserveAspectRatio: "xMidYMid meet", role: "img" });
    const r = size / 2 - thickness / 2 - 2;
    const c = size / 2;
    const defs = s("defs");
    parts.forEach((p, i) => {
      const pat = s("pattern", { id: `pat-${i}-${p.id || i}`, width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: `rotate(${i * 30})` });
      pat.append(s("rect", { width: 6, height: 6, fill: VAR(i) }));
      pat.append(s("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: "rgba(0,0,0,.32)", "stroke-width": i % 2 ? 2 : 1 }));
      defs.append(pat);
    });
    svg.append(defs);
    let acc = 0;
    parts.forEach((p, i) => {
      const frac = p.value / total;
      const len = 2 * Math.PI * r * frac;
      svg.append(titled(s("circle", {
        cx: c, cy: c, r, fill: "none", stroke: `url(#pat-${i}-${p.id || i})`, "stroke-width": thickness,
        "stroke-dasharray": `${len} ${2 * Math.PI * r - len}`, "stroke-dashoffset": -acc,
        transform: `rotate(-90 ${c} ${c})`, class: "chart__seg",
      }), `${p.label}: ${num(p.value)} (${Math.round(frac * 100)}%)`));
      acc += len;
    });
    if (center) {
      svg.append(txt(c, c - 1, center, { class: "chart__center", "text-anchor": "middle" }));
      svg.append(txt(c, c + 13, "total", { class: "chart__tick", "text-anchor": "middle" }));
    }
    return svg;
  }

  static legend(parts) {
    return h("ul", { class: "legend" }, parts.map((p, i) => h("li", {}, [
      h("i", { class: `legend__sw legend__sw--${SERIES[i % SERIES.length]}` }),
      h("span", { text: p.label }),
      h("b", { text: num(p.value) }),
    ])));
  }

  static heat(days, { cell = 13, gap = 3 } = {}) {
    const weeks = Math.ceil(days.length / 7);
    const w = weeks * (cell + gap) + 22;
    const hgt = 7 * (cell + gap) + 8;
    const svg = s("svg", { viewBox: `0 0 ${w} ${hgt}`, width: w, height: hgt, class: "chart chart--heat", preserveAspectRatio: "xMidYMid meet", role: "img" });
    const max = Math.max(...days.map((d) => d.words), 1);
    const names = ["S", "S", "R", "K", "J", "S", "M"];
    days.forEach((d, i) => {
      const col = Math.floor(i / 7);
      const row = i % 7;
      const lvl = d.words === 0 ? 0 : Math.min(4, Math.ceil((d.words / max) * 4));
      svg.append(titled(s("rect", {
        x: 20 + col * (cell + gap), y: 4 + row * (cell + gap), width: cell, height: cell, rx: 3,
        class: `heat heat--${lvl} ${d.isToday ? "is-today" : ""}`,
      }), `${d.label}: ${num(d.words)} kata`));
      if (col === 0) svg.append(txt(14, 4 + row * (cell + gap) + cell - 3, names[row], { class: "chart__tick", "text-anchor": "end" }));
    });
    return svg;
  }

  static hbars(items, { width = 560, rowH = 22, max = null } = {}) {
    const height = items.length * rowH + 8;
    const svg = s("svg", { viewBox: `0 0 ${width} ${height}`, width, height, class: "chart chart--hbars", preserveAspectRatio: "xMidYMid meet", role: "img" });
    const top = max || Math.max(...items.map((i) => i.value), 1);
    const labelW = 118;
    items.forEach((it, i) => {
      const y = 4 + i * rowH;
      const bw = ((width - labelW - 54) * it.value) / top;
      svg.append(txt(labelW - 8, y + rowH / 2 + 3, it.label, { class: "chart__label", "text-anchor": "end" }));
      svg.append(titled(s("rect", { x: labelW, y: y + 4, width: Math.max(2, bw), height: rowH - 10, rx: 3, fill: VAR(it.tone ?? i), class: "chart__bar" }), `${it.label}: ${num(it.value)}`));
      svg.append(txt(labelW + Math.max(2, bw) + 6, y + rowH / 2 + 3, num(it.value), { class: "chart__val" }));
    });
    return svg;
  }
}
