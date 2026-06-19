# git-metrics

Bus factor, code churn, and contributor analytics — straight from your git repo. Zero dependencies, zero API keys.

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

## Quick Start

```bash
git-metrics .                    # full analysis
git-metrics . --json             # JSON output for scripts
git-metrics . --bus-factor       # just the risk assessment
```

## Real-World Examples

### 1. Pre-Release Risk Assessment

Before cutting a release, check your team's bus factor and identify single-owner files:

```bash
$ git-metrics . --bus-factor --ownership --top 10

  Bus Factor
  ─────────────────────────────────
  Bus factor: 2
  Coverage:   78.3% of commits by 2 contributor(s)
  Critical contributors:
    - Alice (847 commits)
    - Bob (312 commits)

  File Ownership (most contested files)
  ─────────────────────────────────
  src/auth/token.js     Alice                      95%   1   ← single point of failure
  src/api/handler.js    Alice                      72%   3
  src/db/schema.js      Bob                         88%   2   ← single point of failure
```

If `src/auth/token.js` only has one contributor at 95% ownership, that's your risk surface — get someone else familiar with it before release.

### 2. Sprint Retrospective Data

Generate a code churn report for the sprint window to find unstable areas:

```bash
# Analyze last 2 weeks of sprint
git-metrics . --churn --since "2 weeks ago" --top 15 --json | \
  jq '.churn[:5]'

[
  { "file": "src/checkout/payment.js", "changes": 23 },
  { "file": "src/cart/totals.js", "changes": 18 },
  { "file": "src/api/refunds.js", "changes": 15 }
]
```

`payment.js` touched 23 times in 2 weeks? Either it's the focal point of the sprint or it's unstable and needs refactoring.

### 3. Onboarding/New-Hire Audit

When a new developer joins, check which areas of the codebase have the most knowledge concentration:

```bash
# Full report for onboarding planning
git-metrics ~/projects/legacy-api --since "6 months ago" > onboarding-audit.txt

# Find files only one person has ever touched
git-metrics ~/projects/legacy-api --ownership --json | \
  jq '.ownership[] | select(.contributors == 1) | .file'
```

Files with `contributors: 1` are your "tribal knowledge" zones — document them or pair-program on them during onboarding.

## Comparison

| Tool | Bus Factor | Code Churn | File Ownership | Zero Deps | Offline |
|------|:---------:|:---------:|:--------------:|:---------:|:-------:|
| **git-metrics** | ✅ | ✅ | ✅ | ✅ | ✅ |
| `git log --stat` | ❌ | partial | ❌ | ✅ | ✅ |
| `git-fame` | ❌ | ❌ | ❌ | ❌ | ✅ |
| GitHub Insights | ✅ | ✅ | partial | — | ❌ |
| GitLab Value Stream | ❌ | ✅ | ❌ | — | ❌ |

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
| `--version, -V` | Show version |
| `-h, --help` | Show help |

## License

MIT
