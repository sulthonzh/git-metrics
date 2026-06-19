# Changelog

## v1.1.0 — 2026-06-19

### Security
- **CRITICAL: Fixed command injection vulnerability.** All `execSync` calls with string interpolation replaced by `execFileSync` with array arguments. Crafted `--since` values like `foo; rm -rf /` could have executed arbitrary shell commands.

### Fixed
- `getSummary` no longer shells out to `wc -l` and `xargs` (platform-dependent, fragile on Windows). Branch/tag/file counts now parsed in JS.
- Line counting in `getSummary` now reads files directly instead of piping through `xargs wc -l`.

### Added
- `--version` / `-V` flag to CLI
- `exports` field in package.json
- `prepublishOnly` script
- 19 new tests (49 → 68): version flag, short version flag, execFileSync verification, empty busFactor, single-contributor dominance, churn top:1, no-tag summary, analyze sections completeness

## v1.0.0 — 2026-06-13

### Initial Release
- Contributor stats (commits, added, deleted, files per author)
- Bus factor calculation (>50% commit coverage)
- Code churn analysis (most frequently changed files)
- Commit timeline (weekly buckets)
- File ownership (line contribution per author)
- Repo summary (commits, files, lines, branches, tags)
- CLI with `--json`, `--since`, `--top`, section filters
- Zero dependencies
