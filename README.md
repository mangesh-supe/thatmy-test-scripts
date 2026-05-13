# thatmy-test-scripts
Open-source test scripts for WordPress hosting benchmarks : k6 load testing, WebPageTest batch runner, PassMark CPU lookup, and data aggregation. MIT licensed.

Same scripts behind every benchmark published at [thatmy.com](https://thatmy.com). Use them to reproduce our results, test your own hosts, or adapt them for your own benchmarking workflow.

**License:** MIT — free to use, modify, and distribute.

---

## What's Inside

| Script | File | Purpose |
|---|---|---|
| k6 Load Test | `k6/wordpress-load-test.js` | Simulate concurrent users, measure TTFB percentiles |
| WebPageTest Batch | `webpagetest/batch-test.js` | Run multi-host WPT tests, export Core Web Vitals |
| PassMark CPU Lookup | `cpu/passmark-lookup.js` | Look up CPU rank, score, and release year |
| Data Aggregation | `data/aggregate-results.js` | Merge all results into a single CSV/JSON |

---

## Requirements

- **Node.js** 18+
- **k6** — [install guide](https://k6.io/docs/get-started/installation/)
- **WebPageTest API key** — free at [webpagetest.org/getkey.php](https://www.webpagetest.org/getkey.php)
- 8GB+ RAM, stable internet (load tests generate 50Mbps+ traffic)

---

## Setup

```bash
git clone https://github.com/mangeshsupe/thatmy-test-scripts.git
cd thatmy-test-scripts
npm install
brew install k6   # macOS; see k6 docs for other platforms
```

---

## Scripts

### 1. k6 Load Test

**File:** `k6/wordpress-load-test.js`

Simulates concurrent users hitting a WordPress homepage. Measures response times, error rates, and TTFB percentiles.

```bash
k6 run k6/wordpress-load-test.js \
  --vus 100 \
  --duration 60s \
  -e TARGET_URL=https://yourhost.com
```

**Parameters:**

| Flag | Default | Description |
|---|---|---|
| `--vus` | 100 | Concurrent virtual users |
| `--duration` | 60s | Test duration |
| `TARGET_URL` | — | Your WordPress site URL |
| `RAMP_UP` | 30s | Ramp-up period |

**Output:** p50/p95/p99 response times, error rate, requests/second.

---

### 2. WebPageTest Batch Runner

**File:** `webpagetest/batch-test.js`

Runs WebPageTest against multiple hosts in parallel. Captures TTFB, FCP, LCP, Speed Index, and waterfall data.

```bash
node webpagetest/batch-test.js \
  --api-key YOUR_WEBPAGETEST_KEY \
  --hosts hosts.json \
  --location Dulles_VA \
  --runs 9
```

**Parameters:**

| Flag | Default | Description |
|---|---|---|
| `--api-key` | — | WebPageTest API key |
| `--hosts` | — | JSON file with host URLs |
| `--location` | Dulles_VA | Test location (e.g. `Frankfurt_Germany`) |
| `--runs` | 9 | Runs per host (median is used) |
| `--private` | false | Private tests (paid API key required) |

**Output:** CSV with TTFB, FCP, LCP, Speed Index, and fully-loaded time per host.

> **Note:** WebPageTest free tier allows 200 tests/day. Paid plan ($99+/month) is unlimited.

---

### 3. PassMark CPU Lookup

**File:** `cpu/passmark-lookup.js`

Takes a CPU model name and returns its PassMark rank, score, release year, and core count.

```bash
# Single CPU
node cpu/passmark-lookup.js "AMD EPYC 9474F"

# Batch from file
node cpu/passmark-lookup.js --file cpu-models.txt
```

**Example output:**

```
AMD EPYC 9474F:
  Rank: #31
  Score: 91,423
  Release Year: 2023
  Cores: 48
```

---

### 4. Data Aggregation

**File:** `data/aggregate-results.js`

Combines k6, WebPageTest, and CPU data into a single unified CSV or JSON file.

```bash
node data/aggregate-results.js \
  --k6 ./results/k6-results.json \
  --webpagetest ./results/wpt-results.csv \
  --cpu ./results/cpu-data.json \
  --output ./results/final-benchmark.csv
```

**Output:** One CSV with all metrics per host, ready to import into a spreadsheet or analysis tool.

---

## How We Run Monthly Tests

1. **Setup** — Install identical WordPress test sites (same plugins, theme, content) on each host
2. **WebPageTest** — Run `batch-test.js` against all hosts from Dulles VA (9 runs each)
3. **Load test** — Run k6 at 50, 100, and 250 concurrent users per host
4. **CPU verification** — SSH into each host, run `lscpu`, look up on PassMark
5. **Aggregation** — Merge everything with `aggregate-results.js`
6. **Analysis** — Calculate percentiles, identify trends, update benchmark pages

**Total time:** 4–6 hours per monthly cycle.

---

## Reproducing Our Benchmarks

To verify published TTFB data or run against your own hosts:

1. Clone this repo
2. Add your sites to `hosts.json`
3. Get a free WebPageTest API key
4. Run `batch-test.js` for page speed metrics
5. Run `k6` for load test metrics
6. Aggregate with `aggregate-results.js`
7. Compare against our published data at [thatmy.com/wordpress-hosting-benchmarks](https://thatmy.com/wordpress-hosting-benchmarks/)

---

## Customization

**Your own site:** Fork the repo, update `hosts.json`, run tests, compare against our public data.

**Different WordPress versions:** Swap out the test install (WP 6.4, 6.6, etc.) and run a full cycle to see version impact.

**Non-WordPress platforms:** Adapt the k6 script for any URL; `batch-test.js` works against any web application.

---

## Related Resources

- [Testing Methodology](https://thatmy.com/how-we-test/) — Full explanation of test conditions, hardware, and controls
- [WordPress Hosting Benchmarks](https://thatmy.com/wordpress-hosting-benchmarks/) — Monthly results using these scripts
- [WebPageTest Docs](https://docs.webpagetest.org/) — Test configuration reference
- [k6 Docs](https://k6.io/docs/) — Load testing framework guide
- [PassMark CPU Benchmarks](https://www.cpubenchmark.net/) — CPU ranking database

---

## License

MIT License. You're free to use, modify, distribute, and commercialize these scripts without restriction.

Attribution appreciated but not required. If you use these scripts for published benchmarks, a link back to [thatmy.com/how-we-test](https://thatmy.com/how-we-test/) is welcome.

---

## Support

- **GitHub Issues:** [File a bug report](https://github.com/mangeshsupe/thatmy-test-scripts/issues)
- **Email:** mangesh@thatmy.com
