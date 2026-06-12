# git-metrics

Analyze git repos for contributor metrics, bus factor, and code churn. Zero dependencies.

## Why

Ever wonder how fragile your project really is? `git-metrics` tells you:

- **Bus factor** — how many people can leave before your project is in trouble
- **Code churn** — which files are getting hammered with changes (usually a code smell)
- **Contributor stats** — who's doing the work, and how much
- **File ownership** — which files have single points of failure
- **Commit timeline** — weekly activity overview

All from your local git repo. No API keys, no external services, no dependencies.

## Install

```bash
npm install -g git-metrics
# or use directly
npx git-metrics .
```

## Usage

```bash
# Full analysis of current directory
git-metrics .

# JSON output
git-metrics . --json

# Only show bus factor
git-metrics . --bus-factor

# Top 20 most-changed files
git-metrics . --churn --top 20

# Analyze since a specific date
git-metrics . --since "2024-01-01"
```

## What It Shows

### Repo Summary
Total commits, files, lines, branches, tags, first/last commit dates.

### Contributors
Sorted by commit count. Shows commits, lines added, lines deleted per contributor.

### Bus Factor
The minimum number of contributors who account for >50% of commits. A bus factor of 1 means one person leaving could tank the project.

### Code Churn
Files changed most often in recent history. High churn usually means unstable code, frequent refactoring, or a file that does too much.

### File Ownership
Which files are "owned" by a single person vs. touched by many contributors. Files with low ownership % and many contributors are well-maintained; files with one owner are risk points.

### Commit Timeline
Weekly commit counts as a bar chart. Spot slow periods and bursts of activity.

## Programmatic API

```js
const { analyze } = require('git-metrics');

const result = analyze('./my-repo', {
  since: '2024-01-01',  // optional date filter
  top: 10,              // top N for churn/ownership
});

console.log(result.busFactor);     // { busFactor: 2, coverage: 67.3, critical: [...] }
console.log(result.contributors);  // [{ name, email, commits, added, deleted, files }]
console.log(result.churn);         // [{ file, changes }]
```

### Individual Functions

```js
const {
  getContributors,
  getBusFactor,
  getChurn,
  getCommitTimeline,
  getFileOwnership,
  getSummary,
} = require('git-metrics');
```

Each function takes `(repoPath, opts)` and returns its specific result.

## Options

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |
| `--since <date>` | Start date for analysis |
| `--top <n>` | Top N items (default: 10) |
| `--contributors` | Show contributors only |
| `--bus-factor` | Show bus factor only |
| `--churn` | Show code churn only |
| `--timeline` | Show commit timeline only |
| `--ownership` | Show file ownership only |
| `--summary` | Show repo summary only |

## License

MIT
