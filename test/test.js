#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const {
  analyze,
  getContributors,
  getBusFactor,
  getChurn,
  getCommitTimeline,
  getFileOwnership,
  getSummary,
  isGitRepo,
} = require('../src/index');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

function createTestRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-metrics-test-'));
  execSync('git init', { cwd: dir });
  execSync('git config user.email "test@test.com"', { cwd: dir });
  execSync('git config user.name "Test User"', { cwd: dir });

  // Create some commits
  for (let i = 0; i < 5; i++) {
    fs.writeFileSync(path.join(dir, `file${i}.txt`), `content ${i}\n`);
    execSync(`git add file${i}.txt && git commit -m "commit ${i}"`, { cwd: dir });
  }

  // Add more changes to file0 for churn
  for (let i = 0; i < 3; i++) {
    fs.appendFileSync(path.join(dir, 'file0.txt'), `more content ${i}\n`);
    execSync('git add file0.txt && git commit -m "update file0"', { cwd: dir });
  }

  return dir;
}

function createMultiContributorRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-metrics-multi-'));
  execSync('git init', { cwd: dir });

  // Alice commits
  execSync('git config user.email "alice@test.com"', { cwd: dir });
  execSync('git config user.name "Alice"', { cwd: dir });
  fs.writeFileSync(path.join(dir, 'a.txt'), 'alice file\n');
  execSync('git add a.txt && git commit -m "alice 1"', { cwd: dir });
  fs.writeFileSync(path.join(dir, 'b.txt'), 'alice file 2\n');
  execSync('git add b.txt && git commit -m "alice 2"', { cwd: dir });

  // Bob commits
  execSync('git config user.email "bob@test.com"', { cwd: dir });
  execSync('git config user.name "Bob"', { cwd: dir });
  fs.writeFileSync(path.join(dir, 'c.txt'), 'bob file\n');
  execSync('git add c.txt && git commit -m "bob 1"', { cwd: dir });

  // Charlie commits
  execSync('git config user.email "charlie@test.com"', { cwd: dir });
  execSync('git config user.name "Charlie"', { cwd: dir });
  fs.writeFileSync(path.join(dir, 'd.txt'), 'charlie file\n');
  execSync('git add d.txt && git commit -m "charlie 1"', { cwd: dir });

  return dir;
}

// ── Tests ──────────────────────────────────────────────────────────

console.log('git-metrics test suite\n');

// isGitRepo
console.log('isGitRepo');
const testRepo = createTestRepo();
assert(isGitRepo(testRepo), 'should detect git repo');
assert(!isGitRepo(os.tmpdir()), 'should reject non-git dir');

// getSummary
console.log('getSummary');
const summary = getSummary(testRepo);
assert(summary.totalCommits === 8, `totalCommits should be 8, got ${summary.totalCommits}`);
assert(summary.trackedFiles >= 5, `trackedFiles should be >= 5, got ${summary.trackedFiles}`);
assert(summary.totalLines > 0, 'totalLines should be > 0');
assert(summary.firstCommit !== null, 'should have firstCommit');
assert(summary.lastCommit !== null, 'should have lastCommit');

// getContributors
console.log('getContributors');
const contribs = getContributors(testRepo);
assert(contribs.length === 1, `should have 1 contributor, got ${contribs.length}`);
assert(contribs[0].name === 'Test User', `first contributor should be Test User`);
assert(contribs[0].commits === 8, `should have 8 commits, got ${contribs[0].commits}`);
assert(contribs[0].added > 0, 'should have added lines');
assert(contribs[0].files > 0, 'should have changed files');

// Multi-contributor
console.log('multi-contributor');
const multiRepo = createMultiContributorRepo();
const multiContribs = getContributors(multiRepo);
assert(multiContribs.length === 3, `should have 3 contributors, got ${multiContribs.length}`);
assert(multiContribs[0].commits >= multiContribs[1].commits, 'should be sorted by commits desc');

// getBusFactor
console.log('getBusFactor');
const bus1 = getBusFactor(contribs);
assert(bus1.busFactor === 1, `single contributor busFactor should be 1, got ${bus1.busFactor}`);
assert(bus1.coverage === 100, `single contributor coverage should be 100, got ${bus1.coverage}`);

const bus3 = getBusFactor(multiContribs);
assert(bus3.busFactor >= 1, `multi contributor busFactor should be >= 1`);
assert(bus3.busFactor <= 2, `3 contributors with 2+1+1 commits, busFactor should be <= 2`);
assert(bus3.critical.length > 0, 'should have critical contributors');

const busEmpty = getBusFactor([]);
assert(busEmpty.busFactor === 0, 'empty busFactor should be 0');

// getChurn
console.log('getChurn');
const churn = getChurn(testRepo, { top: 5 });
assert(Array.isArray(churn), 'churn should be array');
assert(churn.length > 0, 'should have churn data');
// file0 should be the most churned (modified 4 times total: initial + 3 updates)
assert(churn[0].file === 'file0.txt', `most churned should be file0.txt, got ${churn[0].file}`);
assert(churn[0].changes >= 4, `file0 changes should be >= 4, got ${churn[0].changes}`);

const churnLimited = getChurn(testRepo, { top: 2 });
assert(churnLimited.length <= 2, 'should respect top limit');

// getCommitTimeline
console.log('getCommitTimeline');
const timeline = getCommitTimeline(testRepo);
assert(Array.isArray(timeline), 'timeline should be array');
assert(timeline.length > 0, 'should have timeline data');
assert(timeline[0].week.includes('W'), 'week format should contain W');
assert(timeline[0].commits > 0, 'should have commits in weeks');

// getFileOwnership
console.log('getFileOwnership');
const ownership = getFileOwnership(testRepo, { top: 5 });
assert(Array.isArray(ownership), 'ownership should be array');
assert(ownership.length > 0, 'should have ownership data');
assert(ownership[0].owner === 'Test User', 'owner should be Test User');
assert(ownership[0].ownerPct > 0, 'ownerPct should be > 0');
assert(ownership[0].contributors >= 1, 'should have at least 1 contributor per file');

// analyze (full)
console.log('analyze');
const full = analyze(testRepo);
assert(full.summary, 'should have summary');
assert(full.contributors, 'should have contributors');
assert(full.busFactor, 'should have busFactor');
assert(full.churn, 'should have churn');
assert(full.timeline, 'should have timeline');
assert(full.ownership, 'should have ownership');

// analyze with invalid path
console.log('analyze error');
let threw = false;
try { analyze('/nonexistent/path'); } catch (e) { threw = true; }
assert(threw, 'should throw on non-git path');

// CLI test
console.log('CLI');
try {
  const output = execSync(`node ${path.join(__dirname, '..', 'src', 'cli.js')} ${testRepo}`, { encoding: 'utf-8' });
  assert(output.includes('Repo Summary'), 'CLI should show Repo Summary');
  assert(output.includes('Contributors'), 'CLI should show Contributors');
  assert(output.includes('Bus Factor'), 'CLI should show Bus Factor');
  assert(output.includes('Code Churn'), 'CLI should show Code Churn');
} catch (e) {
  assert(false, `CLI failed: ${e.message}`);
}

// CLI JSON mode
try {
  const output = execSync(`node ${path.join(__dirname, '..', 'src', 'cli.js')} ${testRepo} --json`, { encoding: 'utf-8' });
  const parsed = JSON.parse(output);
  assert(parsed.summary, 'JSON output should have summary');
  assert(parsed.contributors, 'JSON output should have contributors');
} catch (e) {
  assert(false, `CLI JSON failed: ${e.message}`);
}

// CLI single section
try {
  const output = execSync(`node ${path.join(__dirname, '..', 'src', 'cli.js')} ${testRepo} --churn --top 3`, { encoding: 'utf-8' });
  assert(output.includes('Code Churn'), 'CLI --churn should show churn section');
  assert(!output.includes('Repo Summary'), 'CLI --churn should not show summary');
} catch (e) {
  assert(false, `CLI --churn failed: ${e.message}`);
}

// ── Security tests ─────────────────────────────────────────────

console.log('security: version flag');
try {
  const output = execSync(`node ${path.join(__dirname, '..', 'src', 'cli.js')} --version`, { encoding: 'utf-8' }).trim();
  assert(output === '1.1.0', `version should be 1.1.0, got ${output}`);
} catch (e) {
  assert(false, `--version failed: ${e.message}`);
}

console.log('security: -V short flag');
try {
  const output = execSync(`node ${path.join(__dirname, '..', 'src', 'cli.js')} -V`, { encoding: 'utf-8' }).trim();
  assert(output === '1.1.0', `-V should output 1.1.0, got ${output}`);
} catch (e) {
  assert(false, `-V failed: ${e.message}`);
}

console.log('security: no shell injection surface');
// Verify that runGit uses execFileSync (array args, no shell) by checking source code
const srcContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf-8');
assert(srcContent.includes('execFileSync'), 'source should use execFileSync (not execSync)');
assert(!srcContent.includes('execSync('), 'source should not call execSync');
assert(srcContent.includes("{ execFileSync }"), 'should destructure execFileSync');

// ── Edge case tests ────────────────────────────────────────────

console.log('edge: empty contributors busFactor');
const busEmpty2 = getBusFactor([]);
assert(busEmpty2.busFactor === 0, 'empty busFactor should be 0');
assert(busEmpty2.coverage === 0, 'empty coverage should be 0');
assert(busEmpty2.critical.length === 0, 'empty critical should be empty array');

console.log('edge: single contributor dominance');
const singleContrib = [{ name: 'Solo', email: 'solo@test.com', commits: 100, added: 1000, deleted: 500, files: 50 }];
const busSingle = getBusFactor(singleContrib);
assert(busSingle.busFactor === 1, 'single contributor busFactor should be 1');
assert(busSingle.coverage === 100, 'single contributor coverage should be 100');

console.log('edge: churn top 1');
const churn1 = getChurn(testRepo, { top: 1 });
assert(churn1.length === 1, 'churn top:1 should return exactly 1 item');
assert(churn1[0].file === 'file0.txt', 'top churned file should be file0.txt');

console.log('edge: summary with no tags');
const noTagSummary = getSummary(testRepo);
// testRepo has no tags created
assert(noTagSummary.tags === 0, 'testRepo should have 0 tags');

console.log('edge: analyze sections completeness');
const fullAnalyze = analyze(testRepo);
const expectedKeys = ['summary', 'contributors', 'busFactor', 'churn', 'timeline', 'ownership'];
for (const key of expectedKeys) {
  assert(fullAnalyze.hasOwnProperty(key), `analyze result should have key: ${key}`);
}

// Cleanup
try {
  fs.rmSync(testRepo, { recursive: true, force: true });
  fs.rmSync(multiRepo, { recursive: true, force: true });
} catch {}

// ── Results ────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`${'─'.repeat(40)}`);

process.exit(failed > 0 ? 1 : 0);
