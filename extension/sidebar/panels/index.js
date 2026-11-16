import { NaskahPanel } from "./NaskahPanel.js";
import { RencanaPanel } from "./RencanaPanel.js";
import { KarakterPanel } from "./KarakterPanel.js";
import { DuniaPanel } from "./DuniaPanel.js";
import { RisetPanel } from "./RisetPanel.js";
import { DataPanel } from "./DataPanel.js";
import { TargetPanel } from "./TargetPanel.js";
import { AnalisisPanel } from "./AnalisisPanel.js";
import { AsistenPanel } from "./AsistenPanel.js";
import { EksporPanel } from "./EksporPanel.js";
import { RpaPanel } from "./RpaPanel.js";
import { KoneksiPanel } from "./KoneksiPanel.js";
import { SettingsPanel } from "./SettingsPanel.js";

/** PANELS — registri tab vertikal. Panel dibuat malas (lazy) saat pertama kali dibuka. */
export const PANELS = [
  { id: "naskah", title: "Naskah", icon: "quill", make: (ctx) => new NaskahPanel(ctx) },
  { id: "rencana", title: "Rencana", icon: "board", make: (ctx) => new RencanaPanel(ctx) },
  { id: "karakter", title: "Tokoh", icon: "users", make: (ctx) => new KarakterPanel(ctx) },
  { id: "dunia", title: "Dunia", icon: "globe", make: (ctx) => new DuniaPanel(ctx) },
  { id: "riset", title: "Riset", icon: "clip", make: (ctx) => new RisetPanel(ctx) },
  { id: "data", title: "Data", icon: "database", make: (ctx) => new DataPanel(ctx) },
  { id: "target", title: "Target & Ritme", icon: "target", make: (ctx) => new TargetPanel(ctx) },
  { id: "analisis", title: "Analisis", icon: "gauge", make: (ctx) => new AnalisisPanel(ctx) },
  { id: "asisten", title: "Asisten AI", icon: "spark", make: (ctx) => new AsistenPanel(ctx) },
  { id: "ekspor", title: "Ekspor & Kirim", icon: "export", make: (ctx) => new EksporPanel(ctx) },
  { id: "rpa", title: "Otomatisasi", icon: "robot", make: (ctx) => new RpaPanel(ctx) },
  { id: "koneksi", title: "Koneksi", icon: "plug", make: (ctx) => new KoneksiPanel(ctx) },
  { id: "settings", title: "Pengaturan", icon: "sliders", bottom: true, make: (ctx) => new SettingsPanel(ctx) },
];