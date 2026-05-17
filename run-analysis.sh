#!/usr/bin/env bash
set -euo pipefail

# End-to-end: merge the source files into unified.ndjson, then produce the
# heatmap CSVs and open the viewers. Re-run any time the data folder changes;
# output files are overwritten.
#
# Flags:
#   --static          Also generate self-contained *.static.html bundles with
#                     the CSVs inlined (no file picker) and open those instead.
#   --hershey         Use the Hershey CompleteTrumpTweetsArchive CSVs as the
#                     Twitter source instead of the default trumparchive v2 JSON.
#   --web-component   Generate web-component bundles in dist/ for embedding in
#                     a Hugo blog or any other site (open dist/index.html demo).

cd "$(dirname "$0")"

STATIC=
HERSHEY=
WEB_COMPONENT=
for arg in "$@"; do
  case "$arg" in
    --static)         STATIC=1 ;;
    --hershey)        HERSHEY=1 ;;
    --web-component)  WEB_COMPONENT=1 ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

DATA_DIR="./data"
UNIFIED="./unified.ndjson"
YEAR_HOUR_CSV="./posts-by-year-hour.csv"
DOW_HOUR_CSV="./posts-by-dow-hour.csv"
MONTH_HOUR_CSV="./posts-by-month-hour.csv"

YEAR_HTML="plot-heatmap.html"
DOW_HTML="plot-dow-heatmap.html"
MONTH_HTML="plot-month-heatmap.html"

YEAR_STATIC="plot-heatmap.static.html"
DOW_STATIC="plot-dow-heatmap.static.html"
MONTH_STATIC="plot-month-heatmap.static.html"

if [[ -n "$HERSHEY" ]]; then
  REQUIRED=(
    "$DATA_DIR/realDonaldTrump_bf_office.csv"
    "$DATA_DIR/realDonaldTrump_in_office.csv"
    "$DATA_DIR/truth_archive.json"
  )
else
  REQUIRED=(
    "$DATA_DIR/trump_tweets_v2_archive.json"
    "$DATA_DIR/truth_archive.json"
  )
fi
for f in "${REQUIRED[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "Missing: $f — see README for download instructions." >&2
    exit 1
  fi
done

if [[ -n "$HERSHEY" ]]; then
  echo "==> Normalising Hershey CSVs + Truth Social into $UNIFIED"
  npx tsx normalise-posts.ts \
    --twitter-csv "$DATA_DIR/realDonaldTrump_bf_office.csv" \
    --twitter-csv "$DATA_DIR/realDonaldTrump_in_office.csv" \
    --truth-json  "$DATA_DIR/truth_archive.json" \
    --out "$UNIFIED"
else
  echo "==> Normalising trumparchive v2 JSON + Truth Social into $UNIFIED"
  npx tsx normalise-posts.ts \
    --twitter    "$DATA_DIR/trump_tweets_v2_archive.json" \
    --truth-json "$DATA_DIR/truth_archive.json" \
    --out "$UNIFIED"
fi

echo
echo "==> Year × hour analysis -> $YEAR_HOUR_CSV"
npx tsx analyse-hours.ts --in "$UNIFIED" --normalise --out "$YEAR_HOUR_CSV"

echo
echo "==> Weekday × hour analysis -> $DOW_HOUR_CSV"
npx tsx analyse-dow-hours.ts --in "$UNIFIED" --normalise --out "$DOW_HOUR_CSV"

echo
echo "==> Month × hour analysis -> $MONTH_HOUR_CSV"
npx tsx analyse-month-hours.ts --in "$UNIFIED" --normalise --out "$MONTH_HOUR_CSV"

if [[ -n "$STATIC" ]]; then
  echo
  echo "==> Bundling static HTML (data inlined)"
  npx tsx bundle-static.ts --template "$YEAR_HTML"  --csv "$YEAR_HOUR_CSV"  --out "$YEAR_STATIC"
  npx tsx bundle-static.ts --template "$DOW_HTML"   --csv "$DOW_HOUR_CSV"   --out "$DOW_STATIC"
  npx tsx bundle-static.ts --template "$MONTH_HTML" --csv "$MONTH_HOUR_CSV" --out "$MONTH_STATIC"
fi

if [[ -n "$WEB_COMPONENT" ]]; then
  echo
  echo "==> Bundling web components into dist/"
  npx tsx bundle-web-components.ts
fi

echo
if [[ -n "$WEB_COMPONENT" ]]; then
  echo "==> Opening dist/index.html (web-component demo)"
  if command -v open >/dev/null 2>&1; then
    open dist/index.html
  else
    echo "Open dist/index.html in a browser to preview the components."
  fi
elif [[ -n "$STATIC" ]]; then
  echo "==> Opening static viewers (data inlined)"
  if command -v open >/dev/null 2>&1; then
    open "$YEAR_STATIC"
    open "$DOW_STATIC"
    open "$MONTH_STATIC"
  else
    echo "Open these in a browser:"
    echo "  $YEAR_STATIC"
    echo "  $DOW_STATIC"
    echo "  $MONTH_STATIC"
  fi
else
  echo "==> Opening viewers (load the matching CSV in each)"
  if command -v open >/dev/null 2>&1; then
    open "$YEAR_HTML"
    open "$DOW_HTML"
    open "$MONTH_HTML"
  else
    echo "Open these in a browser and drop in the CSVs:"
    echo "  $YEAR_HTML        <- $YEAR_HOUR_CSV"
    echo "  $DOW_HTML    <- $DOW_HOUR_CSV"
    echo "  $MONTH_HTML  <- $MONTH_HOUR_CSV"
  fi
fi
