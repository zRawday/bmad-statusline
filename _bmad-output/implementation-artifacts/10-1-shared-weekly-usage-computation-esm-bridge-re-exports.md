# Story 10.1: Shared weekly-usage computation + ESM bridge re-exports

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **bmad-statusline developer**,
I want **the weekly-usage zone math and day-tick math to live as pure, testable functions in `src/reader/shared-constants.cjs` and be re-exported through the `src/defaults.js` ESM bridge**,
so that **the reader (CJS) and the TUI (ESM) compute identical zones and ticks from one source of truth, with the locked boundary thresholds verified by tests**.

## Context

This is the **foundation story of Epic 10** (Weekly Usage). It is pure plumbing: two functions + a handful of constants added to `shared-constants.cjs`, re-exported via the existing `createRequire` bridge in `defaults.js`, and locked down with tests. **No widget, no reader extractor, no TUI screen, no installer change** — those are stories 10.2–10.4, which all depend on this one. Get the math and the bridge exactly right here and the rest of the epic is straightforward consumption.

The feature lets a Claude subscriber see at a glance whether they're burning their weekly quota faster than the week is elapsing. The math classifies `used_percentage` (how much of the weekly quota is spent) against `timePct` (how far we are into the 7-day window, derived from `resets_at`) into 4 fixed color zones.

**Data source (VERIFIED — do not re-investigate, per Architecture Rev.7):** the values originate from the Claude Code statusLine stdin payload `rate_limits.seven_day` (`used_percentage`, `resets_at` in **seconds**). `rate_limits` is absent until the first API response of a session and present only for subscribers — but **that empty-state handling lives in the consumers (10.2/10.4), not here**. This story's functions just receive a `snapshot`/`nowMs` and must return `null` on bad input.

**This story is the analogue of the `getGradientColor`/`CONTEXT_GRADIENT_PALETTE` addition from the (done) Context % widget story** — same pattern: pure self-contained math in `shared-constants.cjs`, bridged to ESM via `defaults.js`. Follow that precedent exactly.

## Acceptance Criteria

### AC1: `shared-constants.cjs` exports the new symbols
**Given** `src/reader/shared-constants.cjs`
**When** inspected
**Then** it defines and adds to `module.exports`: `WEEK_MS` (`7 * 24 * 60 * 60 * 1000`), `WEEKLY_USAGE_SWEET_BAND` (`5`), `WEEKLY_USAGE_HIGH_BAND` (`10`), `WEEKLY_USAGE_ZONES` (keys `good`/`sweet`/`high`/`slowdown` → `{ status, color }`), `WEEKDAY_LABELS` (`['Sun','Mon','Tue','Wed','Thu','Fri','Sat']`), `computeWeeklyUsage`, and `computeWeekDayTicks`.

### AC2: Sweet-band lower boundary belongs to `sweet`
**Given** `computeWeeklyUsage(snapshot, nowMs)` with a `timePct` derived from the snapshot
**When** `usagePct === timePct - 5` exactly
**Then** the zone is `sweet` (status `SWEET SPOT`, color `blue`) — the boundary at `time−5` belongs to `sweet`, not `good`.

### AC3: Just below the sweet band is `good`
**Given** `computeWeeklyUsage`
**When** `usagePct` is just below `timePct - 5` (e.g. `timePct - 5.001`)
**Then** the zone is `good` (status `GOOD`, color `green`).

### AC4: High-band lower boundary belongs to `high`
**Given** `computeWeeklyUsage`
**When** `usagePct === timePct` exactly
**Then** the zone is `high` (status `TOO HIGH`, color `yellow`) — the boundary at `time` belongs to `high`, not `sweet`.

### AC5: Slowdown-band lower boundary belongs to `slowdown`
**Given** `computeWeeklyUsage`
**When** `usagePct === timePct + 10` exactly
**Then** the zone is `slowdown` (status `SLOW DOWN`, color `red`) — the boundary at `time+10` belongs to `slowdown`, not `high`.

### AC6: `timePct` is clamped to [0, 100]
**Given** `computeWeeklyUsage` and a snapshot whose `resets_at * 1000 - WEEK_MS` is in the future relative to `nowMs`, or far in the past
**When** computed
**Then** `timePct = clamp01((nowMs − (resets_at*1000 − WEEK_MS)) / WEEK_MS) × 100` — never negative, never above 100.

### AC7: Bad input returns `null` (empty-state signal)
**Given** `computeWeeklyUsage(snapshot, nowMs)`
**When** `snapshot` is null, OR `used_percentage` is null/absent, OR `resets_at` is null/absent, OR `used_percentage` is non-numeric / non-finite (`NaN` / `Infinity`)
**Then** it returns `null`.

### AC8: Populated result shape
**Given** `computeWeeklyUsage` returning a populated result
**When** inspected
**Then** the object is exactly `{ usagePct, timePct, zone, status, color }` with `status`/`color` sourced from `WEEKLY_USAGE_ZONES[zone]`.

### AC9: Day ticks at local-midnight boundaries, labelled by the starting day
**Given** `computeWeekDayTicks(resetsAtSec, nowMs)` for a window that starts **Friday at noon local time**
**When** computed
**Then** it returns one `{ positionPct, label }` per **local-midnight** day boundary **strictly inside** the window; `label` = the day that is **starting** (`WEEKDAY_LABELS[d.getDay()]`); the first Fri-noon→Sat-midnight segment is naturally half-width; no weekday is hardcoded. (For a Fri-noon→Fri-noon window this yields **7 ticks**, labels `['Sat','Sun','Mon','Tue','Wed','Thu','Fri']`, first `positionPct ≈ 7.14` (12h/168h).)

### AC10: DST-safe midnight advance
**Given** `computeWeekDayTicks`
**When** advancing across a window that crosses a DST transition
**Then** each tick advances via `d.setHours(24, 0, 0, 0)` (next local midnight), **not** a fixed `+24h` offset — boundaries do not drift.

> Note: `nowMs` is an accepted parameter of `computeWeekDayTicks` for signature symmetry with `computeWeeklyUsage` and forward use by callers; the tick set itself is a function of the window (`resetsAtSec` → `weekStartMs`), not of `nowMs`. Keep the parameter even though the reference body does not branch on it.

### AC11: `defaults.js` bridge re-exports the new symbols
**Given** `src/defaults.js`
**When** inspected
**Then** it re-exports `WEEK_MS`, `WEEKLY_USAGE_SWEET_BAND`, `WEEKLY_USAGE_HIGH_BAND`, `WEEKLY_USAGE_ZONES`, `WEEKDAY_LABELS`, `computeWeeklyUsage`, and `computeWeekDayTicks` via the existing `_sc` (`createRequire`) bridge — so ESM consumers (TUI) import them from `defaults.js`.

### AC12: Tests — math in `reader.test.js`, bridge in `defaults.test.js`
**Given** the shared-constants math tests live in **`test/reader.test.js`** (the existing CJS-consumer test file — do **not** create a new `test/shared-constants*.test.js`) and the ESM-bridge assertion lives in **`test/defaults.test.js`**
**When** updated for this story
**Then** `test/reader.test.js` covers: (a) the three locked boundaries at `time−5`, `time`, `time+10`; (b) `good` and `slowdown` extremes; (c) `timePct` clamping at both ends; (d) null / empty / non-finite → `null`; (e) day-tick count + labels + half-width first segment for a Friday-noon reset — **and** `test/defaults.test.js` covers (f) the `defaults.js` bridge re-exports resolve to the **same function references** as `shared-constants.cjs`. `npm test` passes.

## Tasks / Subtasks

- [ ] **Task 1 — Add constants + math to `shared-constants.cjs`** (AC: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
  - [ ] 1.1 Add the consts `WEEK_MS`, `WEEKLY_USAGE_SWEET_BAND`, `WEEKLY_USAGE_HIGH_BAND`, `WEEKLY_USAGE_ZONES`, `WEEKDAY_LABELS` near the other top-level consts (e.g. after `CONTEXT_GRADIENT_PALETTE`).
  - [ ] 1.2 Add `computeWeeklyUsage(snapshot, nowMs)` — copy the reference body verbatim (see Dev Notes). Guard clauses first (`null` returns), then `usagePct`/`weekStartMs`/`timePct`, then the 4-branch zone ladder, then the result object.
  - [ ] 1.3 Add `computeWeekDayTicks(resetsAtSec, nowMs)` — copy the reference body verbatim. Use `d.setHours(24, 0, 0, 0)` for the initial midnight and every advance (DST-safe).
  - [ ] 1.4 Add all 7 new symbols to the `module.exports` object.
- [ ] **Task 2 — Bridge through `defaults.js`** (AC: 11)
  - [ ] 2.1 Add 7 `export const X = _sc.X;` lines after the existing `getGradientColor` re-export, mirroring the existing bridge style.
- [ ] **Task 3 — Math tests in `test/reader.test.js`** (AC: 12 a–e)
  - [ ] 3.1 Add a `describe('weekly-usage computation', ...)` block. Use the already-imported `sharedConstants` handle (`test/reader.test.js:22`) — no new import needed.
  - [ ] 3.2 Helper: build a snapshot whose `timePct` is a known value (see Dev Notes "Boundary test recipe") so boundary asserts are exact and timezone-independent.
  - [ ] 3.3 Assert the three locked boundaries (`time−5`→sweet, `time`→high, `time+10`→slowdown), `good`/`slowdown` extremes (`usagePct` 0 → good, 100 → slowdown), clamp-low (weekStart in future → `timePct === 0`), clamp-high (now past reset → `timePct === 100`), and all four `null` cases.
  - [ ] 3.4 Day-tick test for a Friday-noon reset: assert `ticks.length === 3+...` (expect **7**), `ticks.map(t => t.label)` equals `['Sat','Sun','Mon','Tue','Wed','Thu','Fri']`, and `ticks[0].positionPct` ≈ `100 * 12 / 168` (half-width first segment) within a small epsilon.
- [ ] **Task 4 — Bridge test in `test/defaults.test.js`** (AC: 12 f)
  - [ ] 4.1 Import the 7 new symbols from `../src/defaults.js` and the CJS source via `createRequire`; assert each bridged function/const `===` (same reference) the `shared-constants.cjs` export, and assert const values (`WEEK_MS`, band numbers, zone shape).
- [ ] **Task 5 — Verify** (AC: 12)
  - [ ] 5.1 Run `npm test` (full suite — `node --test test/*.test.js`). All green.

## Dev Notes

### Reference implementation — copy VERBATIM into `shared-constants.cjs`
Source: Architecture Rev.7, `_bmad-output/planning-artifacts/architecture.md:2320-2367`. This is the locked spec — do not improvise the zone ladder or the clamp expression.

```js
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Fixed threshold POINTS (percentage points of the week) — LOCKED spec
const WEEKLY_USAGE_SWEET_BAND = 5;   // blue band:   [time-5, time)
const WEEKLY_USAGE_HIGH_BAND  = 10;  // yellow band: [time, time+10)

// Zone → status word + semantic color name (each surface maps the name to its own renderer)
const WEEKLY_USAGE_ZONES = {
  good:     { status: 'GOOD',       color: 'green'  },
  sweet:    { status: 'SWEET SPOT', color: 'blue'   },
  high:     { status: 'TOO HIGH',   color: 'yellow' },
  slowdown: { status: 'SLOW DOWN',  color: 'red'    },
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// snapshot = { used_percentage, resets_at(seconds) }; nowMs = Date.now()
function computeWeeklyUsage(snapshot, nowMs) {
  if (!snapshot || snapshot.used_percentage == null || snapshot.resets_at == null) return null;
  const usagePct = snapshot.used_percentage;
  if (typeof usagePct !== 'number' || !isFinite(usagePct)) return null;
  const weekStartMs = snapshot.resets_at * 1000 - WEEK_MS;
  // time% = clamp01( (now − (resets_at − 7d)) / 7d ) × 100
  const timePct = Math.min(1, Math.max(0, (nowMs - weekStartMs) / WEEK_MS)) * 100;
  let zone;
  if (usagePct < timePct - WEEKLY_USAGE_SWEET_BAND)      zone = 'good';
  else if (usagePct < timePct)                          zone = 'sweet';
  else if (usagePct < timePct + WEEKLY_USAGE_HIGH_BAND)  zone = 'high';
  else                                                   zone = 'slowdown';
  return { usagePct, timePct, zone, status: WEEKLY_USAGE_ZONES[zone].status, color: WEEKLY_USAGE_ZONES[zone].color };
}

// Day-boundary tick marks for the TUI time bar.
// Returns [{ positionPct, label }] for each LOCAL-midnight day boundary strictly inside the window.
// label = the day that is STARTING.
function computeWeekDayTicks(resetsAtSec, nowMs) {
  const resetsMs = resetsAtSec * 1000;
  const weekStartMs = resetsMs - WEEK_MS;
  const ticks = [];
  const d = new Date(weekStartMs);
  d.setHours(24, 0, 0, 0); // first local midnight strictly after weekStart (DST-safe via setHours)
  while (d.getTime() < resetsMs) {
    ticks.push({ positionPct: ((d.getTime() - weekStartMs) / WEEK_MS) * 100, label: WEEKDAY_LABELS[d.getDay()] });
    d.setHours(24, 0, 0, 0); // advance one local day (DST-safe — not a fixed +24h)
  }
  return ticks;
}
```

Then add to `module.exports`: `WEEK_MS, WEEKLY_USAGE_SWEET_BAND, WEEKLY_USAGE_HIGH_BAND, WEEKLY_USAGE_ZONES, WEEKDAY_LABELS, computeWeeklyUsage, computeWeekDayTicks`.

### `defaults.js` bridge — append after line 85 (`getGradientColor`)
The bridge already does `const _sc = _require('./reader/shared-constants.cjs');` (`src/defaults.js:6`). Just add the re-exports, matching the existing one-line style:

```js
export const WEEK_MS = _sc.WEEK_MS;
export const WEEKLY_USAGE_SWEET_BAND = _sc.WEEKLY_USAGE_SWEET_BAND;
export const WEEKLY_USAGE_HIGH_BAND = _sc.WEEKLY_USAGE_HIGH_BAND;
export const WEEKLY_USAGE_ZONES = _sc.WEEKLY_USAGE_ZONES;
export const WEEKDAY_LABELS = _sc.WEEKDAY_LABELS;
export const computeWeeklyUsage = _sc.computeWeeklyUsage;
export const computeWeekDayTicks = _sc.computeWeekDayTicks;
```

### Boundary test recipe (timezone-independent)
To assert boundaries exactly, **construct a snapshot with a known `timePct`**, then vary `usagePct`:

- Pick `resetsAtSec` (any fixed value, e.g. derived from a Date). Choose `nowMs = resetsAtSec * 1000 - WEEK_MS / 2` → `timePct === 50` exactly (now is at the half-way point of the window). This is pure epoch math, so it's timezone-agnostic — safe for the zone-boundary tests.
- Then: `usagePct = 45` → `sweet` (AC2: `time−5`); `usagePct = 44.999` → `good` (AC3); `usagePct = 50` → `high` (AC4); `usagePct = 60` → `slowdown` (AC5); `usagePct = 0` → `good`; `usagePct = 100` → `slowdown`.
- Clamp-low (AC6): `nowMs = (resetsAtSec * 1000 - WEEK_MS) - 1000` (just before week start) → `timePct === 0`.
- Clamp-high (AC6): `nowMs = resetsAtSec * 1000 + 1000` (just after reset) → `timePct === 100`.
- `null` cases (AC7): `computeWeeklyUsage(null, now)`, `{ resets_at: X }` (no `used_percentage`), `{ used_percentage: 50 }` (no `resets_at`), `{ used_percentage: NaN, resets_at: X }`, `{ used_percentage: Infinity, resets_at: X }`.

### Day-tick test recipe (must use LOCAL Friday noon)
`computeWeekDayTicks` uses `getDay()` / `setHours` which are **local-time** — a hardcoded epoch would make labels/positions timezone-dependent and flaky in CI. Build the window from a local Date:

```js
// Find a local Friday at noon, set weekStart there, reset = weekStart + 7d.
const ws = new Date(2026, 0, 1, 12, 0, 0, 0);      // start somewhere
while (ws.getDay() !== 5) ws.setDate(ws.getDate() + 1); // 5 = Friday
const resetsAtSec = (ws.getTime() + sharedConstants.WEEK_MS) / 1000;
const ticks = sharedConstants.computeWeekDayTicks(resetsAtSec, Date.now());
// expect 7 ticks, labels ['Sat','Sun','Mon','Tue','Wed','Thu','Fri'],
// ticks[0].positionPct ≈ 100 * 12 / (7*24) within ~0.001
```
Assert with a small epsilon on `positionPct` (floating point). Do **not** assert exact float equality.

### Hard constraints (project patterns — see `_bmad-output/project-context.md`)
- **Shared Constants Pattern:** `shared-constants.cjs` is the single source of truth. Never duplicate these consts/functions elsewhere; consumers (10.2 reader, 10.4 TUI) import from here / via the `defaults.js` bridge. (project-context.md "Shared Constants Pattern".)
- **CJS module, `'use strict';` at top** — already present. Plain `function`/`const`, `module.exports` object at the bottom (it already exists — extend it, don't add a second `module.exports`).
- **No runtime deps** (Node stdlib only) — these are pure functions; introduce nothing.
- **Code style:** 2-space indent, single quotes, semicolons always, `camelCase` functions, `UPPER_SNAKE_CASE` consts. Match the existing file exactly (the reference block above already conforms).
- **ESM bridge style:** one `export const X = _sc.X;` per symbol, after the existing re-exports (`src/defaults.js:76-85`). Do not re-architect the bridge.
- **Tests:** `node:test` + `node:assert/strict`, `describe`/`it`, strict assertions. No new test file for the math (goes in `reader.test.js`); bridge assertion in `defaults.test.js`. (project-context.md "Testing Conventions".)

### Anti-patterns to avoid (would fail review)
- ❌ Creating `test/shared-constants.test.js` — AC12 mandates `reader.test.js` + `defaults.test.js`. The reader test file already requires `shared-constants.cjs` at line 22 — reuse `sharedConstants`.
- ❌ Hardcoding a weekday or a timezone offset anywhere in the math or the tests.
- ❌ Using a fixed `+ 24*60*60*1000` to advance ticks — must be `setHours(24,0,0,0)` (DST-safe).
- ❌ Changing the zone ladder comparisons (`<` vs `<=`). The three boundary ACs (2/4/5) depend on the exact `<` placement; the reference body is correct as written.
- ❌ Adding empty-state / `rate_limits` / stdin handling here — that's the reader's job in story 10.2. This story's `null` contract is the seam.
- ❌ Touching the widget registry, reader extractor, TUI, or installer — all out of scope.

### Project Structure Notes
- Files modified: `src/reader/shared-constants.cjs` (extend), `src/defaults.js` (extend bridge), `test/reader.test.js` (add describe block), `test/defaults.test.js` (add bridge assertions). **No new source files.**
- Aligns with Boundary 3 (Shared Constants — THE BRIDGE) and Boundary 7 (Defaults — ESM bridge) in project-context.md. No boundary or contract is changed; this is purely additive, consistent with Epic 10's brownfield-additive framing.
- Doc reconciliation (the "13 widgets" sweep, Boundary 2 wording, Pattern 29 docs) is **story 10.5**, not here. Do not edit `project-context.md` in this story.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.1] — user story + the 11 BDD acceptance criteria (lines 2307-2361).
- [Source: _bmad-output/planning-artifacts/architecture.md#Rev.7 Shared Computation] — reference implementation, verbatim (lines 2316-2373).
- [Source: _bmad-output/planning-artifacts/architecture.md#Rev.7 Data Source Contract] — `rate_limits.seven_day` origin, `resets_at` in seconds (lines 2230-2251); consumers handle empty state, not this story.
- [Source: src/reader/shared-constants.cjs] — current exports + `module.exports` block to extend (lines 80-93); `getGradientColor`/`CONTEXT_GRADIENT_PALETTE` precedent (lines 68-78).
- [Source: src/defaults.js#Shared constants bridged from CJS] — existing `_sc` bridge re-export style to mirror (lines 75-85).
- [Source: test/reader.test.js] — `sharedConstants` handle at line 22; contextpct test precedent (lines 429-509).
- [Source: test/defaults.test.js] — existing structure for the bridge assertion.
- [Source: _bmad-output/project-context.md#Shared Constants Pattern] — single-source-of-truth rule + ESM bridge contract (lines 721-757); Testing Conventions (lines 1048-1098).

### Dependency note for the SM/dev
Per epics.md Epic 10 dependencies: **10.1 is first** (foundation — pure math + bridge). 10.2 (reader extractor + snapshot) and 10.3 (widget registry) parallelize after this. 10.4 (TUI screen) depends on this (shared math via bridge) and 10.3. 10.5 (doc/test reconciliation) is last. Keep this story's surface minimal so the downstream stories inherit a stable seam.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created.

### File List
