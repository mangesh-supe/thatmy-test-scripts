#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yargs = require('yargs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');

const argv = yargs
  .option('k6', {
    describe: 'Path to k6 results JSON file',
    type: 'string',
    demandOption: false,
  })
  .option('webpagetest', {
    describe: 'Path to WebPageTest results CSV file',
    type: 'string',
    demandOption: false,
  })
  .option('cpu', {
    describe: 'Path to CPU data JSON file',
    type: 'string',
    demandOption: false,
  })
  .option('output', {
    describe: 'Output CSV file path',
    type: 'string',
    default: './results/final-benchmark.csv',
  })
  .argv;

console.log('\n╔════════════════════════════════════════╗');
console.log('║   ThatMy.com Data Aggregation Tool    ║');
console.log('╚════════════════════════════════════════╝\n');

async function loadK6Results(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    const results = {};

    // Parse k6 metrics
    Object.entries(data.metrics).forEach(([metric, value]) => {
      if (metric.includes('http_req')) {
        // Extract response time data
        const host = metric.split('{')[1]?.split('}')[0] || 'unknown';
        if (!results[host]) results[host] = {};

        if (metric.includes('duration')) {
          results[host].k6_response_time = Math.round(value.values.p95 || 0);
        }
      }
    });

    return results;
  } catch (error) {
    console.warn(`Warning: Could not parse k6 results: ${error.message}`);
    return {};
  }
}

async function loadWebPageTestResults(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }

  return new Promise((resolve, reject) => {
    const results = {};

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const host = extractHostname(row.URL || row.url || '');
        results[host] = {
          wpt_ttfb: parseInt(row['TTFB (ms)'] || row.ttfb || 0),
          wpt_fcp: parseInt(row['FCP (ms)'] || row.fcp || 0),
          wpt_lcp: parseInt(row['LCP (ms)'] || row.lcp || 0),
          wpt_speed_index: parseInt(row['Speed Index'] || row.speedIndex || 0),
          wpt_fully_loaded: parseInt(row['Fully Loaded (ms)'] || row.fullyLoaded || 0),
        };
      })
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

async function loadCPUData(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    const results = {};

    if (Array.isArray(data)) {
      data.forEach(entry => {
        const host = extractHostname(entry.url || entry.host || '');
        results[host] = {
          cpu_model: entry.cpu_model || '',
          cpu_rank: entry.passmark_rank || 0,
          cpu_score: entry.passmark_score || 0,
          cpu_cores: entry.cores || 0,
        };
      });
    } else {
      Object.entries(data).forEach(([host, entry]) => {
        results[host] = {
          cpu_model: entry.cpu_model || '',
          cpu_rank: entry.passmark_rank || 0,
          cpu_score: entry.passmark_score || 0,
          cpu_cores: entry.cores || 0,
        };
      });
    }

    return results;
  } catch (error) {
    console.warn(`Warning: Could not parse CPU data: ${error.message}`);
    return {};
  }
}

function extractHostname(url) {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url.replace(/https?:\/\/?www\./, '').split('/')[0];
  }
}

function calculatePercentile(value) {
  // Simple category based on TTFB
  if (value <= 100) return 'Top 25%';
  if (value <= 200) return 'Top 50%';
  if (value <= 300) return 'Average';
  return 'Below Average';
}

async function main() {
  let k6Results = {};
  let wptResults = {};
  let cpuResults = {};

  console.log('Loading data sources...\n');

  if (argv.k6) {
    console.log(`  Loading k6 results from: ${argv.k6}`);
    k6Results = await loadK6Results(argv.k6);
  }

  if (argv.webpagetest) {
    console.log(`  Loading WebPageTest results from: ${argv.webpagetest}`);
    wptResults = await loadWebPageTestResults(argv.webpagetest);
  }

  if (argv.cpu) {
    console.log(`  Loading CPU data from: ${argv.cpu}`);
    cpuResults = await loadCPUData(argv.cpu);
  }

  // Merge all results
  const hosts = new Set([
    ...Object.keys(k6Results),
    ...Object.keys(wptResults),
    ...Object.keys(cpuResults),
  ]);

  const aggregated = [];

  hosts.forEach(host => {
    const k6 = k6Results[host] || {};
    const wpt = wptResults[host] || {};
    const cpu = cpuResults[host] || {};

    const ttfb = wpt.wpt_ttfb || 0;
    const percentile = calculatePercentile(ttfb);

    aggregated.push({
      host,
      'TTFB (ms)': ttfb,
      'FCP (ms)': wpt.wpt_fcp || 0,
      'LCP (ms)': wpt.wpt_lcp || 0,
      'Speed Index': wpt.wpt_speed_index || 0,
      'Fully Loaded (ms)': wpt.wpt_fully_loaded || 0,
      'Response Time p95 (ms)': k6.k6_response_time || 0,
      'CPU Model': cpu.cpu_model || 'Unknown',
      'CPU Rank': cpu.cpu_rank || 0,
      'CPU Score': cpu.cpu_score || 0,
      'CPU Cores': cpu.cpu_cores || 0,
      'Performance Tier': percentile,
    });
  });

  // Sort by TTFB
  aggregated.sort((a, b) => a['TTFB (ms)'] - b['TTFB (ms)']);

  // Create output directory if needed
  const outputDir = path.dirname(argv.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write CSV
  const csvWriter = createObjectCsvWriter({
    path: argv.output,
    header: [
      { id: 'host', title: 'Host' },
      { id: 'TTFB (ms)', title: 'TTFB (ms)' },
      { id: 'FCP (ms)', title: 'FCP (ms)' },
      { id: 'LCP (ms)', title: 'LCP (ms)' },
      { id: 'Speed Index', title: 'Speed Index' },
      { id: 'Fully Loaded (ms)', title: 'Fully Loaded (ms)' },
      { id: 'Response Time p95 (ms)', title: 'Response Time p95 (ms)' },
      { id: 'CPU Model', title: 'CPU Model' },
      { id: 'CPU Rank', title: 'CPU Rank' },
      { id: 'CPU Score', title: 'CPU Score' },
      { id: 'CPU Cores', title: 'CPU Cores' },
      { id: 'Performance Tier', title: 'Performance Tier' },
    ],
  });

  await csvWriter.writeRecords(aggregated);

  // Display summary
  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║         Aggregation Results            ║`);
  console.log(`╚════════════════════════════════════════╝\n`);

  console.log(`Total hosts: ${aggregated.length}`);
  console.log(`Output: ${argv.output}\n`);

  console.log('Top 5 performers (by TTFB):');
  aggregated.slice(0, 5).forEach((host, i) => {
    console.log(
      `  ${i + 1}. ${host.host.padEnd(25)} - ${host['TTFB (ms)'].toString().padEnd(4)}ms (${host['Performance Tier']})`
    );
  });

  if (aggregated.length > 5) {
    console.log(`\n... and ${aggregated.length - 5} more\n`);
  }

  console.log(`Statistics:`);
  const ttfbs = aggregated.map(h => h['TTFB (ms)']).filter(v => v > 0);
  if (ttfbs.length > 0) {
    const avg = Math.round(ttfbs.reduce((a, b) => a + b) / ttfbs.length);
    const min = Math.min(...ttfbs);
    const max = Math.max(...ttfbs);
    console.log(`  Avg TTFB: ${avg}ms`);
    console.log(`  Min TTFB: ${min}ms`);
    console.log(`  Max TTFB: ${max}ms`);
    console.log(`  Spread: ${max - min}ms`);
  }

  console.log(`\n✓ Results saved to: ${argv.output}`);
}

main().catch(error => {
  console.error(`\nFatal error: ${error.message}`);
  process.exit(1);
});
