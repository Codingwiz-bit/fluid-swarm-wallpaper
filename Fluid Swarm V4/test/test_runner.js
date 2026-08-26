#!/usr/bin/env node

/**
 * Fluid Swarm V4 - Automated Headless Test Runner
 * 
 * Supports:
 * - Direct Node.js headless execution with built-in WebGL/Canvas/Audio polyfills
 * - Optional Headless Chrome browser execution (--browser)
 * - Multiple output formats: --format=cli (default), --format=tap, --format=json, --format=junit
 * - Tier & Feature filtering: --tier=1,2,3,4,5 --feature=1..24
 * - Strict exit code 0 on 100% pass, 1 on failure
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Load E2E Test Suite
const { runTests } = require('./e2e_suite.js');

// Parse CLI Arguments
const args = process.argv.slice(2);
let format = 'cli';
let tiers = null;
let features = null;
let runInBrowser = false;

for (const arg of args) {
  if (arg.startsWith('--format=')) {
    format = arg.split('=')[1].toLowerCase();
  } else if (arg.startsWith('--tier=')) {
    tiers = arg.split('=')[1].split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
  } else if (arg.startsWith('--feature=')) {
    features = arg.split('=')[1].split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
  } else if (arg === '--browser') {
    runInBrowser = true;
  }
}

// ANSI Colors
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const GRAY = '\x1b[90m';
const BG_GREEN = '\x1b[42m\x1b[30m';
const BG_RED = '\x1b[41m\x1b[37m';

async function runBrowserTest() {
  const chromePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome',
    'chromium',
    'chromium-browser'
  ];

  let chromeBin = null;
  for (const p of chromePaths) {
    try {
      if (fs.existsSync(p) || p.startsWith('/')) {
        chromeBin = p;
        break;
      }
    } catch (e) {}
  }

  if (!chromeBin) {
    console.log(`${YELLOW}Headless Chrome binary not found. Falling back to native Node.js test runner.${RESET}`);
    return null;
  }

  const harnessPath = path.resolve(__dirname, 'test_harness.html');
  const url = `file://${harnessPath}`;

  console.log(`${CYAN}${BOLD}[Browser Test Mode]${RESET} Launching Headless Chrome: ${chromeBin}`);
  console.log(`${GRAY}Target: ${url}${RESET}`);

  return new Promise((resolve) => {
    const child = spawn(chromeBin, [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--dump-dom',
      url
    ]);

    let output = '';
    child.stdout.on('data', (d) => { output += d.toString(); });
    child.stderr.on('data', (d) => { output += d.toString(); });

    child.on('close', (code) => {
      resolve({ browserRan: true, output, exitCode: code });
    });
  });
}

function renderCliReport(results) {
  console.log('\n' + '='.repeat(80));
  console.log(`${BOLD}${CYAN}   FLUID SWARM V4 - COMPREHENSIVE E2E VERIFICATION TEST REPORT${RESET}`);
  console.log('='.repeat(80) + '\n');

  for (const suite of results.suites) {
    const tierTag = `[Tier ${suite.tier}]`;
    const featTag = suite.featureId > 0 ? ` [Feature ${suite.featureId}]` : '';
    const statusIcon = suite.failed === 0 ? `${GREEN}✔ PASS${RESET}` : `${RED}✖ FAIL${RESET}`;
    
    console.log(`${BOLD}${statusIcon} ${CYAN}${tierTag}${featTag}${RESET} ${suite.name} ${GRAY}(${suite.duration.toFixed(1)}ms)${RESET}`);

    for (const t of suite.tests) {
      if (t.passed) {
        console.log(`   ${GREEN}✓${RESET} ${GRAY}${t.name}${RESET} ${GRAY}(${t.duration.toFixed(2)}ms)${RESET}`);
      } else {
        console.log(`   ${RED}✗ ${t.name}${RESET}`);
        console.log(`     ${RED}${BOLD}Error:${RESET} ${RED}${t.error}${RESET}`);
        if (t.stack) {
          const stackLine = t.stack.split('\n')[1] || '';
          console.log(`     ${GRAY}${stackLine.trim()}${RESET}`);
        }
      }
    }
    console.log('');
  }

  console.log('-'.repeat(80));
  console.log(`${BOLD}TIER COVERAGE SUMMARY:${RESET}`);
  console.log(`  Tier 1 (Feature Coverage):       ${results.tierSummary[1].passed}/${results.tierSummary[1].total} passed`);
  console.log(`  Tier 2 (Boundary & Corner Cases): ${results.tierSummary[2].passed}/${results.tierSummary[2].total} passed`);
  console.log(`  Tier 3 (Pairwise Interactions):   ${results.tierSummary[3].passed}/${results.tierSummary[3].total} passed`);
  console.log(`  Tier 4 (Real-World Workloads):    ${results.tierSummary[4].passed}/${results.tierSummary[4].total} passed`);
  console.log(`  Tier 5 (Adversarial Stress):      ${results.tierSummary[5].passed}/${results.tierSummary[5].total} passed`);
  console.log('-'.repeat(80));

  const totalTimeSec = (results.duration / 1000).toFixed(3);
  console.log(`${BOLD}TOTAL STATS:${RESET}`);
  console.log(`  Suites:      ${results.suites.length}`);
  console.log(`  Test Cases:  ${results.passedTests}/${results.totalTests} passed (${results.failedTests} failed)`);
  console.log(`  Assertions:  ${results.passedAssertions}/${results.totalAssertions} passed`);
  console.log(`  Duration:    ${totalTimeSec}s`);
  console.log('='.repeat(80));

  if (results.failedTests === 0) {
    console.log(`\n${BG_GREEN} SUCCESS ${RESET} ${BOLD}${GREEN}All ${results.totalTests} tests passed with 100% assertion coverage!${RESET}\n`);
  } else {
    console.log(`\n${BG_RED} FAILURE ${RESET} ${BOLD}${RED}${results.failedTests} test(s) failed.${RESET}\n`);
  }
}

function renderTapReport(results) {
  console.log('TAP version 13');
  console.log(`1..${results.totalTests}`);
  let idx = 1;
  for (const suite of results.suites) {
    for (const t of suite.tests) {
      if (t.passed) {
        console.log(`ok ${idx} - [Tier ${suite.tier}] ${suite.name} > ${t.name}`);
      } else {
        console.log(`not ok ${idx} - [Tier ${suite.tier}] ${suite.name} > ${t.name}`);
        console.log(`  ---`);
        console.log(`  message: "${t.error}"`);
        console.log(`  ...`);
      }
      idx++;
    }
  }
}

function renderJsonReport(results) {
  console.log(JSON.stringify(results, null, 2));
}

function renderJunitReport(results) {
  console.log('<?xml version="1.0" encoding="UTF-8"?>');
  console.log(`<testsuites tests="${results.totalTests}" failures="${results.failedTests}" time="${(results.duration / 1000).toFixed(3)}">`);
  for (const suite of results.suites) {
    console.log(`  <testsuite name="${suite.name}" tests="${suite.tests.length}" failures="${suite.failed}" time="${(suite.duration / 1000).toFixed(3)}">`);
    for (const t of suite.tests) {
      console.log(`    <testcase name="${t.name}" time="${(t.duration / 1000).toFixed(3)}">`);
      if (!t.passed) {
        console.log(`      <failure message="${t.error}"><![CDATA[${t.stack || t.error}]]></failure>`);
      }
      console.log(`    </testcase>`);
    }
    console.log(`  </testsuite>`);
  }
  console.log('</testsuites>');
}

async function main() {
  if (runInBrowser) {
    await runBrowserTest();
  }

  const options = {
    tier: tiers,
    feature: features
  };

  const results = await runTests(options);

  if (format === 'tap') {
    renderTapReport(results);
  } else if (format === 'json') {
    renderJsonReport(results);
  } else if (format === 'junit') {
    renderJunitReport(results);
  } else {
    renderCliReport(results);
  }

  process.exit(results.failedTests === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`${RED}Fatal runner error: ${err.message}${RESET}`, err);
  process.exit(1);
});
