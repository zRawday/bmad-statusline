---
title: 'doctor — statusline health check & npx cache auto-repair (CLI + TUI)'
type: 'feature'
created: '2026-05-29'
status: 'done'
context: []
baseline_commit: 'c4aa9a9'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The statusline can silently go blank while the monitor keeps working. The observed cause is a corrupted npx cache for `ccstatusline@latest` (missing Windows `.cmd`/`.ps1` bin shims), so `npx -y ccstatusline@latest` fails with "not recognized" and Claude Code's statusLine renders nothing. There is no way to diagnose or fix this short of manual cache spelunking.

**Approach:** Add shared health-check logic that verifies the install (deployed reader, valid `config.json`, `statusLine` in Claude settings, bmad widgets in ccstatusline settings) and functionally checks that `npx -y ccstatusline@latest` runs; on failure it auto-purges the ccstatusline entries from the npx cache (safe, regenerable) and re-runs. Surface it two ways: a `doctor` CLI command and a "Run health check" button on the TUI home that opens a dedicated results screen.

## Boundaries & Constraints

**Always:** Keep one shared core in `src/doctor.js` — an async `runHealthCheck(paths, runStatusline)` returning structured results `{ checks: [{id,label,status:'ok'|'fail'|'repaired',detail}], healthy }`; both the CLI wrapper and the TUI screen consume it. Mirror CLI conventions (injectable `paths`/deps, `cli-utils.js` log helpers). Only delete npx cache dirs whose `package.json` `_npx.packages` references `ccstatusline`. CLI exits 0 when healthy (after any repair), 1 otherwise. Detect brokenness functionally (run + exit code), never by inspecting platform-specific shim files. Use `Spinner` from `@inkjs/ui` for the TUI loading state.

**Ask First:** Deleting anything outside the npx `_npx` cache; auto-running `install` as part of repair.

**Never:** Modify settings.json, ccstatusline settings, `config.json`, or the deployed reader (those failures are reported ✗ with a "run install" hint — repair is out of scope for them). Never clear the whole npm cache. No new runtime dependencies.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| All healthy | reader+cjs deployed, config.json valid, statusLine present, ≥1 bmad-line-* widget, npx run exits 0 | every check `ok`, healthy=true | N/A |
| Broken npx cache | npx run fails; `_npx/<hash>` has `_npx.packages` incl. `ccstatusline` | purge matching dir(s), re-run; exit 0 → that check `repaired`, healthy=true | re-run still fails → `fail` + reinstall hint, healthy=false |
| Reader missing | `readerDest` absent | check `fail` "reader not deployed" + `install` hint | healthy=false |
| config.json corrupt/absent | unreadable or invalid JSON | check `fail` "config invalid" | healthy=false |
| statusLine missing | no `statusLine` key (or settings absent) | check `fail` "statusLine not configured" | healthy=false |
| widgets missing | no `bmad-line-*` in ccstatusline settings | check `fail` "widgets not registered" | healthy=false |
| npx cache dir absent | `_npx` dir not found | skip purge; rely on functional re-run only | N/A |

</frozen-after-approval>

## Code Map

- `src/clean.js` -- pattern to mirror: default export, injectable `paths`, cache-dir scan, per-entry try/catch + logError.
- `src/cli-utils.js` -- `logSuccess/logSkipped/logError/logSection`, `readJsonFile`; reuse.
- `src/install.js` -- `defaultPaths` shape (claudeSettings, ccstatuslineSettings, readerDest, readerDir) + the 7 targets that define "healthy"; `defaults.js getStatusLineConfig()` = the `npx -y ccstatusline@latest` command.
- `bin/cli.js` -- command `switch` + `USAGE`.
- `src/tui/app.js` -- screen router + `navigate`; `paths` lives in `App` scope (not yet in `screenProps`); `onLaunchCcstatusline` shows the exit-then-run precedent (not reused here).
- `src/tui/screens/HomeScreen.js` -- `HOME_OPTIONS`, `SELECTABLE_INDICES`, Enter dispatch.
- `src/tui/screens/ContextPctConfigScreen.js` + `components/ScreenLayout.js` -- screen scaffold (ScreenLayout, useInput, shortcuts) to copy for the new screen.
- `test/clean.test.js` (captureOutput + tmp dirs) and `test/tui-monitor.test.js` (ink-testing-library) -- test harnesses to mirror.

## Tasks & Acceptance

**Execution:**
- [x] `src/doctor.js` -- create. Export async `runHealthCheck(paths = defaultPaths, runStatusline = defaultRunStatusline)` → structured results (see Boundaries). `defaultPaths` extends install's shape with `npxCacheDir` (default `process.env.BMAD_NPX_CACHE_DIR` || platform npm `_npx` dir: `AppData/Local/npm-cache/_npx` on win32 else `~/.npm/_npx`). Read-only checks: reader+cjs deployed, `config.json` parses, `statusLine` key present, ≥1 `bmad-line-*` widget. Functional check: `runStatusline()`→`{ok,error}` (default spawns `npx -y ccstatusline@latest`, feeds minimal statusline JSON on stdin, ok=exit 0). On functional fail: delete `npxCacheDir` subdirs whose `_npx.packages` includes a `ccstatusline` spec, re-run once. Default export `doctor(paths)` = CLI wrapper: await core, print each check via cli-utils helpers, `process.exit(1)` if !healthy.
- [x] `bin/cli.js` -- add `doctor` to the dynamic-import command group + a `doctor   Diagnose and repair the status line` line in `USAGE`.
- [x] `src/tui/screens/HealthCheckScreen.js` -- create. Props from `screenProps` plus `paths` and injectable `runHealthCheck` (default real). `useEffect` runs the check once on mount → state `{loading, results}`; while loading render `@inkjs/ui` `Spinner` "Running checks…"; then render one `✓/✗` row per check (green/red) with detail. Wrap in `ScreenLayout`. `useInput`: `[Esc]`→`goBack()`, `r`→re-run.
- [x] `src/tui/screens/HomeScreen.js` -- add option `{ label: '🩺 Run health check', value: 'doctor' }` (after the ccstatusline entry) and Enter branch `navigate('healthCheck')`.
- [x] `src/tui/app.js` -- import `HealthCheckScreen`, add router branch `if (screen === 'healthCheck') return e(HealthCheckScreen, { ...screenProps, paths })`.
- [x] `test/doctor.test.js` -- create. Inject `paths` (tmp dirs) + fake `runStatusline`; cover every I/O Matrix row, asserting check statuses, `healthy`, that broken-cache repair deletes only ccstatusline `_npx` dirs (a planted non-ccstatusline entry survives), and CLI exit behavior.
- [x] `test/tui-health-check.test.js` -- create (ink-testing-library). Inject a fake `runHealthCheck`; assert Spinner shows while pending and ✓/✗ rows render after resolve.
- [x] `README.md` -- document the `doctor` command and the home-screen "Run health check" button.

**Acceptance Criteria:**
- Given a healthy install, when `npx bmad-statusline doctor` runs, then every check prints ✓ and the process exits 0.
- Given a broken `ccstatusline@latest` npx cache (otherwise healthy), when `doctor` runs, then only the offending cache dir is deleted, the re-check passes (`repaired`), and exit is 0.
- Given the functional check still fails after purge, when `doctor` runs, then it prints ✗ with a reinstall hint and exits 1.
- Given the TUI home, when "Run health check" is selected, then a screen opens showing a spinner during the npx run, then ✓/✗ rows, with `[Esc]` returning home and `r` re-running.

## Verification

**Commands:**
- `node --test test/doctor.test.js test/tui-health-check.test.js` -- expected: all pass.
- `npm test` -- expected: full suite green (no regression in cli.test.js / tui-app.test.js).
- `node bin/cli.js doctor` -- expected: prints health report; exits 0 on this (healthy) machine.

## Suggested Review Order

**Shared core (the design lives here)**

- Entry point: the structured-result contract both CLI and TUI consume.
  [`doctor.js:112`](../../src/doctor.js#L112)
- Functional check — win32 shell vs posix args, stdin EPIPE guard, 60s timeout.
  [`doctor.js:37`](../../src/doctor.js#L37)
- Safe repair — deletes only `_npx` dirs whose `_npx.packages` reference ccstatusline.
  [`doctor.js:80`](../../src/doctor.js#L80)
- Default paths honor `BMAD_CONFIG_DIR` to match where the reader actually reads.
  [`doctor.js:23`](../../src/doctor.js#L23)
- statusLine check now requires a truthy object (rejects `null` false-pass).
  [`doctor.js:132`](../../src/doctor.js#L132)

**CLI surface**

- CLI wrapper: prints each check, exits 1 only when unhealthy.
  [`doctor.js:176`](../../src/doctor.js#L176)
- Wired into the dynamic-import command group + USAGE.
  [`cli.js:42`](../../bin/cli.js#L42)

**TUI surface**

- Screen: runs the check on mount, Spinner while pending, ✓/✗ rows, `r` re-run / `Esc` back.
  [`HealthCheckScreen.js:22`](../../src/tui/screens/HealthCheckScreen.js#L22)
- Router now threads `paths` through so the TUI checks the configured dir.
  [`app.js:156`](../../src/tui/app.js#L156)
- Home-screen entry + Enter dispatch to the new screen.
  [`HomeScreen.js:24`](../../src/tui/screens/HomeScreen.js#L24)

**Tests & docs (supporting)**

- Core tests: every I/O-matrix row, selective purge, CLI exit behavior.
  [`doctor.test.js:50`](../../test/doctor.test.js#L50)
- Screen tests: spinner-while-pending, ✓/✗ rows after resolve.
  [`tui-health-check.test.js:26`](../../test/tui-health-check.test.js#L26)
- README: `doctor` command + home-screen button.
  [`README.md:172`](../../README.md#L172)
