// bundle-web-components.ts
// Reads each web-component template in web-components/, substitutes the
// __CSV_PLACEHOLDER__ token with the contents of the matching CSV, and writes
// the bundled JS into dist/. Also emits a demo index.html showing all three
// components and a README.md with Hugo integration instructions.
//
// Usage:
//   npx tsx bundle-web-components.ts
//
// Reads from the project root, with these fixed pairings:
//   web-components/trump-heatmap-year.js   <- posts-by-year-hour.csv
//   web-components/trump-heatmap-dow.js    <- posts-by-dow-hour.csv
//   web-components/trump-heatmap-month.js  <- posts-by-month-hour.csv

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(ROOT, "dist");

const PAIRS = [
  { name: "trump-heatmap-year",  csv: "posts-by-year-hour.csv"  },
  { name: "trump-heatmap-dow",   csv: "posts-by-dow-hour.csv"   },
  { name: "trump-heatmap-month", csv: "posts-by-month-hour.csv" },
] as const;

const escapeForBacktick = (s: string): string =>
  s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const bundleOne = async (templateName: string, csvPath: string): Promise<{ outPath: string; bytes: number }> => {
  const templatePath = resolve(ROOT, "web-components", `${templateName}.js`);
  const [template, csv] = await Promise.all([
    readFile(templatePath, "utf8"),
    readFile(resolve(ROOT, csvPath), "utf8"),
  ]);

  // Guard: the token must appear exactly once. If it appears in a comment as
  // well as the template literal, .replace() would substitute the comment
  // instance and break the file at the CSV's first newline.
  const occurrences = template.split("__CSV_PLACEHOLDER__").length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected exactly one __CSV_PLACEHOLDER__ in ${templatePath}, found ${occurrences}`);
  }
  const bundled = template.replace("__CSV_PLACEHOLDER__", escapeForBacktick(csv));

  const outPath = resolve(DIST, `${templateName}.js`);
  await writeFile(outPath, bundled);
  return { outPath, bytes: Buffer.byteLength(bundled, "utf8") };
};

const DEMO_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Trump heatmap web components — demo</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  body {
    font-family: "Fraunces", Georgia, serif;
    max-width: 1100px;
    margin: 3rem auto;
    padding: 0 1.5rem;
    color: #1a1814;
    background: #faf6ec;
  }
  h1 { font-size: 2rem; margin: 0 0 0.5rem; }
  h2 { font-size: 1.2rem; margin: 2.5rem 0 0.5rem; color: #5a5346; font-weight: 500; }
  p  { color: #5a5346; max-width: 60ch; font-style: italic; }
  trump-heatmap-year, trump-heatmap-dow, trump-heatmap-month { margin-top: 0.5rem; }
</style>
</head>
<body>
<h1>Trump heatmap components</h1>
<p>This page demos each custom element with and without initial-state attributes. Drop the .js files into your Hugo static folder, &lt;script&gt; them, and use the tags below anywhere on your site.</p>

<h2>Year × hour — defaults</h2>
<trump-heatmap-year></trump-heatmap-year>

<h2>Year × hour — global scale, ink palette, hiding sparse early years</h2>
<trump-heatmap-year scale="global" palette="ink" exclude="2009,2010,2011,2021"></trump-heatmap-year>

<h2>Weekday × hour — defaults</h2>
<trump-heatmap-dow></trump-heatmap-dow>

<h2>Weekday × hour — within-each-weekday scale, moss palette</h2>
<trump-heatmap-dow scale="dow" palette="moss"></trump-heatmap-dow>

<h2>Month × hour — defaults (last 24 months)</h2>
<trump-heatmap-month></trump-heatmap-month>

<h2>Month × hour — fixed 2017 window, global scale</h2>
<trump-heatmap-month from="2017-01" to="2017-12" scale="global"></trump-heatmap-month>

<script src="./trump-heatmap-year.js"></script>
<script src="./trump-heatmap-dow.js"></script>
<script src="./trump-heatmap-month.js"></script>
</body>
</html>
`;

const README_MD = `# Trump heatmap web components

Self-contained custom elements that render hour-of-day posting heatmaps from Trump's Twitter + Truth Social corpus. Each file embeds its own CSV at build time — no fetch, no external data dependency.

## Files

- \`trump-heatmap-year.js\` — defines \`<trump-heatmap-year>\` (year × hour)
- \`trump-heatmap-dow.js\` — defines \`<trump-heatmap-dow>\` (weekday × hour with marginal histogram)
- \`trump-heatmap-month.js\` — defines \`<trump-heatmap-month>\` (month × hour, default range = last 24 months, slidable)
- \`index.html\` — demo page showing all three

## Hugo integration

1. Copy the three \`.js\` files into your Hugo site's \`static/\` directory (e.g. \`static/heatmaps/\`).
2. In the page (or partial / shortcode) where you want a chart, reference the script and drop the tag:

\`\`\`html
<script src="/heatmaps/trump-heatmap-year.js" defer></script>
<trump-heatmap-year></trump-heatmap-year>
\`\`\`

Each script defines its component the first time it loads and is a no-op on subsequent loads, so it's safe to include in multiple places. Each \`<trump-...>\` tag is an independent instance with its own state (selected scale, palette, date range, excluded years).

## Setting initial state via attributes

All three components accept attributes that set the initial state of their filters. Attribute changes after mount are reactive — updating an attribute from JavaScript re-renders the chart.

### \`<trump-heatmap-year>\`

| Attribute | Values | Default | Notes |
|---|---|---|---|
| \`scale\` | \`year\` \\| \`global\` | \`year\` | Per-year max vs shared global max. |
| \`palette\` | \`ember\` \\| \`ink\` \\| \`moss\` | \`ember\` | Colour ramp. |
| \`exclude\` | comma-separated years | (none) | Years to start excluded from the chart and the global-max calc. |

\`\`\`html
<trump-heatmap-year scale="global" palette="ink" exclude="2009,2010,2011,2021"></trump-heatmap-year>
\`\`\`

### \`<trump-heatmap-dow>\`

| Attribute | Values | Default | Notes |
|---|---|---|---|
| \`scale\` | \`global\` \\| \`dow\` | \`global\` | Shared scale vs per-weekday max. |
| \`palette\` | \`ember\` \\| \`ink\` \\| \`moss\` | \`ember\` | Colour ramp. |

\`\`\`html
<trump-heatmap-dow scale="dow" palette="moss"></trump-heatmap-dow>
\`\`\`

### \`<trump-heatmap-month>\`

| Attribute | Values | Default | Notes |
|---|---|---|---|
| \`scale\` | \`month\` \\| \`global\` | \`month\` | Per-month max vs shared global max. |
| \`palette\` | \`ember\` \\| \`ink\` \\| \`moss\` | \`ember\` | Colour ramp. |
| \`from\` | \`YYYY-MM\` | last 24 months | Start of the visible window. |
| \`to\` | \`YYYY-MM\` | latest month in the data | End of the visible window. |

\`\`\`html
<trump-heatmap-month from="2017-01" to="2017-12" scale="global"></trump-heatmap-month>
\`\`\`

### Programmatic changes

Setting attributes from JS triggers a re-render:

\`\`\`js
const el = document.querySelector("trump-heatmap-year");
el.setAttribute("scale", "global");
el.setAttribute("exclude", "2009,2010");
\`\`\`

## Hugo shortcode

For convenience, drop this in \`layouts/shortcodes/heatmap.html\`:

\`\`\`html
{{- $kind := .Get "kind" -}}
{{- $scale := .Get "scale" -}}
{{- $palette := .Get "palette" -}}
{{- $from := .Get "from" -}}
{{- $to := .Get "to" -}}
{{- $exclude := .Get "exclude" -}}
<script src="/heatmaps/trump-heatmap-{{ $kind }}.js" defer></script>
<trump-heatmap-{{ $kind }}
  {{ with $scale }}scale="{{ . }}"{{ end }}
  {{ with $palette }}palette="{{ . }}"{{ end }}
  {{ with $from }}from="{{ . }}"{{ end }}
  {{ with $to }}to="{{ . }}"{{ end }}
  {{ with $exclude }}exclude="{{ . }}"{{ end }}
></trump-heatmap-{{ $kind }}>
\`\`\`

Use it in Markdown content:

\`\`\`
{{< heatmap kind="year" >}}
{{< heatmap kind="year" scale="global" palette="ink" exclude="2009,2010,2021" >}}
{{< heatmap kind="month" from="2017-01" to="2017-12" >}}
\`\`\`

## Styling

Each component uses Shadow DOM, so your site's styles don't bleed in and the component's styles don't bleed out. The font stack is \`"Fraunces", Georgia, serif\` for body text and \`"JetBrains Mono", ui-monospace, monospace\` for controls. If your Hugo theme loads those Google fonts at the page level, the components inherit them; otherwise they fall back to system fonts gracefully.

The host element accepts standard layout properties via CSS in the parent document — \`max-width\`, \`margin\`, etc. — since \`:host { display: block }\`.

## Browser support

Standards-only — custom elements v1, Shadow DOM, \`composedPath()\`. Works in every browser shipped since 2018 (Edge after the Chromium switch, Safari 10.1+, Firefox 63+, Chrome 53+).

## Regenerating

These files are regenerated by \`./run-analysis.sh --web-component\` at the project root. The source templates live in \`web-components/\` and the data comes from the analyser CSVs (\`posts-by-*.csv\`).
`;

const main = async (): Promise<void> => {
  await mkdir(DIST, { recursive: true });

  const results = await Promise.all(PAIRS.map((p) => bundleOne(p.name, p.csv)));
  for (const r of results) {
    console.error(`  ${r.outPath}  (${(r.bytes / 1024).toFixed(1)} KB)`);
  }

  await writeFile(resolve(DIST, "index.html"), DEMO_HTML);
  await writeFile(resolve(DIST, "README.md"), README_MD);
  console.error(`  ${resolve(DIST, "index.html")}`);
  console.error(`  ${resolve(DIST, "README.md")}`);
};

main().catch((err: unknown) => { console.error(err); process.exit(1); });
