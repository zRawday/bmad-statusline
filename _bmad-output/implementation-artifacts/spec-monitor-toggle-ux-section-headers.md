---
title: 'Monitor toggle UX, bash filter, section headers, and conditional shortcuts'
type: 'feature'
created: '2026-04-05'
status: 'done'
baseline_commit: '459a59c'
context: []
---

<frozen-after-approval>

## Intent

**Problem:** The monitor shortcut bar uses a `[x]`/`[ ]` checkbox style that is visually cluttered, the "agents" label is unclear, there is no way to hide bash commands, section headers lack visual distinction, and shortcuts for scroll and sub-agents display even when irrelevant (nothing to scroll, no sub-agent activity).

**Approach:** (1) Replace checkbox toggles with inline `ON`/`OFF` suffix, rename "agents" → "Subagents". (2) Add toggle key `b` to show/hide bash commands, hidden by default. (3) Add background colors to section headers using colors that avoid LLM-state palette. (4) Only show scroll shortcut when content overflows viewport. (5) Only show Subagents shortcut when at least one entry has a non-null `agent_id` in the current session.

## Boundaries & Constraints

**Always:** White or bright foreground text on header backgrounds for contrast. Header backgrounds must not use green, yellowBright/yellow, or blueBright/blue (reserved for LLM badge states). Toggle ON/OFF labels must be visually distinct (ON = colored, OFF = dim).

**Ask First:** Choice of specific background colors for the three section headers if the initial proposal doesn't look right.

**Never:** Do not change LlmBadge colors. Do not modify detail screen headers (MonitorDetailScreen). Do not add new dependencies.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Toggle bash off (default) | Monitor loads | COMMANDS section not rendered, shortcut shows `b Bash OFF` | N/A |
| Toggle bash on | Press `b` | COMMANDS section appears, shortcut shows `b Bash ON` | N/A |
| No sub-agent activity | All entries have null agent_id | `f Subagents` shortcut hidden from bar | N/A |
| Sub-agent activity exists | Any entry has agent_id | `f Subagents ON`/`OFF` shortcut visible | N/A |
| Content fits viewport | items.length <= viewportHeight | `↑↓ scroll` shortcut hidden | N/A |
| Content overflows | items.length > viewportHeight | `↑↓ scroll` shortcut visible | N/A |

</frozen-after-approval>

## Code Map

- `src/tui/components/ShortcutBar.js` -- Renders toggle indicators; replace `[x]`/`[ ]` with `ON`/`OFF` suffix
- `src/tui/monitor/MonitorScreen.js` -- State, shortcuts, filtering; add `showBash` state, `b` key handler, conditional scroll/subagent shortcuts, pass context to getShortcuts

## Tasks & Acceptance

**Execution:**
- [x] `src/tui/components/ShortcutBar.js` -- Replace `[x] `/`[ ] ` checkbox with ` ON`/` OFF` suffix after label; ON inherits action color, OFF is dim
- [x] `src/tui/monitor/MonitorScreen.js` -- Rename label `'agents'` → `'Subagents'` in all getShortcuts entries
- [x] `src/tui/monitor/MonitorScreen.js` -- Add `showBash` state (default `false`); add `b` key toggle in both detail and normal input handlers
- [x] `src/tui/monitor/MonitorScreen.js` -- Add `{ key: 'b', label: 'Bash', color: 'magenta', checked: toggleState.showBash }` to shortcut arrays (detail + normal)
- [x] `src/tui/monitor/MonitorScreen.js` -- Conditionally skip bashResult in sectionPairs when `showBash` is false
- [x] `src/tui/monitor/MonitorScreen.js` -- Pass `hasSubAgents` (derived from rawWrites/rawReads/rawCommands any having non-null agent_id) and `canScroll` (items.length > viewportHeight) to getShortcuts; conditionally include scroll and Subagents shortcuts only when relevant
- [x] `src/tui/monitor/components/FileTreeSection.js` -- Add `backgroundColor: 'magenta'` and `color: 'white'` to header Text element, pad with spaces
- [x] `src/tui/monitor/components/BashSection.js` -- Add `backgroundColor: 'redBright'` and `color: 'white'` to header Text element, pad with spaces

**Acceptance Criteria:**
- Given monitor loads, when no key pressed, then COMMANDS section is hidden and shortcut bar shows `b Bash OFF`
- Given any toggle active, when viewing shortcut bar, then no `[x]` or `[ ]` appears; toggle state shown as `ON`/`OFF` suffix
- Given shortcut bar visible, when looking at subagent toggle, then label reads `Subagents` not `agents`
- Given content fits in viewport, when viewing shortcut bar, then `↑↓ scroll` shortcut is absent
- Given no sub-agent activity in session, when viewing shortcut bar, then `f Subagents` shortcut is absent
- Given sections have entries, when viewing monitor, then each section header has a colored background with readable white text

## Verification

**Commands:**
- `cd bmad-statusline && npm test` -- expected: all existing tests pass

**Manual checks:**
- Launch monitor with active session, verify section headers have colored backgrounds
- Verify bash section hidden on load, press `b` to show, press again to hide
- Verify toggle labels show `ON`/`OFF` instead of checkboxes
- Verify `f` shortcut label reads `Subagents`
- Verify scroll shortcut absent when content fits, present when it overflows
- Verify Subagents shortcut absent when no sub-agent entries exist

## Suggested Review Order

**Toggle UX & conditional shortcuts**

- Entry point: getShortcuts signature gains hasSubAgents/canScroll, conditionally includes shortcuts
  [`MonitorScreen.js:37`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L37)

- showBash state (default false), hasSubAgents derivation, conditional bash rendering
  [`MonitorScreen.js:101`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L101)

- 'b' key handler in detail mode, alongside existing 'f' toggle
  [`MonitorScreen.js:238`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L238)

- 'b' key handler in normal mode
  [`MonitorScreen.js:273`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L273)

- ON/OFF suffix replaces [x]/[ ] checkbox prefix
  [`ShortcutBar.js:17`](../../bmad-statusline/src/tui/components/ShortcutBar.js#L17)

**Section header backgrounds**

- File section headers: magenta background, white text
  [`FileTreeSection.js:46`](../../bmad-statusline/src/tui/monitor/components/FileTreeSection.js#L46)

- Bash section header: redBright background, white text
  [`BashSection.js:40`](../../bmad-statusline/src/tui/monitor/components/BashSection.js#L40)
