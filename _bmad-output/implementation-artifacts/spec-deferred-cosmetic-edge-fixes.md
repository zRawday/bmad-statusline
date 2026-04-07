---
title: 'Deferred Fixes — Cosmetic, Edge Cases & Robustness'
type: 'bugfix'
created: '2026-04-04'
status: 'done'
baseline_commit: '02e9fa8'
context: []
---

<frozen-after-approval>

## Intent

**Problem:** Accumulated low-severity items from code reviews across Epics 5-7: toggle indicators hidden at defaults (user wants always-visible), CSV export collision within same second, `formatRelativeTime` returns empty for future timestamps, `mergeChronology` sort NaN on invalid dates, `pollSessions` has no staleness check/upper bound/stable ordering, `buildFileTree` file/dir name collision, no memoization on monitor derived state, `pollSessions` silently drops skillless sessions, `*`/`🔀` indicators not colored, scroll offset not clamped on shrink, orphan `sep-bmad-*` separators not cleaned on fresh install, `readStatusFile`/`touchAlive` no path sanitization, `purgeStale` loop aborts on stat failure, `formatProgressStep` no cap on large totals.

**Approach:** Fix each item in-place. Group by file for efficiency. Most are 1-3 line changes. Test infrastructure fix (`delay`) is out of scope — low value vs effort.

## Boundaries & Constraints

**Always:** Maintain silent error handling in reader/hook (Pattern 1). Keep all fixes backward-compatible.

**Ask First:** If `pollSessions` ordering change affects session tab display order in monitor.

**Never:** Add new dependencies. Never change the hook dispatch or status file schema. Skip `delay(50)` test infra fix (low ROI).

</frozen-after-approval>

## Code Map

- `src/tui/monitor/MonitorScreen.js:145,211,350-360` — Scroll offset clamping, toggle indicators
- `src/tui/monitor/monitor-utils.js:8-24` — `pollSessions` (staleness, ordering, bound, filter)
- `src/tui/monitor/monitor-utils.js:107-128` — `buildFileTree` (name collision)
- `src/tui/monitor/monitor-utils.js:150-152` — `*`/`🔀` indicators (not colored)
- `src/tui/monitor/monitor-utils.js:225-255` — `mergeChronology` sort (NaN)
- `src/tui/monitor/monitor-utils.js:257-273` — `formatRelativeTime` (future dates)
- `src/tui/monitor/monitor-utils.js:317-326` — CSV export filename (second precision)
- `src/reader/bmad-sl-reader.js:176-211` — `readStatusFile`, `touchAlive`, `purgeStale`
- `src/reader/bmad-sl-reader.js:339-351` — `formatProgressStep` (no cap)
- `src/install.js:116-122` — Fresh install orphan separator detection

## Tasks & Acceptance

**Execution:**
- [x] `src/tui/monitor/MonitorScreen.js` — (1) Toggle indicators: show all toggles always (both default and non-default states, e.g., `[AUTO]`/`[manual]`). (2) Scroll offset: clamp upper bound on `items.length` change via `useEffect` or inline guard.
- [x] `src/tui/monitor/monitor-utils.js` — (1) `pollSessions`: add `.alive` mtime staleness check (> ALIVE_MAX_AGE), cap array at 20 sessions, sort by mtime descending for stable order. Remove `if (status.skill)` filter — include skillless sessions with fallback display. (2) `buildFileTree`: check if node already exists as object (dir) before overwriting with leaf entry. (3) `*`/`🔀` indicators: return structured items with `color` field (`green` for `*`, `cyan` for `🔀`), render with `<Text color={...}>`. (4) `mergeChronology` sort: guard NaN with `|| 0` on both sides. (5) `formatRelativeTime`: return `'maintenant'` for negative diff (future/clock skew). (6) CSV filename: add milliseconds to timestamp (`HHmmssSSS`).
- [x] `src/reader/bmad-sl-reader.js` — (1) `readStatusFile`/`touchAlive`: sanitize `sessionId` — reject if contains `/`, `\`, or `..`. (2) `purgeStale`: wrap `fs.statSync` in its own try/catch with `continue` on failure. (3) `formatProgressStep`: cap display at `step/999` if total exceeds 999.
- [x] `src/install.js` — Fresh install: also detect orphan `sep-bmad-*` widgets independently of `hasV1` — remove them in all cases.
- [x] `test/tui-monitor.test.js` — Add tests for toggle always-visible and scroll clamp.
- [x] `test/reader.test.js` — Add tests for sessionId sanitization and purgeStale resilience.

**Acceptance Criteria:**
- Given all toggles at defaults, when monitor renders, then all toggle indicators are visible.
- Given `.alive` file older than threshold, when `pollSessions` runs, then session is excluded.
- Given slug `5-3-auth--login` in file tree with same-name dir/file, then tree doesn't corrupt.
- Given future timestamp, when `formatRelativeTime` called, then returns `'maintenant'`.
- Given 2 CSV exports in same second, when filenames generated, then they differ (milliseconds).
- Given `sessionId` containing `../`, when `readStatusFile` called, then returns null.
- Given `purgeStale` with one unreadable `.alive` file, then loop continues for remaining files.

## Spec Change Log

## Verification

**Commands:**
- `node --test test/tui-monitor.test.js` — expected: all pass
- `node --test test/reader.test.js` — expected: all pass

## Suggested Review Order

**Security: path sanitization**

- SessionId validation rejects `/`, `\`, `..` — shared guard for both read and write paths
  [`bmad-sl-reader.js:176`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L176)

- `purgeStale` per-entry try/catch so one stat failure doesn't abort the loop
  [`bmad-sl-reader.js:210`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L210)

**Monitor: pollSessions rework**

- Staleness check, mtime sort, 20-session cap, skillless inclusion
  [`monitor-utils.js:12`](../../bmad-statusline/src/tui/monitor/monitor-utils.js#L12)

**Monitor: display fixes**

- Always-visible toggle indicators with default/active labels
  [`MonitorScreen.js:379`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L379)

- Scroll offset clamped via useEffect when items shrink
  [`MonitorScreen.js:196`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L196)

- Colored `*`/`🔀` indicators — structured data in renderTreeLines
  [`monitor-utils.js:162`](../../bmad-statusline/src/tui/monitor/monitor-utils.js#L162)

- FileTreeSection renders colored indicators via `<Text color={...}>`
  [`FileTreeSection.js:45`](../../bmad-statusline/src/tui/monitor/components/FileTreeSection.js#L45)

**Tree & chronology edge cases**

- buildFileTree dir/file collision — dir wins, leaf not overwritten
  [`monitor-utils.js:134`](../../bmad-statusline/src/tui/monitor/monitor-utils.js#L134)

- mergeChronology NaN guard on invalid dates
  [`monitor-utils.js:269`](../../bmad-statusline/src/tui/monitor/monitor-utils.js#L269)

- formatRelativeTime returns 'maintenant' for future timestamps
  [`monitor-utils.js:283`](../../bmad-statusline/src/tui/monitor/monitor-utils.js#L283)

- CSV filename includes milliseconds to avoid same-second collisions
  [`monitor-utils.js:340`](../../bmad-statusline/src/tui/monitor/monitor-utils.js#L340)

**Reader: formatProgressStep cap**

- Total capped at 999, current also capped defensively
  [`bmad-sl-reader.js:355`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L355)

**Installer: orphan separator cleanup**

- Fresh install detects and removes `sep-bmad-*` independently of v1 widgets
  [`install.js:122`](../../bmad-statusline/src/install.js#L122)

**Tests**

- Toggle always-visible + scroll clamp tests
  [`tui-monitor.test.js:1247`](../../bmad-statusline/test/tui-monitor.test.js#L1247)

- SessionId sanitization, purgeStale resilience, formatProgressStep cap tests
  [`reader.test.js:562`](../../bmad-statusline/test/reader.test.js#L562)
