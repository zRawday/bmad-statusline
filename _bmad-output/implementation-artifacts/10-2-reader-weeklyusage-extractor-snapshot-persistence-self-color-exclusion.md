# Story 10.2: Reader — `weeklyusage` extractor + snapshot persistence + self-color exclusion

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer with the `bmad-weeklyusage` widget on a status line**,
I want **the reader to render the zone-colored `Weekly usage : <STATUS>` from live stdin and persist an account-global usage snapshot for the TUI**,
so that **the statusline shows my live weekly-quota zone and the standalone TUI screen can read the latest usage without its own stdin payload**.

## Context

This is the **reader-side consumer story of Epic 10** (Weekly Usage). Story 10.1 (done) already landed the pure math — `computeWeeklyUsage`, `computeWeekDayTicks`, and the zone constants — in `src/reader/shared-constants.cjs`, bridged to ESM via `src/defaults.js`. **This story consumes that math inside the reader only.** Three additive changes to `src/reader/bmad-sl-reader.js`, nothing else:

1. **`COMMANDS.weeklyusage`** — a new extractor that reads `rate_limits.seven_day` from the live ccstatusline stdin payload, computes the zone, and returns a self-colored `Weekly usage : <STATUS>` string (empty when no data — exactly like `contextpct`).
2. **`persistUsageSnapshot(stdin)`** — a new side-effect helper that writes an account-global `weekly-usage.json` to the cache dir so the standalone TUI screen (story 10.4) can read usage without its own stdin. Atomic write + content-change throttle (Pattern 8 / Pattern 29).
3. **Self-color exclusion** — add `bmad-weeklyusage` to the existing exclusion guard in `handleLineCommand()` so the generic fixed-color wrapper never re-colors it (it self-colors in its extractor).

**No widget registry, no TUI screen, no preview-utils, no installer, no `project-context.md` edits** — those are stories 10.3 (registry/preview), 10.4 (TUI screen), 10.5 (doc/test reconciliation). This story's surface is one file plus its tests.

**The architectural crux (why the snapshot exists):** the live usage data only ever reaches the **reader** (via the statusLine stdin payload). The **TUI is a standalone process with no stdin payload**, so the reader must persist a snapshot the TUI can read. The widget itself never reads the snapshot — it has live stdin and computes directly (the `contextpct` precedent). The snapshot is purely a side effect for the TUI consumer in 10.4.

**Data source (VERIFIED — do not re-investigate, per Architecture Rev.7):** values come from the Claude Code statusLine stdin payload `rate_limits.seven_day` (`used_percentage` = number 0–100; `resets_at` = Unix epoch **seconds**). `rate_limits` is **absent until the first API response** of a session and present **only for subscribers** — every consumer handles the empty state by returning `''` / writing nothing.

## Acceptance Criteria

### AC1: `weeklyusage` extractor renders the zone-colored status from live stdin
**Given** `COMMANDS.weeklyusage(s, lc, stdin)` in `src/reader/bmad-sl-reader.js`
**When** `stdin.rate_limits.seven_day` has numeric `used_percentage` and `resets_at`
**Then** it returns `colorize('Weekly usage : ' + u.status, COLOR_CODES[u.color])` where `u = computeWeeklyUsage({ used_percentage, resets_at }, Date.now())` — self-colored with the zone color.

### AC2: extractor empty state → `''`
**Given** `COMMANDS.weeklyusage`
**When** `stdin.rate_limits` (or `.seven_day`) is absent, OR `stdin` is null, OR `computeWeeklyUsage` returns `null`
**Then** it returns `''` (empty string) — matching the `contextpct` precedent. The `line N` loop skips it (`if (!value) continue`), so the widget contributes nothing and shows no `--` placeholder in the statusline (the `--`/grey-bar empty state is a TUI-screen concern, story 10.4).

### AC3: self-color exclusion in `handleLineCommand()`
**Given** the self-color exclusion guard in `handleLineCommand()` (currently `src/reader/bmad-sl-reader.js:251`)
**When** updated
**Then** `bmad-weeklyusage` is added to the exclusion alongside `bmad-llmstate` and `bmad-contextpct`, so the generic fixed-color wrapper never wraps it (it self-colors in its extractor). The guard reads:
`if (widgetId !== 'bmad-llmstate' && widgetId !== 'bmad-contextpct' && widgetId !== 'bmad-weeklyusage' && colorMode && colorMode.mode === 'fixed' && colorMode.fixedColor) { … }`

### AC4: `persistUsageSnapshot` writes the snapshot via atomic write
**Given** `persistUsageSnapshot(stdin)` in the reader
**When** `stdin.rate_limits.seven_day` has non-null `used_percentage` and `resets_at`
**Then** it writes `{ used_percentage, resets_at, captured_at }` (`captured_at = new Date().toISOString()`) to `<CACHE_DIR>/weekly-usage.json` via atomic write — `fs.writeFileSync(USAGE_PATH + '.tmp', JSON.stringify(snap, null, 2) + '\n')` then `fs.renameSync(USAGE_PATH + '.tmp', USAGE_PATH)` (Pattern 8). `CACHE_DIR` resolves via `process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status')` (Pattern 5 — the existing module-level `CACHE_DIR` const at line 8).

### AC5: `persistUsageSnapshot` empty state → writes nothing
**Given** `persistUsageSnapshot(stdin)`
**When** `stdin` is null, `rate_limits` is absent, or `used_percentage`/`resets_at` is null
**Then** it returns early and writes nothing (empty state — nothing to persist).

### AC6: content-change throttle skips unchanged writes
**Given** an existing `weekly-usage.json` whose `used_percentage` and `resets_at` equal the incoming values (Pattern 29 content-change throttle)
**When** `persistUsageSnapshot` runs
**Then** it reads the previous snapshot and skips the write — no disk write when the meaningful fields are unchanged (prevents per-render write storms). `captured_at` is NOT a meaningful field for the throttle — only `used_percentage` and `resets_at` are compared.

### AC7: concurrent identical writes are safe
**Given** up to 3 concurrent `line N` reader processes (plus native-widget reader processes) rendering in the same cycle
**When** they all call `persistUsageSnapshot` with identical values
**Then** the atomic `.tmp`→rename plus the content-change throttle make concurrent identical writes safe — the first writes, the rest see "unchanged" and skip, and a torn read is impossible. (This is satisfied by AC4 + AC6 mechanics; no extra locking is added.)

### AC8: silent failure on any `fs` error
**Given** any `fs` error inside `persistUsageSnapshot` (read, write, rename, or `JSON.parse` of a corrupt previous snapshot)
**When** it occurs
**Then** it is swallowed silently (`try { … } catch {}`) — reader = silent always (Pattern 1); never throws, never logs, never blocks the render.

### AC9: call sites — invoked once after `readStdin()` in both reader entry paths, before the no-status early-return
**Given** the reader entry paths
**When** inspected
**Then** `persistUsageSnapshot(stdin)` is invoked once right after `readStdin()` in **both** `handleLineCommand()` — placed **before** the `if (!status) … return` early-return (line 232) so the snapshot is captured even outside a BMAD project / before any status file exists — **and** the individual-command path in `main()` (after `const stdin = readStdin();`, line 377). It is NOT invoked from the `line`-routing shortcut in `main()` (that path delegates to `handleLineCommand`, which already calls it).

### AC10: tests in `test/reader.test.js`
**Given** `test/reader.test.js`
**When** updated for this story
**Then** it tests:
- (a) extractor zone output for each of the 4 zones (`good`/`sweet`/`high`/`slowdown`) — correct status word + ANSI color;
- (b) extractor empty state — `rate_limits` absent → `''`, and `stdin` null → `''`;
- (c) snapshot atomic write produces the correct schema (`{ used_percentage, resets_at, captured_at }`) at `<CACHE_DIR>/weekly-usage.json`;
- (d) content-change throttle skips an unchanged write (snapshot file mtime / `captured_at` unchanged on a second identical render);
- (e) snapshot written even when **no status file exists** (TUI-without-session path — `line N` with `rate_limits` but no `status-{sid}.json`);
- (f) silent-fail on a write error (no throw, reader still emits its normal output);
- (g) `bmad-weeklyusage` excluded from generic fixed-color wrapping (a `line N` render with `bmad-weeklyusage` configured `{ mode: 'fixed', fixedColor: … }` still emits the **zone** color, not the fixed color).

`npm test` passes (full suite).

## Tasks / Subtasks

- [ ] **Task 1 — Import `computeWeeklyUsage` + add `USAGE_PATH` const** (AC: 1, 4)
  - [ ] 1.1 Extend the destructured `require('./shared-constants.cjs')` at `src/reader/bmad-sl-reader.js:16` to also pull in `computeWeeklyUsage`. (Only `computeWeeklyUsage` is needed in the reader — `computeWeekDayTicks`/`WEEKDAY_LABELS` are TUI-only, story 10.4.)
  - [ ] 1.2 Add `const USAGE_PATH = path.join(CACHE_DIR, 'weekly-usage.json');` near the existing `CACHE_DIR` const (line 8). Reuse the existing `CACHE_DIR` — do **not** recompute the cache path.
- [ ] **Task 2 — Add `COMMANDS.weeklyusage` extractor** (AC: 1, 2)
  - [ ] 2.1 Add a `weeklyusage: (s, lc, stdin) => { … }` entry to the `COMMANDS` object (alongside `contextpct`, ~line 312). Copy the reference body verbatim (see Dev Notes). Guard `rate_limits.seven_day` absence → `''`; `computeWeeklyUsage(...) === null` → `''`; else `colorize('Weekly usage : ' + u.status, COLOR_CODES[u.color])`.
- [ ] **Task 3 — Add `persistUsageSnapshot(stdin)` helper** (AC: 4, 5, 6, 7, 8)
  - [ ] 3.1 Add the function (place it near the other cache helpers, e.g. after `purgeStale()` ~line 174, or just above the `COMMANDS` block — anywhere module-scope, before the call sites). Copy the reference body verbatim (see Dev Notes): guard empty state → return; read previous snapshot in a nested `try/catch`; content-change throttle on `used_percentage` + `resets_at`; atomic `.tmp`→rename; whole body wrapped in `try { … } catch {}`.
- [ ] **Task 4 — Wire call sites** (AC: 9)
  - [ ] 4.1 In `handleLineCommand()` insert `persistUsageSnapshot(stdin);` immediately after `const stdin = readStdin();` (line 226) — i.e. **before** the `if (!stdin || !stdin.session_id)` guard (227) and the `if (!status) return` guard (232). This guarantees capture even with no session / no status file.
  - [ ] 4.2 In `main()` insert `persistUsageSnapshot(stdin);` immediately after `const stdin = readStdin();` (line 377), before the `if (!stdin || !stdin.session_id)` guard (378). Do **not** add it to the `line`-routing shortcut (lines 360-367) — that delegates to `handleLineCommand`, which already persists.
- [ ] **Task 5 — Extend self-color exclusion** (AC: 3)
  - [ ] 5.1 At `handleLineCommand()` line 251, add `&& widgetId !== 'bmad-weeklyusage'` to the exclusion condition, alongside the existing `bmad-llmstate`/`bmad-contextpct` checks.
- [ ] **Task 6 — Tests in `test/reader.test.js`** (AC: 10 a–g)
  - [ ] 6.1 Add a `describe('weekly-usage reader', …)` block (separate from the 10.1 `'weekly-usage computation'` block).
  - [ ] 6.2 Extractor zone tests (a) + empty state (b): direct-import via `reader.COMMANDS.weeklyusage({}, {}, stdin)` — build a stdin with a known `timePct` (see Dev Notes "Zone fixture recipe") and assert the status word + ANSI color for all 4 zones; assert `''` for `rate_limits` absent and `stdin` null.
  - [ ] 6.3 Snapshot tests (c)(d)(e)(f): **spawn** the reader as a subprocess with `BMAD_CACHE_DIR: tmpDir` and a stdin payload that includes `rate_limits.seven_day` (the in-process `reader` handle captured `CACHE_DIR` at require time from the ambient env — direct-import would write to the real home cache dir). Add a spawn helper that accepts a custom stdin object (the existing `execReader` only sends `{ session_id }`). Assert `weekly-usage.json` schema (c); render twice with identical values and assert `captured_at` unchanged (d); `line N` with `rate_limits` but no `status-{sid}.json` written → snapshot still present (e); for (f), simulate a write error path (e.g. assert the reader still exits 0 / emits normal output — silent-fail is satisfied by the `try/catch`; a hard fault injection is optional).
  - [ ] 6.4 Exclusion test (g): spawn `line N` with a config where the line has `bmad-weeklyusage` and `colorModes['bmad-weeklyusage'] = { mode: 'fixed', fixedColor: 'magenta' }`, a status file present, and stdin producing the **sweet** zone (color `blue`); assert the output contains the blue zone code (`\x1b[34m`) and does **not** contain the magenta fixed code (`\x1b[35m`).
- [ ] **Task 7 — Verify** (AC: 10)
  - [ ] 7.1 Run `npm test` (full suite — `node --test --test-concurrency=4 --test-timeout=30000 test/*.test.js`). All green, including the 10.1 weekly-usage block.

## Dev Notes

### Reference implementation — copy VERBATIM into `src/reader/bmad-sl-reader.js`
Source: Architecture Rev.7 (`_bmad-output/planning-artifacts/architecture.md:2287-2407`). These are the locked spec bodies — do not improvise.

**Extractor** (add to the `COMMANDS` object near `contextpct`):
```js
weeklyusage: (s, lc, stdin) => {
  const rl = stdin && stdin.rate_limits && stdin.rate_limits.seven_day;
  if (!rl) return ''; // empty state → no widget output (matches contextpct precedent)
  const u = computeWeeklyUsage({ used_percentage: rl.used_percentage, resets_at: rl.resets_at }, Date.now());
  if (!u) return '';
  return colorize('Weekly usage : ' + u.status, COLOR_CODES[u.color]);
},
```

**Snapshot helper** (module-scope, near the other cache helpers):
```js
const USAGE_PATH = path.join(CACHE_DIR, 'weekly-usage.json');

function persistUsageSnapshot(stdin) {
  try {
    const rl = stdin && stdin.rate_limits && stdin.rate_limits.seven_day;
    if (!rl || rl.used_percentage == null || rl.resets_at == null) return; // empty state — nothing to persist
    let prev = null;
    try { prev = JSON.parse(fs.readFileSync(USAGE_PATH, 'utf8')); } catch {}
    // Content-change throttle: skip write if value unchanged (avoids writing on every render)
    if (prev && prev.used_percentage === rl.used_percentage && prev.resets_at === rl.resets_at) return;
    const snap = {
      used_percentage: rl.used_percentage,
      resets_at: rl.resets_at,
      captured_at: new Date().toISOString(),
    };
    fs.writeFileSync(USAGE_PATH + '.tmp', JSON.stringify(snap, null, 2) + '\n'); // atomic (Pattern 8)
    fs.renameSync(USAGE_PATH + '.tmp', USAGE_PATH);
  } catch { /* silent — Pattern 1 */ }
}
```

**Self-color exclusion** — the current guard at line 251 is:
```js
if (widgetId !== 'bmad-llmstate' && widgetId !== 'bmad-contextpct' && colorMode && colorMode.mode === 'fixed' && colorMode.fixedColor) {
```
Change to:
```js
if (widgetId !== 'bmad-llmstate' && widgetId !== 'bmad-contextpct' && widgetId !== 'bmad-weeklyusage' && colorMode && colorMode.mode === 'fixed' && colorMode.fixedColor) {
```

### Call-site placement (precise)
- **`handleLineCommand()`** (lines 224-270): the order is `ensureCacheDir()` → `const stdin = readStdin();` (226) → `if (!stdin || !stdin.session_id) return;` (227) → `touchAlive`/`purgeStale` (229-230) → `const status = readStatusFile(...)` (231) → `if (!status) { write(''); return; }` (232). **Insert `persistUsageSnapshot(stdin);` on a new line immediately after line 226** (right after `readStdin()`), before the `session_id` guard. `persistUsageSnapshot(null)` is safe (its own guard returns early), so placing it before the `session_id` check is correct and maximizes capture (snapshot is account-global, not session-scoped).
- **`main()`** (lines 357-411): for the individual-command path, `const stdin = readStdin();` is at line 377. **Insert `persistUsageSnapshot(stdin);` immediately after line 377**, before `if (!stdin || !stdin.session_id) return;` (378). The `line` command (360-367) returns before reaching 377, so it never double-persists — `handleLineCommand` owns persistence for that path.

### COLOR_CODES already covers all 4 zone colors — DO NOT add color codes
The zone color names are `green`, `blue`, `yellow`, `red` (from `WEEKLY_USAGE_ZONES` in `shared-constants.cjs`). All four are already keys in the reader's `COLOR_CODES` map (`src/reader/bmad-sl-reader.js:180-196`): `red \x1b[31m`, `green \x1b[32m`, `yellow \x1b[33m`, `blue \x1b[34m`. `COLOR_CODES[u.color]` resolves cleanly — **do not add or rename any color codes.**

### Zone fixture recipe (timezone-independent) — for the extractor tests
The 10.1 boundary-test recipe applies directly. Construct a snapshot/stdin with a known `timePct`, then vary `used_percentage`:
- Pick any `resetsAtSec` (e.g. `Math.floor(Date.now() / 1000) + 3 * 24 * 3600`). The extractor calls `computeWeeklyUsage(..., Date.now())` internally — so to get a deterministic `timePct` you must control the relationship between `resets_at` and "now". The simplest deterministic approach for a `Date.now()`-driven extractor: choose `resets_at` so that `weekStartMs = resets_at*1000 - WEEK_MS` is ~half a week before now → `timePct ≈ 50`. Compute `resets_at = Math.floor((Date.now() + WEEK_MS / 2) / 1000)` → `timePct ≈ 50` at call time.
- Then with `timePct ≈ 50`: `used_percentage = 30` → `good` (GOOD/green, `\x1b[32m`); `45` → `sweet` (SWEET SPOT/blue, `\x1b[34m`); `50` → `high` (TOO HIGH/yellow, `\x1b[33m`); `65` → `slowdown` (SLOW DOWN/red, `\x1b[31m`). Keep a margin from the exact boundaries (the boundary precision is 10.1's job; here just land squarely in each band so a sub-second `Date.now()` drift can't flip the zone — avoid `used_percentage` within ~1 point of `45`/`50`/`60`).
- Assert the output equals `\x1b[<code>mWeekly usage : <STATUS>\x1b[0m` (use the `colorize` shape: `${code}${text}${RESET}`), or assert it `.includes()` both the color code and the status word.
- Empty state: `reader.COMMANDS.weeklyusage({}, {}, {})` → `''`; `reader.COMMANDS.weeklyusage({}, {}, null)` → `''`; `{ rate_limits: {} }` (no `seven_day`) → `''`.

### Snapshot test recipe — must SPAWN (not direct-import)
`CACHE_DIR`/`USAGE_PATH` are module-level consts captured at `require()` time. The top-of-file `const reader = _require(READER_PATH)` (`test/reader.test.js:21`) captured `CACHE_DIR` from the ambient env (real home dir) — calling `persistUsageSnapshot` via the direct handle would pollute the real cache dir. For snapshot assertions, **spawn** the reader so `BMAD_CACHE_DIR` is honored per-process. The existing `execReader(command, sessionId)` (lines 42-48) only sends `{ session_id }` as stdin — add a sibling helper that merges a custom stdin object, e.g.:
```js
function execReaderStdin(args, stdinObj, extraEnv = {}) {
  return execSync(`node "${READER_PATH}" ${args}`, {
    input: JSON.stringify(stdinObj),
    encoding: 'utf8',
    env: { ...process.env, BMAD_CACHE_DIR: tmpDir, ...extraEnv },
  });
}
```
Then for (c): run `execReaderStdin('weeklyusage', { session_id: 'us1', rate_limits: { seven_day: { used_percentage: 42.5, resets_at: <sec> } } })`, write a status file first so the individual-command path proceeds, and read `path.join(tmpDir, 'weekly-usage.json')` → assert `{ used_percentage: 42.5, resets_at: <sec>, captured_at: <ISO string> }`. For (e): use `line 0` with a config that places `bmad-weeklyusage` on line 0, **do not** write a `status-{sid}.json`, run, then assert `weekly-usage.json` exists in `tmpDir` (proves the pre-`if (!status)` placement). For (d): run twice with identical `rate_limits`, capture `captured_at` after each, assert equal (throttle skipped the second write). Use `BMAD_CONFIG_DIR` for the `line N` tests exactly as `execReaderWithConfig` does (lines 50-56).

### Hard constraints (project patterns — see `_bmad-output/project-context.md`)
- **Error Handling Triad — Reader = silent always (Pattern 1):** never `console.log`/`console.error`/`throw` anywhere in the reader. `persistUsageSnapshot` wraps everything in `try {} catch {}`. The extractor returns `''` on any miss (the `COMMANDS` loop already wraps each extractor in try/catch at line 247-266, so an extractor throw is also swallowed — but prefer returning `''` explicitly).
- **Synchronous I/O only (Pattern 2):** `fs.readFileSync` / `fs.writeFileSync` / `fs.renameSync`. Never `fs.promises`, never callbacks, never async. (Load-bearing — prevents races between the ≤3 concurrent `line N` processes.)
- **ANSI via `colorize()` (Pattern 3):** never inline escape codes in the extractor. Use `colorize(text, COLOR_CODES[u.color])`.
- **Path construction (Pattern 5):** reuse the existing `CACHE_DIR` const (already honors `BMAD_CACHE_DIR`). `USAGE_PATH = path.join(CACHE_DIR, 'weekly-usage.json')`. Never call `os.homedir()` directly in a function.
- **Atomic write (Pattern 8):** `.tmp` then `renameSync`. No backup, no post-write validation (Pattern 29 — cache bookkeeping, not config).
- **Pattern 29 — Reader Usage-Snapshot Cache (new, realized here):** the reader may write **account-global, regenerable cache bookkeeping** to the cache dir (and only the cache dir), extending its existing `touchAlive`/`purgeStale` role. It must NOT write `config.json` (Pattern 20 stands) and MUST NOT write the per-session status file (hook is sole status writer, Boundary 1 stands). Content-change throttle is mandatory.
- **Shared Constants Pattern:** import `computeWeeklyUsage` from `shared-constants.cjs` (already bridged). **Never** re-implement or duplicate the zone math in the reader. The widget computes the zone live from stdin; it does **not** read `weekly-usage.json`.
- **CJS module, `'use strict';`** — the reader is standalone CommonJS. `require`, `module.exports`. Match the file's existing style: 2-space indent, single quotes, semicolons, `camelCase` functions, `UPPER_SNAKE_CASE` consts.
- **Tests:** `node:test` + `node:assert/strict`, `describe`/`it`. Math/extractor tests go in `test/reader.test.js` — **do not** create a new test file. Reuse the existing `tmpDir` + spawn harness (lines 24-56).

### Anti-patterns to avoid (would fail review)
- ❌ Reading `weekly-usage.json` inside the extractor. The widget uses **live stdin** (the `contextpct` precedent). The snapshot is a write-only side effect here; only the TUI screen (10.4) reads it.
- ❌ Duplicating the zone ladder / `computeWeeklyUsage` body in the reader. Import it from `shared-constants.cjs`.
- ❌ Adding `bmad-weeklyusage` to a default line or touching `createDefaultConfig`/`widget-registry.js`/`preview-utils.js` — that's story 10.3. This story is `bmad-sl-reader.js` + `test/reader.test.js` only.
- ❌ Persisting in the `main()` `line`-routing shortcut (360-367) **and** in `handleLineCommand` — that double-persists per render. Persist once per entry path; the `line` shortcut delegates to `handleLineCommand`.
- ❌ Placing `persistUsageSnapshot` **after** the `if (!status) return` guard — then the TUI-without-session path (AC9 / test e) never captures a snapshot. Must be right after `readStdin()`.
- ❌ Comparing `captured_at` in the content-change throttle. Only `used_percentage` + `resets_at` are meaningful; `captured_at` changes every call and would defeat the throttle.
- ❌ Writing without the `.tmp`→rename (a torn read by a concurrent `line N` process becomes possible). Atomic only.
- ❌ Any `console.*` or unguarded `throw` in the reader (Pattern 1).
- ❌ Editing `project-context.md`, README, the widget count, or Boundary-2 wording — all reserved for story 10.5.

### Known deferred item from 10.1 review — do NOT speculatively guard here
Story 10.1's review deferred a finding: `computeWeeklyUsage` type-guards `used_percentage` but **not** `resets_at` (a non-numeric `resets_at` → `NaN` `timePct` → spurious `slowdown`). The VERIFIED data source always supplies a numeric `resets_at` (epoch seconds), and 10.2's locked ACs do not call for extra guarding — **follow the verbatim reference**. If defense-in-depth is later desired, the one-liner lives in `shared-constants.cjs` (10.1's file) or is tracked for 10.5, not patched ad-hoc into the extractor. Do not diverge from the reference body for inputs the data-source contract cannot produce.

### Intentional asymmetry (awareness only — documented in 10.5, not here)
The **widget** renders only inside a tracked BMAD session: `handleLineCommand` returns `''` when there is no `status-{sid}.json`, so even with `rate_limits` present, the inline widget shows nothing outside a tracked session. But the **snapshot is persisted before that early-return**, so the standalone TUI screen (10.4) works anywhere. This asymmetry is deliberate (Architecture Rev.7 flag #3). You don't document it in this story — just don't "fix" it by moving the persist call after the status check.

### Project Structure Notes
- Files modified: `src/reader/bmad-sl-reader.js` (extractor + helper + 2 call sites + exclusion guard), `test/reader.test.js` (new `describe` block + spawn helper). **No new source files.**
- Aligns with Boundary 2 (Reader — THE CONSUMER, now owning cache-dir usage-snapshot bookkeeping per Pattern 29) and Boundary 3 (Shared Constants — the math is imported, not duplicated). No contract changes to config.json or the status file; this is purely additive, consistent with Epic 10's brownfield-additive framing.
- The `defaults.js` ESM bridge re-exports (10.1) are untouched here — they're for the TUI (10.4), not the reader (the reader requires `shared-constants.cjs` directly).

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.2] — user story + the 7 BDD acceptance criteria (lines 2363-2409).
- [Source: _bmad-output/planning-artifacts/architecture.md#Rev.7 Key Decision — Usage Snapshot Persistence] — persistence rationale, `weekly-usage.json` schema, `persistUsageSnapshot` reference body, call sites (lines 2253-2314).
- [Source: _bmad-output/planning-artifacts/architecture.md#Rev.7 New Widget — bmad-weeklyusage] — extractor reference body + self-color exclusion (lines 2390-2407).
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 29 — Reader Usage-Snapshot Cache] — cache-bookkeeping rules, content-change throttle (lines 2458-2467).
- [Source: src/reader/bmad-sl-reader.js] — `CACHE_DIR` const (line 8); shared-constants import (line 16); `colorize` (26-29); `CACHE_DIR`/`touchAlive`/`purgeStale` cache helpers (77-174); `COLOR_CODES` map (180-196); `handleLineCommand` + self-color exclusion guard at line 251 (224-270); `COMMANDS` incl. `contextpct` precedent (294-353); `main()` individual-command path (357-411).
- [Source: src/reader/shared-constants.cjs] — `computeWeeklyUsage`, `WEEKLY_USAGE_ZONES` (zone → status/color), exports (80-148) — landed in story 10.1.
- [Source: test/reader.test.js] — `reader`/`sharedConstants` handles (21-22); `tmpDir` + `writeStatus`/`execReader`/`execReaderWithConfig` harness (24-56); `contextpct` direct-import test precedent (429-509).
- [Source: _bmad-output/implementation-artifacts/10-1-shared-weekly-usage-computation-esm-bridge-re-exports.md] — 10.1 done; boundary/zone test recipe + the deferred `resets_at` finding (Review Findings).
- [Source: _bmad-output/project-context.md#Reader Multi-Line Architecture] — `line N` execution sequence + "Color application in `line N`" self-color exclusion prose (lines 839-888); Error Handling Triad / Patterns 1,2,5,8 (lines 56-117).

### Dependency note for the SM/dev
Per epics.md Epic 10 dependencies: 10.1 (done) is the foundation. **10.2 and 10.3 parallelize after 10.1.** 10.4 (TUI screen) depends on 10.1 (shared math via bridge) and 10.3 (widget registered + previewable) — and consumes the `weekly-usage.json` this story persists. 10.5 (doc/test reconciliation, incl. the 13-widget sweep and Boundary-2 wording) is last. Keep this story confined to the reader so 10.3/10.4 inherit a stable, persisted snapshot contract.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

### Change Log
