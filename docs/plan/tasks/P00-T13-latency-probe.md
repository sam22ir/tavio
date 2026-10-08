# P00-T13 Latency probe script
Wave 1. Parallel-safe.
## Files
- `scripts/latency-probe.sh`
- `docs/latency.md`
## Implement
- A bash script the user runs from Algerian connections (mobile and ADSL).
- For each target, it does 20 `curl -o /dev/null -s -w '%{time_connect} %{time_starttransfer}'` requests and prints the median and p90 in ms. The targets are:
  - `https://dynamodb.eu-west-3.amazonaws.com/ping` (Paris)
  - `https://dynamodb.eu-central-1.amazonaws.com/ping` (Frankfurt)
  - `https://www.cloudflare.com/cdn-cgi/trace`, which also prints the colo line
- The output is a markdown table the user can paste into docs/latency.md.
- `docs/latency.md` explains how to run the script and has an empty results table (connection type, ISP, city, target, median, p90).
## Verification
`bash -n scripts/latency-probe.sh && shellcheck scripts/latency-probe.sh` (skip shellcheck if it isn't installed). Run it once and include the output in your report.
