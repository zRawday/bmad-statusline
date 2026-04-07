---
title: 'Deferred Fixes — Reader & Hook Hardening'
type: 'bugfix'
created: '2026-04-04'
status: 'done'
baseline_commit: '02e9fa8'
context: []
---

<frozen-after-approval>

## Intent

**Problem:** Accumulated tech debt from code reviews across Epics 6-7: standalone reader ignores custom colors, health extractor uses inline ANSI instead of COLOR_CODES, hook has several edge cases (hookPath injection risk, _outputFolders gated too aggressively, is_new unreliable after history cap, `||` vs `??` coalescing, no bash command truncation, walk-up depth unbounded, step enrichment fails on Edit partials, Windows path casing edge).

**Approach:** Fix each item in-place following existing patterns. All reader changes in `bmad-sl-reader.js`, all hook changes in `bmad-hook.js`, hookPath escaping in `defaults.js`. Each fix is isolated and independently testable.

## Boundaries & Constraints

**Always:** Respect Pattern 1 (reader=silent, hook=silent). Maintain backward compat — no status file schema changes. Keep hook synchronous (Pattern 2).

**Ask First:** If a fix requires changing the status file contract or hook dispatch structure.

**Never:** Add new dependencies. Never break existing reader `line N` output for unchanged configs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Standalone custom colors | `node reader project sid` with projectColors in config | Output uses custom color | Falls back to default hash color if config unreadable |
| Health ANSI | Fresh session (< 30s) | Green dot via `COLOR_CODES.green` | N/A |
| hookPath with quotes | path containing `'` or `` ` `` | Properly escaped in hook config | N/A |
| _outputFolders resumed session | Session with project already set | _outputFolders computed on next event | N/A |
| is_new after cap | File read before cap, write after | `is_new: false` (best-effort, not guaranteed) | N/A |
| old_string empty | Edit with `old_string: ""` | Stored as `""` not `null` | N/A |
| Large bash command | 5000+ char command | Truncated to 1000 chars in history | N/A |
| Walk-up depth | 30+ levels deep | Stops after 20 iterations | Silent exit |

</frozen-after-approval>

## Code Map

- `src/reader/bmad-sl-reader.js:370-378` — Health extractor with inline ANSI codes
- `src/reader/bmad-sl-reader.js:421-423` — Standalone command dispatch (no lineConfig)
- `src/reader/bmad-sl-reader.js:243-258` — `readLineConfig()` for config reading pattern
- `src/defaults.js:20-42` — `getHookConfig()` with template literal hookPath
- `src/hook/bmad-hook.js:51-59` — Walk-up `_bmad/` loop (no depth limit)
- `src/hook/bmad-hook.js:65-94` — `_outputFolders` gated by `!earlyStatus.project`
- `src/hook/bmad-hook.js:366-370` — `is_new` computation from `reads[]`
- `src/hook/bmad-hook.js:458` — `old_string || null` (should be `?? null`)
- `src/hook/bmad-hook.js:505-522` — Bash command stored without truncation
- `src/hook/bmad-hook.js:563-579` — Step enrichment frontmatter regex
- `src/hook/bmad-hook.js:178,348,439` — `inProject` path comparison

## Tasks & Acceptance

**Execution:**
- [x] `src/reader/bmad-sl-reader.js` — (1) Health extractor: replace inline `\x1b[32m`/`\x1b[33m`/`\x1b[90m` with `COLOR_CODES.green`/`COLOR_CODES.yellow`/`COLOR_CODES.brightBlack`. (2) Standalone path: read config.json and pass lineConfig-like object with `skillColors`/`projectColors` to extractors that accept it.
- [x] `src/defaults.js` — Escape `hookPath` for shell safety: replace double-quote wrapping with proper escaping (e.g., replace `'` with `'\''` before wrapping, or use JSON.stringify).
- [x] `src/hook/bmad-hook.js` — (1) Walk-up: add `maxDepth = 20` counter, exit if exceeded. (2) _outputFolders: compute when missing regardless of `project` presence — check `!earlyStatus._outputFolders` instead of `!earlyStatus.project`. (3) is_new: add comment documenting the known limitation after history cap. (4) Line 458: change `|| null` to `?? null` for both `old_string` and `new_string`. (5) Bash: truncate `command` to 1000 chars before push. (6) Step enrichment: guard with `hook_event_name !== 'Edit'` or document limitation. (7) Windows paths: normalize drive letter casing in `normPath` construction.
- [x] `test/reader.test.js` — Add test for health extractor using COLOR_CODES (no raw escapes in output).
- [x] `test/hook.test.js` — Add tests for walk-up depth limit and bash truncation.

**Acceptance Criteria:**
- Given health extractor output, when inspected, then ANSI codes match COLOR_CODES constants (no inline hex escapes).
- Given `node reader project sid` with custom projectColors, when rendered, then custom color is applied.
- Given a hookPath with special characters, when config is generated, then the shell command is safe.
- Given a walk-up traversal > 20 levels, when hook runs, then it exits silently.
- Given an Edit with `old_string: ""`, when stored, then value is `""` not `null`.
- Given a 5000-char bash command, when stored, then it is truncated to 1000 chars.

## Spec Change Log

## Verification

**Commands:**
- `node --test test/reader.test.js` — expected: all pass
- `node --test test/hook.test.js` — expected: all pass including new edge case tests

## Suggested Review Order

**Reader hardening**

- Health extractor: inline ANSI codes replaced with COLOR_CODES constants
  [`bmad-sl-reader.js:381`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L381)

- Standalone command path now reads config for custom colors
  [`bmad-sl-reader.js:431`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L431)

**Hook edge cases**

- Walk-up _bmad/ search bounded to 20 levels
  [`bmad-hook.js:59`](../../bmad-statusline/src/hook/bmad-hook.js#L59)

- _outputFolders computed independently of project presence via earlyDirty flag
  [`bmad-hook.js:74`](../../bmad-statusline/src/hook/bmad-hook.js#L74)

- `??` coalescing preserves empty strings for Edit old/new_string
  [`bmad-hook.js:474`](../../bmad-statusline/src/hook/bmad-hook.js#L474)

- Bash command truncated to 1000 chars before history push
  [`bmad-hook.js:530`](../../bmad-statusline/src/hook/bmad-hook.js#L530)

- Edit step enrichment skipped (partial content unreliable)
  [`bmad-hook.js:488`](../../bmad-statusline/src/hook/bmad-hook.js#L488)

- Windows drive letter normalization in normalize()
  [`bmad-hook.js:23`](../../bmad-statusline/src/hook/bmad-hook.js#L23)

**Shell safety**

- hookPath escaped via JSON.stringify for safe shell embedding
  [`defaults.js:21`](../../bmad-statusline/src/defaults.js#L21)

**Tests**

- Health extractor source-level assertion (no inline ANSI hex)
  [`reader.test.js:515`](../../bmad-statusline/test/reader.test.js#L515)

- Walk-up depth limit, bash truncation, Edit coalescing
  [`hook.test.js:1917`](../../bmad-statusline/test/hook.test.js#L1917)
