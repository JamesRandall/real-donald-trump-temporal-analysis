// analyse-hours.ts
// Usage:
//   npx tsx analyse-hours.ts --in ./unified.ndjson --out ./posts-by-year-hour.csv
//   npx tsx analyse-hours.ts --in ./unified.ndjson --normalise
//
// Output (CSV): hour, <year1>, <year2>, ...
// With --normalise each cell is % of that year's total (per-year shape comparison).

import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";

interface Args {
  in: string;
  out: string;
  format: "csv" | "json";
  tz: string;
  includeReblogs: boolean;
  includeReplies: boolean;
  normalise: boolean;
}

// Same loose-shape Status as analyse-dow-hours.ts — accepts both canonical
// (is_reply/is_reblog) and raw Mastodon (in_reply_to_id/reblog).
interface Status {
  id?: string;
  created_at: string;
  is_reply?: boolean;
  is_reblog?: boolean;
  reblog?: Status | null;
  in_reply_to_id?: string | null;
}

const isReblog = (s: Status): boolean => s.is_reblog === true || !!s.reblog;
const isReply = (s: Status): boolean => s.is_reply === true || !!s.in_reply_to_id;

const parseArgs = (argv: string[]): Args => {
  const get = (flag: string, fallback: string): string => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  const has = (flag: string): boolean => argv.includes(flag);
  return {
    in: get("--in", "./unified.ndjson"),
    out: get("--out", "./posts-by-year-hour.csv"),
    format: (get("--format", "csv") as "csv" | "json"),
    tz: get("--tz", "America/New_York"),
    includeReblogs: has("--include-reblogs"),
    includeReplies: !has("--exclude-replies"),
    normalise: has("--normalise") || has("--normalize"),
  };
};

const buildExtractor = (tz: string): ((iso: string) => { year: number; hour: number }) => {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    hour: "numeric",
    hour12: false,
  });
  return (iso: string) => {
    const parts = fmt.formatToParts(new Date(iso));
    let year = 0;
    let hour = 0;
    for (const p of parts) {
      if (p.type === "year") year = Number(p.value);
      else if (p.type === "hour") hour = Number(p.value) % 24;
    }
    return { year, hour };
  };
};

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  console.error("Args:", args);

  const extract = buildExtractor(args.tz);

  // counts[year][hour]
  const counts = new Map<number, number[]>();
  const yearTotals = new Map<number, number>();
  let total = 0;
  let skippedReblogs = 0;
  let skippedReplies = 0;
  let skippedBad = 0;

  const stream = createReadStream(args.in, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    let post: Status;
    try {
      post = JSON.parse(line) as Status;
    } catch {
      skippedBad += 1;
      continue;
    }
    if (!args.includeReblogs && isReblog(post)) {
      skippedReblogs += 1;
      continue;
    }
    if (!args.includeReplies && isReply(post)) {
      skippedReplies += 1;
      continue;
    }
    if (!post.created_at) {
      skippedBad += 1;
      continue;
    }

    const { year, hour } = extract(post.created_at);
    if (!year) {
      skippedBad += 1;
      continue;
    }

    let row = counts.get(year);
    if (!row) {
      row = new Array<number>(24).fill(0);
      counts.set(year, row);
    }
    row[hour] += 1;
    yearTotals.set(year, (yearTotals.get(year) ?? 0) + 1);
    total += 1;
  }

  const years = [...counts.keys()].sort((a, b) => a - b);

  // valueAt: per-year normalised percentage when --normalise, otherwise raw count.
  // Per-year normalisation (not grand total) so each year's daily-shape is
  // directly comparable regardless of how many posts that year had.
  const valueAt = (year: number, hour: number): number => {
    const raw = counts.get(year)?.[hour] ?? 0;
    if (!args.normalise) return raw;
    const yt = yearTotals.get(year) ?? 0;
    return yt === 0 ? 0 : (raw / yt) * 100;
  };

  if (args.format === "csv") {
    const header = ["hour", ...years.map(String)].join(",");
    const rows: string[] = [header];
    for (let h = 0; h < 24; h += 1) {
      const cells = [
        String(h),
        ...years.map((y) => valueAt(y, h).toFixed(args.normalise ? 3 : 0)),
      ];
      rows.push(cells.join(","));
    }
    await writeFile(args.out, rows.join("\n") + "\n");
  } else {
    const payload = {
      tz: args.tz,
      normalised: args.normalise,
      total,
      years,
      yearTotals: Object.fromEntries(years.map((y) => [y, yearTotals.get(y) ?? 0])),
      byHour: Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        values: Object.fromEntries(years.map((y) => [y, valueAt(y, h)])),
      })),
    };
    await writeFile(args.out, JSON.stringify(payload, null, 2));
  }

  console.error(`\nProcessed: ${total} posts in ${args.tz}`);
  console.error(`Skipped: ${skippedReblogs} reblogs, ${skippedReplies} replies, ${skippedBad} malformed`);
  console.error(`\nYear totals:`);
  for (const y of years) console.error(`  ${y}: ${yearTotals.get(y)}`);

  // ASCII heatmap for sanity check.
  console.error(`\nYear × hour (darker = more posts, per-year scale):`);
  const shades = " .:-=+*#%@";
  console.error("    " + years.map((y) => String(y).slice(-2).padStart(2)).join(" "));
  for (let h = 0; h < 24; h += 1) {
    const cells = years.map((y) => {
      const v = counts.get(y)?.[h] ?? 0;
      const yt = yearTotals.get(y) ?? 0;
      const share = yt === 0 ? 0 : v / yt;
      const yearMaxShare = Math.max(...Array.from({ length: 24 }, (_, hh) => (counts.get(y)?.[hh] ?? 0) / (yt || 1)));
      const idx = yearMaxShare === 0 ? 0 : Math.floor((share / yearMaxShare) * (shades.length - 1));
      return ` ${shades[idx]}`;
    });
    console.error(`${String(h).padStart(2, "0")}h ${cells.join("")}`);
  }

  console.error(`\nWrote ${args.out}`);
};

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
