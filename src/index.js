'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * git-metrics — Analyze git repos for contributor metrics, bus factor, and code churn.
 * Zero dependencies.
 */

// ── Helpers ──────────────────────────────────────────────────────────

function runGit(args, repoPath) {
  try {
    return execFileSync('git', args, {
      cwd: repoPath,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

function isGitRepo(dir) {
  return fs.existsSync(path.join(dir, '.git'));
}

function parseLogLine(line) {
  // format: hash<|>author<|>email<|>timestamp<|>added<|>deleted<|>files
  const parts = line.split('<|>');
  if (parts.length < 7) return null;
  return {
    hash: parts[0],
    author: parts[1],
    email: parts[2],
    date: parts[3],
    added: parseInt(parts[4], 10) || 0,
    deleted: parseInt(parts[5], 10) || 0,
    files: parseInt(parts[6], 10) || 0,
  };
}

// ── Core Metrics ─────────────────────────────────────────────────────

/**
 * Get contributor stats from the repo.
 */
function getContributors(repoPath, opts = {}) {
  const since = opts.since || '';
  const until = opts.until || '';
  const args = ['log'];
  if (since) args.push(`--since=${since}`);
  if (until) args.push(`--until=${until}`);
  args.push('--format=%aN<|>%aE', '--shortstat');

  const raw = runGit(args, repoPath);
  if (!raw) return [];

  const blocks = raw.split(/\n(?=[^\s])/);
  const map = new Map();

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;
    const [name, email] = lines[0].split('<|>');
    const statLine = lines.slice(1).join(' ');

    let added = 0, deleted = 0, files = 0;
    const fileMatch = statLine.match(/(\d+) files? changed/);
    const addMatch = statLine.match(/(\d+) insertion/);
    const delMatch = statLine.match(/(\d+) deletion/);
    if (fileMatch) files = parseInt(fileMatch[1], 10);
    if (addMatch) added = parseInt(addMatch[1], 10);
    if (delMatch) deleted = parseInt(delMatch[1], 10);

    const key = `${name} <${email}>`;
    if (!map.has(key)) {
      map.set(key, { name, email, commits: 0, added: 0, deleted: 0, files: 0 });
    }
    const entry = map.get(key);
    entry.commits++;
    entry.added += added;
    entry.deleted += deleted;
    entry.files += files;
  }

  const contributors = [...map.values()];
  contributors.sort((a, b) => b.commits - a.commits);
  return contributors;
}

/**
 * Calculate bus factor — minimum number of contributors whose departure
 * would leave the project unable to maintain >50% of recent commits.
 */
function getBusFactor(contributors) {
  if (!contributors.length) return { busFactor: 0, coverage: 0, critical: [] };

  const totalCommits = contributors.reduce((s, c) => s + c.commits, 0);
  if (totalCommits === 0) return { busFactor: 0, coverage: 0, critical: [] };

  let running = 0;
  const critical = [];
  for (const c of contributors) {
    running += c.commits;
    critical.push(c);
    if (running / totalCommits > 0.5) break;
  }

  return {
    busFactor: critical.length,
    coverage: +(running / totalCommits * 100).toFixed(1),
    critical: critical.map(c => ({ name: c.name, commits: c.commits })),
  };
}

/**
 * Get code churn — files with highest lines changed recently.
 */
function getChurn(repoPath, opts = {}) {
  const since = opts.since || '3 months ago';
  const top = opts.top || 10;

  const raw = runGit(
    ['log', `--since=${since}`, '--format=', '--name-only'],
    repoPath
  );
  if (!raw) return [];

  const churn = new Map();
  const lines = raw.split('\n').filter(Boolean);
  for (const file of lines) {
    churn.set(file, (churn.get(file) || 0) + 1);
  }

  const sorted = [...churn.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([file, changes]) => ({ file, changes }));

  return sorted;
}

/**
 * Get commit activity over time (weekly buckets).
 */
function getCommitTimeline(repoPath, opts = {}) {
  const since = opts.since || '6 months ago';
  const raw = runGit(
    ['log', `--since=${since}`, '--format=%aI', '--date=iso'],
    repoPath
  );
  if (!raw) return [];

  const weeks = new Map();
  for (const line of raw.split('\n').filter(Boolean)) {
    const d = new Date(line);
    if (isNaN(d)) continue;
    // Get ISO week
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    weeks.set(key, (weeks.get(key) || 0) + 1);
  }

  return [...weeks.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, count]) => ({ week, commits: count }));
}

/**
 * Get file ownership — who "owns" each file based on line contribution.
 */
function getFileOwnership(repoPath, opts = {}) {
  const top = opts.top || 10;
  const raw = runGit(['log', '--format=%aN', '--name-only'], repoPath);
  if (!raw) return [];

  const files = new Map();
  let currentAuthor = '';

  for (const line of raw.split('\n')) {
    if (!line) continue;
    // Lines with | are author names, others are filenames
    if (!line.includes('.') && !line.includes('/')) {
      currentAuthor = line;
      continue;
    }
    if (!files.has(line)) files.set(line, new Map());
    const owners = files.get(line);
    owners.set(currentAuthor, (owners.get(currentAuthor) || 0) + 1);
  }

  const result = [...files.entries()]
    .map(([file, authors]) => {
      const sorted = [...authors.entries()].sort((a, b) => b[1] - a[1]);
      const total = sorted.reduce((s, [, c]) => s + c, 0);
      return {
        file,
        owner: sorted[0]?.[0] || 'unknown',
        ownerPct: total ? +((sorted[0]?.[1] / total) * 100).toFixed(1) : 0,
        contributors: sorted.length,
      };
    })
    .sort((a, b) => b.contributors - a.contributors)
    .slice(0, top);

  return result;
}

/**
 * Get repo summary stats.
 */
function getSummary(repoPath, opts = {}) {
  const totalCommits = runGit(['rev-list', '--count', 'HEAD'], repoPath);
  const firstCommit = runGit(['log', '--reverse', '--format=%aI', '--max-count=1'], repoPath);
  const lastCommit = runGit(['log', '--format=%aI', '--max-count=1'], repoPath);
  const branches = runGit(['branch', '-a'], repoPath);
  const branchCount = branches ? branches.split('\n').length : 0;
  const tags = runGit(['tag'], repoPath);
  const tagCount = tags ? tags.split('\n').filter(Boolean).length : 0;
  const tracked = runGit(['ls-files'], repoPath);
  const trackedFiles = tracked ? tracked.split('\n').filter(Boolean).length : 0;
  let lineCount = 0;
  if (tracked) {
    const fileList = tracked.split('\n').filter(Boolean);
    for (const file of fileList) {
      try {
        const fullPath = path.join(repoPath, file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        lineCount += content.split('\n').length;
      } catch {}
    }
  }

  return {
    totalCommits: parseInt(totalCommits, 10) || 0,
    firstCommit,
    lastCommit,
    branches: branchCount,
    tags: tagCount,
    trackedFiles,
    totalLines: lineCount,
  };
}

/**
 * Run full analysis on a repo.
 */
function analyze(repoPath, opts = {}) {
  repoPath = path.resolve(repoPath);
  if (!isGitRepo(repoPath)) {
    throw new Error(`Not a git repository: ${repoPath}`);
  }

  const contributors = getContributors(repoPath, opts);
  const busFactor = getBusFactor(contributors);
  const churn = getChurn(repoPath, opts);
  const timeline = getCommitTimeline(repoPath, opts);
  const ownership = getFileOwnership(repoPath, opts);
  const summary = getSummary(repoPath, opts);

  return { summary, contributors, busFactor, churn, timeline, ownership };
}

module.exports = {
  analyze,
  getContributors,
  getBusFactor,
  getChurn,
  getCommitTimeline,
  getFileOwnership,
  getSummary,
  isGitRepo,
};
