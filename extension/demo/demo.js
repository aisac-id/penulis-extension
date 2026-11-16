/** demo.js — perilaku halaman demo: formulir lokal tanpa jaringan, untuk latihan RPA. */
(() => {
  const form = document.querySelector("[data-form]");
  if (!form) return;
  const btn = form.querySelector("[data-kirim]");
  const ok = form.querySelector("[data-sukses]");
  btn.addEventListener("click", () => {
    const judul = form.querySelector("[data-field=judul]").value.trim();
    const penulis = form.querySelector("[data-field=penulis]").value.trim();
    const setuju = form.querySelector("[data-setuju]").checked;
    if (!judul || !penulis || !setuju) {
      ok.hidden = false;
      ok.className = "form-ok";
      ok.textContent = "Lengkapi judul, penulis, dan centang pernyataan hak cipta dulu.";
      ok.style.background = "#fbe3e3";
      ok.style.borderColor = "#e0a3a3";
      ok.style.color = "#8c2b2b";
      return;
    }
    ok.hidden = false;
    ok.style.background = "";
    ok.style.borderColor = "";
    ok.style.color = "";
    ok.textContent = `Proposal "${judul}" oleh ${penulis} diterima. Nomor antrean demo: KLM-1998-041.`;
  });
})();