# Latency probe results

This page records how long requests take from Algerian connections to the AWS and Cloudflare endpoints Tavio may use.

## How to run

1. Use the connection you want to measure: mobile data or ADSL. Turn off VPNs and proxies.
2. From the repo root, run:

   ```bash
   bash scripts/latency-probe.sh
   ```

3. The script sends 20 requests to each target and prints a markdown table. It also prints the Cloudflare colo, which is the data center that served you (for example `ALG` or `CDG`).
4. Paste the table into the results section below. Add the connection type, ISP and city yourself.

The script needs `bash` and `curl`. Run it once per connection. A full run takes about 30 seconds.

## Metrics

- **Connect**: time to open the TCP and TLS connection (`time_connect`).
- **TTFB**: time from request start to the first response byte (`time_starttransfer`).
- **Median and p90** use nearest-rank on the 20 samples. Failed requests are left out and counted in the `OK/20` column.

## Results

The median and p90 columns below use TTFB, the figure that matters most for API calls. Connect times are in the script output.

| Connection type | ISP | City | Target | Median (ms) | P90 (ms) |
|---|---|---|---|---|---|
|  |  |  |  |  |  |
