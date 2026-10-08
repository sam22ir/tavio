#!/usr/bin/env bash
# Latency probe: measures TCP connect and time-to-first-byte to the AWS and
# Cloudflare endpoints Tavio may use. Prints a markdown table for docs/latency.md.
#
# Usage: bash scripts/latency-probe.sh
# Each target gets N requests. Median and p90 use nearest-rank on the samples.
set -euo pipefail

N=20
MAX_TIME=20

TARGET_NAMES=(
  "AWS DynamoDB Paris (eu-west-3)"
  "AWS DynamoDB Frankfurt (eu-central-1)"
  "Cloudflare (www.cloudflare.com)"
)
TARGET_URLS=(
  "https://dynamodb.eu-west-3.amazonaws.com/ping"
  "https://dynamodb.eu-central-1.amazonaws.com/ping"
  "https://www.cloudflare.com/cdn-cgi/trace"
)

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required" >&2
  exit 1
fi

# Reads numbers on stdin and prints the nearest-rank percentile $1 (0-100).
percentile() {
  local pct=$1
  sort -n | awk -v p="$pct" '
    NF { a[++n] = $1 }
    END {
      if (n == 0) { print "n/a"; exit }
      r = int((p / 100) * n + 0.999999)
      if (r < 1) r = 1
      if (r > n) r = n
      printf "%.0f", a[r]
    }'
}

# Prints "connect_ms ttfb_ms" lines for $1 over N requests. Failed requests are skipped.
measure() {
  local url=$1 out i samples=""
  for ((i = 1; i <= N; i++)); do
    if out=$(curl -o /dev/null -s -m "$MAX_TIME" \
        -w '%{time_connect} %{time_starttransfer}' "$url" 2>/dev/null); then
      samples+="$out"$'\n'
    fi
  done
  printf '%s' "$samples" | awk 'NF == 2 { printf "%.0f %.0f\n", $1 * 1000, $2 * 1000 }'
}

echo "| Target | OK/$N | Median connect (ms) | P90 connect (ms) | Median TTFB (ms) | P90 TTFB (ms) |"
echo "|---|---|---|---|---|---|"

colo=""
for idx in "${!TARGET_URLS[@]}"; do
  name=${TARGET_NAMES[$idx]}
  url=${TARGET_URLS[$idx]}
  pairs=$(measure "$url")
  ok=$(printf '%s' "$pairs" | awk 'NF == 2' | wc -l | tr -d ' ')
  connect=$(printf '%s' "$pairs" | awk 'NF == 2 { print $1 }')
  ttfb=$(printf '%s' "$pairs" | awk 'NF == 2 { print $2 }')
  echo "| $name | $ok | $(printf '%s\n' "$connect" | percentile 50) | $(printf '%s\n' "$connect" | percentile 90) | $(printf '%s\n' "$ttfb" | percentile 50) | $(printf '%s\n' "$ttfb" | percentile 90) |"

  if [[ "$url" == *cdn-cgi/trace ]]; then
    colo=$(curl -s -m "$MAX_TIME" "$url" 2>/dev/null | awk -F= '$1 == "colo" { print $2 }') || colo=""
  fi
done

echo
echo "Cloudflare colo: ${colo:-unknown}"
