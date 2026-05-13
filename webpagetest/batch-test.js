#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const yargs = require('yargs');
const { createObjectCsvWriter } = require('csv-writer');

// Parse command-line arguments
const argv = yargs
  .option('api-key', {
    describe: 'WebPageTest API key',
    type: 'string',
    demandOption: false,
  })
  .option('hosts', {
    describe: 'JSON file with host URLs to test',
    type: 'string',
    demandOption: false,
  })
  .option('location', {
    describe: 'Test location (e.g., Dulles_VA, Frankfurt_Germany)',
    type: 'string',
    default: 'Dulles_VA',
  })
  .option('runs', {
    describe: 'Number of test runs per host',
    type: 'number',
    default: 9,
  })
  .option('private', {
    describe: 'Run private tests (requires paid API key)',
    type: 'boolean',
    default: false,
  })
  .option('output', {
    describe: 'Output CSV file path',
    type: 'string',
    default: './results/webpagetest-results.csv',
  })
  .argv;

const API_KEY = argv['api-key'] || process.env.WPT_API_KEY;
const HOSTS_FILE = argv['hosts'] || './hosts.json';
const LOCATION = argv['location'];
const RUNS = argv['runs'];
const PRIVATE = argv['private'];
const OUTPUT = argv['output'];

if (!API_KEY) {
  console.error('Error: WebPageTest API key required. Set via --api-key or WPT_API_KEY env var');
  console.error('Get a free key at: https://www.webpagetest.org/getkey.php');
  process.exit(1);
}

if (!fs.existsSync(HOSTS_FILE)) {
  console.error(`Error: Hosts file not found: ${HOSTS_FILE}`);
  process.exit(1);
}

// Load hosts from JSON file
let hosts = [];
try {
  const content = fs.readFileSync(HOSTS_FILE, 'utf8');
  hosts = JSON.parse(content);
  if (!Array.isArray(hosts)) {
    console.error('Error: hosts.json must contain an array of URLs');
    process.exit(1);
  }
} catch (e) {
  console.error(`Error reading hosts.json: ${e.message}`);
  process.exit(1);
}

console.log(`\n╔════════════════════════════════════════╗`);
console.log(`║   ThatMy.com WebPageTest Batch Runner  ║`);
console.log(`╚════════════════════════════════════════╝\n`);

console.log(`Configuration:`);
console.log(`  Hosts: ${hosts.length}`);
console.log(`  Location: ${LOCATION}`);
console.log(`  Runs per host: ${RUNS}`);
console.log(`  Test type: ${PRIVATE ? 'Private' : 'Public'}`);
console.log(`  Output: ${OUTPUT}\n`);

async function submitTest(url, runNumber) {
  const params = {
    url: url,
    location: LOCATION,
    runs: RUNS,
    first: 1,
    private: PRIVATE ? 1 : 0,
    video: 1,
    k: API_KEY,
  };

  try {
    const response = await axios.get('https://www.webpagetest.org/api/json/runtest', {
      params: params,
      timeout: 10000,
    });

    if (response.data.statusCode !== 200) {
      console.error(`  ✗ Failed to submit test for ${url}`);
      return null;
    }

    const testId = response.data.data.testid;
    console.log(`  ✓ Submitted: ${url} (Test ID: ${testId})`);
    return { url, testId, submittedAt: new Date() };
  } catch (error) {
    console.error(`  ✗ Error submitting test for ${url}: ${error.message}`);
    return null;
  }
}

async function getTestResults(testId) {
  const params = {
    testid: testId,
    breakdown: 1,
    domains: 1,
    pageSpeed: 1,
    k: API_KEY,
  };

  try {
    const response = await axios.get('https://www.webpagetest.org/api/json/results', {
      params: params,
      timeout: 10000,
    });

    if (response.data.statusCode !== 200) {
      return null;
    }

    const data = response.data.data;

    // Average metrics across runs
    let avgTTFB = 0;
    let avgFCP = 0;
    let avgLCP = 0;
    let avgSpeedIndex = 0;
    let avgFullyLoaded = 0;
    let runCount = 0;

    if (data.runs) {
      Object.values(data.runs).forEach((run) => {
        if (run.firstView) {
          avgTTFB += run.firstView.TTFB || 0;
          avgFCP += run.firstView.firstContentfulPaint || 0;
          avgLCP += run.firstView.largestContentfulPaint || 0;
          avgSpeedIndex += run.firstView.SpeedIndex || 0;
          avgFullyLoaded += run.firstView.fullyLoaded || 0;
          runCount++;
        }
      });

      if (runCount > 0) {
        avgTTFB = Math.round(avgTTFB / runCount);
        avgFCP = Math.round(avgFCP / runCount);
        avgLCP = Math.round(avgLCP / runCount);
        avgSpeedIndex = Math.round(avgSpeedIndex / runCount);
        avgFullyLoaded = Math.round(avgFullyLoaded / runCount);
      }
    }

    return {
      testId: testId,
      ttfb: avgTTFB,
      fcp: avgFCP,
      lcp: avgLCP,
      speedIndex: avgSpeedIndex,
      fullyLoaded: avgFullyLoaded,
      url: data.testUrl,
      location: LOCATION,
      testDate: new Date(data.completed * 1000),
    };
  } catch (error) {
    console.error(`Error retrieving results for ${testId}: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log(`Submitting ${hosts.length} hosts for testing...\n`);

  // Submit all tests
  const submissions = [];
  for (const host of hosts) {
    const result = await submitTest(host, 1);
    if (result) {
      submissions.push(result);
    }
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
  }

  if (submissions.length === 0) {
    console.error('No tests submitted successfully');
    process.exit(1);
  }

  console.log(`\n✓ Submitted ${submissions.length} tests`);
  console.log(`\nWaiting for results (this may take 10-30 minutes)...\n`);

  // Poll for results
  const results = [];
  let completed = 0;
  let maxWaitTime = RUNS * 60 * 1000 + 5 * 60 * 1000; // Runs time + 5 min buffer
  let elapsedTime = 0;

  while (completed < submissions.length && elapsedTime < maxWaitTime) {
    for (const submission of submissions) {
      if (!submission.completed) {
        const result = await getTestResults(submission.testId);
        if (result) {
          results.push(result);
          submission.completed = true;
          completed++;
          console.log(`[${completed}/${submissions.length}] ✓ ${submission.url}`);
        }
      }
    }

    if (completed < submissions.length) {
      await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 seconds before retrying
      elapsedTime += 15000;
    }
  }

  if (results.length === 0) {
    console.error('\n✗ No test results retrieved');
    process.exit(1);
  }

  // Write results to CSV
  const outputDir = path.dirname(OUTPUT);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const csvWriter = createObjectCsvWriter({
    path: OUTPUT,
    header: [
      { id: 'url', title: 'URL' },
      { id: 'ttfb', title: 'TTFB (ms)' },
      { id: 'fcp', title: 'FCP (ms)' },
      { id: 'lcp', title: 'LCP (ms)' },
      { id: 'speedIndex', title: 'Speed Index' },
      { id: 'fullyLoaded', title: 'Fully Loaded (ms)' },
      { id: 'location', title: 'Location' },
      { id: 'testDate', title: 'Test Date' },
    ],
  });

  await csvWriter.writeRecords(results);

  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║         Test Results Summary           ║`);
  console.log(`╚════════════════════════════════════════╝\n`);

  console.log(`Total tests: ${results.length}`);
  console.log(`Location: ${LOCATION}`);
  console.log(`Output file: ${OUTPUT}\n`);

  // Sort by TTFB and display
  results.sort((a, b) => a.ttfb - b.ttfb);

  console.log('Top performers (by TTFB):');
  results.slice(0, 3).forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.url.replace(/https?:\/\//g, '')} - ${r.ttfb}ms`);
  });

  console.log(`\nResults saved to: ${OUTPUT}`);
}

main().catch(error => {
  console.error(`\nFatal error: ${error.message}`);
  process.exit(1);
});
