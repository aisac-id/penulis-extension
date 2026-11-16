export class Branding {
  constructor(settings) { this.settings = settings; }
  get name() { return String(this.settings.get("lanjutan.brandNama") || "Kalam").slice(0, 28); }
  get accent() {
    const c = String(this.settings.get("lanjutan.brandWarna") || "#f6a723");
    return /^#[0-9a-f]{6}$/i.test(c) ? c : "#f6a723";
  }
  get help() { return String(this.settings.get("lanjutan.brandBantuan") || ""); }
  get tagline() { return "Ruang kerja penulis buku di sisi layar Anda"; }
  apply(root) {
    if (!root) return;
    root.style.setProperty("--brand-accent", this.accent);
    root.dataset.brand = this.name.toLowerCase().replace(/\s+/g, "-");
  }
  title(suffix = "") {
    return suffix ? `${this.name} — ${suffix}` : this.name;
  }
  exportHeader(project) {
    return {
      generator: `${this.name} 1.0.0`,
      brand: this.name,
      help: this.help,
      project: project?.title || "",
      exportedAt: new Date().toISOString(),
    };
  }
}
