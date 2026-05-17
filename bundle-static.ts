// bundle-static.ts
// Usage:
//   npx tsx bundle-static.ts --template plot-heatmap.html \
//                            --csv      posts-by-year-hour.csv \
//                            --out      plot-heatmap.static.html
//
// Inlines a CSV into one of the viewer templates so the resulting HTML opens
// straight to a rendered chart — no file picker, no upload step. Works for
// any of the three viewers; the bootstrap just calls each one's own parseCSV
// and then onDataLoaded() / render(), whichever the template defines.
//
// Note: the viewer still loads Fraunces + JetBrains Mono from Google Fonts.
// If you need a fully-offline bundle, strip the <link> in the template head.

import { readFile, writeFile } from "node:fs/promises";

const parseArgs = (argv: string[]): { template: string; csv: string; out: string } => {
  const get = (flag: string): string => {
    const i = argv.indexOf(flag);
    if (i < 0 || !argv[i + 1]) throw new Error(`Missing ${flag}`);
    return argv[i + 1];
  };
  return { template: get("--template"), csv: get("--csv"), out: get("--out") };
};

const escapeForBacktick = (s: string): string =>
  s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const main = async (): Promise<void> => {
  const { template, csv, out } = parseArgs(process.argv.slice(2));

  const [html, csvText] = await Promise.all([
    readFile(template, "utf8"),
    readFile(csv, "utf8"),
  ]);

  // The bootstrap runs after the viewer's own <script> block, so parseCSV,
  // DATA, render, and (where present) onDataLoaded are all in scope.
  const bootstrap = `
<script>
(() => {
  const PRELOADED_CSV = \`${escapeForBacktick(csvText)}\`;
  const apply = () => {
    DATA = parseCSV(PRELOADED_CSV);
    if (typeof onDataLoaded === "function") onDataLoaded();
    else render();
    // Static bundle: no upload, no sample needed.
    const fi = document.getElementById("file");
    if (fi) { const lbl = fi.closest("label"); if (lbl) lbl.remove(); }
    const sample = document.getElementById("sample");
    if (sample) sample.remove();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
})();
</script>
`;

  if (!/<\/body>/i.test(html)) throw new Error(`No </body> tag found in ${template}`);
  const output = html.replace(/<\/body>/i, bootstrap + "</body>");

  await writeFile(out, output);
  const sizeKb = (Buffer.byteLength(output, "utf8") / 1024).toFixed(1);
  console.error(`Wrote ${out} (${sizeKb} KB; embedded CSV ${(Buffer.byteLength(csvText, "utf8") / 1024).toFixed(1)} KB)`);
};

main().catch((err: unknown) => { console.error(err); process.exit(1); });
