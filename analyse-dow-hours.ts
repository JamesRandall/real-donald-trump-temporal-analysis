// analyse-dow-hours.ts
// Usage:
//   npx tsx analyse-dow-hours.ts --in ./truth-posts.ndjson --out ./posts-by-dow-hour.csv
//   npx tsx analyse-dow-hours.ts --in ./truth-posts.ndjson --year 2024
//   npx tsx analyse-dow-hours.ts --in ./truth-posts.ndjson --year-range 2022-2024
//   npx tsx analyse-dow-hours.ts --in ./truth-posts.ndjson --normalise
//
// Output (CSV): hour, Mon, Tue, Wed, Thu, Fri, Sat, Sun
// Optionally filtered to a single year or year range.

import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";

interface Args {
  in: string;
  out: string;
  format: "csv" | "json";
  tz: string;
  yearMin: number | null;
  yearMax: number | null;
  includeReblogs: boolean;
  includeReplies: boolean;
  normalise: boolean;
}

// Accepts either the canonical NDJSON shape emitted by normalise-posts.ts
// (is_reply/is_reblog booleans) or the raw Mastodon shape from scrape-truth.ts
// (in_reply_to_id/reblog object). isReply/isReblog below normalise both.
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

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const parseArgs = (argv: string[]): Args => {
  const get = (flag: string, fallback: string): string => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  const has = (flag: string): boolean => argv.includes(flag);

  let yearMin: number | null = null;
  let yearMax: number | null = null;
  const yearSingle = get("--year", "");
  const yearRange = get("--year-range", "");
  if (yearSingle) {
    yearMin = Number(yearSingle);
    yearMax = Number(yearSingle);
  } else if (yearRange) {
    const [a, b] = yearRange.split("-").map(Number);
    yearMin = a;
    yearMax = b;
  }

  return {
    in: get("--in", "./truth-posts.ndjson"),
    out: get("--out", "./posts-by-dow-hour.csv"),
    format: (get("--format", "csv") as "csv" | "json"),
    tz: get("--tz", "America/New_York"),
    yearMin,
    yearMax,
    includeReblogs: has("--include-reblogs"),
    includeReplies: !has("--exclude-replies"),
    normalise: has("--normalise") || has("--normalize"),
  };
};

// Build a single formatter that extracts year, weekday, and hour in one pass.
const buildExtractor = (tz: string): ((iso: string) => { year: number; dow: number; hour: number }) => {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  });
  // Mon=0..Sun=6 to match common analytics convention.
  const dowMap: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
  };
  return (iso: string) => {
    const parts = fmt.formatToParts(new Date(iso));
    let year = 0;
    let dow = -1;
    let hour = 0;
    for (const p of parts) {
      if (p.type === "year") year = Number(p.value);
      else if (p.type === "weekday") dow = dowMap[p.value] ?? -1;
      else if (p.type === "hour") hour = Number(p.value) % 24;
    }
    return { year, dow, hour };
  };
};

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  console.error("Args:", args);

  const extract = buildExtractor(args.tz);

  // counts[dow][hour]
  const counts: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const dowTotals = new Array<number>(7).fill(0);
  let total = 0;
  let skippedReblogs = 0;
  let skippedReplies = 0;
  let skippedOutOfRange = 0;
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

    const { year, dow, hour } = extract(post.created_at);
    if (dow < 0) {
      skippedBad += 1;
      continue;
    }
    if (args.yearMin !== null && year < args.yearMin) {
      skippedOutOfRange += 1;
      continue;
    }
    if (args.yearMax !== null && year > args.yearMax) {
      skippedOutOfRange += 1;
      continue;
    }

    counts[dow][hour] += 1;
    dowTotals[dow] += 1;
    total += 1;
  }

  // For normalisation we divide by the per-(dow) total so each weekday's
  // shape is comparable regardless of how many of that weekday fell in range.
  // (Alternative: divide by grand total; that one preserves which weekdays
  // are heavier overall, which is what we want here — so use grand total.)
  const valueAt = (dow: number, hour: number): number => {
    const raw = counts[dow][hour];
    if (!args.normalise) return raw;
    return total === 0 ? 0 : (raw / total) * 100;
  };

  if (args.format === "csv") {
    const header = ["hour", ...DOW_LABELS].join(",");
    const rows: string[] = [header];
    for (let h = 0; h < 24; h += 1) {
      const cells = [
        String(h),
        ...DOW_LABELS.map((_, d) => valueAt(d, h).toFixed(args.normalise ? 3 : 0)),
      ];
      rows.push(cells.join(","));
    }
    await writeFile(args.out, rows.join("\n") + "\n");
  } else {
    const payload = {
      tz: args.tz,
      yearRange: { min: args.yearMin, max: args.yearMax },
      normalised: args.normalise,
      total,
      dowTotals: Object.fromEntries(DOW_LABELS.map((l, i) => [l, dowTotals[i]])),
      byHour: Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        values: Object.fromEntries(DOW_LABELS.map((l, d) => [l, valueAt(d, h)])),
      })),
    };
    await writeFile(args.out, JSON.stringify(payload, null, 2));
  }

  console.error(`\nProcessed: ${total} posts in ${args.tz}`);
  if (args.yearMin !== null || args.yearMax !== null) {
    console.error(`Year filter: ${args.yearMin ?? "*"}..${args.yearMax ?? "*"} (excluded ${skippedOutOfRange})`);
  }
  console.error(`Skipped: ${skippedReblogs} reblogs, ${skippedReplies} replies, ${skippedBad} malformed`);
  console.error(`\nWeekday totals:`);
  for (let d = 0; d < 7; d += 1) {
    console.error(`  ${DOW_LABELS[d]}: ${dowTotals[d]}`);
  }

  // ASCII heatmap.
  console.error(`\nDay-of-week × hour (darker = more posts):`);
  const shades = " .:-=+*#%@";
  let max = 0;
  for (let d = 0; d < 7; d += 1) {
    for (let h = 0; h < 24; h += 1) {
      if (counts[d][h] > max) max = counts[d][h];
    }
  }
  console.error("    " + DOW_LABELS.map((l) => ` ${l} `).join(""));
  for (let h = 0; h < 24; h += 1) {
    const cells = Array.from({ length: 7 }, (_, d) => {
      const v = counts[d][h];
      const idx = max === 0 ? 0 : Math.floor((v / max) * (shades.length - 1));
      return `  ${shades[idx]} `;
    });
    console.error(`${String(h).padStart(2, "0")}h ${cells.join("")}`);
  }

  console.error(`\nWrote ${args.out}`);
};

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
