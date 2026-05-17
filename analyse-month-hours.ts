// analyse-month-hours.ts
// Usage:
//   npx tsx analyse-month-hours.ts --in ./unified.ndjson --out ./posts-by-month-hour.csv
//   npx tsx analyse-month-hours.ts --in ./unified.ndjson --normalise
//
// Output (CSV): hour, 2009-05, 2009-06, ..., 2026-05
// Columns are continuous: months with no posts are emitted as zero columns so
// the timeline (and any gap, e.g. Jan 2021 → Feb 2022) shows correctly.
//
// With --normalise each cell is % of that month's total posts.

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
    out: get("--out", "./posts-by-month-hour.csv"),
    format: (get("--format", "csv") as "csv" | "json"),
    tz: get("--tz", "America/New_York"),
    includeReblogs: has("--include-reblogs"),
    includeReplies: !has("--exclude-replies"),
    normalise: has("--normalise") || has("--normalize"),
  };
};

const buildExtractor = (
  tz: string,
): ((iso: string) => { year: number; month: number; hour: number }) => {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    hour: "numeric",
    hour12: false,
  });
  return (iso: string) => {
    const parts = fmt.formatToParts(new Date(iso));
    let year = 0;
    let month = 0;
    let hour = 0;
    for (const p of parts) {
      if (p.type === "year") year = Number(p.value);
      else if (p.type === "month") month = Number(p.value);
      else if (p.type === "hour") hour = Number(p.value) % 24;
    }
    return { year, month, hour };
  };
};

const monthKey = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, "0")}`;

// Enumerate every YYYY-MM between (yearA,monthA) and (yearB,monthB) inclusive.
const monthRange = (yearA: number, monthA: number, yearB: number, monthB: number): string[] => {
  const out: string[] = [];
  let y = yearA;
  let m = monthA;
  while (y < yearB || (y === yearB && m <= monthB)) {
    out.push(monthKey(y, m));
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
};

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  console.error("Args:", args);

  const extract = buildExtractor(args.tz);

  // counts[monthKey][hour]
  const counts = new Map<string, number[]>();
  const monthTotals = new Map<string, number>();
  let total = 0;
  let skippedReblogs = 0;
  let skippedReplies = 0;
  let skippedBad = 0;
  let minYear = Infinity, minMonth = 13, maxYear = -Infinity, maxMonth = 0;

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

    const { year, month, hour } = extract(post.created_at);
    if (!year || !month) {
      skippedBad += 1;
      continue;
    }

    if (year < minYear || (year === minYear && month < minMonth)) { minYear = year; minMonth = month; }
    if (year > maxYear || (year === maxYear && month > maxMonth)) { maxYear = year; maxMonth = month; }

    const key = monthKey(year, month);
    let row = counts.get(key);
    if (!row) {
      row = new Array<number>(24).fill(0);
      counts.set(key, row);
    }
    row[hour] += 1;
    monthTotals.set(key, (monthTotals.get(key) ?? 0) + 1);
    total += 1;
  }

  // Emit every month between first and last post, filling gaps with zeros so
  // the timeline is continuous. A gap like Jan 2021 → Feb 2022 becomes a
  // contiguous block of zero columns rather than a discontinuity.
  const months: string[] = total === 0 ? [] : monthRange(minYear, minMonth, maxYear, maxMonth);

  const valueAt = (mkey: string, hour: number): number => {
    const raw = counts.get(mkey)?.[hour] ?? 0;
    if (!args.normalise) return raw;
    const mt = monthTotals.get(mkey) ?? 0;
    return mt === 0 ? 0 : (raw / mt) * 100;
  };

  if (args.format === "csv") {
    const header = ["hour", ...months].join(",");
    const rows: string[] = [header];
    for (let h = 0; h < 24; h += 1) {
      const cells = [
        String(h),
        ...months.map((m) => valueAt(m, h).toFixed(args.normalise ? 3 : 0)),
      ];
      rows.push(cells.join(","));
    }
    await writeFile(args.out, rows.join("\n") + "\n");
  } else {
    const payload = {
      tz: args.tz,
      normalised: args.normalise,
      total,
      months,
      monthTotals: Object.fromEntries(months.map((m) => [m, monthTotals.get(m) ?? 0])),
      byHour: Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        values: Object.fromEntries(months.map((m) => [m, valueAt(m, h)])),
      })),
    };
    await writeFile(args.out, JSON.stringify(payload, null, 2));
  }

  console.error(`\nProcessed: ${total} posts in ${args.tz}`);
  console.error(`Months: ${months.length} (${months[0] ?? "-"} → ${months[months.length - 1] ?? "-"})`);
  const emptyMonths = months.filter((m) => !monthTotals.has(m)).length;
  if (emptyMonths > 0) console.error(`Empty months in range: ${emptyMonths} (rendered as zero columns)`);
  console.error(`Skipped: ${skippedReblogs} reblogs, ${skippedReplies} replies, ${skippedBad} malformed`);
  console.error(`\nWrote ${args.out}`);
};

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
