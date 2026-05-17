// trump-heatmap-year — year × hour heatmap as a self-contained custom element.
// The bundler injects the CSV into the placeholder string below at build time.
// Drop the bundled file in your Hugo static/ folder, <script> it, and use
// <trump-heatmap-year></trump-heatmap-year> anywhere on the page.

(() => {
  const PRELOADED_CSV = `hour,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026
0,0.000,0.000,0.000,0.000,1.796,2.883,3.997,2.354,0.829,0.772,1.955,3.361,9.000,3.775,3.869,3.778,3.532,2.743
1,0.000,0.000,0.000,0.000,0.984,2.072,1.434,1.586,0.393,0.386,0.333,1.083,2.000,2.363,2.737,2.059,1.284,2.743
2,0.000,0.000,0.000,0.000,0.910,1.778,1.740,0.223,0.480,0.290,0.291,0.319,0.000,1.130,1.020,0.992,0.417,0.876
3,0.000,0.000,0.000,0.000,0.886,2.089,1.368,0.198,0.567,0.257,0.291,0.000,0.000,0.539,0.354,0.142,0.321,0.000
4,0.000,0.000,0.000,0.000,1.046,3.263,1.819,0.074,0.524,0.322,0.354,0.064,0.000,0.282,0.081,0.019,0.177,0.267
5,0.000,0.000,0.000,0.000,1.747,3.349,2.098,1.066,1.440,0.966,0.728,0.255,0.000,0.360,0.354,0.113,0.642,2.667
6,0.000,0.000,0.000,0.028,3.187,4.213,2.138,3.569,9.991,5.665,3.744,2.406,2.000,1.130,1.172,0.756,1.268,3.086
7,0.000,0.000,0.000,0.170,3.383,6.302,4.515,4.709,11.344,10.203,9.671,5.703,0.000,4.725,3.758,1.530,4.286,3.276
8,0.000,0.000,0.518,1.334,4.171,5.231,4.529,6.543,11.955,10.332,10.753,8.268,8.000,4.289,3.515,2.465,4.110,4.038
9,19.643,14.789,8.031,5.932,4.737,5.628,4.688,6.196,6.763,9.527,7.945,6.468,8.000,2.645,4.071,3.986,5.266,5.295
10,23.214,17.606,11.140,8.317,5.167,3.557,4.449,5.056,4.494,6.437,6.947,6.803,12.000,3.672,4.576,6.499,6.646,6.095
11,10.714,15.493,12.824,9.339,5.020,4.334,3.997,5.353,2.661,4.120,4.680,4.859,3.000,2.722,8.949,7.198,6.438,5.943
12,10.714,14.085,9.067,9.793,5.598,3.867,3.054,4.907,3.709,3.862,3.661,4.015,2.000,6.703,7.606,4.761,4.993,3.581
13,3.571,4.225,11.788,9.764,5.475,3.833,3.479,4.585,3.229,4.667,3.515,3.887,6.000,6.369,5.737,6.158,4.784,4.495
14,10.714,9.859,14.378,16.236,7.960,5.318,3.758,4.758,2.967,4.216,3.952,5.496,5.000,7.576,7.020,6.621,5.699,3.771
15,1.786,7.042,16.839,17.655,9.375,6.492,5.551,5.006,5.061,5.182,4.264,4.859,6.000,7.242,7.455,6.470,5.025,6.095
16,5.357,11.972,10.363,14.391,10.322,7.303,6.003,5.527,5.061,5.085,4.014,5.417,2.000,5.393,6.828,6.338,6.614,4.610
17,1.786,4.225,3.238,3.349,4.318,3.280,3.599,5.725,4.756,4.538,5.054,4.795,8.000,6.728,5.909,6.735,6.422,7.314
18,5.357,0.000,0.907,0.852,3.236,3.591,4.104,5.799,6.239,4.731,5.096,5.910,12.000,5.958,5.141,5.526,7.915,4.610
19,3.571,0.704,0.389,0.369,3.752,4.126,4.529,3.990,4.494,3.412,4.846,5.066,4.000,4.854,4.626,5.138,5.908,4.990
20,0.000,0.000,0.130,0.454,3.875,4.195,7.663,5.155,3.665,4.216,4.243,4.540,2.000,3.159,3.293,5.563,4.094,5.105
21,1.786,0.000,0.389,0.880,4.909,4.972,7.742,6.840,4.232,4.474,4.243,5.671,2.000,6.908,4.313,6.442,5.169,7.848
22,1.786,0.000,0.000,0.766,5.020,5.456,8.659,6.890,3.490,3.444,5.116,6.022,7.000,6.754,3.424,5.469,4.640,4.952
23,0.000,0.000,0.000,0.369,3.125,2.866,5.086,3.891,1.658,2.897,4.305,4.732,0.000,4.725,4.192,5.242,4.351,5.600
`;

  const PALETTES = {
    ember: { stops: ["#f4efe6", "#f0d5a8", "#e89968", "#c95a2e", "#7a1d0d"] },
    ink:   { stops: ["#f4efe6", "#c9bea8", "#7a6f5c", "#3a342a", "#1a1814"] },
    moss:  { stops: ["#f4efe6", "#c8d4ad", "#7a9258", "#3d5a2a", "#1a2a10"] },
  };

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
    const header = lines[0].split(",");
    const years = header.slice(1).map(Number);
    const matrix = [];
    for (const row of lines.slice(1)) {
      const cells = row.split(",");
      matrix[Number(cells[0])] = cells.slice(1).map(Number);
    }
    return { years, matrix };
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
      font-family: "Fraunces", Georgia, serif;
      font-variant-numeric: tabular-nums;
      background: var(--thm-paper);
      color: var(--thm-ink);
      padding: 1.5rem;
      border: 1px solid var(--thm-rule);
    }
    * { box-sizing: border-box; }
    .controls {
      display: flex;
      gap: 1.2rem;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 1.2rem;
      font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.78rem;
    }
    .controls label {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--thm-ink-soft);
      text-transform: uppercase;
      letter-spacing: 0.1em;
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
      margin: 0 0 0.4rem;
      color: var(--thm-ink);
    }
    .info-panel p { margin: 0 0 0.55rem; }
    .info-panel p:last-child { margin: 0; }
    .info-panel strong { color: var(--thm-ink); font-weight: 600; }
    .year-chips {
      display: flex; flex-wrap: wrap; gap: 0.35rem;
      align-items: center;
      margin-bottom: 1.2rem;
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 0.72rem;
    }
    .year-chips-label {
      color: var(--thm-ink-soft);
      text-transform: uppercase; letter-spacing: 0.1em;
      margin-right: 0.5rem;
    }
    .year-chip { padding: 0.2rem 0.55rem; }
    .year-chip:hover { border-color: var(--thm-ink); background: var(--thm-paper-warm); color: var(--thm-ink); }
    .year-chip.excluded {
      background: transparent; color: var(--thm-ink-faint);
      text-decoration: line-through;
    }
    .years-reset {
      margin-left: 0.5rem;
      background: transparent; border: none;
      color: var(--thm-ink-soft); text-decoration: underline;
    }
    .years-reset:hover { background: transparent; color: var(--thm-ink); }
    .chart-wrap { position: relative; }
    svg { display: block; width: 100%; height: auto; overflow: visible; }
    .cell { stroke: var(--thm-paper); stroke-width: 1; cursor: crosshair; }
    .cell:hover { stroke: var(--thm-ink); stroke-width: 1.5; }
    .axis text {
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 11px; fill: var(--thm-ink-soft);
    }
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
    .empty {
      padding: 2rem; text-align: center;
      color: var(--thm-ink-soft);
      border: 1px dashed var(--thm-rule);
      font-style: italic;
      display: none;
    }
  `;

  const MARKUP = `
    <div class="controls">
      <label>Scale
        <select data-id="scale">
          <option value="year">Per-year max</option>
          <option value="global">Global max</option>
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
      <p><strong>Per-year max</strong> normalises colour within each column. Every year's darkest cell hits the top of the palette, so each year shows its daily rhythm at full contrast.</p>
      <p><strong>Global max</strong> uses one shared scale anchored at the largest percentage anywhere in the visible matrix. Years with sharp peaks draw darker than ones whose posts are spread evenly.</p>
      <p>Excluding a year via the chips below removes it from the chart and from the global-max calculation.</p>
    </div>
    <div class="year-chips" data-id="year-chips" hidden>
      <span class="year-chips-label">Years</span>
      <span data-id="year-chip-list"></span>
      <button class="years-reset" type="button" data-id="years-reset">reset</button>
    </div>
    <div class="empty" data-id="empty"></div>
    <div class="chart-wrap" data-id="chart-wrap">
      <svg data-id="chart"></svg>
      <div class="tooltip" data-id="tooltip"></div>
    </div>
  `;

  class TrumpHeatmapYear extends HTMLElement {
    static get observedAttributes() { return ["scale", "palette", "exclude"]; }

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `<style>${STYLES}</style>${MARKUP}`;
      this.EXCLUDED = new Set();
      this.DATA = parseCSV(PRELOADED_CSV);
      this._q = (id) => this.shadowRoot.querySelector(`[data-id="${id}"]`);
      this._handleDocClick = this._handleDocClick.bind(this);
      this._handleEsc = this._handleEsc.bind(this);
    }

    connectedCallback() {
      this._wireControls();
      this._renderYearChips();
      this.render();
      document.addEventListener("click", this._handleDocClick);
      document.addEventListener("keydown", this._handleEsc);
    }

    attributeChangedCallback(name, oldVal, newVal) {
      if (oldVal === newVal) return;
      this._applyAttr(name, newVal);
      if (!this.isConnected) return;  // initial attrs are flushed by connectedCallback's render
      if (name === "exclude") this._renderYearChips();
      this.render();
    }

    _applyAttr(name, val) {
      if (name === "scale" && val) this._q("scale").value = val;
      else if (name === "palette" && val) this._q("palette").value = val;
      else if (name === "exclude") {
        this.EXCLUDED.clear();
        if (val) for (const y of val.split(",")) {
          const yy = Number(y.trim());
          if (Number.isFinite(yy)) this.EXCLUDED.add(yy);
        }
      }
    }

    disconnectedCallback() {
      document.removeEventListener("click", this._handleDocClick);
      document.removeEventListener("keydown", this._handleEsc);
    }

    _wireControls() {
      this._q("scale").addEventListener("change", () => this.render());
      this._q("palette").addEventListener("change", () => this.render());
      this._q("years-reset").addEventListener("click", () => {
        if (this.EXCLUDED.size === 0) return;
        this.EXCLUDED.clear();
        this._renderYearChips();
        this.render();
      });
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

    _renderYearChips() {
      const wrap = this._q("year-chips");
      const list = this._q("year-chip-list");
      list.innerHTML = "";
      for (const y of this.DATA.years) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "year-chip" + (this.EXCLUDED.has(y) ? " excluded" : "");
        chip.textContent = String(y);
        chip.addEventListener("click", () => {
          if (this.EXCLUDED.has(y)) this.EXCLUDED.delete(y); else this.EXCLUDED.add(y);
          this._renderYearChips();
          this.render();
        });
        list.appendChild(chip);
      }
      wrap.hidden = false;
    }

    render() {
      const visibleIdx = [];
      const years = [];
      for (let i = 0; i < this.DATA.years.length; i++) {
        if (!this.EXCLUDED.has(this.DATA.years[i])) { visibleIdx.push(i); years.push(this.DATA.years[i]); }
      }
      const empty = this._q("empty");
      const chartWrap = this._q("chart-wrap");
      if (years.length === 0) {
        empty.style.display = "block";
        empty.textContent = "All years excluded — toggle some back on above.";
        chartWrap.style.display = "none";
        return;
      }
      empty.style.display = "none";
      chartWrap.style.display = "block";

      const matrix = this.DATA.matrix.map((row) => visibleIdx.map((i) => row[i] || 0));
      const scaleMode = this._q("scale").value;
      const paletteName = this._q("palette").value;

      const yearMax = years.map((_, yi) => {
        let m = 0;
        for (let h = 0; h < 24; h++) m = Math.max(m, matrix[h][yi] || 0);
        return m;
      });
      const globalMax = Math.max(...yearMax);
      const tFor = (val, yi) => {
        if (scaleMode === "global") return globalMax === 0 ? 0 : val / globalMax;
        return yearMax[yi] === 0 ? 0 : val / yearMax[yi];
      };

      const margin = { top: 40, right: 90, bottom: 30, left: 60 };
      const cellW = Math.max(20, Math.min(48, 760 / years.length));
      const cellH = 20;
      const width = margin.left + cellW * years.length + margin.right;
      const height = margin.top + cellH * 24 + margin.bottom;

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

      const bands = [
        { from: 0, to: 5, label: "small hours" },
        { from: 5, to: 12, label: "morning" },
        { from: 12, to: 17, label: "afternoon" },
        { from: 17, to: 22, label: "evening" },
        { from: 22, to: 24, label: "late" },
      ];
      for (const b of bands) {
        const y = margin.top + b.from * cellH;
        const h = (b.to - b.from) * cellH;
        svg.appendChild(el("text", {
          x: margin.left + cellW * years.length + 12,
          y: y + h / 2 + 3,
          class: "band-label",
        }, b.label));
      }

      years.forEach((y, i) => {
        const x = margin.left + i * cellW + cellW / 2;
        svg.appendChild(el("text", { x, y: margin.top - 10, "text-anchor": "middle", class: "axis" }, String(y)));
      });

      for (let h = 0; h < 24; h++) {
        if (h % 3 !== 0) continue;
        svg.appendChild(el("text", {
          x: margin.left - 8,
          y: margin.top + h * cellH + cellH / 2 + 4,
          "text-anchor": "end", class: "axis",
        }, HOUR_LABEL(h)));
      }

      const tooltip = this._q("tooltip");
      for (let h = 0; h < 24; h++) {
        for (let yi = 0; yi < years.length; yi++) {
          const v = matrix[h][yi] || 0;
          const t = tFor(v, yi);
          const rect = el("rect", {
            x: margin.left + yi * cellW, y: margin.top + h * cellH,
            width: cellW, height: cellH,
            fill: rampColor(t, paletteName), class: "cell",
          });
          rect.addEventListener("mousemove", (ev) => {
            tooltip.innerHTML = `<strong>${years[yi]} · ${HOUR_LABEL(h)}</strong><br><span class="val">${v.toFixed(2)}%</span> of year's posts`;
            const wrect = chartWrap.getBoundingClientRect();
            tooltip.style.left = (ev.clientX - wrect.left + 12) + "px";
            tooltip.style.top = (ev.clientY - wrect.top + 12) + "px";
            tooltip.style.opacity = "1";
          });
          rect.addEventListener("mouseleave", () => { tooltip.style.opacity = "0"; });
          svg.appendChild(rect);
        }
      }

      const legendW = 180, legendH = 8;
      const legendX = margin.left;
      const legendY = height - 8;
      const gradId = "thy-grad-" + paletteName;
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
      svg.appendChild(el("text", { x: legendX + legendW / 2, y: legendY + 12, "text-anchor": "middle", class: "legend-tick" }, scaleMode === "global" ? "shared scale" : "per-year scale"));
    }
  }

  if (!customElements.get("trump-heatmap-year")) {
    customElements.define("trump-heatmap-year", TrumpHeatmapYear);
  }
})();
