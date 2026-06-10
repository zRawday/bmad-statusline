# Story 10.4: TUI "Weekly usage" screen + Home button + app routing

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **subscriber wanting a fuller view of my weekly consumption**,
I want **a read-only "Weekly usage" screen reachable from a new Home button, showing a usage bar and a time bar with day ticks**,
so that **I can see at a glance whether I'm ahead of or behind the week's pace, even outside a tracked BMAD session**.

## Context

This is the **TUI-screen story of Epic 10** (Weekly Usage) — the final feature story; only the 10.5 doc/test reconciliation sweep follows. It is the **consumer** of everything 10.1–10.3 landed:

- **10.1 (done):** the zone/time/tick math (`computeWeeklyUsage`, `computeWeekDayTicks`, `WEEKDAY_LABELS`, `WEEKLY_USAGE_ZONES`) in `shared-constants.cjs`, re-exported to ESM via `src/defaults.js`. **This screen imports those from `defaults.js`** (ESM — never `require` the `.cjs` directly).
- **10.2 (done):** the reader persists an account-global `weekly-usage.json` snapshot to the cache dir (`{ used_percentage, resets_at, captured_at }`), written **before** the `line N` no-status early-return so the snapshot exists even outside a tracked session. **This screen reads that snapshot.**
- **10.3 (done):** the widget is registered (13th) and previews correctly. Not consumed here, but it confirms the widget is selectable; this story is the standalone dashboard view.

**Three changes plus a new test file:**

1. **`src/tui/screens/WeeklyUsageScreen.js`** (NEW, PascalCase, JSX-less `const e = React.createElement;`) — a read-only screen that reads `weekly-usage.json`, computes `u = computeWeeklyUsage(snapshot, Date.now())` + `ticks = computeWeekDayTicks(snapshot.resets_at, Date.now())`, and renders a **usage bar** (filled to `u.usagePct`, zone-colored), a **time bar** (filled to `u.timePct`, neutral/dim, with `│` day-tick glyphs + labels), and a **status line** `Weekly usage : <u.status>` in the zone color. Empty state shows a grey placeholder bar + waiting message. A ~60s `setInterval` re-reads the snapshot and forces a re-render (so the time bar advances).
2. **`src/tui/screens/HomeScreen.js`** (MODIFIED) — add one `HOME_OPTIONS` entry `{ label: '📈 Weekly usage', value: 'weeklyUsage' }` near Monitor, and one `else if (value === 'weeklyUsage') navigate('weeklyUsage')` branch in the `key.return` handler.
3. **`src/tui/app.js`** (MODIFIED) — import `WeeklyUsageScreen` and add a router branch for `screen === 'weeklyUsage'`. **CRITICAL:** pass `paths: { cachePath }` built from the app-level `cachePath` const (app.js:37) — NOT the bare `paths` prop (see the ⚠️ disaster-prevention note below).
4. **`test/tui-weekly-usage.test.js`** (NEW) — populated render, empty state, Esc→`goBack()`, no-config-write, Home option + routing.

**The architectural crux (read-only, BF2-safe, no stdin):** the TUI is a standalone process with **no statusLine stdin payload** — it cannot compute usage from live data. It reads the snapshot the reader persisted (10.2). The screen mirrors `HealthCheckScreen`'s **reduced read-only props shape** `{ config, previewOverride, goBack, isActive, paths }` — it diagnoses/displays, it **never** mutates config (no `updateConfig`/`setConfig`/`writeInternalConfig`), so there is no BF2 render-loop risk. The 60s refresh is a render-only effect (re-read + re-render), exactly like Monitor polling and HealthCheck's async check — also BF2-exempt.

### ⚠️ DISASTER-PREVENTION #1 — the `paths` prop is `undefined` in production; pass `{ cachePath }` explicitly

The epics/architecture snippet literally says route with `e(WeeklyUsageScreen, { ...screenProps, paths })`. **Taken literally this CRASHES.** Here is why, verified against the live code:

- `bin/cli.js:34` launches the TUI with **`await launchTui();`** — **no `paths` argument**. So `App`'s top-level `paths` prop is **`undefined`** in production.
- `HealthCheckScreen` survives `paths === undefined` ONLY because it forwards `paths` to `runHealthCheck(paths)`, whose signature has a `paths = defaultPaths` **default parameter** that kicks in on `undefined`. There is no such downstream default for a screen that does `paths.cachePath` — **`undefined.cachePath` throws a `TypeError` and crashes the TUI.**
- The **working** precedent is `MonitorScreen`: app.js does NOT forward the bare `paths`; it builds a fresh object `paths: { cachePath, outputFolder: … }` from the app-level `cachePath` const (`app.js:37`: `const cachePath = process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status');`) and `MonitorScreen` reads `paths.cachePath`.

**Required wiring (mirror MonitorScreen, NOT the literal HealthCheck snippet):**
```js
if (screen === 'weeklyUsage') {
  return e(WeeklyUsageScreen, { ...screenProps, paths: { cachePath } });
}
```
This honors the AC's "reads `weekly-usage.json` from `paths.cachePath` dir" contract AND works at runtime (the `cachePath` const already honors `BMAD_CACHE_DIR`, so tests and `clean` stay consistent). Defense-in-depth: the screen ALSO resolves a safe fallback (see AC5 reference) so it never throws even if `paths`/`paths.cachePath` is missing.

## Acceptance Criteria

### AC1: populated render — two bars (usage + time-with-day-ticks)
**Given** `src/tui/screens/WeeklyUsageScreen.js` (new, PascalCase, `const e = React.createElement;`, JSX-less)
**When** it mounts with a valid `weekly-usage.json` snapshot (`computeWeeklyUsage` returns non-null)
**Then** it computes `u = computeWeeklyUsage(snapshot, Date.now())` and `ticks = computeWeekDayTicks(snapshot.resets_at, Date.now())` (both imported from `../../defaults.js`) and renders two **fixed-width** bars:
- a **usage bar** filled to `u.usagePct`, colored with `toInkColor(u.color)` (the zone color), with the percentage `u.usagePct.toFixed(1) + '%'` shown alongside;
- a **time bar** of the same width filled to `u.timePct` in a **neutral/dim** color, with `│` tick glyphs overlaid at each `ticks[i].positionPct` and the `ticks[i].label` printed under each tick.

### AC2: zone status line, wording identical to the widget
**Given** the populated screen
**When** rendered
**Then** it also shows a status line `Weekly usage : <u.status>` rendered in the zone color (`toInkColor(u.color)`) — **wording visually identical to the statusline widget** (10.2: `'Weekly usage : ' + u.status`). E.g. for the `sweet` zone the text is `Weekly usage : SWEET SPOT` in blue.

### AC3: authoritative formats override the (indicative) prototype
**Given** `docs/prototype weekly usage.png` is indicative only, NOT pixel-authoritative
**When** the developer reconciles format details against the locked spec
**Then** the authoritative formats are:
- the percentage reads `u.usagePct.toFixed(1) + '%'` (e.g. `24.0%` — one decimal, **no space** before `%`); the prototype's `24 %` (integer + space) is NOT followed;
- day-tick labels use the short `WEEKDAY_LABELS` form (`'Fri'`, `'Sat'`, …) — NOT the prototype's spelled-out `Friday`.

### AC4: empty state — grey placeholder bar + waiting message, no crash
**Given** the snapshot file is missing, invalid JSON, or `computeWeeklyUsage` returns `null` (empty state — `rate_limits` was never captured, e.g. non-subscriber or before the first API response)
**When** the screen renders
**Then** it shows a **dim placeholder**: a grey `░`-filled bar plus a message such as `Weekly usage : --` and `"Waiting for usage data (subscribers only; appears after the first API response)."` — **no crash, no colored zone, no `Date.now()`-driven compute on null**.

### AC5: read-only file access from `paths.cachePath`, synchronous, no config mutation
**Given** the screen reads `weekly-usage.json`
**When** it accesses the file
**Then** it reads from the `paths.cachePath` dir **read-only** and **synchronously** (`fs.readFileSync`, Pattern 2; wrapped in try/catch → `null` on any error), and it **never** calls `updateConfig` / `setConfig` / `writeInternalConfig` (no config mutation → no BF2 risk). Cache-dir resolution is defensive so it never throws on a missing prop:
`const cacheDir = (paths && paths.cachePath) || process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status');`
(In production app.js supplies `paths: { cachePath }`; the fallback is belt-and-suspenders and makes the screen testable in isolation.)

### AC6: ~60s low-frequency refresh — render-only, not a config read+write
**Given** the screen is mounted
**When** ~60s elapse
**Then** a low-frequency `setInterval` (interval handle `.unref()`'d, **cleared on unmount** via the `useEffect` cleanup) re-reads the snapshot from disk and forces a re-render so the **time bar advances** and `used_percentage` refreshes. This is a render-only effect (re-read snapshot into state + re-render; it does NOT read+write `config`), so it does **not** violate the BF2 anti-pattern — same exemption as Monitor polling / HealthCheck async.

### AC7: reduced read-only props shape + Esc handling
**Given** the screen receives the reduced read-only props shape `{ config, previewOverride, goBack, isActive, paths }` (Pattern 18, like `HealthCheckScreen`)
**When** the user presses Escape
**Then** `useInput((input, key) => { if (key.escape) goBack(); }, { isActive })` calls `goBack()` — `isActive` MUST be passed to `useInput` to prevent ghost input on the unfocused screen.

### AC8: Home option + navigation branch
**Given** `src/tui/screens/HomeScreen.js`
**When** inspected
**Then** `HOME_OPTIONS` includes `{ label: '📈 Weekly usage', value: 'weeklyUsage' }` placed near Monitor (both read-only dashboards), and the `key.return` handler has an `else if (value === 'weeklyUsage') navigate('weeklyUsage');` branch. (Placement note: insert it adjacent to the existing `monitor` option; if you add it on its own line, the `SELECTABLE_INDICES`/separator machinery already handles non-`_sep` entries automatically — no index math to hand-edit.)

### AC9: app.js routing — passes `paths: { cachePath }`, NOT the bare `paths`
**Given** `src/tui/app.js`
**When** inspected
**Then** it imports `WeeklyUsageScreen` from `./screens/WeeklyUsageScreen.js` and routes `screen === 'weeklyUsage'` to:
```js
if (screen === 'weeklyUsage') {
  return e(WeeklyUsageScreen, { ...screenProps, paths: { cachePath } });
}
```
using the existing app-level `cachePath` const (`app.js:37`). It **must NOT** be `{ ...screenProps, paths }` (the bare `paths` prop is `undefined` in production → `paths.cachePath` would throw). This mirrors the **MonitorScreen** wiring (`app.js:160-168`), which is the correct read-from-cache precedent — not the literal HealthCheck snippet.

### AC10: tests in `test/tui-weekly-usage.test.js` (new)
**Given** `test/tui-weekly-usage.test.js`
**When** run
**Then** it tests:
- **(a) populated render** — for a known snapshot (deterministic `resets_at`, see Dev Notes "Deterministic snapshot recipe"), the frame contains both bars (filled block glyphs) and the zone status line text `Weekly usage : <STATUS>` for the expected zone; at least one day-tick label (e.g. a `WEEKDAY_LABELS` entry) is present;
- **(b) empty state** — when the `weekly-usage.json` file is missing or invalid, the frame contains the grey `░` placeholder and the `Waiting for usage data` message and `Weekly usage : --`;
- **(c) Esc calls `goBack()`** — render with `isActive: true`, write Escape (`'\x1B'`), assert the injected `goBack` was called;
- **(d) no config write** — render the screen, drive it (mount + an interval tick if practical), and assert no config-mutation occurred (the screen receives no `updateConfig`; assert it is never invoked / not present in props — i.e. the screen does not call config writers). A focused check: pass a spy `updateConfig` in props and assert it is never called, OR assert no internal config file is written when the screen is rendered against a tmp `paths`;
- **(e) Home option present + routes** — `HomeScreen` frame includes `Weekly usage`; navigating to it (via `App` with `BMAD_CACHE_DIR` set to a tmp dir, or via a `HomeScreen` `navigate` spy) reaches `navigate('weeklyUsage')` / renders the screen.

**And** `npm test` passes (full suite — `node --test --test-concurrency=4 --test-timeout=30000 test/*.test.js`), **zero failures**. Adding a new Home option shifts the arrow-key navigation counts in existing `tui-app.test.js` tests that count down-arrows from Home (e.g. "navigate down to Reset" / "navigate to separator"); **if you place the new option above those targets, update those down-arrow counts** so the suite stays green (see Dev Notes "Existing-test impact").

## Tasks / Subtasks

- [x] **Task 1 — Create `WeeklyUsageScreen.js`** (AC: 1, 2, 3, 4, 5, 6, 7)
  - [x] 1.1 New file `src/tui/screens/WeeklyUsageScreen.js`. ESM, JSX-less: `import React, { useState, useEffect } from 'react';`, `import { Box, Text, useInput } from 'ink';`, `import fs from 'node:fs';`, `import path from 'node:path';`, `import os from 'node:os';`, `import { ScreenLayout } from '../components/ScreenLayout.js';`, `import { toInkColor } from '../preview-utils.js';`, `import { computeWeeklyUsage, computeWeekDayTicks } from '../../defaults.js';`. `const e = React.createElement;`. (Import the compute fns from `defaults.js` — the ESM bridge — NEVER `require('../../reader/shared-constants.cjs')`.)
  - [x] 1.2 Signature: `export function WeeklyUsageScreen({ config, previewOverride, goBack, isActive, paths }) { … }`. Resolve `cacheDir` defensively (AC5 line) and `const usagePath = path.join(cacheDir, 'weekly-usage.json');`.
  - [x] 1.3 Read the snapshot synchronously into state: `const [snapshot, setSnapshot] = useState(() => readSnapshot(usagePath));` where `readSnapshot` does `try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }` (Pattern 2). Compute `const u = computeWeeklyUsage(snapshot, Date.now());` on each render (recomputing `Date.now()` is what advances the time bar). `computeWeekDayTicks` only when `u` is non-null AND `snapshot.resets_at != null`.
  - [x] 1.4 60s refresh (AC6): in a `useEffect(() => { const id = setInterval(() => setSnapshot(readSnapshot(usagePath)), 60000); id.unref?.(); return () => clearInterval(id); }, [usagePath]);`. (`setSnapshot` re-renders even if the object is value-identical — a fresh object reference; that's the intended render-only refresh.)
  - [x] 1.5 Esc handling (AC7): `useInput((input, key) => { if (key.escape) goBack(); }, { isActive });`.
  - [x] 1.6 Render via `ScreenLayout` (`screenName: 'Weekly Usage'`, `screenColor: 'cyan'`, `config`, `previewOverride`, `shortcuts: [{ key: 'Esc', label: 'Back' }]`) so the screen is consistent with HealthCheck (header + 3-line preview + screen label + body + shortcut bar). Body = empty-state placeholder OR the two bars + zone status line.
  - [x] 1.7 Build the **usage bar** (AC1): a fixed-width row (suggest `const WIDTH = 40;`) of per-cell `e(Text, …, '█')` like `ContextPctConfigScreen.js:51-57`. `fill = Math.round((u.usagePct / 100) * WIDTH)`; cells `< fill` colored `toInkColor(u.color)`, the rest dim/empty (`'░'` with `dimColor`). Append the label `' ' + u.usagePct.toFixed(1) + '%'`.
  - [x] 1.8 Build the **time bar + day ticks** (AC1): same `WIDTH`. `timeFill = Math.round((u.timePct / 100) * WIDTH)`. Map each tick to a column `col = Math.round((ticks[i].positionPct / 100) * (WIDTH - 1))`. Render per-cell: a tick column gets `'│'` (`│`); other cells get `'█'` (filled, neutral/dim) if `< timeFill` else `'░'`/space. Below the bar, render a **label row**: a `WIDTH`-wide char buffer with each `ticks[i].label` placed left-aligned starting at its `col` (guard against running past `WIDTH`; if two labels would collide, last-write-wins is acceptable — prototype is indicative). Align the label row's left padding to the bar's left padding so ticks and labels line up.
  - [x] 1.9 **Status line** (AC2): `e(Text, { color: toInkColor(u.color) }, 'Weekly usage : ' + u.status)`.
  - [x] 1.10 **Empty state** (AC4): when `!u`, render a grey `░`-filled bar (`'░'.repeat(WIDTH)` in `gray`/`dimColor`), a `Weekly usage : --` line (dim), and `e(Text, { dimColor: true }, 'Waiting for usage data (subscribers only; appears after the first API response).')`. Do NOT call `computeWeekDayTicks` or `toInkColor(u.color)` in this branch (`u` is null).
- [x] **Task 2 — Home option + navigation** (AC: 8)
  - [x] 2.1 In `src/tui/screens/HomeScreen.js`, add `{ label: '📈 Weekly usage', value: 'weeklyUsage' }` to `HOME_OPTIONS` adjacent to the `monitor` entry (e.g. right after it). Match the existing escaped-unicode label style used in that file (📈 = `📈`).
  - [x] 2.2 In the `key.return` handler, add `else if (value === 'weeklyUsage') navigate('weeklyUsage');` alongside the existing `else if (value === 'monitor') navigate('monitor');`.
- [x] **Task 3 — app.js routing** (AC: 9)
  - [x] 3.1 Add `import { WeeklyUsageScreen } from './screens/WeeklyUsageScreen.js';` near the other screen imports (after `HealthCheckScreen`).
  - [x] 3.2 Add the router branch **with the corrected props** (place it near the `healthCheck`/`monitor` branches):
    ```js
    if (screen === 'weeklyUsage') {
      return e(WeeklyUsageScreen, { ...screenProps, paths: { cachePath } });
    }
    ```
    Use the existing `cachePath` const (app.js:37). Do NOT forward the bare `paths` prop (it is `undefined` in production).
- [x] **Task 4 — Tests `test/tui-weekly-usage.test.js`** (AC: 10 a–e)
  - [x] 4.1 New file, mirroring `test/tui-health-check.test.js` harness: `import { describe, test, afterEach } from 'node:test';`, `import assert from 'node:assert/strict';`, `import React, { act } from 'react';` + `globalThis.IS_REACT_ACT_ENVIRONMENT = true;`, `import { render } from 'ink-testing-library';`, `import fs/os/path`, `import { WeeklyUsageScreen } from '../src/tui/screens/WeeklyUsageScreen.js';`, `import { createDefaultConfig } from '../src/tui/widget-registry.js';`. Add a `makeTmpDir()` + `afterEach` cleanup (copy from `tui-app.test.js:17-40`).
  - [x] 4.2 (a) Populated: write `weekly-usage.json` into a tmp cacheDir with the deterministic recipe (Dev Notes), render `e(WeeklyUsageScreen, { config: createDefaultConfig(), previewOverride: null, goBack(){}, isActive: true, paths: { cachePath: tmpDir } })`, assert the frame matches the expected zone status word + contains block glyphs + a weekday label.
  - [x] 4.3 (b) Empty: render against a tmpDir with **no** `weekly-usage.json` (or invalid JSON), assert the frame matches `/Waiting for usage data/` and `/Weekly usage : --/`.
  - [x] 4.4 (c) Esc: render with a `goBack` spy + `isActive: true`, `await act(async () => stdin.write('\x1B'))`, assert the spy fired.
  - [x] 4.5 (d) No write: render against a tmp `paths` and assert no config file is created in it (the screen reads cache only, never writes config). Optionally also pass an `updateConfig` spy and assert it is never called.
  - [x] 4.6 (e) Home + route: assert `HomeScreen` frame includes `Weekly usage` (render `HomeScreen` with a `navigate` spy; arrow to the new option, Enter, assert `navigate` called with `'weeklyUsage'`). Optionally render `App` with `BMAD_CACHE_DIR` set to a tmp dir and navigate to confirm the screen mounts without crashing (this exercises the AC9 `paths: { cachePath }` wiring end-to-end).
- [x] **Task 5 — Verify** (AC: 10)
  - [x] 5.1 Run the full suite: `node --test --test-concurrency=4 --test-timeout=30000 test/*.test.js`. All green, zero failures.
  - [x] 5.2 Fix any `tui-app.test.js` down-arrow navigation counts that shifted because the new Home option moved the targets (see "Existing-test impact"). Do NOT touch unrelated `12`-count assertions (those are hook event types / widget counts owned by other stories).

## Dev Notes

### Reference bodies — copy these VERBATIM (locked spec surfaces)
Source: Architecture Rev.7 (`_bmad-output/planning-artifacts/architecture.md:2409-2444`) and Epic 10.4 (`epics.md:2447-2493`).

**Home option** (`HomeScreen.js` `HOME_OPTIONS`, near `monitor`):
```js
{ label: '📈 Weekly usage', value: 'weeklyUsage' },   // 📈
// in the key.return handler:
else if (value === 'weeklyUsage') navigate('weeklyUsage');
```

**Routing** (`app.js`, CORRECTED — `paths: { cachePath }`, not bare `paths`):
```js
if (screen === 'weeklyUsage') {
  return e(WeeklyUsageScreen, { ...screenProps, paths: { cachePath } });
}
```

**Props contract** (reduced read-only shape, like `HealthCheckScreen`):
```
{ config, previewOverride, goBack, isActive, paths }
```

**Compute imports (ESM bridge — from `defaults.js`, NOT the `.cjs`):**
```js
import { computeWeeklyUsage, computeWeekDayTicks } from '../../defaults.js';
```
(`WEEKDAY_LABELS` is already baked into each tick's `label` by `computeWeekDayTicks`, so you usually don't need to import it separately — `ticks[i].label` is the short day name.)

### How the math behaves (so you render the right thing)
From `shared-constants.cjs` (10.1), re-exported via `defaults.js`:
- `computeWeeklyUsage(snapshot, nowMs)` → `null` on empty/invalid input, else `{ usagePct, timePct, zone, status, color }`. `usagePct` = `snapshot.used_percentage`; `timePct` = how far into the 7-day window we are (clamped 0–100); `color` ∈ `green|blue|yellow|red`; `status` ∈ `GOOD|SWEET SPOT|TOO HIGH|SLOW DOWN`.
- `computeWeekDayTicks(resetsAtSec, nowMs)` → `[{ positionPct, label }]` for each **local-midnight** day boundary strictly inside the window. `label` = the day that is **starting** (short `WEEKDAY_LABELS` name). Because the week resets at a non-midnight time (e.g. Friday noon), the first segment is naturally half-width and the count of ticks is whatever falls inside the window — **do not assume exactly 7 ticks**; iterate `ticks` as-is.
- `toInkColor('green'|'blue'|'yellow'|'red')` returns the name unchanged (none start with `bright`), so `e(Text, { color: toInkColor(u.color) }, …)` is correct for all four zones — **no `bright*` translation needed.**

### Bar rendering — reuse the ContextPctConfigScreen per-cell pattern
`src/tui/screens/ContextPctConfigScreen.js:51-57` builds a colored bar as an array of per-cell `e(Text, { key, color }, '█')` elements rendered inside one `e(Text, …, ' 0% ', ...barChars, ' 100%')`. Reuse that exact shape:
```js
const cells = [];
for (let i = 0; i < WIDTH; i++) {
  const filled = i < fill;
  cells.push(e(Text, { key: `u${i}`, color: filled ? toInkColor(u.color) : undefined, dimColor: !filled },
    filled ? '█' : '░'));
}
```
For the time bar, additionally check a `Set` of tick columns and emit `'│'` (`│`) for those cells. Render per-row inside `e(Box, { flexDirection: 'column' }, …)`. Keep a consistent **left label gutter** (e.g. `'usage '` / `'time  '` prefixes, or a fixed-width pad) so the usage bar, time bar, and the day-label row all align column-for-column — the day labels MUST sit under their ticks.

### Day-tick label row (the fiddly part)
Build a plain `WIDTH`-length char array of spaces; for each tick, write its `label` characters starting at `col = Math.round((positionPct/100)*(WIDTH-1))`, clamping so you never write past `WIDTH-1` (truncate the label if needed). Then render that buffer as a single dim `e(Text, …)` with the same left gutter as the bars. Last-write-wins on overlap is acceptable (the prototype is indicative). Do NOT try to pixel-match the prototype's spacing.

### Deterministic snapshot recipe (for tests — same approach as 10.2)
`computeWeeklyUsage` is `Date.now()`-driven inside the screen, so choose `resets_at` to pin `timePct`:
- `const WEEK_MS = 7*24*3600*1000;` `const resetsAtSec = Math.floor((Date.now() + WEEK_MS/2)/1000);` → `timePct ≈ 50` at render time.
- Then pick `used_percentage` to land squarely in a zone (keep a margin from the `45`/`50`/`60` boundaries so sub-second drift can't flip it): `30` → `good`/green/`GOOD`; `47` → `sweet`/blue/`SWEET SPOT`; `55` → `high`/yellow/`TOO HIGH`; `65` → `slowdown`/red/`SLOW DOWN`.
- Snapshot JSON: `{ used_percentage: 47, resets_at: resetsAtSec, captured_at: '2026-06-10T00:00:00.000Z' }`. Write it to `path.join(tmpDir, 'weekly-usage.json')` and pass `paths: { cachePath: tmpDir }`.
- Assert via `app.lastFrame()` `.includes('SWEET SPOT')` (or the chosen zone) and that block glyphs (`█`) appear. For a weekday label, assert the frame contains at least one of `WEEKDAY_LABELS` (don't assert a specific day — it depends on the wall clock).
- Use the `act`/`flush` pattern from `tui-health-check.test.js` (`const flush = async () => { await act(async () => {}); };`).

### Existing-test impact (keep `npm test` green)
Adding a Home option **between** existing options changes the down-arrow distance to later options. `tui-app.test.js` has tests that count down-arrows from Home:
- `'navigation calls navigate with editLine context'` — currently 1 down (Monitor→Edit line 1).
- `'Reset to original calls resetToOriginal'` — currently 6 downs.
- `'resetToOriginal restores snapshot'` and `'navigation push/pop…'` — 5 downs to Separator.
**If you place `weeklyUsage` immediately after `monitor` (the top), every one of those down-counts increases by 1.** Update them to match, or place the new option **below** all of those targets to avoid touching them. Pick one approach and make the suite green — the placement is cosmetic (spec only says "near Monitor"), but the test counts must agree with the final `HOME_OPTIONS` order. Re-run the full suite to confirm.

### Hard constraints (project patterns — `_bmad-output/project-context.md`)
- **Pattern 18 — reduced read-only props:** `{ config, previewOverride, goBack, isActive, paths }`. Like `HealthCheckScreen`, this screen never calls `updateConfig`/`setConfig`/`writeInternalConfig` (project-context.md:289-319, :1011). It is a dashboard, not a configurator.
- **Pattern 2 — synchronous I/O only:** `fs.readFileSync`. Never `fs.promises`, callbacks, or async file reads (project-context.md:67).
- **Pattern 3 — Ink `<Text>` color only:** no raw ANSI escape codes in React. Colors via the `color`/`dimColor` props and `toInkColor()` (the four zone colors are valid Ink names).
- **BF2 anti-pattern — never read+write `config` in a `useEffect`:** the 60s refresh re-reads a **cache file** into local state and re-renders; it does NOT touch `config`. This is the same BF2-exempt pattern as Monitor's `useSessionPolling` (`MonitorScreen.js:21-39`) and HealthCheck's async effect (project-context.md:239, :1038, :1211).
- **`isActive` → `useInput`:** every screen passes `isActive` to `useInput({ isActive })` to avoid ghost input when unfocused (project-context.md:319).
- **ESM Bridge:** the TUI is ESM; import shared math from `src/defaults.js`, which `createRequire`-bridges `shared-constants.cjs`. NEVER `require` the `.cjs` directly from a TUI module.
- **Code Conventions:** new screen file is PascalCase, JSX-less (`const e = React.createElement;`), 2-space indent, single quotes, semicolons, `camelCase` functions, `UPPER_SNAKE`/`PascalCase` consts — match `HealthCheckScreen.js` / `ContextPctConfigScreen.js`.
- **Tests:** `node:test` + `node:assert/strict` + `ink-testing-library` + `react`'s `act`. New file `test/tui-weekly-usage.test.js` (the 10.3 story explicitly reserved this filename for this story). Do not add screen tests to the `tui-*` registry/preview files.

### Anti-patterns to avoid (would fail review)
- ❌ Forwarding the bare `paths` prop (`{ ...screenProps, paths }`) into `WeeklyUsageScreen` — it is `undefined` in production (`bin/cli.js:34` calls `launchTui()` with no args) → `paths.cachePath` throws and crashes the TUI. Pass `paths: { cachePath }` (DISASTER-PREVENTION #1).
- ❌ `require('../../reader/shared-constants.cjs')` from the ESM screen. Import the compute fns from `../../defaults.js`.
- ❌ Reading the snapshot with `fs.promises`/async, or polling faster than ~60s (cache is ~1h-stale-tolerant; a tight interval is wasteful and risks churn). One `setInterval(…, 60000)`, `.unref()`'d, cleared on unmount.
- ❌ Any `updateConfig`/`setConfig`/`writeInternalConfig` call, or a `useEffect` that reads+writes `config` (BF2). This screen is read-only.
- ❌ Recomputing zone math in the screen (duplicating `computeWeeklyUsage`/`computeWeekDayTicks`). Import them.
- ❌ Calling `computeWeekDayTicks(snapshot.resets_at, …)` or `toInkColor(u.color)` in the empty-state branch where `u`/`snapshot` is null → `TypeError`. Guard the populated branch behind `if (u)`.
- ❌ Hardcoding `Friday`/`24 %`/integer percentages to match the prototype — the prototype is indicative; the spec mandates short `WEEKDAY_LABELS` and `toFixed(1) + '%'` (AC3).
- ❌ Touching the reader, widget-registry, preview-utils, `shared-constants.cjs`, `defaults.js`, installer, or the `weekly-usage.json` **writer** — all owned by 10.1/10.2/10.3 (done). This story is the TUI screen + Home + routing + its test only.
- ❌ Editing `_bmad-output/project-context.md`, README, the "12/13 widgets" prose, Boundary-2 wording, or the intentional-asymmetry doc — that's the **story 10.5** reconciliation sweep. (This story only adds its new screen test + any down-arrow count fixes in `tui-app.test.js` needed to keep the suite green.)
- ❌ Making the screen full-screen with its own navigation (like Monitor). It mirrors HealthCheck: a normal `ScreenLayout` body with an Esc→back shortcut.

### Intentional asymmetry (awareness only — documented in 10.5, not here)
The **statusline widget** renders only inside a tracked BMAD session (the `line N` reader returns `''` with no `status-{sid}.json`), but **this TUI screen works anywhere** because the reader persists the snapshot **before** that early-return (10.2). So the screen can show real data even when the inline widget shows nothing. This is deliberate (Architecture Rev.7 flag #3). Don't "fix" it; don't document it here (10.5 owns the doc).

### Previous story intelligence (10.1 / 10.2 / 10.3 — all done)
- **10.1** landed and bridged the math; `defaults.js:86-92` already exports `WEEK_MS`, the zone consts, `WEEKLY_USAGE_ZONES`, `WEEKDAY_LABELS`, `computeWeeklyUsage`, `computeWeekDayTicks`. **Verified present** — import directly; no bridge work needed.
- **10.2** persists `weekly-usage.json` (`{ used_percentage, resets_at, captured_at }`) to the cache dir via atomic per-pid `.tmp`→rename + content-change throttle, **before** the no-status early-return. The schema this screen reads is locked; don't add/expect extra fields. Zone colors are `green|blue|yellow|red`; `blue` = SWEET SPOT.
- **10.3** registered the 13th widget (`defaultEnabled: false`, `defaultMode: 'dynamic'`) and added `SAMPLE_VALUES['bmad-weeklyusage'] = 'Weekly usage : SWEET SPOT'` + `resolvePreviewColor → 'blue'`. The 10.3 review also fixed `EditLineScreen.getColorOptions()` to suppress the no-op color control for `bmad-weeklyusage`. None of this is touched here; it confirms the widget side is complete so this screen is the last feature surface.
- **Verbatim-reference discipline:** 10.2 and 10.3 succeeded by copying locked spec bodies verbatim and not speculatively guarding. Do the same for the locked surfaces (Home option, routing, props, status wording, formats). The **rendering** of the bars is the one area with latitude (prototype is indicative) — use judgment there, but keep formats per AC3.

### Project Structure Notes
- Files: `src/tui/screens/WeeklyUsageScreen.js` (NEW), `src/tui/screens/HomeScreen.js` (one option + one branch), `src/tui/app.js` (one import + one route), `test/tui-weekly-usage.test.js` (NEW). Plus possibly minor down-arrow count fixes in `test/tui-app.test.js` to keep the suite green (see "Existing-test impact").
- Aligns with Boundary 6 (TUI isolation, ESM) and the read-only screen precedent (HealthCheck). Purely additive — no contract change to `config.json`, the status file, or the snapshot schema. Consistent with Epic 10's brownfield-additive framing.
- `defaults.js` (10.1 bridge) and `weekly-usage.json` (10.2 writer) are **consumed read-only**; neither is modified.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.4] — user story + the 9 BDD acceptance criteria (lines 2447-2493).
- [Source: _bmad-output/planning-artifacts/architecture.md#Rev.7 New TUI Screen — "Weekly usage"] — Home integration, routing snippet, reduced props contract, data lifecycle (60s refresh), rendering spec (usage/time bars, status line), empty state, new-file note (lines 2409-2444).
- [Source: _bmad-output/planning-artifacts/architecture.md#Rev.7 Shared Computation] — `computeWeeklyUsage`/`computeWeekDayTicks`/`WEEKDAY_LABELS` bodies + DST/half-width notes (lines 2316-2373).
- [Source: _bmad-output/planning-artifacts/architecture.md#Rev.7 Conflicts/Flags] — intentional asymmetry (flag #3), widget-count drift owned by 10.5 (lines 2476-2483).
- [Source: src/tui/app.js] — `cachePath` const (line 37); `screenProps` (95-105); `healthCheck` route (156-158); **MonitorScreen route building `paths: { cachePath, outputFolder }` (160-168) — the correct read-from-cache wiring precedent**.
- [Source: bin/cli.js] — `launchTui()` called with **no args** (line 34) → `App` `paths` prop is `undefined` in production (basis for DISASTER-PREVENTION #1).
- [Source: src/tui/screens/HealthCheckScreen.js] — read-only screen precedent: reduced props, `ScreenLayout`, `useInput({ isActive })` Esc→`goBack()`, async effect (BF2-exempt).
- [Source: src/tui/screens/HomeScreen.js] — `HOME_OPTIONS` + `SELECTABLE_INDICES` + `key.return` `navigate(...)` branches (lines 9-65); `monitor` option/branch to sit next to.
- [Source: src/tui/screens/ContextPctConfigScreen.js:51-57] — per-cell colored bar build with `toInkColor` + `'█'` — the bar-rendering pattern to reuse.
- [Source: src/tui/monitor/MonitorScreen.js:21-39, 89-90] — `useSessionPolling` `setInterval` + cleanup (BF2-exempt polling precedent); reads `paths.cachePath`.
- [Source: src/tui/preview-utils.js:25-31] — `toInkColor()` (zone colors pass through unchanged).
- [Source: src/defaults.js:86-92] — ESM re-exports of the weekly-usage compute fns/consts (import target).
- [Source: src/tui/components/ScreenLayout.js] — screen wrapper (header + ThreeLinePreview + screen label + body + ShortcutBar); props `{ screenName, screenColor, config, previewOverride, shortcuts, children }`.
- [Source: test/tui-health-check.test.js] — screen-test harness (`act`/`flush`, `ink-testing-library`, `makeProps`) to mirror for `tui-weekly-usage.test.js`.
- [Source: test/tui-app.test.js:17-40, 104-138, 186-226] — tmpDir helpers + the down-arrow navigation tests that may need count updates.
- [Source: _bmad-output/implementation-artifacts/10-2-reader-weeklyusage-extractor-snapshot-persistence-self-color-exclusion.md] — snapshot schema + deterministic `resets_at` test recipe + intentional asymmetry.
- [Source: _bmad-output/implementation-artifacts/10-3-widget-registry-entry-13th-widget-configurator-preview-integration.md] — widget registration + preview (done); scope boundary with 10.5.
- [Source: docs/prototype weekly usage.png] — indicative visual only (NOT pixel-authoritative); AC3 overrides its `24 %` / `Friday` formats.

### Dependency note for the SM/dev
Per epics.md Epic 10: 10.1/10.2/10.3 are **done**. **10.4 (this story) depends on all three** — it imports 10.1's math (via `defaults.js`), reads 10.2's `weekly-usage.json` snapshot, and is the standalone view of 10.3's registered widget. **10.5 is the last story** (doc/test reconciliation: 13-widget sweep, Boundary-2 wording, intentional-asymmetry doc, Pattern 29 reference) — keep this story confined to the TUI screen + Home + routing + its test so 10.5 only has the doc/prose sweep left.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context)

### Debug Log References

- Full suite: `node --test --test-concurrency=4 --test-timeout=30000 test/*.test.js` → 718 tests, 718 pass, 0 fail.
- New file alone + tui-app: `node --test --test-timeout=30000 test/tui-weekly-usage.test.js test/tui-app.test.js` → 21 pass, 0 fail. (The `act(...)` console warnings are pre-existing ink-testing-library noise shared by the HomeScreen/App tests; they are not failures.)

### Completion Notes List

- **WeeklyUsageScreen.js (NEW)** — read-only dashboard mirroring `HealthCheckScreen`'s reduced props shape `{ config, previewOverride, goBack, isActive, paths }`. Reads `weekly-usage.json` synchronously (Pattern 2, try/catch → `null`), computes `u = computeWeeklyUsage(snapshot, Date.now())` each render (advances the time bar) and `ticks = computeWeekDayTicks(...)` only when `u` and `snapshot.resets_at` are non-null. Renders a zone-colored **usage bar** (filled to `usagePct`, `WIDTH=40`, `toFixed(1)+'%'` label), a dim **time bar** with `│` day-tick glyphs overlaid at each tick column, an aligned **day-label row** (short `WEEKDAY_LABELS`), and a `Weekly usage : <status>` line in the zone color. Empty state = grey `░` bar + `Weekly usage : --` + waiting message, with no tick/`toInkColor(u.color)` calls on null. 60s `setInterval` refresh is `.unref()`'d and cleared on unmount (BF2-exempt render-only effect). No `updateConfig`/`setConfig`/`writeInternalConfig` — pure read-only.
- **HomeScreen.js (MOD)** — added `{ label: '📈 Weekly usage', value: 'weeklyUsage' }` immediately after Monitor (both read-only dashboards), using the file's escaped-unicode style (`📈`); added `else if (value === 'weeklyUsage') navigate('weeklyUsage');`. `SELECTABLE_INDICES`/separator machinery handles the new non-`_sep` entry automatically.
- **app.js (MOD)** — imported `WeeklyUsageScreen`; added router branch `if (screen === 'weeklyUsage') return e(WeeklyUsageScreen, { ...screenProps, paths: { cachePath } });`. **Passes `paths: { cachePath }`, NOT the bare `paths`** (DISASTER-PREVENTION #1: `bin/cli.js:34` calls `launchTui()` with no args → top-level `paths` is `undefined` in production; bare forwarding would throw `undefined.cachePath`). Mirrors the MonitorScreen wiring; the screen also resolves a defensive fallback (AC5) for belt-and-suspenders.
- **tui-weekly-usage.test.js (NEW)** — 6 tests: (a) populated render (deterministic `resets_at` → SWEET SPOT, asserts both bars/`47.0%`/a weekday label), (b) empty state, (b2) invalid-JSON → empty state, (c) Esc→`goBack()`, (d) no config writer called + no config file written, (e) Home lists "Weekly usage" + routes to `weeklyUsage`.
- **tui-app.test.js (MOD)** — bumped the four Home down-arrow navigation counts (+1 each) since `weeklyUsage` sits right after Monitor: editLine (1→2), Reset (6→7), separator (5→6), Reset-in-restore (6→7). No other assertions touched (12-count hook/widget assertions left untouched — owned by other stories).
- **Scope discipline:** no changes to the reader, `defaults.js`, `shared-constants.cjs`, widget-registry, preview-utils, installer, the snapshot writer, README, project-context.md, or the 12/13-widget / Boundary-2 / intentional-asymmetry prose (all owned by 10.1/10.2/10.3-done or the 10.5 sweep).

### File List

- `src/tui/screens/WeeklyUsageScreen.js` (new)
- `src/tui/screens/HomeScreen.js` (modified)
- `src/tui/app.js` (modified)
- `test/tui-weekly-usage.test.js` (new)
- `test/tui-app.test.js` (modified — down-arrow navigation counts)

## Change Log

| Date       | Version | Description                                                                                          | Author |
| ---------- | ------- | ---------------------------------------------------------------------------------------------------- | ------ |
| 2026-06-10 | 1.0     | Implemented TUI "Weekly usage" read-only screen + Home option + app routing + tests. Story → review. | Amelia |
