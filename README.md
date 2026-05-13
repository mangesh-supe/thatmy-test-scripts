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

## How We Use These Scripts

Our monthly testing workflow:

1. **Setup:** Create test WordPress install on each host (identical plugins, content, theme)
2. **WebPageTest:** Run batch-test.js against all hosts from Dulles VA (9 runs each)
3. **Load test:** Run k6 load test (50, 100, 250 concurrent users) against each host
4. **CPU verification:** SSH into each host, run `lscpu`, look up on PassMark
5. **Aggregation:** Combine all results into unified CSV
6. **Analysis:** Calculate percentiles, identify trends, update benchmark pages

Total time: 4-6 hours per monthly test cycle

## Reproducing Our Benchmarks

To verify our TTFB data or run against your own hosts:

1. **Clone the repo:**
   ```bash
   git clone https://github.com/mangeshsupe/thatmy-test-scripts.git
   cd thatmy-test-scripts
   ```

2. **Install dependencies:**
   ```bash
   npm install && brew install k6
   ```

3. **Get WebPageTest key:**
   Free account at [webpagetest.org](https://webpagetest.org)

4. **Create hosts.json:**
   ```json
   [
     "https://yourhost1.com",
     "https://yourhost2.com",
     "https://yourhost3.com"
   ]
   ```

5. **Run batch-test.js:**
   ```bash
   node webpagetest/batch-test.js \
     --api-key YOUR_KEY \
     --hosts hosts.json \
     --location Dulles_VA \
     --runs 9
   ```

6. **Run k6 script:**
   ```bash
   k6 run k6/wordpress-load-test.js \
     --vus 100 \
     --duration 60s \
     -e TARGET_URL=https://yourhost.com
   ```

7. **Compare results:**
   See how your host stacks up against the benchmarked providers.

Full instructions in repository README.

## Customizing for Your Use Case

### Testing your own site:
- Fork the repo
- Update `hosts.json` with your site URL
- Run load tests to benchmark against public data
- Use k6 to test your own performance optimization efforts

### Testing different WordPress versions:
- Modify the test WordPress install to use WordPress 6.4, 6.6, etc.
- Run full test cycle to see version impact on performance

### Testing non-WordPress platforms:
- Adapt k6 script to target different URLs/endpoints
- Use WebPageTest batch runner on any web application

## Requirements

**Software:**
- Node.js 18+ (for batch and aggregation scripts)
- k6 (for load testing)
- WebPageTest API key (free account at webpagetest.org)

**Hardware:**
- Laptop or desktop with 8GB+ RAM
- Stable internet connection (load tests generate 50Mbps+ traffic)

**Cost:**
- Free (WebPageTest free tier: 200 tests/day)
- Optional: Paid WebPageTest plan for unlimited tests ($99+/month)

## License & Attribution

These scripts are published under the **MIT License**. You're free to:

- **Use:** Run them against your own hosts
- **Modify:** Adapt for different testing scenarios
- **Distribute:** Share modified versions
- **Commercialize:** Use for commercial testing services

**Attribution appreciated but not required:** If you use these scripts for published benchmarks, a link back to thatmy.com/how-we-test is appreciated.

## Support & Issues

Questions or issues with the scripts?

- **GitHub Issues:** File a bug report at the [repository](https://github.com/mangeshsupe/thatmy-test-scripts/issues)
- **Email:** [mangesh@thatmy.com](mailto:mangesh@thatmy.com)

## Related Resources

- [Complete Testing Methodology](https://thatmy.com/how-we-test/) — Full explanation of test conditions
- [WordPress Hosting Benchmarks](https://thatmy.com/wordpress-hosting-benchmarks/) — Our monthly results using these scripts
- [WebPageTest Documentation](https://www.webpagetest.org/) — Test configuration reference
- [k6 Documentation](https://k6.io/docs/) — Load testing framework guide
- [PassMark CPU Benchmarks](https://www.passmark.com/) — CPU ranking database
