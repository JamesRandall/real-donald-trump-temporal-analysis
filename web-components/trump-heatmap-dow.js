// trump-heatmap-dow — weekday × hour heatmap with marginal histogram.
// The bundler injects the CSV into the placeholder string below at build time.
// Drop the bundled file in Hugo's static/ folder, <script> it, and use
// <trump-heatmap-dow></trump-heatmap-dow>.

(() => {
  const PRELOADED_CSV = `__CSV_PLACEHOLDER__`;

  const PALETTES = {
    ember: { stops: ["#f4efe6", "#f0d5a8", "#e89968", "#c95a2e", "#7a1d0d"] },
    ink:   { stops: ["#f4efe6", "#c9bea8", "#7a6f5c", "#3a342a", "#1a1814"] },
    moss:  { stops: ["#f4efe6", "#c8d4ad", "#7a9258", "#3d5a2a", "#1a2a10"] },
  };

  const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const WEEKEND = [5, 6];

  const HOUR_LABEL = (h) => {
    const ampm = h < 12 ? "am" : "pm";
    const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hh}${ampm}`;
  };

  const lerpColor = (a, b, t) => {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
    const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
    return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
  };

  const rampColor = (t, paletteName) => {
    const stops = PALETTES[paletteName].stops;
    if (t <= 0) return stops[0];
    if (t >= 1) return stops[stops.length - 1];
    const seg = t * (stops.length - 1);
    const i = Math.floor(seg);
    return lerpColor(stops[i], stops[i + 1], seg - i);
  };

  const parseCSV = (text) => {
    const lines = text.trim().split(/\r?\n/);
    const matrix = [];
    for (const row of lines.slice(1)) {
      const cells = row.split(",");
      matrix[Number(cells[0])] = cells.slice(1, 8).map(Number);
    }
    return { matrix };
  };

  const STYLES = `
    :host {
      display: block;
      --thm-ink: #1a1814;
      --thm-ink-soft: #5a5346;
      --thm-ink-faint: #a39885;
      --thm-paper: #f4efe6;
      --thm-paper-warm: #ebe4d4;
      --thm-rule: #c9bea8;
      --thm-accent: #8b2c1a;
      --thm-weekend: #8b2c1a;
      font-family: "Fraunces", Georgia, serif;
      font-variant-numeric: tabular-nums;
      background: var(--thm-paper);
      color: var(--thm-ink);
      padding: 1.5rem;
      border: 1px solid var(--thm-rule);
    }
    * { box-sizing: border-box; }
    .controls {
      display: flex; gap: 1.2rem; align-items: center; flex-wrap: wrap;
      margin-bottom: 1.2rem;
      font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.78rem;
    }
    .controls label {
      display: inline-flex; align-items: center; gap: 0.5rem;
      color: var(--thm-ink-soft);
      text-transform: uppercase; letter-spacing: 0.1em;
    }
    select, button {
      font: inherit;
      padding: 0.35rem 0.6rem;
      background: var(--thm-paper-warm);
      border: 1px solid var(--thm-rule);
      color: var(--thm-ink);
      cursor: pointer;
    }
    button:hover { background: var(--thm-ink); color: var(--thm-paper); }
    .info-btn {
      width: 1.5em; height: 1.5em; padding: 0;
      border-radius: 50%; line-height: 1;
      display: inline-flex; align-items: center; justify-content: center;
      margin-left: 0.3rem; color: var(--thm-ink-soft);
    }
    .info-btn[aria-expanded="true"] { background: var(--thm-ink); color: var(--thm-paper); }
    .info-panel {
      font-size: 0.95rem; line-height: 1.5;
      color: var(--thm-ink-soft);
      background: var(--thm-paper-warm);
      border: 1px solid var(--thm-rule);
      border-left: 3px solid var(--thm-accent);
      padding: 0.9rem 1.1rem;
      margin: 0 0 1.2rem;
      max-width: 68ch;
    }
    .info-panel h4 {
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 0.7rem; letter-spacing: 0.12em;
      text-transform: uppercase;
      margin: 0 0 0.4rem; color: var(--thm-ink);
    }
    .info-panel p { margin: 0 0 0.55rem; }
    .info-panel p:last-child { margin: 0; }
    .info-panel strong { color: var(--thm-ink); font-weight: 600; }
    .chart-wrap { position: relative; }
    svg { display: block; width: 100%; height: auto; overflow: visible; }
    .cell { stroke: var(--thm-paper); stroke-width: 1; cursor: crosshair; }
    .cell:hover { stroke: var(--thm-ink); stroke-width: 1.5; }
    .axis text {
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 11px; fill: var(--thm-ink-soft);
    }
    .axis text.weekend { fill: var(--thm-weekend); font-weight: 500; }
    .axis-title {
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 10px; fill: var(--thm-ink);
      text-transform: uppercase; letter-spacing: 0.15em;
    }
    .band-label {
      font-family: "Fraunces", Georgia, serif;
      font-style: italic; font-size: 11px;
      fill: var(--thm-ink-faint);
    }
    .marginal-bar { fill: var(--thm-ink-soft); }
    .legend-tick {
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 10px; fill: var(--thm-ink-soft);
    }
    .tooltip {
      position: absolute;
      pointer-events: none;
      background: var(--thm-ink);
      color: var(--thm-paper);
      padding: 0.5rem 0.7rem;
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 0.7rem;
      line-height: 1.5;
      opacity: 0;
      transition: opacity 0.12s;
      white-space: nowrap;
      z-index: 10;
    }
    .tooltip strong { color: var(--thm-paper); font-weight: 500; }
    .tooltip .val { color: #f0c060; font-weight: 500; }
  `;

  const MARKUP = `
    <div class="controls">
      <label>Scale
        <select data-id="scale">
          <option value="global">Across all cells</option>
          <option value="dow">Within each weekday</option>
        </select>
      </label>
      <button class="info-btn" type="button" aria-expanded="false" data-info="scale-help" title="What do these mean?">?</button>
      <label>Palette
        <select data-id="palette">
          <option value="ember">Ember</option>
          <option value="ink">Ink</option>
          <option value="moss">Moss</option>
        </select>
      </label>
    </div>
    <div class="info-panel" data-id="scale-help" hidden>
      <h4>Scale mode</h4>
      <p><strong>Across all cells</strong> uses one shared scale anchored at the largest percentage anywhere in the matrix.</p>
      <p><strong>Within each weekday</strong> normalises colour per column — each weekday's darkest cell hits the top of the palette.</p>
    </div>
    <div class="chart-wrap" data-id="chart-wrap">
      <svg data-id="chart"></svg>
      <div class="tooltip" data-id="tooltip"></div>
    </div>
  `;

  class TrumpHeatmapDow extends HTMLElement {
    static get observedAttributes() { return ["scale", "palette"]; }

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `<style>${STYLES}</style>${MARKUP}`;
      this.DATA = parseCSV(PRELOADED_CSV);
      this._q = (id) => this.shadowRoot.querySelector(`[data-id="${id}"]`);
      this._handleDocClick = this._handleDocClick.bind(this);
      this._handleEsc = this._handleEsc.bind(this);
    }

    connectedCallback() {
      this._wireControls();
      this.render();
      document.addEventListener("click", this._handleDocClick);
      document.addEventListener("keydown", this._handleEsc);
    }

    attributeChangedCallback(name, oldVal, newVal) {
      if (oldVal === newVal) return;
      if ((name === "scale" || name === "palette") && newVal) this._q(name).value = newVal;
      if (this.isConnected) this.render();
    }

    disconnectedCallback() {
      document.removeEventListener("click", this._handleDocClick);
      document.removeEventListener("keydown", this._handleEsc);
    }

    _wireControls() {
      this._q("scale").addEventListener("change", () => this.render());
      this._q("palette").addEventListener("change", () => this.render());
      this.shadowRoot.querySelectorAll(".info-btn").forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const panel = this._q(btn.dataset.info);
          const wasOpen = btn.getAttribute("aria-expanded") === "true";
          this._closeAllPanels();
          if (!wasOpen) { btn.setAttribute("aria-expanded", "true"); panel.hidden = false; }
        });
      });
    }

    _closeAllPanels() {
      this.shadowRoot.querySelectorAll(".info-btn").forEach((b) => b.setAttribute("aria-expanded", "false"));
      this.shadowRoot.querySelectorAll(".info-panel").forEach((p) => { p.hidden = true; });
    }

    _handleDocClick(ev) {
      const path = ev.composedPath();
      if (!path.includes(this)) { this._closeAllPanels(); return; }
      const inControl = path.some((n) => n.classList && (n.classList.contains("info-panel") || n.classList.contains("info-btn")));
      if (!inControl) this._closeAllPanels();
    }

    _handleEsc(ev) { if (ev.key === "Escape") this._closeAllPanels(); }

    render() {
      const scaleMode = this._q("scale").value;
      const paletteName = this._q("palette").value;
      const { matrix } = this.DATA;

      let globalMax = 0;
      for (let h = 0; h < 24; h++) for (let d = 0; d < 7; d++) globalMax = Math.max(globalMax, matrix[h]?.[d] || 0);
      const dowMax = Array.from({ length: 7 }, (_, d) => {
        let m = 0;
        for (let h = 0; h < 24; h++) m = Math.max(m, matrix[h]?.[d] || 0);
        return m;
      });
      const hourTotals = Array.from({ length: 24 }, (_, h) => {
        let s = 0;
        for (let d = 0; d < 7; d++) s += matrix[h]?.[d] || 0;
        return s;
      });
      const hourTotalMax = Math.max(...hourTotals);
      const tFor = (val, d) => {
        if (scaleMode === "dow") return dowMax[d] === 0 ? 0 : val / dowMax[d];
        return globalMax === 0 ? 0 : val / globalMax;
      };

      const cellW = 60, cellH = 20;
      const marginalW = 100;
      const margin = { top: 50, right: 20, bottom: 50, left: 60 };
      const gridW = cellW * 7;
      const gridH = cellH * 24;
      const width = margin.left + gridW + 14 + marginalW + margin.right;
      const height = margin.top + gridH + margin.bottom;

      const svg = this._q("chart");
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      svg.innerHTML = "";

      const ns = "http://www.w3.org/2000/svg";
      const el = (tag, attrs = {}, text = null) => {
        const e = document.createElementNS(ns, tag);
        for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
        if (text !== null) e.textContent = text;
        return e;
      };

      DOW_LABELS.forEach((d, i) => {
        const x = margin.left + i * cellW + cellW / 2;
        const cls = WEEKEND.includes(i) ? "axis weekend" : "axis";
        svg.appendChild(el("text", { x, y: margin.top - 12, "text-anchor": "middle", class: cls }, d));
      });
      svg.appendChild(el("text", {
        x: margin.left + gridW / 2, y: 18, "text-anchor": "middle", class: "axis-title",
      }, "Day of week"));

      for (let h = 0; h < 24; h++) {
        if (h % 3 !== 0) continue;
        svg.appendChild(el("text", {
          x: margin.left - 8, y: margin.top + h * cellH + cellH / 2 + 4,
          "text-anchor": "end", class: "axis",
        }, HOUR_LABEL(h)));
      }
      svg.appendChild(el("text", {
        x: 14, y: margin.top + 12 * cellH,
        transform: `rotate(-90 14 ${margin.top + 12 * cellH})`,
        "text-anchor": "middle", class: "axis-title",
      }, "Hour of day"));

      const tooltip = this._q("tooltip");
      const wrap = this._q("chart-wrap");

      for (let h = 0; h < 24; h++) {
        for (let d = 0; d < 7; d++) {
          const v = matrix[h]?.[d] || 0;
          const t = tFor(v, d);
          const rect = el("rect", {
            x: margin.left + d * cellW, y: margin.top + h * cellH,
            width: cellW, height: cellH,
            fill: rampColor(t, paletteName), class: "cell",
          });
          rect.addEventListener("mousemove", (ev) => {
            tooltip.innerHTML = `<strong>${DOW_LABELS[d]} · ${HOUR_LABEL(h)}</strong><br><span class="val">${v.toFixed(2)}%</span> of all posts`;
            const rb = wrap.getBoundingClientRect();
            tooltip.style.left = (ev.clientX - rb.left + 12) + "px";
            tooltip.style.top = (ev.clientY - rb.top + 12) + "px";
            tooltip.style.opacity = "1";
          });
          rect.addEventListener("mouseleave", () => { tooltip.style.opacity = "0"; });
          svg.appendChild(rect);
        }
      }

      const bands = [
        { from: 0, to: 5, label: "small hours" },
        { from: 5, to: 12, label: "morning" },
        { from: 12, to: 17, label: "afternoon" },
        { from: 17, to: 22, label: "evening" },
        { from: 22, to: 24, label: "late" },
      ];
      const bandX = margin.left + gridW + 6;
      for (const b of bands) {
        const y = margin.top + b.from * cellH;
        const h = (b.to - b.from) * cellH;
        svg.appendChild(el("text", { x: bandX, y: y + h / 2 + 3, class: "band-label" }, b.label));
      }

      const margX = margin.left + gridW + 14 + 50;
      const margW = marginalW - 50;
      svg.appendChild(el("text", {
        x: margX + margW / 2, y: margin.top - 12,
        "text-anchor": "middle", class: "axis-title",
      }, "All days"));
      svg.appendChild(el("line", {
        x1: margX, x2: margX, y1: margin.top, y2: margin.top + gridH,
        stroke: "var(--thm-rule)", "stroke-width": "0.5",
      }));
      for (let h = 0; h < 24; h++) {
        const w = hourTotalMax === 0 ? 0 : (hourTotals[h] / hourTotalMax) * margW;
        const bar = el("rect", {
          x: margX, y: margin.top + h * cellH + 3,
          width: w, height: cellH - 6,
          class: "marginal-bar",
          fill: rampColor(hourTotals[h] / hourTotalMax, paletteName),
        });
        bar.addEventListener("mousemove", (ev) => {
          tooltip.innerHTML = `<strong>${HOUR_LABEL(h)} · all days</strong><br><span class="val">${hourTotals[h].toFixed(2)}%</span> of all posts`;
          const rb = wrap.getBoundingClientRect();
          tooltip.style.left = (ev.clientX - rb.left + 12) + "px";
          tooltip.style.top = (ev.clientY - rb.top + 12) + "px";
          tooltip.style.opacity = "1";
        });
        bar.addEventListener("mouseleave", () => { tooltip.style.opacity = "0"; });
        svg.appendChild(bar);
      }

      const legendW = 180, legendH = 8;
      const legendX = margin.left;
      const legendY = margin.top + gridH + 26;
      const gradId = "thd-grad-" + paletteName;
      const defs = el("defs");
      const grad = el("linearGradient", { id: gradId, x1: "0%", x2: "100%", y1: "0%", y2: "0%" });
      PALETTES[paletteName].stops.forEach((c, i) => {
        grad.appendChild(el("stop", { offset: (i / (PALETTES[paletteName].stops.length - 1) * 100) + "%", "stop-color": c }));
      });
      defs.appendChild(grad);
      svg.appendChild(defs);
      svg.appendChild(el("rect", { x: legendX, y: legendY - legendH, width: legendW, height: legendH, fill: `url(#${gradId})`, stroke: "var(--thm-rule)" }));
      svg.appendChild(el("text", { x: legendX, y: legendY + 12, class: "legend-tick" }, "less"));
      svg.appendChild(el("text", { x: legendX + legendW, y: legendY + 12, "text-anchor": "end", class: "legend-tick" }, "more"));
      svg.appendChild(el("text", { x: legendX + legendW / 2, y: legendY + 12, "text-anchor": "middle", class: "legend-tick" }, scaleMode === "dow" ? "per-weekday scale" : "shared scale"));
    }
  }

  if (!customElements.get("trump-heatmap-dow")) {
    customElements.define("trump-heatmap-dow", TrumpHeatmapDow);
  }
})();
