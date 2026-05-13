import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const ttfbDuration = new Trend('ttfb', { isTime: true });
const responseDuration = new Trend('response_time', { isTime: true });
const p95Response = new Trend('p95_response', { isTime: true });
const p99Response = new Trend('p99_response', { isTime: true });

// Configuration from environment variables
const TARGET_URL = __ENV.TARGET_URL || 'http://localhost';
const VUS = __ENV.VUS || 100;
const DURATION = __ENV.DURATION || '60s';
const RAMP_UP = __ENV.RAMP_UP || '30s';

export const options = {
  stages: [
    { duration: RAMP_UP, target: parseInt(VUS) },
    { duration: DURATION, target: parseInt(VUS) },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.1'],
    response_time: ['p(95)<500'],
    ttfb: ['p(95)<300'],
  },
};

export default function () {
  group('WordPress Homepage', function () {
    const res = http.get(TARGET_URL, {
      headers: {
        'User-Agent': 'ThatMy.com Benchmark Suite/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      tags: { name: 'Homepage' },
    });

    // Track TTFB (Time to First Byte)
    ttfbDuration.add(res.timings.waiting);
    responseDuration.add(res.timings.duration);

    // Check response validity
    const isSuccess = check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 1000ms': (r) => r.timings.duration < 1000,
      'page loaded': (r) => r.body.includes('wp-content') || r.status < 400,
    });

    errorRate.add(!isSuccess);

    // Percentile tracking
    if (res.timings.duration < 300) {
      p95Response.add(res.timings.duration);
    }
    if (res.timings.duration < 500) {
      p99Response.add(res.timings.duration);
    }
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data, null, 2),
  };
}

// Helper function to format summary output
function textSummary(data, options) {
  const summary = `

╔══════════════════════════════════════╗
║    ThatMy.com k6 Load Test Results   ║
╚══════════════════════════════════════╝

Test Target: ${TARGET_URL}
Virtual Users: ${VUS}
Duration: ${DURATION}

─ Response Times ─
  TTFB (p50): ${Math.round(data.metrics.ttfb?.values?.p('0.5') || 0)}ms
  TTFB (p95): ${Math.round(data.metrics.ttfb?.values?.p('0.95') || 0)}ms
  TTFB (p99): ${Math.round(data.metrics.ttfb?.values?.p('0.99') || 0)}ms

  Response (p50): ${Math.round(data.metrics.response_time?.values?.p('0.5') || 0)}ms
  Response (p95): ${Math.round(data.metrics.response_time?.values?.p('0.95') || 0)}ms
  Response (p99): ${Math.round(data.metrics.response_time?.values?.p('0.99') || 0)}ms

─ Throughput ─
  Requests/sec: ${Math.round(data.metrics.http_reqs?.value || 0)}

─ Errors ─
  Error Rate: ${(data.metrics.errors?.value || 0).toFixed(2)}%
  Failed Checks: ${Object.keys(data.metrics).filter(k => k.includes('check')).length}

Full summary saved to: summary.json
`;

  return summary;
}
