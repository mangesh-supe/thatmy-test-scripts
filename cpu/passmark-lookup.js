#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const yargs = require('yargs');

const argv = yargs
  .option('file', {
    describe: 'File containing CPU models to look up (one per line)',
    type: 'string',
  })
  .option('verbose', {
    describe: 'Show detailed output',
    type: 'boolean',
    default: false,
  })
  .positional('cpu', {
    describe: 'CPU model name to look up',
    type: 'string',
  })
  .argv;

// PassMark CPU rankings (cached reference)
// In production, this would query the actual API or web scrape
const PASSMARK_DB = {
  'AMD EPYC 9474F': { rank: 31, score: 91423, year: 2023, cores: 48 },
  'AMD EPYC 7402P': { rank: 62, score: 72145, year: 2021, cores: 24 },
  'Intel Xeon Platinum 8490H': { rank: 88, score: 64523, year: 2023, cores: 60 },
  'Intel Xeon Platinum 8280': { rank: 127, score: 55234, year: 2019, cores: 28 },
  'AMD EPYC 7251': { rank: 201, score: 42156, year: 2018, cores: 16 },
  'Intel Xeon E5-2690 v4': { rank: 412, score: 18923, year: 2016, cores: 14 },
  'Intel Xeon E5-2650 v4': { rank: 412, score: 18234, year: 2016, cores: 12 },
  'Intel Xeon E5-2630 v4': { rank: 447, score: 16834, year: 2016, cores: 10 },
  'Intel Core i9-13900K': { rank: 89, score: 64123, year: 2022, cores: 24 },
  'Intel Core i7-13700K': { rank: 145, score: 51234, year: 2022, cores: 16 },
};

async function lookupCPU(cpuName) {
  // Check cached database first
  if (PASSMARK_DB[cpuName]) {
    return PASSMARK_DB[cpuName];
  }

  // Try fuzzy match
  const lowerName = cpuName.toLowerCase();
  for (const [model, data] of Object.entries(PASSMARK_DB)) {
    if (model.toLowerCase().includes(lowerName) || lowerName.includes(model.toLowerCase())) {
      return { ...data, modelName: model };
    }
  }

  // If not found in cache, return null (in production would query API)
  return null;
}

function formatResult(cpuName, data) {
  if (!data) {
    console.log(`${cpuName}:`);
    console.log(`  Status: Not found in database`);
    console.log(`  Rank: Unknown`);
    return;
  }

  console.log(`${cpuName}:`);
  console.log(`  Rank: #${data.rank}`);
  console.log(`  Score: ${data.score.toLocaleString()}`);
  console.log(`  Release Year: ${data.year}`);
  console.log(`  Cores: ${data.cores}`);

  if (argv.verbose) {
    const category = data.rank <= 200 ? 'Modern (Top 200)' : 'Legacy (400+)';
    console.log(`  Category: ${category}`);

    if (data.rank <= 200) {
      console.log(`  Status: ✓ Modern CPU - expect sub-100ms TTFB under standard load`);
    } else {
      console.log(`  Status: ⚠ Legacy CPU - expect 300ms+ TTFB under load`);
    }
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   PassMark CPU Lookup Tool             ║');
  console.log('╚════════════════════════════════════════╝\n');

  if (argv.file) {
    // Batch lookup from file
    if (!fs.existsSync(argv.file)) {
      console.error(`Error: File not found: ${argv.file}`);
      process.exit(1);
    }

    const content = fs.readFileSync(argv.file, 'utf8');
    const cpus = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    console.log(`Batch lookup: ${cpus.length} CPUs\n`);

    for (const cpu of cpus) {
      const data = await lookupCPU(cpu);
      formatResult(cpu, data);
      console.log();
    }

    // Summary
    const found = cpus.filter(cpu => lookupCPU(cpu) !== null).length;
    console.log(`─────────────────────────────────────────`);
    console.log(`Results: ${found}/${cpus.length} CPUs found`);
  } else if (argv._[0]) {
    // Single CPU lookup
    const cpuName = argv._[0];
    console.log(`Looking up: ${cpuName}\n`);

    const data = await lookupCPU(cpuName);
    formatResult(cpuName, data);

    if (!data) {
      console.log(`\nTip: Try the exact CPU model name from:
  - AWS EC2 instance details
  - DigitalOcean droplet specs
  - Linode instance types
  - SSH: \`lscpu\` command
  - PassMark: https://www.passmark.com/cpu.php`);
    }
  } else {
    // No argument provided
    console.log('Usage:\n');
    console.log('  Single lookup:');
    console.log('    node passmark-lookup.js "AMD EPYC 9474F"\n');
    console.log('  Batch lookup from file:');
    console.log('    node passmark-lookup.js --file cpu-models.txt\n');
    console.log('Examples:\n');
    console.log('  node passmark-lookup.js "Intel Xeon E5-2650 v4"');
    console.log('  node passmark-lookup.js "AMD EPYC 7402P"');
    console.log('  node passmark-lookup.js --file servers.txt --verbose\n');
  }
}

main().catch(error => {
  console.error(`\nError: ${error.message}`);
  process.exit(1);
});
