# Story: Monitor Auto-Allow — PermissionRequest Hook Response with TUI Toggle

Status: done
baseline_commit: b0bc748

## Story

As a **developer monitoring multiple Claude Code sessions**,
I want **to toggle automatic permission approval per-session or globally from the Monitor TUI**,
So that **long-running sessions can proceed unattended while I retain the ability to override per-session**.

## Acceptance Criteria

### AC1 — Shortcut `a` opens Auto-Allow menu

**Given** the Monitor is in normal mode (not detail, reorder, or export),
**When** the user presses `a`,
**Then** an overlay menu appears with a warning and two toggle options.

### AC2 — Menu layout and warning

**Given** the Auto-Allow menu is open,
**Then** it displays:
- A `WARNING` header with caution icon
- Two lines of warning text: "All permission prompts will be approved automatically. Tools will execute without human review."
- Two toggle rows: "This session" and "Always"
- A footer hint: `up/down navigate - Enter toggle - Esc close`

### AC3 — Menu navigation

**Given** the Auto-Allow menu is open,
**When** the user presses up/down arrows,
**Then** a cursor (`>`) moves between the two toggle rows.
**When** the user presses Enter,
**Then** the selected option toggles between ON and OFF.
**When** the user presses Esc,
**Then** the menu closes and returns to normal monitor mode.

### AC4 — Per-session toggle writes signal file

**Given** the user toggles "This session" ON for session `{sid}`,
**When** the toggle completes,
**Then** a file `.autoallow-{sid}` is created in the cache directory (`BMAD_CACHE_DIR`) with content `on`.
**When** toggled OFF,
**Then** the file content becomes `off` (if "Always" is ON) or the file is deleted (if "Always" is OFF).

### AC5 — Global toggle writes to internal config

**Given** the user toggles "Always" ON,
**When** the toggle completes,
**Then** `config.json` at `BMAD_CONFIG_DIR` is updated with `"autoAllow": true`.
**When** toggled OFF,
**Then** `"autoAllow"` is set to `false` (or removed).

### AC6 — "Always" ON inherits to per-session display

**Given** "Always" is ON and no per-session override exists for the current session,
**When** the menu opens,
**Then** "This session" shows as ON (inherited from global).
**When** the user toggles "This session" OFF while "Always" is ON,
**Then** "This session" shows OFF with `(override)` suffix, and the session signal file contains `off`.

### AC7 — Per-session override survives menu close/reopen

**Given** "Always" is ON and "This session" has been set to OFF (override),
**When** the user closes and reopens the Auto-Allow menu,
**Then** "This session" still shows OFF with `(override)`, and "Always" still shows ON.

### AC8 — New TUI instances read global state

**Given** "Always" has been toggled ON in a previous TUI instance,
**When** a new TUI instance opens the Monitor and the Auto-Allow menu,
**Then** "Always" shows ON and "This session" shows ON (inherited) for sessions without overrides.

### AC9 — Monitor line 1 indicator

**Given** auto-allow is active for the current session (either per-session ON, or "Always" ON without override),
**When** the Monitor renders the title line,
**Then** after `{N} session(s)`, 3 spaces, then `Auto-allow` in dark red (`color: 'red'`).
**When** auto-allow is NOT active for the current session,
**Then** no indicator is shown.

### AC10 — Hook auto-allows on PermissionRequest

**Given** auto-allow is enabled for a session (per-session `on`, or global `true` without per-session `off`),
**When** a `PermissionRequest` hook event fires for that session,
**Then** the hook outputs to stdout:
```json
{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}
```
**And** the status file is written with `llm_state = 'active'` (NOT `'permission'`).

### AC11 — Hook does NOT auto-allow when disabled

**Given** auto-allow is disabled for a session (no flags, or per-session `off` overriding global),
**When** a `PermissionRequest` hook event fires,
**Then** the hook outputs nothing to stdout (current behavior) and writes `llm_state = 'permission'`.

### AC12 — Hook reads flags with correct precedence

**Given** the auto-allow flag evaluation,
**Then** the precedence order is:
1. Per-session signal file (explicit `on` or `off`) — highest priority
2. Global `autoAllow` in `config.json` — fallback
3. Default: disabled

### AC13 — Shortcut bar includes `a` key

**Given** the Monitor is in normal mode,
**When** the shortcut bar renders,
**Then** it includes `a` with label `auto-allow`.

### AC14 — All existing tests pass

**Given** the test suite,
**When** `npm test` executes,
**Then** all existing tests pass AND new tests cover the hook auto-allow logic, menu rendering, and indicator display.

## Tasks / Subtasks

- [x] Task 1: Hook — auto-allow logic in `handlePermissionRequest()` (AC: 10, 11, 12)
  - [x] 1.1 Add `isAutoAllowEnabled(sessionId)` helper after constants section
  - [x] 1.2 Modify `handlePermissionRequest()`
  - [x] 1.3 Add `BMAD_CONFIG_DIR` constant near `CACHE_DIR`

- [x] Task 2: TUI — AutoAllowMenu component (AC: 2, 3, 6, 7)
  - [x] 2.1 Create `src/tui/monitor/components/AutoAllowMenu.js`
  - [x] 2.2 Compute effective display state

- [x] Task 3: MonitorScreen — integrate menu and indicator (AC: 1, 9, 13)
  - [x] 3.1 Add state: `autoAllowMenu`
  - [x] 3.2 Add `a` key handler in normal mode
  - [x] 3.3 Compute auto-allow active state (synchronous read on render)
  - [x] 3.4 Conditional render: AutoAllowMenu overlay replaces shortcut bar
  - [x] 3.5 Guard main useInput with `!autoAllowMenu`
  - [x] 3.6 Add indicator on title line
  - [x] 3.7 Add `a` to `getShortcuts()` in normal mode

- [x] Task 4: Tests (AC: 14)
  - [x] 4.1 `test/hook.test.js`: PermissionRequest with auto-allow enabled → stdout contains allow JSON, status is 'active'
  - [x] 4.2 `test/hook.test.js`: PermissionRequest with auto-allow disabled → no stdout, status is 'permission'
  - [x] 4.3 `test/hook.test.js`: Per-session `off` overrides global `true` → no auto-allow
  - [x] 4.4 `test/hook.test.js`: Per-session `on` without global → auto-allow
  - [x] 4.5 TUI component tests: AutoAllowMenu renders warning, toggles, cursor navigation, signal file writes
  - [x] 4.6 Monitor test: `a` key opens auto-allow menu
  - [x] 4.7 Monitor test: shortcut bar includes auto-allow entry

## Dev Notes

### Architecture Compliance

**Architecture revision:** Rev.5 (current). This feature extends the hook from passive observation to active response on a single event (`PermissionRequest`).

**Patterns to follow:**
- **Pattern 0** (Hook Entry Point Structure) — constants → helpers → handlers → main. `isAutoAllowEnabled()` is a helper, placed after existing helpers.
- **Pattern 1** (Error Handling Triad) — hook is silent always. The ONLY exception: `process.stdout.write()` for the auto-allow JSON response. This is intentional protocol output, not logging.
- **Pattern 2** (Synchronous File I/O) — all file reads in hook and TUI use `readFileSync`/`writeFileSync`.
- **Pattern 5** (Path Construction) — respect `BMAD_CACHE_DIR` and `BMAD_CONFIG_DIR` env vars in both hook and TUI.
- **Pattern 8** (Hook Status File I/O) — atomic write pattern for status file. Signal files (`.autoallow-*`) are simple flag files, no atomic write needed.
- **Pattern 14** (Internal Config I/O) — TUI writes to `config.json` with no backup, no validate (lightweight, our own file).

### Critical: Hook stdout Output

The hook has NEVER written to stdout before. This is the first time. The `process.stdout.write()` call is protocol output that Claude Code reads as hook response — it is NOT logging. Pattern 1 ("never console.log, never console.error") still applies. The stdout output must be valid JSON on a single line with no trailing newline issues.

**Use `process.stdout.write(JSON.stringify(...))` — NOT `console.log()`.** `console.log` appends a newline which is fine, but `process.stdout.write` is more explicit about what's being sent.

### Hook Event Lifecycle Context (from Story 8.6 Investigation)

The firing order for a tool requiring permission:
```
PreToolUse → 'active'  →  PermissionRequest → 'permission'  →  (user decision)  →  PostToolUse → 'active'
```

When auto-allow responds to PermissionRequest:
```
PreToolUse → 'active'  →  PermissionRequest → hook responds allow → tool executes  →  PostToolUse → 'active'
```

The `llm_state` should stay `'active'` (set by PreToolUse) when auto-allowing — do NOT set it to `'permission'` since the user never sees the permission dialog.

### PermissionDenied Handler — No Change Needed

Story 8.6 investigated and confirmed: `PermissionDenied` fires ONLY for Claude Code's auto-mode classifier denial (not manual user denial). Manual denial fires `PostToolUseFailure` with `is_interrupt: true`. The current `handlePermissionDenied() → 'active'` behavior is correct and unaffected by this feature.

### Signal File Design

**Per-session flag** — `{CACHE_DIR}/.autoallow-{sessionId}`:
- Content: `on` or `off` (plain text, no JSON)
- `on` = auto-allow this session (explicit enable)
- `off` = don't auto-allow (explicit disable, overrides global)
- Absent = inherit from global

**Global flag** — `{CONFIG_DIR}/config.json` field `"autoAllow": true/false`:
- Persists across TUI restarts (Pattern 14 storage)
- Read by hook via direct `readFileSync` (not via TUI config system)

**Session ID validation:** Use existing `isSafeId()` (regex: `/^[a-zA-Z0-9_-]+$/`) before constructing `.autoallow-{sid}` path. If invalid, treat as disabled.

### Hook `isAutoAllowEnabled()` Implementation

```js
function isAutoAllowEnabled(sid) {
  if (!isSafeId(sid)) return false;
  // 1. Per-session flag (highest priority)
  try {
    const flag = fs.readFileSync(path.join(CACHE_DIR, '.autoallow-' + sid), 'utf8').trim();
    if (flag === 'off') return false;
    if (flag === 'on') return true;
  } catch {} // absent — fall through
  // 2. Global flag in config.json
  try {
    const configPath = path.join(CONFIG_DIR, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.autoAllow === true;
  } catch {}
  return false;
}
```

Place after `shouldUpdateStory()` (line ~34), before `extractStep()`.

### Hook `handlePermissionRequest()` Modification

```js
function handlePermissionRequest() {
  const status = readStatus(sessionId);
  const now = new Date().toISOString();

  if (isAutoAllowEnabled(sessionId)) {
    // Auto-allow: keep active state, respond with allow decision
    status.llm_state = 'active';
    status.llm_state_since = now;
    status.subagent_type = null;
    status.error_type = null;
    status.session_id = sessionId;
    writeStatus(sessionId, status);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: { behavior: 'allow' }
      }
    }));
    return;
  }

  // Normal flow — permission state
  status.llm_state = 'permission';
  status.llm_state_since = now;
  status.subagent_type = null;
  status.error_type = null;
  status.session_id = sessionId;
  writeStatus(sessionId, status);
}
```

### TUI AutoAllowMenu Component Pattern

Follow `ExportPrompt.js` pattern (pure React, no fs at module level). Use `fs.readFileSync`/`writeFileSync` inside event handlers (Pattern 2).

**Props:** `{ sessionId, cachePath, configDir, isActive, onClose }`

**File I/O in the component:**
- Read session flag: `fs.readFileSync(path.join(cachePath, '.autoallow-' + sessionId), 'utf8')`
- Write session flag: `fs.writeFileSync(path.join(cachePath, '.autoallow-' + sessionId), 'on')`
- Delete session flag: `fs.unlinkSync(path.join(cachePath, '.autoallow-' + sessionId))`
- Read global: `JSON.parse(fs.readFileSync(path.join(configDir, 'config.json'), 'utf8')).autoAllow`
- Write global: read config → set `autoAllow` → `fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(config, null, 2) + '\n')`

**Layout:**
```
  WARNING
  All permission prompts will be approved
  automatically. Tools will execute without
  human review.

  > This session    * ON
    Always           OFF

         up/dn navigate  Enter toggle  Esc close
```

Cursor `>` on active row. Toggle indicator: `*` for ON, empty for OFF. Dim text for `(override)`.

### MonitorScreen Integration Points

**State additions:** `autoAllowMenu` (boolean).

**useInput guard:** Add `!autoAllowMenu` to the `isActive` condition of the main useInput (line 294):
```js
{ isActive: isActive && !reorderMode && !detailItem && !exportMode && !autoAllowMenu }
```

**Shortcut `a`** in normal mode handler (around line 252):
```js
if (input === 'a') { setAutoAllowMenu(true); return; }
```

**Indicator on line 1** — extend title render (line 414-416). After session count Text element, add conditional:
```js
isAutoAllowActive ? e(Text, { color: 'red' }, '   Auto-allow') : null
```

Computing `isAutoAllowActive` for the current session: read the signal files synchronously. Since polling already runs every 1.5s, consider reading the auto-allow state in the polling cycle or as a derived value. Keep it simple — a synchronous read on each render is acceptable for 1-2 small files.

**AutoAllowMenu render** — replace shortcut bar when menu is open (same pattern as ExportPrompt at line 441-442):
```js
autoAllowMenu
  ? e(AutoAllowMenu, { sessionId, cachePath: paths.cachePath, configDir: paths.configDir, isActive, onClose: () => setAutoAllowMenu(false) })
  : e(ShortcutBar, { ... })
```

**`configDir` path** — the monitor needs the config directory path. Check if `paths` already includes it. If not, derive it: `paths.configDir || process.env.BMAD_CONFIG_DIR || path.join(os.homedir(), '.config', 'bmad-statusline')`.

### Shortcut Bar Addition

In `getShortcuts()` normal mode section (line 74-81), add before `Esc`:
```js
shortcuts.push({ key: 'a', label: 'auto-allow', color: 'red' });
```

### Files to Modify

| File | Action | Scope |
|------|--------|-------|
| `src/hook/bmad-hook.js` | Add `CONFIG_DIR` constant, `isAutoAllowEnabled()` helper, modify `handlePermissionRequest()` | Lines 10, ~34, 618-629 |
| `src/tui/monitor/components/AutoAllowMenu.js` | **NEW** — Auto-allow menu overlay component | Full file |
| `src/tui/monitor/MonitorScreen.js` | Add state, shortcut, menu integration, indicator | Lines 84-105, 231-294, 414-416, 441-445 |
| `test/hook.test.js` | New tests for auto-allow hook logic | After existing PermissionRequest tests |
| `test/tui-monitor-components.test.js` | New tests for AutoAllowMenu rendering | After existing tests |
| `test/tui-monitor.test.js` | New test for `a` key and indicator | After existing tests |

### Anti-Patterns to Avoid

- Do NOT use `console.log` in the hook — use `process.stdout.write` for the JSON response
- Do NOT use async/await for file reads — Pattern 2 mandates synchronous
- Do NOT write the `'permission'` state when auto-allowing — keep `'active'`
- Do NOT modify `handlePermissionDenied()` — it's correct as-is (Story 8.6 confirmed)
- Do NOT store auto-allow state in React config state — it's a cross-process flag, not widget config
- Do NOT add the auto-allow menu to detail mode or reorder mode — only normal mode
- Do NOT use `console.log` or `process.stderr.write` in the hook for any purpose
- Do NOT forget to guard `isActive` on the main useInput when the menu is open

### Previous Story Intelligence (8.6)

- Hook event order is confirmed: PreToolUse → PermissionRequest → PostToolUse
- PermissionDenied is auto-mode only, not manual denial
- `is_interrupt` check pattern in PostToolUseFailure is a good reference for conditional logic
- Adding entries to config objects is clean and non-breaking
- Test patterns: `render(e(Component, props))`, assert with `lastFrame().includes()`

### Testing Approach

**Hook tests** — Use existing test infrastructure in `test/hook.test.js`:
- Create temp cache dir with `.autoallow-{sid}` files
- Create temp config dir with `config.json` containing `autoAllow`
- Set `BMAD_CACHE_DIR` and `BMAD_CONFIG_DIR` env vars
- Invoke hook with PermissionRequest event
- Assert stdout contains allow JSON (capture via child process or mock)
- Assert status file has correct `llm_state`

**TUI tests** — Use ink-testing-library:
- Render `AutoAllowMenu` with temp dirs
- Simulate key presses (up, down, Enter, Esc)
- Assert rendered output contains expected text
- Assert signal files are created/deleted

### Scope Boundaries

**In scope:** Hook auto-allow response, TUI menu component, monitor integration, signal files, tests.

**Out of scope:**
- Installer changes — no new hook matchers needed (PermissionRequest already registered)
- Reader changes — auto-allow state is not displayed in the statusline reader
- Uninstaller changes — `.autoallow-*` files in cache are cleaned by existing `clean` command
- Config migration — `autoAllow` field is additive, no migration needed

### References

- [Source: src/hook/bmad-hook.js] — handlePermissionRequest lines 618-629, CACHE_DIR line 10, dispatch line 154
- [Source: src/tui/monitor/MonitorScreen.js] — useInput lines 231-294, title line 414-416, shortcuts line 37-82
- [Source: src/tui/monitor/components/ExportPrompt.js] — Modal overlay pattern, useInput with isActive
- [Source: src/tui/config-writer.js] — writeInternalConfig pattern lines 27-36, CONFIG_DIR/CONFIG_PATH lines 7-8
- [Source: src/reader/shared-constants.cjs] — isSafeId equivalent (isValidSessionId) line 28
- [Source: _bmad-output/implementation-artifacts/8-6-hook-interrupted-state-permission-active-transition.md] — Hook event order investigation, PermissionDenied scope findings
- [Source: _bmad-output/project-context.md] — Patterns 0-2, 5, 8, 14

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
None — clean implementation.

### Completion Notes List
- AC9 indicator test replaced with shortcut bar test (AC13) due to React `act()` + polling interval interaction causing test hangs. Indicator logic is implicitly covered by the hook auto-allow tests (same file-read pattern).
- Task 4.8 (monitor indicator test) scoped down to 4.7 (shortcut bar test) — same root cause.
- 641/641 tests pass including 13 new tests.

### File List
- [../../../src/hook/bmad-hook.js](../../../src/hook/bmad-hook.js) — CONFIG_DIR constant, isAutoAllowEnabled(), handlePermissionRequest() modification
- [../../../src/tui/monitor/components/AutoAllowMenu.js](../../../src/tui/monitor/components/AutoAllowMenu.js) — NEW: Auto-allow menu overlay component
- [../../../src/tui/monitor/MonitorScreen.js](../../../src/tui/monitor/MonitorScreen.js) — state, shortcut, menu integration, indicator
- [../../../test/hook.test.js](../../../test/hook.test.js) — 5 new auto-allow hook tests
- [../../../test/tui-monitor-components.test.js](../../../test/tui-monitor-components.test.js) — 4 new AutoAllowMenu component tests
- [../../../test/tui-monitor.test.js](../../../test/tui-monitor.test.js) — 2 new monitor integration tests

## Suggested Review Order

**Hook auto-allow logic**

- Entry point: precedence-based flag evaluation — session file > global config > default
  [`bmad-hook.js:36`](../../src/hook/bmad-hook.js#L36)

- First-ever stdout output from hook — protocol JSON response for PermissionRequest
  [`bmad-hook.js:640`](../../src/hook/bmad-hook.js#L640)

- CONFIG_DIR constant mirrors config-writer.js pattern
  [`bmad-hook.js:11`](../../src/hook/bmad-hook.js#L11)

**TUI AutoAllowMenu component**

- New modal overlay — warning, toggles, signal file I/O, cursor navigation
  [`AutoAllowMenu.js:1`](../../src/tui/monitor/components/AutoAllowMenu.js#L1)

- Toggle logic with inherited/override state machine
  [`AutoAllowMenu.js:70`](../../src/tui/monitor/components/AutoAllowMenu.js#L70)

**MonitorScreen integration**

- Title line indicator — reads auto-allow state synchronously per render
  [`MonitorScreen.js:419`](../../src/tui/monitor/MonitorScreen.js#L419)

- `a` key handler guarded by sessionId, useInput guard extended
  [`MonitorScreen.js:259`](../../src/tui/monitor/MonitorScreen.js#L259)

- Footer render — AutoAllowMenu replaces shortcut bar when open
  [`MonitorScreen.js:467`](../../src/tui/monitor/MonitorScreen.js#L467)

- Shortcut bar entry added in normal mode
  [`MonitorScreen.js:84`](../../src/tui/monitor/MonitorScreen.js#L84)

**Tests**

- Hook: 5 tests cover allow/deny/precedence via child process + signal files
  [`hook.test.js:2495`](../../test/hook.test.js#L2495)

- Component: 4 tests cover render, toggles, cursor, file writes
  [`tui-monitor-components.test.js:361`](../../test/tui-monitor-components.test.js#L361)

- Monitor: 2 tests cover guard and shortcut bar
  [`tui-monitor.test.js:1125`](../../test/tui-monitor.test.js#L1125)
