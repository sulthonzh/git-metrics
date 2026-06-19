#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const { analyze } = require('./index');

const args = process.argv.slice(2);
const repoPath = args[0] || '.';

let format = 'text';
let since = '';
let top = 10;
const sections = new Set();

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--json') format = 'json';
  if (args[i] === '--since' && args[i + 1]) { since = args[++i]; }
  if (args[i] === '--top' && args[i + 1]) { top = parseInt(args[++i], 10); }
  if (args[i] === '--contributors') sections.add('contributors');
  if (args[i] === '--bus-factor') sections.add('busFactor');
  if (args[i] === '--churn') sections.add('churn');
  if (args[i] === '--timeline') sections.add('timeline');
  if (args[i] === '--ownership') sections.add('ownership');
  if (args[i] === '--summary') sections.add('summary');
  if (args[i] === '--version' || args[i] === '-V') {
    const pkg = require('../package.json');
    console.log(pkg.version);
    process.exit(0);
  }
  if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
git-metrics — Analyze git repos for contributor metrics, bus factor, and code churn.

Usage:
  git-metrics [path] [options]

Options:
  --json             Output as JSON
  --since <date>     Start date for analysis (e.g. "2024-01-01", "6 months ago")
  --top <n>          Top N items for churn/ownership (default: 10)
  --contributors     Show contributor stats only
  --bus-factor       Show bus factor analysis only
  --churn            Show code churn (most changed files) only
  --timeline         Show commit timeline only
  --ownership        Show file ownership only
  --summary          Show repo summary only
  -h, --help         Show this help

Examples:
  git-metrics .                      Full analysis of current repo
  git-metrics ./my-project --json    JSON output
  git-metrics . --since "2024-01-01" Analyze from specific date
  git-metrics . --churn --top 20     Top 20 most-churned files
`);
    process.exit(0);
  }
}

try {
  const opts = { since, top };
  const result = analyze(repoPath, opts);

  if (format === 'json') {
    const out = sections.size
      ? Object.fromEntries([...sections].map(s => [s, result[s]]))
      : result;
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  }

  const show = sections.size === 0 ? new Set(['summary', 'contributors', 'busFactor', 'churn']) : sections;

  if (show.has('summary')) {
    const s = result.summary;
    console.log('\n  Repo Summary');
    console.log('  ─────────────────────────────────');
    console.log(`  Commits:      ${s.totalCommits}`);
    console.log(`  Files:        ${s.trackedFiles}`);
    console.log(`  Lines:        ${s.totalLines.toLocaleString()}`);
    console.log(`  Branches:     ${s.branches}`);
    console.log(`  Tags:         ${s.tags}`);
    console.log(`  First commit: ${s.firstCommit || 'unknown'}`);
    console.log(`  Last commit:  ${s.lastCommit || 'unknown'}`);
  }

  if (show.has('contributors') && result.contributors.length) {
    console.log('\n  Contributors');
    console.log('  ─────────────────────────────────');
    const maxName = Math.max(...result.contributors.map(c => c.name.length), 10);
    console.log(`  ${'Name'.padEnd(maxName)}  Commits   Added   Deleted`);
    for (const c of result.contributors.slice(0, top)) {
      console.log(
        `  ${c.name.padEnd(maxName)}  ${String(c.commits).padStart(7)}  ${String(c.added).padStart(6)}  ${String(c.deleted).padStart(8)}`
      );
    }
    console.log(`  Total: ${result.contributors.length} contributors`);
  }

  if (show.has('busFactor')) {
    const bf = result.busFactor;
    console.log('\n  Bus Factor');
    console.log('  ─────────────────────────────────');
    console.log(`  Bus factor: ${bf.busFactor}`);
    console.log(`  Coverage:   ${bf.coverage}% of commits by ${bf.busFactor} contributor(s)`);
    if (bf.critical.length) {
      console.log('  Critical contributors:');
      for (const c of bf.critical) {
        console.log(`    - ${c.name} (${c.commits} commits)`);
      }
    }
  }

  if (show.has('churn') && result.churn.length) {
    console.log('\n  Code Churn (most changed files)');
    console.log('  ─────────────────────────────────');
    const maxFile = Math.max(...result.churn.map(c => c.file.length), 10);
    console.log(`  ${'File'.padEnd(maxFile)}  Changes`);
    for (const c of result.churn) {
      const bar = '█'.repeat(Math.min(Math.ceil(c.changes / 2), 40));
      console.log(`  ${c.file.padEnd(maxFile)}  ${String(c.changes).padStart(3)} ${bar}`);
    }
  }

  if (show.has('timeline') && result.timeline.length) {
    console.log('\n  Commit Timeline (weekly)');
    console.log('  ─────────────────────────────────');
    const maxCommits = Math.max(...result.timeline.map(t => t.commits));
    for (const t of result.timeline) {
      const bar = '█'.repeat(Math.ceil((t.commits / maxCommits) * 30));
      console.log(`  ${t.week}  ${String(t.commits).padStart(3)} ${bar}`);
    }
  }

  if (show.has('ownership') && result.ownership.length) {
    console.log('\n  File Ownership (most contested files)');
    console.log('  ─────────────────────────────────');
    const maxFile = Math.max(...result.ownership.map(o => o.file.length), 10);
    console.log(`  ${'File'.padEnd(maxFile)}  Owner                    Own%   Contrib`);
    for (const o of result.ownership) {
      console.log(
        `  ${o.file.padEnd(maxFile)}  ${o.owner.padEnd(24)}  ${String(o.ownerPct).padStart(3)}%   ${o.contributors}`
      );
    }
  }

  console.log('');
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
