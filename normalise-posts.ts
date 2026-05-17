// normalise-posts.ts
// Unify Trump's Twitter archive and Truth Social NDJSON into one canonical NDJSON.
//
// Usage:
//   # Trump Twitter Archive V2 (JSON array, one big file)
//   npx tsx normalise-posts.ts --twitter ./tweets.json --out ./unified.ndjson
//
//   # Hershey CompleteTrumpTweetsArchive (CSV)
//   npx tsx normalise-posts.ts --twitter-csv ./realDonaldTrump.csv --out ./unified.ndjson
//
//   # Combine all sources in one pass (output is appended in order)
//   npx tsx normalise-posts.ts \
//       --twitter-csv ./realDonaldTrump_bf_office.csv \
//       --twitter ./trumparchive-v2.json \
//       --truth ./truth-posts.ndjson \
//       --out ./unified.ndjson
//
// Output: one canonical record per line.
//
// Canonical record shape:
//   {
//     id: string,             // platform-prefixed: "tw:123..." or "ts:456..."
//     platform: "twitter" | "truthsocial",
//     created_at: string,     // ISO 8601 UTC
//     text: string,           // plain text, HTML stripped, entities decoded
//     is_reply: boolean,
//     is_reblog: boolean,     // retweet on Twitter, reblog on Truth Social
//     reply_to_user: string | null,
//     favourites: number,
//     reblogs: number,
//     replies: number | null, // Twitter v1 doesn't expose this
//     url: string | null,
//     source_app: string | null,  // "Twitter for iPhone", etc., Twitter only
//     raw_id: string,         // original platform id, no prefix
//   }

import { createReadStream } from "node:fs";
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { createInterface } from "node:readline";

// --- CLI ------------------------------------------------------------------
interface Args {
  twitterJson: string[];          // Trump Twitter Archive V2 format (JSON array)
  twitterCsv: string[];           // Hershey CSV format
  truthNdjson: string[];          // our scraper output (one JSON per line)
  truthJson: string[];            // Truth Social archive in JSON-array form
  out: string;
  truncate: boolean;              // wipe output before writing
  dropRetweets: boolean;
  dropReplies: boolean;
}

const parseArgs = (argv: string[]): Args => {
  const get = (flag: string, fallback: string): string => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  const collect = (flag: string): string[] => {
    const out: string[] = [];
    for (let i = 0; i < argv.length - 1; i += 1) {
      if (argv[i] === flag) out.push(argv[i + 1]);
    }
    return out;
  };
  const has = (flag: string): boolean => argv.includes(flag);
  return {
    twitterJson: collect("--twitter"),
    twitterCsv: collect("--twitter-csv"),
    truthNdjson: collect("--truth"),
    truthJson: collect("--truth-json"),
    out: get("--out", "./unified.ndjson"),
    truncate: !has("--no-truncate"),
    dropRetweets: has("--drop-retweets"),
    dropReplies: has("--drop-replies"),
  };
};

// --- Canonical type -------------------------------------------------------
interface Canonical {
  id: string;
  platform: "twitter" | "truthsocial";
  created_at: string;
  text: string;
  is_reply: boolean;
  is_reblog: boolean;
  reply_to_user: string | null;
  favourites: number;
  reblogs: number;
  replies: number | null;
  url: string | null;
  source_app: string | null;
  raw_id: string;
}

// --- Text helpers ---------------------------------------------------------
// Strip HTML tags and decode the entities Mastodon actually emits.
const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'",
  "&apos;": "'", "&nbsp;": " ", "&hellip;": "…", "&mdash;": "—", "&ndash;": "–",
  "&lsquo;": "\u2018", "&rsquo;": "\u2019", "&ldquo;": "\u201C", "&rdquo;": "\u201D",
};
const decodeEntities = (s: string): string =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z#0-9]+;/gi, (m) => HTML_ENTITIES[m] ?? m);

const stripHtml = (html: string): string => {
  // Mastodon HTML is well-formed and limited: <p>, <br>, <a>, <span>, <em>, etc.
  // Replace <br> and </p> with newlines, drop everything else.
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
};

// Twitter v1 text is already plain but uses entity encoding for & < >.
const decodeTwitterText = (text: string): string => decodeEntities(text);

// --- Twitter Archive V2 (thetrumparchive.com) ----------------------------
// Shape: a JSON array of objects roughly matching Twitter v1.1 status format.
// We accept either the "compact" form used by trumparchive.com export
// (just {id, text, isRetweet, ...}) or the full v1.1 status object.
interface TwitterV1Status {
  id_str?: string;
  id?: string | number;
  created_at?: string;
  text?: string;
  full_text?: string;
  retweet_count?: number;
  favorite_count?: number;
  // trumparchive v2 shape uses short field names and an integer id; "date"
  // is "YYYY-MM-DD HH:MM:SS" in UTC, and isRetweet is "t"/"f".
  retweets?: number;
  favorites?: number;
  device?: string;
  in_reply_to_status_id_str?: string | null;
  in_reply_to_screen_name?: string | null;
  retweeted_status?: { id_str?: string } | null;
  isRetweet?: boolean | string;
  isDeleted?: boolean | string;
  isFlagged?: boolean | string;
  source?: string;
  date?: string;
}

const parseTwitterDate = (s: string): string => {
  // Twitter's v1.1 format: "Wed Oct 10 20:19:24 +0000 2018"
  // Hershey CSV format:    "2009-05-04 13:54" (UTC, no timezone marker)
  // Some exports use ISO 8601 directly.
  const trimmed = s.trim();
  const hershey = trimmed.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)$/);
  if (hershey) {
    const time = hershey[2].length === 5 ? `${hershey[2]}:00` : hershey[2];
    return new Date(`${hershey[1]}T${time}Z`).toISOString();
  }
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) {
    throw new Error(`Unparseable Twitter date: ${s}`);
  }
  return d.toISOString();
};

const tweetToCanonical = (t: TwitterV1Status): Canonical | null => {
  const rawId = String(t.id_str ?? t.id ?? "");
  if (!rawId) return null;
  const createdRaw = t.created_at ?? t.date;
  if (!createdRaw) return null;

  const text = decodeTwitterText(t.full_text ?? t.text ?? "");
  const isRetweet =
    t.isRetweet === true ||
    t.isRetweet === "true" ||
    t.isRetweet === "t" ||
    !!t.retweeted_status ||
    text.startsWith("RT @");
  const isReply = !!t.in_reply_to_status_id_str || !!t.in_reply_to_screen_name;

  return {
    id: `tw:${rawId}`,
    platform: "twitter",
    created_at: parseTwitterDate(createdRaw),
    text,
    is_reply: isReply,
    is_reblog: isRetweet,
    reply_to_user: t.in_reply_to_screen_name ?? null,
    favourites: Number(t.favorite_count ?? t.favorites ?? 0),
    reblogs: Number(t.retweet_count ?? t.retweets ?? 0),
    replies: null,
    url: `https://twitter.com/realDonaldTrump/status/${rawId}`,
    source_app: t.source
      ? // Twitter wraps source in an <a> tag — extract the label.
        t.source.replace(/<[^>]+>/g, "").trim() || null
      : (t.device ?? null),
    raw_id: rawId,
  };
};

const processTwitterJson = async (path: string): Promise<Canonical[]> => {
  const raw = await readFile(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Could not parse ${path} as JSON: ${(e as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected ${path} to contain a JSON array of tweets.`);
  }
  const out: Canonical[] = [];
  let bad = 0;
  for (const t of parsed) {
    try {
      const c = tweetToCanonical(t as TwitterV1Status);
      if (c) out.push(c);
    } catch {
      bad += 1;
    }
  }
  console.error(`Twitter JSON: ${out.length} tweets (${bad} skipped)`);
  return out;
};

// --- Twitter CSV (Hershey format) ----------------------------------------
// Header columns vary slightly between Hershey's files. The script auto-detects
// from the header row. Common columns: id, text, isRetweet, isDeleted,
// favorites/favorite_count, retweets/retweet_count, date/created_at, etc.

// Minimal RFC-4180-ish CSV parser. Handles quoted fields with embedded commas
// and "" escapes. Streams line-by-line for memory safety on big files.
const parseCsvRow = (line: string): string[] => {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1; }
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
};

const truthyCell = (v: string | undefined): boolean => {
  if (!v) return false;
  const s = v.toLowerCase().trim();
  return s === "true" || s === "t" || s === "1" || s === "yes";
};

const processTwitterCsv = async (path: string): Promise<Canonical[]> => {
  const stream = createReadStream(path, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let header: string[] | null = null;
  let buffer = "";          // accumulator for rows that span multiple lines (quoted newlines)
  const records: Canonical[] = [];
  let bad = 0;

  const flushBuffered = (): void => {
    if (!buffer) return;
    const cells = parseCsvRow(buffer);
    buffer = "";
    if (!header) {
      header = cells.map((c) => c.trim().toLowerCase());
      return;
    }
    try {
      const row: Record<string, string> = {};
      for (let i = 0; i < header.length; i += 1) row[header[i]] = (cells[i] ?? "").trim();

      // Hershey's "ID" column is the handle (e.g. "@realDonaldTrump"), not the
      // tweet id — the real id lives inside the URL column. Prefer a numeric
      // id_str/tweet_id, fall back to the URL, and finally to the id column.
      const idCol = row["id_str"] ?? row["tweet_id"] ?? row["id"] ?? "";
      const tweetUrl = row["tweet url"] ?? row["url"] ?? "";
      const urlId = tweetUrl.match(/\/status\/(\d+)/)?.[1];
      const rawId = /^\d+$/.test(idCol) ? idCol : (urlId ?? "");
      if (!rawId) { bad += 1; return; }

      const text = row["tweet text"] ?? row["text"] ?? row["content"] ?? "";
      const createdRaw = row["time"] ?? row["date"] ?? row["created_at"] ?? row["timestamp"];
      if (!createdRaw) { bad += 1; return; }

      const c: Canonical = {
        id: `tw:${rawId}`,
        platform: "twitter",
        created_at: parseTwitterDate(createdRaw),
        text: decodeTwitterText(text),
        is_reply: truthyCell(row["isreply"]) || !!row["in_reply_to_status_id_str"] || !!row["in_reply_to_screen_name"],
        is_reblog: truthyCell(row["isretweet"]) || text.startsWith("RT @"),
        reply_to_user: row["in_reply_to_screen_name"] || null,
        favourites: Number(row["favorites"] ?? row["favorite_count"] ?? 0) || 0,
        reblogs: Number(row["retweets"] ?? row["retweet_count"] ?? 0) || 0,
        replies: row["replies"] ? Number(row["replies"]) : null,
        url: tweetUrl || `https://twitter.com/realDonaldTrump/status/${rawId}`,
        source_app: row["source"]?.replace(/<[^>]+>/g, "").trim() || null,
        raw_id: rawId,
      };
      records.push(c);
    } catch {
      bad += 1;
    }
  };

  // Quick row-completeness heuristic: if line has unbalanced quotes, the row
  // continues on the next line. Easier than building a true stream parser.
  const isComplete = (s: string): boolean => {
    let q = 0;
    for (let i = 0; i < s.length; i += 1) if (s[i] === '"') q += 1;
    return q % 2 === 0;
  };

  for await (const line of rl) {
    buffer = buffer ? buffer + "\n" + line : line;
    if (isComplete(buffer)) flushBuffered();
  }
  if (buffer) flushBuffered();

  console.error(`Twitter CSV: ${records.length} tweets (${bad} skipped)`);
  return records;
};

// --- Truth Social NDJSON -------------------------------------------------
interface TruthStatus {
  id: string;
  created_at: string;
  content: string;
  url: string;
  in_reply_to_id: string | null;
  reblog: TruthStatus | null;
  replies_count?: number;
  reblogs_count?: number;
  favourites_count?: number;
  mentions?: { username?: string; acct?: string }[];
}

const truthToCanonical = (s: TruthStatus): Canonical | null => {
  if (!s.id || !s.created_at) return null;
  // For reblogs, the outer object has its own id and content="", but the
  // inner reblog field has the original. We surface engagement from outer
  // and text from inner if it's a pure reblog.
  const text = s.reblog ? stripHtml(s.reblog.content ?? "") : stripHtml(s.content ?? "");
  // Mastodon mentions are objects; reply_to_user is the first mention for replies.
  const replyToUser = s.in_reply_to_id && s.mentions && s.mentions.length > 0
    ? (s.mentions[0].username ?? s.mentions[0].acct ?? null)
    : null;

  return {
    id: `ts:${s.id}`,
    platform: "truthsocial",
    created_at: new Date(s.created_at).toISOString(),
    text,
    is_reply: !!s.in_reply_to_id,
    is_reblog: !!s.reblog,
    reply_to_user: replyToUser,
    favourites: s.favourites_count ?? 0,
    reblogs: s.reblogs_count ?? 0,
    replies: s.replies_count ?? null,
    url: s.url ?? null,
    source_app: null,
    raw_id: s.id,
  };
};

const processTruthNdjson = async (path: string): Promise<Canonical[]> => {
  const stream = createReadStream(path, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  const out: Canonical[] = [];
  let bad = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const s = JSON.parse(line) as TruthStatus;
      const c = truthToCanonical(s);
      if (c) out.push(c);
    } catch {
      bad += 1;
    }
  }
  console.error(`Truth NDJSON: ${out.length} posts (${bad} skipped)`);
  return out;
};

// Truth Social archives that ship as a single JSON array (e.g. archive.org
// dumps) rather than NDJSON. Same per-record shape as the scraper output, so
// we reuse truthToCanonical; in_reply_to_id / reblog may be absent, in which
// case is_reply / is_reblog default to false.
const processTruthJsonArray = async (path: string): Promise<Canonical[]> => {
  const raw = await readFile(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Could not parse ${path} as JSON: ${(e as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected ${path} to contain a JSON array of statuses.`);
  }
  const out: Canonical[] = [];
  let bad = 0;
  for (const s of parsed) {
    try {
      const c = truthToCanonical(s as TruthStatus);
      if (c) out.push(c);
    } catch {
      bad += 1;
    }
  }
  console.error(`Truth JSON array: ${out.length} posts (${bad} skipped)`);
  return out;
};

// --- Main ----------------------------------------------------------------
const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  const totalInputs =
    args.twitterJson.length + args.twitterCsv.length +
    args.truthNdjson.length + args.truthJson.length;
  if (totalInputs === 0) {
    console.error("Need at least one of --twitter, --twitter-csv, --truth, --truth-json");
    process.exit(1);
  }

  if (args.truncate) await writeFile(args.out, "");

  const buckets: Canonical[][] = [];
  for (const p of args.twitterCsv) buckets.push(await processTwitterCsv(p));
  for (const p of args.twitterJson) buckets.push(await processTwitterJson(p));
  for (const p of args.truthNdjson) buckets.push(await processTruthNdjson(p));
  for (const p of args.truthJson) buckets.push(await processTruthJsonArray(p));

  // Merge, dedupe by canonical id, sort by created_at ascending.
  const seen = new Set<string>();
  const merged: Canonical[] = [];
  for (const bucket of buckets) {
    for (const c of bucket) {
      if (seen.has(c.id)) continue;
      if (args.dropRetweets && c.is_reblog) continue;
      if (args.dropReplies && c.is_reply) continue;
      seen.add(c.id);
      merged.push(c);
    }
  }
  merged.sort((a, b) => a.created_at.localeCompare(b.created_at));

  // Write in chunks to keep memory bounded for big merges.
  const CHUNK = 5000;
  for (let i = 0; i < merged.length; i += CHUNK) {
    const slice = merged.slice(i, i + CHUNK).map((c) => JSON.stringify(c)).join("\n") + "\n";
    await appendFile(args.out, slice);
  }

  // Summary.
  const byPlatform = new Map<string, number>();
  const byYear = new Map<number, number>();
  for (const c of merged) {
    byPlatform.set(c.platform, (byPlatform.get(c.platform) ?? 0) + 1);
    const y = Number(c.created_at.slice(0, 4));
    byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  console.error(`\nWrote ${merged.length} records to ${args.out}`);
  console.error(`By platform:`);
  for (const [p, n] of byPlatform) console.error(`  ${p}: ${n}`);
  console.error(`By year:`);
  for (const y of [...byYear.keys()].sort()) {
    const n = byYear.get(y)!;
    const barLen = n > 0 ? Math.max(1, Math.min(60, Math.round(n / 100))) : 0;
    const bar = "█".repeat(barLen);
    console.error(`  ${y}: ${String(n).padStart(6)}  ${bar}`);
  }
  if (merged.length > 0) {
    console.error(`\nFirst: ${merged[0].created_at}`);
    console.error(`Last:  ${merged[merged.length - 1].created_at}`);
  }
};

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
