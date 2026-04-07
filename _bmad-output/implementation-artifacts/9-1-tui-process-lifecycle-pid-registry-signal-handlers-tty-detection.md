# Story 9.1: TUI Process Lifecycle — PID Registry, Signal Handlers, TTY Detection

Status: ready-for-dev

## Story

As a developer running one or more TUI instances,
I want orphaned TUI processes to be automatically cleaned up,
So that closing terminals or crashing doesn't leave zombie Node.js processes consuming resources.

## Acceptance Criteria

### AC1: PID Registration on Startup

**Given** the TUI starts
**When** `launchTui()` is called in `app.js`
**Then** the current PID is registered in `tui-pids.json` in the cache directory (`BMAD_CACHE_DIR` / `~/.cache/bmad-status/`)
**And** before registering, all existing PIDs in the registry are checked for liveness via `process.kill(pid, 0)`
**And** dead PIDs (orphans from previous crashes) are removed from the registry
**And** the registry file is written atomically (tmp + rename, Pattern 22)

### AC2: Multi-instance Coexistence

**Given** multiple TUI instances are running simultaneously
**When** a new instance starts
**Then** it does NOT kill or interfere with existing live instances
**And** only dead PIDs are purged from the registry
**And** all live instances coexist without conflict

### AC3: Normal Exit (User Quit)

**Given** the TUI exits normally (user presses `q` or Esc from HomeScreen)
**When** the quit handler fires
**Then** the current PID is removed from `tui-pids.json`
**And** the config is flushed (existing debounce behavior preserved)
**And** the alternate screen buffer is restored

### AC4: Signal-based Termination

**Given** the TUI receives SIGINT, SIGTERM, or SIGHUP
**When** the signal handler fires
**Then** the current PID is removed from `tui-pids.json`
**And** the alternate screen buffer is restored
**And** the process exits cleanly via `process.exit()`

### AC5: Exception Handling

**Given** an uncaught exception or unhandled rejection occurs
**When** the error handler fires
**Then** the current PID is removed from `tui-pids.json`
**And** the alternate screen buffer is restored
**And** the process exits with code 1

### AC6: TTY Orphan Detection (Windows Terminal Close)

**Given** the user closes the terminal window (no signal delivered on Windows)
**When** the periodic TTY check runs (every 5-10 seconds)
**Then** `process.stdout.isTTY` returns falsy
**And** the TUI initiates graceful shutdown: removes PID from registry, restores screen buffer, exits

### AC7: Test Coverage

**Given** tests are executed
**Then** tests exist for: PID registration on startup, dead PID cleanup, PID removal on normal exit, PID removal on signal, TTY detection triggering exit, multi-instance coexistence, atomic write of registry file
**And** all existing tests pass (`npm test`)

## Tasks / Subtasks

- [ ] Task 1: Create PID lifecycle module (AC: #1, #2)
  - [ ] 1.1 Create `src/tui/tui-lifecycle.js` — ESM module with `loadRegistry`, `saveRegistry`, `registerPid`, `unregisterPid`
  - [ ] 1.2 Registry path: `path.join(cachePath, 'tui-pids.json')` using Pattern 5 (`BMAD_CACHE_DIR`)
  - [ ] 1.3 Atomic write: tmp + `fs.renameSync` (Pattern 22)
  - [ ] 1.4 Liveness check: `process.kill(pid, 0)` to purge dead PIDs on startup
  - [ ] 1.5 `unregisterPid()` must be idempotent (safe to call multiple times)
- [ ] Task 2: Signal handlers and TTY detection (AC: #4, #5, #6)
  - [ ] 2.1 Add `setupSignalHandlers(cachePath)` — registers SIGINT, SIGTERM, SIGHUP, uncaughtException, unhandledRejection
  - [ ] 2.2 Add `startTtyWatch()` — `setInterval` (5s) checking `process.stdout.isTTY`, with `.unref()`
  - [ ] 2.3 Each handler calls `unregisterPid()` then `restoreScreen()` then `process.exit(code)`
  - [ ] 2.4 Export `stopTtyWatch()` for cleanup on normal exit
- [ ] Task 3: Integrate into `launchTui()` in `app.js` (AC: #1, #3, #4, #5, #6)
  - [ ] 3.1 Call `registerPid(cachePath)` BEFORE `inkRender()`
  - [ ] 3.2 Call `setupSignalHandlers(cachePath)` BEFORE `inkRender()`
  - [ ] 3.3 Call `startTtyWatch(cachePath)` BEFORE `inkRender()`
  - [ ] 3.4 On normal exit path (`waitUntilExit`): call `unregisterPid(cachePath)` and `stopTtyWatch()`
  - [ ] 3.5 Update `onQuit` callback in `app.js` (line 113) to also call `unregisterPid` (defense-in-depth alongside Task 3.4)
- [ ] Task 4: Tests (AC: #7)
  - [ ] 4.1 Create `test/tui-lifecycle.test.js`
  - [ ] 4.2 Test: registerPid writes PID to registry file
  - [ ] 4.3 Test: registerPid purges dead PIDs (mock dead PID entry, verify removed)
  - [ ] 4.4 Test: unregisterPid removes current PID from registry
  - [ ] 4.5 Test: unregisterPid is idempotent (call twice, no error)
  - [ ] 4.6 Test: multi-instance coexistence (register two PIDs, both survive)
  - [ ] 4.7 Test: atomic write produces valid JSON (no corruption on concurrent write)
  - [ ] 4.8 Test: TTY watch triggers shutdown when isTTY goes falsy
  - [ ] 4.9 Verify all existing tests pass (`npm test`)

## Dev Notes

### Architecture Patterns (MUST follow)

**Pattern 2 — Synchronous fs everywhere.** All file I/O uses `fs.readFileSync` / `fs.writeFileSync`. No async, no promises, no callbacks. Load-bearing rule preventing race conditions.

**Pattern 5 — Path construction.** Cache directory: `process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status')`. The `cachePath` is already computed in `app.js:32` — reuse it.

**Pattern 22 — Atomic write.** Write to `.tmp`, then `fs.renameSync()`. Prevents corruption if two instances start simultaneously.

**Pattern 28 — TUI Process Lifecycle Management.** Three complementary mechanisms: PID registry, signal handlers, TTY orphan detection. This is the pattern being implemented.

### PID Registry Design (from Architecture Rev.5)

Registry file: `tui-pids.json` in cache directory. Format: `{ "pids": [number, ...] }`.

```js
// Architecture reference — Pattern 28
function loadRegistry() {
  try { return JSON.parse(fs.readFileSync(registryPath, 'utf8')); }
  catch { return { pids: [] }; }
}

function saveRegistry(registry) {
  try {
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    const tmp = registryPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(registry, null, 2));
    fs.renameSync(tmp, registryPath);
  } catch { /* best-effort — lifecycle is non-critical */ }
}

function registerPid() {
  const registry = loadRegistry();
  registry.pids = registry.pids.filter(pid => {
    try { process.kill(pid, 0); return true; }
    catch (e) { return e.code !== 'ESRCH'; } // EPERM = alive but different user
  });
  registry.pids.push(process.pid);
  saveRegistry(registry);
}

function unregisterPid() {
  const registry = loadRegistry();
  registry.pids = registry.pids.filter(pid => pid !== process.pid);
  saveRegistry(registry);
}
```

### Signal Handler Design (from Architecture Rev.5)

Register BEFORE `inkRender()`. Graceful shutdown sequence: `unregisterPid()` -> `restoreScreen()` -> `process.exit(code)`.

```js
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('SIGHUP', gracefulShutdown);
process.on('uncaughtException', () => { unregisterPid(); restoreScreen(); process.exit(1); });
process.on('unhandledRejection', () => { unregisterPid(); restoreScreen(); process.exit(1); });
```

SIGINT handler coexists with Ink's internal SIGINT handling — Ink calls `process.exit()` which triggers the `exit` event listener (existing screen restore).

### TTY Orphan Detection Design (from Architecture Rev.5)

Critical for Windows where terminal close doesn't deliver signals.

```js
const ttyCheckId = setInterval(() => {
  if (!process.stdout.isTTY) {
    clearInterval(ttyCheckId);
    unregisterPid();
    try { restoreScreen(); } catch {} // TTY may already be gone
    process.exit();
  }
}, 5000);
ttyCheckId.unref(); // Don't block Node.js natural exit
```

### Critical Rules

- **Never `process.kill(pid, 9)` live instances** — only purge entries where `process.kill(pid, 0)` throws
- **Liveness check must handle EPERM** — use `catch (e) { return e.code !== 'ESRCH'; }` not bare `catch { return false; }`, consistent with `monitor-utils.js:isProcessAlive`. EPERM means process is alive but owned by another user.
- **Register signal handlers BEFORE `inkRender()`** — not after
- **`ttyCheckId.unref()`** — interval must not prevent natural Node.js exit
- **`unregisterPid()` must be idempotent** — safe to call from multiple exit paths
- **Atomic write always** — never direct `writeFileSync` to `tui-pids.json`
- **Cache dir may not exist** — `saveRegistry` must `mkdirSync({ recursive: true })` before writing (first-ever TUI run may precede hook creating the cache dir)
- **On Windows, `fs.renameSync` may throw EPERM/EACCES** if another instance is reading the file. Wrap in try/catch — lifecycle writes are best-effort, not critical path.
- **TTY watch `restoreScreen()` must be wrapped in try/catch** — when the terminal is gone, writing escape codes to stdout will throw

### Current `launchTui()` State (app.js:163-180)

The current code does:
1. Enter alternate screen buffer (`\x1b[?1049h`)
2. `process.on('exit', restoreScreen)` — only screen restore
3. `inkRender()` + `waitUntilExit()`
4. Restore screen + remove exit listener
5. Optional ccstatusline launch

**What to add (in order):**
1. Before `process.stdout.write('\x1b[?1049h')`: call `registerPid(cachePath)`, `setupSignalHandlers(cachePath, restoreScreen)`, `startTtyWatch(cachePath, restoreScreen)`
2. After `instance.waitUntilExit()`: call `unregisterPid(cachePath)`, `stopTtyWatch()`

The `restoreScreen` function needs to be accessible to signal handlers. Define it before registering handlers.

### Existing Code to Reuse (DO NOT reinvent)

- **`isProcessAlive(pid)`** already exists in `src/tui/monitor/monitor-utils.js:15-18` — same `process.kill(pid, 0)` pattern. The lifecycle module implements its own inline version since monitor-utils is a different concern (cache I/O isolation, Pattern 23).
- **`cachePath`** already computed in `app.js:32` — pass it to lifecycle functions.
- **`restoreScreen`** already defined in `launchTui()` as `() => process.stdout.write('\x1b[?1049l')` — pass to signal handlers.

### Error Handling Philosophy

TUI error handling (Pattern 1): StatusMessage on error, never crash to terminal on recoverable errors. However, for `uncaughtException`/`unhandledRejection`, these are unrecoverable — exit with code 1 after cleanup.

For registry file operations: if `loadRegistry()` fails (corrupted JSON, missing file), return `{ pids: [] }` — silent fallback. `saveRegistry()` is already wrapped in try/catch (see code snippet) — process lifecycle is best-effort, not critical path. Similarly, wrap `registerPid()` and `unregisterPid()` calls in try/catch at call sites in `launchTui()` so a registry failure never blocks TUI startup or exit.

### Project Structure Notes

New file: `src/tui/tui-lifecycle.js` — ESM module, co-located with `app.js` in the TUI boundary.
New test: `test/tui-lifecycle.test.js` — mirrors `src/tui/` layout per project convention.

No changes needed to:
- `bin/cli.js` — TUI launch routing stays the same
- `src/defaults.js` — no new shared constants needed
- `src/reader/` — reader is unaffected
- `src/hook/` — hook is unaffected
- Monitor components — monitor reads `.alive-*` files, not `tui-pids.json`

### Testing Patterns (from Stories 8-4, 8-5)

- Use `node:test` + `node:assert/strict` (project standard)
- Isolated temp directories with `BMAD_CACHE_DIR` env var for file I/O tests
- No mocking of fs — use real file I/O with isolated dirs
- Clean up temp files in `afterEach` or test teardown
- Pre-existing test failures in "MonitorScreen — toggles" (3 tests) are known and not regressions

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 9, Story 9.1]
- [Source: _bmad-output/planning-artifacts/architecture.md — Pattern 22 (Atomic Write), Pattern 28 (TUI Process Lifecycle)]
- [Source: _bmad-output/planning-artifacts/architecture.md — Pattern 1 (Error Handling), Pattern 2 (Sync fs), Pattern 5 (Paths)]
- [Source: src/tui/app.js:163-180 — current launchTui() implementation]
- [Source: src/tui/monitor/monitor-utils.js:15-18 — isProcessAlive() reference pattern]
- [Source: _bmad-output/implementation-artifacts/8-5-monitor-badge-error-subagent-display.md — previous story learnings]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
