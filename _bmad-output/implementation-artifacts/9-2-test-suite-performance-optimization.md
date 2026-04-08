# Story 9.2: Test Suite Performance Optimization — React.act(), Concurrency & Spawn Reduction

Status: ready-for-dev

## Story

As a developer working on bmad-statusline,
I want the full test suite to complete in under 5 seconds,
so that the feedback loop stays fast and tests remain useful as a pre-commit safety net.

## Context

The test suite currently takes 25-40 seconds on Windows for a small app (9.5k lines of test code, 23 files). Root cause analysis identified three compounding issues:

1. **207 `await delay(50-2000)` calls** across 10 TUI test files — ~13s of pure sleep
2. **Sequential file execution** — `node --test` runs all 23 files one after another
3. **20 `execSync` process spawns** in hook/reader/cli tests — ~1-3s of process creation overhead on Windows

## Acceptance Criteria

### AC1: Replace `delay()` with `React.act()` in TUI Tests

**Given** any TUI test file that uses `await delay(ms)` after `stdin.write()` or `render()`
**When** the developer migrates to `React.act()`
**Then** the delay call is replaced with `await act(async () => { stdin.write(...); })`
**And** assertions on `lastFrame()` work immediately after `act()` returns (no sleep)
**And** the `delay()` helper function is removed from each migrated file
**And** all existing test assertions continue to pass with identical semantics

### AC2: Handle the 2000ms Poll Wait in tui-monitor.test.js

**Given** `tui-monitor.test.js:1054` uses `await delay(2000)` to wait for a polling interval
**When** the developer addresses this specific case
**Then** either the polling interval is made injectable (prop or env var, e.g. 10ms in test) or `node:timers/promises` mock is used to advance time
**And** the test no longer waits 2 seconds of real wall-clock time
**And** the test still validates that poll-based data refresh works correctly

### AC3: Enable Test File Concurrency

**Given** `package.json` scripts section
**When** the test script is updated
**Then** it reads: `"test": "node --test --test-concurrency=4 test/*.test.js"`
**And** all 23 test files pass when run concurrently (no shared mutable state between files)
**And** if any file uses shared temp directories or ports, they are made unique per-file

### AC4: Reduce execSync Spawns Where Possible

**Given** `reader.test.js` (12 spawns), `hook.test.js` (6 spawns), `cli.test.js` (2 spawns)
**When** the developer evaluates each spawn
**Then** tests that only validate internal logic (not CLI entry point behavior) are refactored to direct module imports
**And** true integration tests that validate the CLI entry point (cli.test.js) keep their spawns
**And** a minimum of 10 spawns are eliminated across the three files

### AC5: All Existing Tests Pass

**Given** the full test suite after all optimizations
**When** `npm test` is run
**Then** all tests pass (zero regressions)
**And** total wall-clock time is under 10 seconds on a standard dev machine (stretch goal: under 5s)

## Tasks / Subtasks

- [ ] Task 1: Enable concurrency in package.json (AC: 3)
  - [ ] Change test script to add `--test-concurrency=4`
  - [ ] Run full suite, identify any concurrency conflicts (shared temp dirs, etc.)
  - [ ] Fix any shared-state issues between files

- [ ] Task 2: Migrate TUI tests from `delay()` to `React.act()` (AC: 1)
  - [ ] Create a proof-of-concept in `tui-components.test.js` (smallest file, 7 delays)
  - [ ] Validate the `act()` pattern works with ink-testing-library v4 + React 19
  - [ ] Apply pattern to remaining 9 TUI test files:
    - `tui-edit-line.test.js` (21 delays)
    - `tui-select-preview.test.js` (15 delays)
    - `tui-reorder-lines.test.js` (16 delays)
    - `tui-separator.test.js` (19 delays)
    - `tui-preset.test.js` (26 delays)
    - `tui-widget-order.test.js` (26 delays)
    - `tui-monitor.test.js` (27 delays)
    - `tui-monitor-detail.test.js` (29 delays)
    - `tui-app.test.js` (21 delays)
  - [ ] Remove `delay()` helper and `CI_FACTOR` from all migrated files

- [ ] Task 3: Fix the 2000ms poll wait (AC: 2)
  - [ ] In MonitorScreen or its polling hook, make poll interval injectable (prop or constant importable from test)
  - [ ] In `tui-monitor.test.js:1054`, pass a short interval (e.g. 10ms) and use a small `act()`-wrapped wait
  - [ ] Validate the poll-triggered data refresh still works

- [ ] Task 4: Reduce execSync spawns (AC: 4)
  - [ ] Audit `reader.test.js` — identify which of 12 spawns test internal logic vs CLI entry point
  - [ ] Refactor internal-logic tests to import reader module directly (CJS `require()` — reader is CommonJS)
  - [ ] Audit `hook.test.js` — identify which of 6 spawns test internal logic vs stdin/process behavior
  - [ ] Refactor where possible (hook tests may need spawns for stdin piping — assess case by case)
  - [ ] Keep cli.test.js spawns (2) — these are genuine CLI integration tests

- [ ] Task 5: Final validation (AC: 5)
  - [ ] Run `npm test` — all tests pass
  - [ ] Measure total wall-clock time
  - [ ] Run 3 times to confirm consistency

## Dev Notes

### React.act() Pattern

`React.act()` is available in React 19 (installed: v19.2.4). It synchronously flushes all state updates, effects, and re-renders.

```js
import { act } from 'react';

// BEFORE:
stdin.write('\r');
await delay(50);
assert.ok(lastFrame().includes('Confirm'));

// AFTER:
await act(async () => { stdin.write('\r'); });
assert.ok(lastFrame().includes('Confirm'));
```

For render initialization (delay before first interaction):
```js
// BEFORE:
const { stdin, lastFrame } = render(e(Component, props));
await delay(50);
stdin.write('j');

// AFTER:
let result;
await act(async () => { result = render(e(Component, props)); });
await act(async () => { result.stdin.write('j'); });
```

### Critical Constraints

- **Pattern 1 — Error Handling Triad:** TUI tests use `ink-testing-library` render — never `console.log` in components under test
- **Pattern 2 — Synchronous File I/O:** Test files that write fixtures must use `writeFileSync` — no async fs
- **Module systems:** Reader is CommonJS (`require()`), TUI is ESM (`import`). When importing reader directly in tests, use `createRequire` from `node:module` since test files are ESM
- **No new dependencies:** Zero runtime deps policy. `React.act()` is already in React 19 — no package to add
- **ink-testing-library v4:** The `render()` function returns `{ lastFrame, stdin, unmount }`. `act()` wraps stdin writes, not render itself if render is synchronous

### Source Tree — Files to Modify

```
package.json                          # test script concurrency
test/tui-components.test.js           # 7 delays → act()
test/tui-edit-line.test.js            # 21 delays → act()
test/tui-select-preview.test.js       # 15 delays → act()
test/tui-reorder-lines.test.js        # 16 delays → act()
test/tui-separator.test.js            # 19 delays → act()
test/tui-preset.test.js               # 26 delays → act()
test/tui-widget-order.test.js         # 26 delays → act()
test/tui-monitor.test.js              # 27 delays + 2000ms poll → act() + injectable interval
test/tui-monitor-detail.test.js       # 29 delays → act()
test/tui-app.test.js                  # 21 delays + CI_FACTOR → act()
test/reader.test.js                   # reduce 12 spawns → direct imports
test/hook.test.js                     # reduce 6 spawns where feasible
```

### Testing Conventions (from Architecture Rev.5)

- Framework: `node:test` + `node:assert/strict` (built-in, zero dev deps)
- TUI: `ink-testing-library` v4 for component render tests
- Element creation: `const e = React.createElement` shorthand in all TUI tests
- No shared test helpers exist — each file is self-contained
- Temp dirs: `fs.mkdtempSync()` in beforeEach, `fs.rmSync()` in afterEach

### Previous Story Intelligence (from 9.1)

- Story 9.1 added signal handlers and PID registry — new test file may exist for lifecycle
- Pattern 22 (atomic write) and Pattern 28 (PID registry) are new patterns — tests touching cache dir must respect `BMAD_CACHE_DIR`
- `tui-pids.json` in cache directory — ensure concurrent test runs don't collide on this file

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — Test Organization & Conventions]
- [Source: _bmad-output/planning-artifacts/architecture.md — Enforcement Guidelines]
- [Source: _bmad-output/project-context.md — Pattern 1, Pattern 2]
- [React.act() docs: React 19 built-in test utility]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
