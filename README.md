# truth-archive

A small set of TypeScript scripts that take pre-built Twitter and Truth Social archives, merge them into a single canonical record stream, and bucket the result into hour-of-day heatmaps (year × hour, weekday × hour, month × hour). Designed for offline analysis from third-party archive dumps — there's no scraper in the repo.

Components:

- **`normalise-posts.ts`** — unify multiple Twitter and Truth Social archive formats into one canonical NDJSON.
- **`analyse-hours.ts`** — buckets posts by `(year, hour-of-day)` in any timezone.
- **`analyse-dow-hours.ts`** — buckets posts by `(weekday, hour-of-day)`, optionally filtered to a year or year range.
- **`analyse-month-hours.ts`** — buckets posts by `(year-month, hour-of-day)` with a continuous month timeline; the matching viewer defaults to the last 24 months and lets you slide the range.

Plus three browser-based heatmap viewers for the analyser output (with optional static-bundle generation that inlines the data).

---

## Setup

Requires Node 20+ (uses `fetch`, `BigInt`, top-level `for-await`).

```bash
npm install tsx typescript @types/node
```

All dev-only — runtime is plain Node.

---

## Getting the data

The repo ships without source data — drop these two files into `./data/` and the analysis pipeline will pick them up.

### Twitter (May 2009 – Jan 2021)

`trump_tweets_v2_archive.json` — the trumparchive.com v2 dump covering the full pre-suspension Twitter run. Timestamps are explicit UTC, which is why we prefer this over the Hershey CSVs (whose `Time` column has no timezone marker).

Hosted on Google Drive:

> https://drive.google.com/file/d/16wm-2NTKohhcA26w-kaWfhLIGwl_oX95/view

Easiest path is to open that in a browser, click *Download*, and save it as `data/trump_tweets_v2_archive.json`. Or via curl (works for files under ~100MB without the virus-scan interstitial):

```bash
mkdir -p data
curl -L -o data/trump_tweets_v2_archive.json \
  "https://drive.google.com/uc?export=download&id=16wm-2NTKohhcA26w-kaWfhLIGwl_oX95"
```

If Google Drive serves an HTML confirm page instead of the file, fall back to the browser download.

### Truth Social (Feb 2022 – present)

`truth_archive.json` — JSON array of public statuses in Mastodon shape (one object per post, `id` / `created_at` / `content` / engagement counts). Drop your archive at `data/truth_archive.json`. The normaliser also accepts NDJSON (one status per line) via `--truth` if that's the form you have.

There's a real gap between January 2021 and February 2022 when he wasn't posting anywhere mainstream — that'll show as a column of zeros in the year-by-hour heatmap.

### Alternative Twitter sources

The same period is also available as:

- **Hershey CSVs** — split pre-/in-office; `Time` column lacks a timezone marker but is empirically UTC. Feed both files with repeated `--twitter-csv` flags.
  ```bash
  curl -L -o data/realDonaldTrump_bf_office.csv \
    https://raw.githubusercontent.com/MarkHershey/CompleteTrumpTweetsArchive/master/data/realDonaldTrump_bf_office.csv
  curl -L -o data/realDonaldTrump_in_office.csv \
    https://raw.githubusercontent.com/MarkHershey/CompleteTrumpTweetsArchive/master/data/realDonaldTrump_in_office.csv
  ```
- **Internet Archive `trump-tweets` dump** — Twitter v1.1 JSON, includes reply markers. Feed with `--twitter`.
  ```bash
  curl -L -o data/trump-tweets-v2.json \
    "https://archive.org/download/trump-tweets/tweets_01-08-2021.json"
  ```

---

## Quick start

Once `./data/` has the two files above:

```bash
./run-analysis.sh                     # opens the dynamic viewers — you drop the CSVs in
./run-analysis.sh --static            # also writes plot-*.static.html with the CSVs inlined; opens those instead
./run-analysis.sh --hershey           # use the Hershey CSVs instead of the trumparchive v2 JSON as the Twitter source
./run-analysis.sh --hershey --static  # flags compose
```

This merges the sources into `unified.ndjson`, runs all three analysers, writes `posts-by-year-hour.csv` + `posts-by-dow-hour.csv` + `posts-by-month-hour.csv`, and opens the viewers. With `--static` it additionally produces `plot-heatmap.static.html`, `plot-dow-heatmap.static.html`, and `plot-month-heatmap.static.html` — each one a single self-contained file with the corresponding CSV embedded, ready to share or commit.

`--hershey` swaps the Twitter source from `data/trump_tweets_v2_archive.json` to `data/realDonaldTrump_bf_office.csv` + `data/realDonaldTrump_in_office.csv`. The Truth Social file is unchanged. Useful for a sanity check (the two sources should agree on the overall posting-hour shape) or if you can't get the v2 JSON. The Hershey CSVs lack reblog markers, so reblog-filtering is a no-op on that path.

To work step by step instead:

```bash
# 1. Merge sources into one canonical NDJSON.
npx tsx normalise-posts.ts \
    --twitter    ./data/trump_tweets_v2_archive.json \
    --truth-json ./data/truth_archive.json \
    --out ./unified.ndjson

# 2. Bucket by hour-of-day per year.
npx tsx analyse-hours.ts --in ./unified.ndjson --normalise

# 3. Bucket by weekday × hour-of-day.
npx tsx analyse-dow-hours.ts --in ./unified.ndjson --normalise

# 4. Bucket by month × hour-of-day (continuous timeline, zero-filled gaps).
npx tsx analyse-month-hours.ts --in ./unified.ndjson --normalise

# 5. Open the heatmap viewers in a browser and drop in the CSVs.
open plot-heatmap.html
open plot-dow-heatmap.html
open plot-month-heatmap.html
```

---

## Analysers

Both produce CSV by default (wide format, easy to feed to the viewers or anything else). JSON output is also available with `--format json`.

### `analyse-hours.ts`

```bash
npx tsx analyse-hours.ts --in ./unified.ndjson --normalise
```

Output columns: `hour, 2009, 2010, ..., 2026` — each cell is either raw count or (with `--normalise`) percent of that year's posts. Normalise is what you want for year-on-year shape comparison.

### `analyse-dow-hours.ts`

```bash
# Full corpus
npx tsx analyse-dow-hours.ts --in ./unified.ndjson --normalise

# Just one year
npx tsx analyse-dow-hours.ts --in ./unified.ndjson --year 2024 --normalise --out 2024-dow.csv

# A range
npx tsx analyse-dow-hours.ts --in ./unified.ndjson --year-range 2022-2024 --normalise
```

Output columns: `hour, Mon, Tue, Wed, Thu, Fri, Sat, Sun`. With `--normalise`, cells are percent of total posts in the filter window — so a Sat cell and a Wed cell are directly comparable.

### `analyse-month-hours.ts`

```bash
npx tsx analyse-month-hours.ts --in ./unified.ndjson --normalise
```

Output columns: `hour, 2009-05, 2009-06, ..., 2026-05`. The month timeline is continuous — months with no posts (e.g. the Jan 2021 → Feb 2022 platform gap) are emitted as zero columns so the chart's x-axis stays uniform. With `--normalise`, cells are percent of *that month's* posts. Date-range filtering lives in the viewer (`plot-month-heatmap.html`), not the CLI, so one CSV serves any range you want to inspect.

### Shared options

| Flag | Default | Notes |
|---|---|---|
| `--tz` | `America/New_York` | Any IANA zone. DST is handled per-post. |
| `--exclude-replies` | (replies included) | |
| `--include-reblogs` | (reblogs excluded by default) | |
| `--normalise` / `--normalize` | off | Emit percentages instead of raw counts. |
| `--format` | `csv` | Or `json`. |

`analyse-hours.ts` and `analyse-dow-hours.ts` also print an ASCII heatmap to stderr as a sanity check — useful for spotting empty buckets or timezone bugs before you even open the browser viewer.

---

## `normalise-posts.ts` — unify Twitter and Truth Social

For continuous analysis covering both platforms (2009 → present), this script maps third-party Twitter and Truth Social archives into a single canonical NDJSON.

### Where to get the source data

See [Getting the data](#getting-the-data) above for the actual download commands.

| Source | Coverage | Format | Flag |
|---|---|---|---|
| [`MarkHershey/CompleteTrumpTweetsArchive`](https://github.com/MarkHershey/CompleteTrumpTweetsArchive) | May 2009 → Jan 2021, split into pre-/in-office CSVs | CSV | `--twitter-csv` (repeatable) |
| trumparchive.com v2 dump (mirrored on Google Drive) | May 2009 → Jan 2021 | JSON | `--twitter` |
| [Internet Archive `trump-tweets`](https://archive.org/details/trump-tweets) | Same period as above, Twitter v1.1 JSON | JSON | `--twitter` |
| Truth Social archive (JSON array) | Feb 2022 → present | JSON | `--truth-json` |
| Truth Social archive (NDJSON) | Feb 2022 → present | NDJSON | `--truth` |

### Usage

All input flags are repeatable, so you can mix Hershey CSVs, JSON archives and NDJSON in one call:

```bash
# Default pipeline (trumparchive v2 JSON + Truth Social archive)
npx tsx normalise-posts.ts \
    --twitter    ./data/trump_tweets_v2_archive.json \
    --truth-json ./data/truth_archive.json \
    --out ./unified.ndjson

# Hershey CSVs as an alternative Twitter source (repeatable)
npx tsx normalise-posts.ts \
    --twitter-csv ./data/realDonaldTrump_bf_office.csv \
    --twitter-csv ./data/realDonaldTrump_in_office.csv \
    --truth-json  ./data/truth_archive.json \
    --out ./unified.ndjson

# Drop noise for analysis
npx tsx normalise-posts.ts \
    --twitter    ./data/trump_tweets_v2_archive.json \
    --truth-json ./data/truth_archive.json \
    --drop-retweets --drop-replies --out ./unified-original.ndjson
```

`--truth-json` accepts a single JSON array of statuses (typical archive-dump shape); `--truth` expects NDJSON (one JSON object per line). Same record fields either way.

### Canonical record shape

```json
{
  "id": "tw:1234567890",           // or "ts:110123..." — platform-prefixed
  "platform": "twitter",           // or "truthsocial"
  "created_at": "2018-10-10T20:19:24.000Z",
  "text": "Make America Great Again! & Keep it that way.",
  "is_reply": false,
  "is_reblog": false,              // retweet on Twitter, reblog on Truth Social
  "reply_to_user": null,
  "favourites": 50000,
  "reblogs": 10000,
  "replies": null,                 // Twitter v1 doesn't expose this; Truth does
  "url": "https://twitter.com/realDonaldTrump/status/1234567890",
  "source_app": "Twitter for iPhone",   // Twitter only
  "raw_id": "1234567890"
}
```

The analysers already key on `created_at` and `in_reply_to_id`, so you can feed unified.ndjson through them directly with a one-line tweak: rename `is_reply` → `in_reply_to_id` (with a sentinel value) or just point the analysers at the new field name. The diff is small enough I'd suggest doing it as part of the merge run rather than carrying two field names.

### Field mapping reference

| Concept | Twitter v1 | Truth Social (Mastodon) | Canonical |
|---|---|---|---|
| ID | `id_str` | `id` | `raw_id` |
| Timestamp | `created_at` (RFC 2822) | `created_at` (ISO 8601) | `created_at` (ISO 8601 UTC) |
| Body | `text` / `full_text` (plain) | `content` (HTML) | `text` (plain, entities decoded) |
| Reply marker | `in_reply_to_status_id_str` | `in_reply_to_id` | `is_reply` |
| Retweet/reblog | `retweeted_status` | `reblog` | `is_reblog` |
| Engagement | `favorite_count`, `retweet_count` | `favourites_count`, `reblogs_count` | `favourites`, `reblogs` |
| Source app | `source` (HTML `<a>` wrapped) | n/a | `source_app` (label only) |

### What the script handles

- Multiple Twitter date formats (RFC 2822 and ISO 8601 both appear across archives).
- HTML entity decoding (`&amp;` → `&` etc.) for both Twitter text and Mastodon content.
- Mastodon HTML stripping (`<p>`, `<br>`, `<a>`) to plain text with paragraph breaks preserved.
- CSV with quoted fields containing commas, embedded quotes (`""`), and newlines.
- The `RT @` text-prefix fallback when `retweeted_status` is missing.
- Deduplication across overlapping sources (canonical id includes platform prefix so a Twitter `1234` and Truth `1234` won't collide).
- Chronological sort by ISO timestamp.

Output summary prints to stderr: per-platform totals, per-year histogram, first/last record timestamps — useful for spotting an unexpected gap or a parse failure that left a year empty.

---

## Heatmap viewers

Three standalone HTML files, no build step. Open in any modern browser, drop in a CSV.

- **`plot-heatmap.html`** — year × hour. Columns = years (auto-scaling cell width), rows = hours 0–23. Toggle per-year vs global scale. Year chips let you exclude individual years from both the chart and the global-max scale.
- **`plot-dow-heatmap.html`** — weekday × hour. Columns = Mon–Sun with weekend tinting, rows = hours 0–23. Includes a marginal histogram on the right showing each hour's all-days total.
- **`plot-month-heatmap.html`** — month × hour. Columns = continuous months with year-group labels and dashed year separators. Defaults to the last 24 months; `From` / `To` pickers let you widen the range, `reset` jumps back to the default.

All three support a `?` button next to the scale dropdown that explains per-column vs global-max scaling. Three sequential colour palettes (Ember / Ink / Moss) — no rainbow, since rainbow palettes mislead the eye on ordinal data. Each has a "Load sample" button so you can see the layout without real data.

---

## File layout

```
.
├── run-analysis.sh          # end-to-end: normalise -> three CSVs -> open viewers
├── normalise-posts.ts       # unify Twitter + Truth Social into one NDJSON
├── analyse-hours.ts         # year × hour bucketing
├── analyse-dow-hours.ts     # weekday × hour bucketing
├── analyse-month-hours.ts   # month × hour bucketing (continuous timeline)
├── plot-heatmap.html        # year × hour viewer (file picker)
├── plot-dow-heatmap.html    # weekday × hour viewer (file picker)
├── plot-month-heatmap.html  # month × hour viewer (date range default: 24mo)
├── bundle-static.ts         # inlines a CSV into a viewer template
├── plot-*.static.html       # self-contained bundles (run-analysis.sh --static)
├── data/                    # source files (gitignore)
│   ├── trump_tweets_v2_archive.json
│   └── truth_archive.json
├── unified.ndjson           # normaliser output (gitignore)
├── posts-by-year-hour.csv   # analyser output (gitignore)
├── posts-by-dow-hour.csv    # analyser output (gitignore)
└── posts-by-month-hour.csv  # analyser output (gitignore)
```
