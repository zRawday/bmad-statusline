# Story 8.5: Monitor Badge — Error & Subagent Display

Status: review

## Story

As a developer monitoring active Claude Code sessions,
I want the Monitor TUI to display error and subagent LLM states in badges and tabs,
so that I can immediately see when a session has an error condition or is running a sub-agent.

## Acceptance Criteria

1. **LlmBadge renders ERROR state** — `LLM_BADGE_CONFIG` includes `error` entry with red background (`bgColor: 'redBright'`), white text (`color: 'white'`), icon `\u2B24`, label `'ERROR'`. Badge renders identically to permission/waiting badge style (background-colored block).
2. **LlmBadge renders SUBAGENT state** — `LLM_BADGE_CONFIG` includes `'active:subagent'` entry with cyan text (`color: 'cyan'`), no `bgColor`, icon `\u2B24`, label `'SUBAGENT'`. Badge renders identically to active/inactive style (text-only, dim when inactive pattern).
3. **SessionTabs shows ERROR icon** — `STATE_ICONS` map includes `error` with red-colored `\u2B24` icon.
4. **SessionTabs shows SUBAGENT icon** — `STATE_ICONS` map includes `'active:subagent'` with cyan-colored `\u2B24` icon.
5. **worstState aggregation correct** — Project-level badge correctly resolves when sessions include error or subagent states. `worstState()` already handles this via `LLM_STATE_PRIORITY` (no code change needed — verify only).
6. **All existing tests pass** — Zero regressions on current 4-state badge, tabs, and worstState tests.
7. **New tests cover error and subagent** — At minimum 2 new LlmBadge render tests + 2 new SessionTabs icon tests in `tui-monitor-components.test.js`.

## Tasks / Subtasks

- [x] Task 1: Update LlmBadge.js — add error + active:subagent to LLM_BADGE_CONFIG (AC: 1, 2)
  - [x] 1.1 Add `error` entry: `{ icon: '\u2B24', label: 'ERROR', bgColor: 'redBright', fgColor: 'white' }`
  - [x] 1.2 Add `'active:subagent'` entry: `{ icon: '\u2B24', label: 'SUBAGENT', color: 'cyan' }` (no bgColor)
  - [x] 1.3 Verify rendering: error uses bgColor path (lines 38-45), subagent uses text-only path (lines 29-35)
- [x] Task 2: Update SessionTabs.js — add error + active:subagent to STATE_ICONS (AC: 3, 4)
  - [x] 2.1 Add `error` to STATE_ICONS: `error: { icon: '\u2B24', color: 'red' }`
  - [x] 2.2 Add `'active:subagent'` to STATE_ICONS: `'active:subagent': { icon: '\u2B24', color: 'cyan' }`
- [x] Task 3: Add component tests in tui-monitor-components.test.js (AC: 7)
  - [x] 3.1 Test LlmBadge ERROR: render with state='error', assert red background and "ERROR" label
  - [x] 3.2 Test LlmBadge SUBAGENT: render with state='active:subagent', assert cyan text and "SUBAGENT" label
  - [x] 3.3 Test SessionTabs error icon: verify error state session shows red icon in tabs
  - [x] 3.4 Test SessionTabs subagent icon: verify subagent state session shows cyan icon
- [x] Task 4: Verify no regressions (AC: 5, 6)
  - [x] 4.1 Run full test suite: `node --test test/tui-monitor-components.test.js test/tui-monitor.test.js`
  - [x] 4.2 Verify worstState tests still pass — error, permission, active:subagent priority resolution confirmed

## Dev Notes

### What Story 8.4 Already Delivered (Foundation)

Story 8.4 added `LLM_STATE_PRIORITY` to `shared-constants.cjs` with all 6 states, bridged to ESM via `defaults.js`, and updated `monitor-utils.js` to import it. The reader already renders error (red bg) and subagent (cyan text). The `worstState()` and `computeDisplayState()` functions already handle all 6 states. **No changes needed to shared-constants, defaults, monitor-utils, or reader.**

### Files to Modify

| File | Action | Lines |
|------|--------|-------|
| `src/tui/monitor/components/LlmBadge.js` | Add 2 entries to `LLM_BADGE_CONFIG` | ~lines 9-14 |
| `src/tui/monitor/components/SessionTabs.js` | Add 2 entries to `STATE_ICONS` | ~lines 9-14 |
| `test/tui-monitor-components.test.js` | Add 4 new tests | after line 149 |

### LlmBadge.js — Current LLM_BADGE_CONFIG (lines 9-14)

```js
const LLM_BADGE_CONFIG = {
  active:     { icon: '\u2B24', label: 'ACTIVE',     bgColor: 'green',       color: 'white' },
  permission: { icon: '\u2B24', label: 'PERMISSION', bgColor: 'yellow',      color: 'black' },
  waiting:    { icon: '\u2B24', label: 'WAITING',    bgColor: 'blue',        color: 'white' },
  inactive:   { icon: '\u2B24', label: 'INACTIVE',   color: 'grey' },
};
```

**Add these 2 entries:**

```js
  error:              { icon: '\u2B24', label: 'ERROR',     bgColor: 'redBright',  color: 'white' },
  'active:subagent':  { icon: '\u2B24', label: 'SUBAGENT',  color: 'cyan' },
```

- `error` gets `bgColor` → uses background-colored rendering path (lines 38-45), matching permission/waiting pattern
- `'active:subagent'` has no `bgColor` → uses text-only rendering path (lines 29-35), matching inactive pattern but in cyan

### SessionTabs.js — Current STATE_ICONS (lines 9-14)

```js
const STATE_ICONS = {
  active:     { icon: '\u2B24', color: 'green' },
  permission: { icon: '\u2B24', color: 'yellow' },
  waiting:    { icon: '\u2B24', color: 'blueBright' },
  inactive:   { icon: '\u2B24', color: 'grey' },
};
```

**Add these 2 entries:**

```js
  error:              { icon: '\u2B24', color: 'red' },
  'active:subagent':  { icon: '\u2B24', color: 'cyan' },
```

### Rendering Paths in LlmBadge (no logic changes needed)

The component already handles both rendering paths:
- **With bgColor** (lines 38-45): `e(Box, { … }, e(Text, { backgroundColor: cfg.bgColor, color: cfg.color, bold: true }, …))`
- **Without bgColor** (lines 29-35): `e(Text, { color: cfg.color, dimColor: state === 'inactive' }, …)`

The `error` state will use the bgColor path (red background block). The `active:subagent` state will use the text-only path (cyan text, not dimmed since `state !== 'inactive'`).

### Color Alignment with Reader (Story 8.4)

| State | Reader ANSI | Ink Equivalent | Rationale |
|-------|------------|----------------|-----------|
| error | bg:`\x1b[101m` fg:`\x1b[97m` | `bgColor: 'redBright'`, `color: 'white'` | Red = error convention. Badge-style for urgency. |
| active:subagent | `\x1b[36m` | `color: 'cyan'` | Cyan = agent convention. Text-only for normal operation. |

### Testing Pattern (tui-monitor-components.test.js)

Follow existing LlmBadge test pattern (lines 107-150):

```js
it('renders ERROR state with red background', () => {
  const { lastFrame } = render(e(LlmBadge, {
    state: 'error', workflow: 'dev-story', startedAt: new Date().toISOString()
  }));
  const frame = lastFrame();
  assert.ok(frame.includes('ERROR'));
  assert.ok(frame.includes('\u2B24'));
});

it('renders SUBAGENT state in cyan', () => {
  const { lastFrame } = render(e(LlmBadge, {
    state: 'active:subagent', workflow: 'dev-story', startedAt: new Date().toISOString()
  }));
  const frame = lastFrame();
  assert.ok(frame.includes('SUBAGENT'));
  assert.ok(frame.includes('\u2B24'));
});
```

### Anti-Patterns to Avoid

- Do NOT modify `computeDisplayState()` — it already passes through `'error'` and `'active:subagent'`
- Do NOT modify `worstState()` — already uses `LLM_STATE_PRIORITY` which includes all 6 states
- Do NOT modify `shared-constants.cjs`, `defaults.js`, or `monitor-utils.js` — all done in 8.4
- Do NOT modify `bmad-sl-reader.js` — reader states done in 8.4
- Do NOT add async code — Pattern 2 mandates synchronous fs everywhere
- Do NOT use ANSI escape codes in Ink components — use Ink color props (`bgColor`, `color`, `dimColor`)
- Do NOT change the rendering logic in LlmBadge — only add config entries

### Previous Story Intelligence (8.4)

- Clean implementation, no debugging needed, no review corrections
- `LLM_STATE_PRIORITY` confirmed working with 6 states in `worstState()` tests
- Reader tests confirmed error (brightRed bg) and subagent (cyan) rendering
- Pattern: badge-style (bg/fg) for high-priority states (permission, waiting, error), text-only for normal states (active, inactive, active:subagent)
- Deferred observation: `computeDisplayState()` 5-min timeout converts `active:subagent` to `inactive` for long-running subagents — pre-existing behavior, not a bug to fix

### Git Intelligence

Recent commits show story 8.4 delivered cleanly with one code review fix commit. The branch `story-8-5` was created from `main` after the 8.4 merge. All 8.4 changes are already in the working tree.

### Project Structure Notes

- Alignment: All changes within `src/tui/monitor/components/` and `test/` — correct locations
- No conflicts: Only modifying config objects in existing files, no new files needed
- Module boundary: All changes within Monitor sub-boundary (`src/tui/monitor/`)

### References

- [Source: src/tui/monitor/components/LlmBadge.js] — LLM_BADGE_CONFIG lines 9-14, bgColor rendering lines 38-45, text-only rendering lines 29-35
- [Source: src/tui/monitor/components/SessionTabs.js] — STATE_ICONS lines 9-14, worstState usage line 58
- [Source: src/reader/shared-constants.cjs] — LLM_STATE_PRIORITY lines 21-28, computeDisplayState lines 43-49
- [Source: src/tui/monitor/monitor-utils.js] — worstState lines 72-79, LLM_STATE_PRIORITY import line 7
- [Source: test/tui-monitor-components.test.js] — LlmBadge tests lines 107-150
- [Source: test/tui-monitor.test.js] — worstState tests lines 426-482
- [Source: _bmad-output/implementation-artifacts/8-4-shared-constants-reader-new-llm-state-support.md] — Foundation story, color conventions, anti-patterns
- [Source: _bmad-output/planning-artifacts/architecture.md] — Pattern 20 (LlmBadge), Pattern 23 (Monitor Cache I/O), Monitor sub-boundary

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean implementation, no debugging needed.

### Completion Notes List

- Added `error` and `'active:subagent'` entries to `LLM_BADGE_CONFIG` in LlmBadge.js. Used `fgColor` (not `color`) for the error entry to match existing codebase convention for bgColor entries.
- Added `error` and `'active:subagent'` entries to `STATE_ICONS` in SessionTabs.js.
- Added 2 new LlmBadge tests (ERROR + SUBAGENT render) and 2 new SessionTabs tests (error + subagent icon) in tui-monitor-components.test.js.
- All 22 component tests pass. All worstState tests pass (error, permission, active:subagent priority resolution verified).
- 3 pre-existing test failures in "MonitorScreen — toggles" confirmed identical on main branch — not regressions.
- Updated LlmBadge.js header comment from "4-state" to "6-state".

### Change Log

- 2026-04-07: Implemented story 8.5 — added error and active:subagent display to LlmBadge and SessionTabs components with 4 new tests.

### File List

- `src/tui/monitor/components/LlmBadge.js` — added error + active:subagent to LLM_BADGE_CONFIG
- `src/tui/monitor/components/SessionTabs.js` — added error + active:subagent to STATE_ICONS
- `test/tui-monitor-components.test.js` — added 4 new tests (2 LlmBadge + 2 SessionTabs)

