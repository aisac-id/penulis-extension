import { h, icon, num, debounce } from "./Dom.js";

export class Controls {
  constructor(settings) { this.settings = settings; }

  field(spec, value, onChange) {
    const t = spec.type;
    if (t === "toggle") return this.toggle(spec.label, value, onChange, spec.desc);
    if (t === "range") return this.slider(spec, value, onChange);
    if (t === "number") return this.stepper(spec, value, onChange);
    if (t === "select") return this.select(spec, value, onChange);
    if (t === "color") return this.color(spec, value, onChange);
    return this.text(spec, value, onChange);
  }

  static row(label, control, desc) {
    return h("div", { class: "ctl" }, [
      h("div", { class: "ctl__meta" }, [h("span", { class: "ctl__label", text: label }), desc ? h("small", { class: "ctl__desc", text: desc }) : null]),
      control,
    ]);
  }

  toggle(label, value, onChange, desc = "") {
    const input = h("input", { type: "checkbox", class: "switch__input", checked: !!value, "aria-label": label });
    const sw = h("label", { class: `switch ${value ? "is-on" : ""}` }, [input, h("span", { class: "switch__track" }, [h("span", { class: "switch__knob" })])]);
    input.addEventListener("change", () => { sw.classList.toggle("is-on", input.checked); onChange(input.checked); });
    return Controls.row(label, sw, desc);
  }

  slider(spec, value, onChange) {
    const out = (v) => `${num(v)}${spec.unit ? ` ${spec.unit}` : ""}`;
    const val = h("output", { class: "slider__val", text: out(value) });
    const input = h("input", { type: "range", class: "slider", min: spec.min ?? 0, max: spec.max ?? 100, step: spec.step ?? 1, value, "aria-label": spec.label });
    const paint = () => {
      input.style.setProperty("--p", `${((input.value - input.min) / (input.max - input.min)) * 100}%`);
      val.textContent = out(input.value);
    };
    paint();
    input.addEventListener("input", () => { paint(); onChange(Number(input.value)); });
    return Controls.row(spec.label, h("div", { class: "slider-wrap" }, [input, val]), spec.desc);
  }

  stepper(spec, value, onChange) {
    const input = h("input", { type: "number", class: "input input--num", value, min: spec.min, max: spec.max, step: spec.step ?? 1, "aria-label": spec.label });
    const bump = (d) => {
      const next = Math.min(spec.max ?? Infinity, Math.max(spec.min ?? -Infinity, Number(input.value) + d * (spec.step ?? 1)));
      input.value = next;
      onChange(next);
    };
    input.addEventListener("change", () => onChange(Number(input.value)));
    return Controls.row(spec.label, h("div", { class: "stepper" }, [
      h("button", { class: "stepper__b", type: "button", "aria-label": `Kurangi ${spec.label}`, onclick: () => bump(-1) }, [icon("chevDown", 13)]),
      input,
      spec.unit ? h("span", { class: "stepper__u", text: spec.unit }) : null,
      h("button", { class: "stepper__b", type: "button", "aria-label": `Tambah ${spec.label}`, onclick: () => bump(1) }, [icon("chev", 13)]),
    ]), spec.desc);
  }

  select(spec, value, onChange) {
    const sel = h("select", { class: "input select", "aria-label": spec.label },
      spec.options.map(([v, l]) => h("option", { value: v, text: l, selected: v === value })));
    sel.value = value;
    sel.addEventListener("change", () => onChange(sel.value));
    return Controls.row(spec.label, sel, spec.desc);
  }

  color(spec, value, onChange) {
    const input = h("input", { type: "color", class: "color", value, "aria-label": spec.label });
    const code = h("code", { class: "color__code", text: value });
    input.addEventListener("input", () => { code.textContent = input.value; onChange(input.value); });
    return Controls.row(spec.label, h("div", { class: "color-wrap" }, [input, code]), spec.desc);
  }

  text(spec, value, onChange) {
    const input = h("input", { type: "text", class: "input", value: value ?? "", placeholder: spec.placeholder || "", "aria-label": spec.label });
    input.addEventListener("input", debounce(() => onChange(input.value), 250));
    return Controls.row(spec.label, input, spec.desc);
  }

  static search(placeholder, onInput, { value = "" } = {}) {
    const input = h("input", { type: "search", class: "input search__input", placeholder, value, "aria-label": placeholder });
    input.addEventListener("input", debounce(() => onInput(input.value), 160));
    return { box: h("div", { class: "search" }, [icon("search", 15), input]), input };
  }

  static segmented(options, active, onPick) {
    const wrap = h("div", { class: "seg", role: "tablist" });
    for (const o of options) {
      const b = h("button", {
        class: `seg__b ${o.value === active ? "is-active" : ""}`, type: "button", role: "tab",
        "aria-selected": o.value === active ? "true" : "false", text: o.label,
        onclick: () => {
          wrap.querySelectorAll(".seg__b").forEach((x) => { x.classList.remove("is-active"); x.setAttribute("aria-selected", "false"); });
          b.classList.add("is-active");
          b.setAttribute("aria-selected", "true");
          onPick(o.value);
        },
      });
      wrap.append(b);
    }
    return wrap;
  }

  static chip(label, tone = "ink", title = "") {
    return h("span", { class: `chip chip--${tone}`, title, text: label });
  }

  static stat(label, value, { tone = "cyan", sub = "", iconName = null } = {}) {
    return h("div", { class: `stat stat--${tone}` }, [
      h("div", { class: "stat__top" }, [iconName ? icon(iconName, 14) : null, h("span", { class: "stat__label", text: label })]),
      h("strong", { class: "stat__val", text: value }),
      sub ? h("small", { class: "stat__sub", text: sub }) : null,
    ]);
  }

  static progress(ratio, { tone = "cyan", label = "", height = 8 } = {}) {
    const r = Math.max(0, Math.min(1, ratio || 0));
    return h("div", { class: "prog", title: label }, [
      h("div", { class: `prog__bar prog__bar--${tone}`, style: { height: `${height}px` } }, [h("i", { style: { transform: `scaleX(${r})` } })]),
      label ? h("span", { class: "prog__label", text: label }) : null,
    ]);
  }

  static empty(title, desc, action = null) {
    return h("div", { class: "empty" }, [icon("quill", 26), h("strong", { text: title }), h("p", { class: "muted", text: desc }), action]);
  }

  static toolbar(children) { return h("div", { class: "toolbar" }, children); }

  static button(label, onClick, { kind = "", iconName = null, title = "", small = false } = {}) {
    return h("button", {
      class: `btn ${kind ? `btn--${kind}` : ""} ${small ? "btn--sm" : ""}`, type: "button", title: title || label, onclick: onClick,
    }, [iconName ? icon(iconName, 14) : null, h("span", { text: label })]);
  }

  static iconButton(name, label, onClick, { active = false, tone = "" } = {}) {
    return h("button", {
      class: `icon-btn ${active ? "is-active" : ""} ${tone ? `icon-btn--${tone}` : ""}`,
      type: "button", "aria-label": label, title: label, onclick: onClick,
    }, [icon(name, 16)]);
  }

  static fieldset(title, children, desc = "") {
    return h("section", { class: "fieldset" }, [
      h("header", { class: "fieldset__head" }, [h("h4", { text: title }), desc ? h("small", { class: "muted", text: desc }) : null]),
      h("div", { class: "fieldset__body" }, children),
    ]);
  }
}
