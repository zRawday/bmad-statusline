---
title: 'Monitor UX Polish — Sticky Header, Spacing, LLM Badge, Bash Prefix, Sub-Agent Toggle'
type: 'feature'
created: '2026-04-04'
status: 'done'
baseline_commit: '02e9fa89bc9c936e63d249da6c05432018271b03'
context: []
---

<frozen-after-approval>

## Intent

**Problem:** The monitor screen has several UX issues: (a) the header (title, tabs, LLM badge) scrolls away with content instead of staying fixed — the outer Box lacks a `height` constraint and `rows - 6` miscounts variable header rows (SessionTabs = 0/1/2 rows depending on mode), (b) no vertical breathing room between sections, (c) the "EN ATTENTE" LLM badge uses yellowBright background with white text making it illegible, (d) bash commands lack a prefix character making it hard to distinguish command start from continuation lines, (e) no way to filter out sub-agent actions from the display.

**Approach:** Add `height: rows` to the outer Box and dynamically compute `viewportHeight` from actual header/footer row counts to make header+footer sticky. Fix spacing with explicit `marginY` or Newline. Change the "waiting" badge color scheme. Prepend `$` to bash commands. Add a toggle key to show/hide sub-agent entries.

## Boundaries & Constraints

**Always:** Respect existing scroll/viewport math — spacing changes must account for any row consumption. Sub-agent toggle default is "show all" (no filtering). Toggle state indicated in the shortcut bar.

**Ask First:** If spacing changes push content below the fold on small terminals (< 20 rows).

**Never:** Change the polling logic or status file format. Never alter how sub-agent data is collected by the hook.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sticky header | Scroll down in long content | Title, tabs, LLM badge stay visible at top; shortcuts stay at bottom | N/A |
| Sticky multi-project | 2 tab rows (project + session) | viewportHeight adjusts, no overflow | N/A |
| Spacing | Normal render | Visible gaps between title/tabs/content/shortcuts | N/A |
| LLM waiting | llm_state: waiting | Legible badge (e.g., dark text on yellow, or yellow text on dark bg) | N/A |
| Bash prefix | command: `npm test` | Displayed as `$ npm test` | N/A |
| Sub-agent shown (default) | entries with agent_id set | All entries visible, no filtering | N/A |
| Sub-agent hidden | toggle active | Entries where `agent_id !== null` are excluded from file/bash sections | N/A |
| No sub-agent data | all entries have agent_id null | Toggle has no visible effect | N/A |
| Stale session hidden | `.alive-{sid}` mtime > 2 min ago | Session excluded from `pollSessions` results — hidden from monitor display. Files NOT deleted (7-day retention for session resume). | N/A |
| Session just closed | User closes Claude or `/clear` — alive stops being touched | Within 2 min (next poll cycle), session hidden from monitor | N/A |
| Active session | `.alive-{sid}` mtime < 2 min ago | Session visible in monitor | N/A |

</frozen-after-approval>

## Code Map

- `src/tui/monitor/MonitorScreen.js:327` — Outer Box missing `height: rows` constraint (root cause of full-page scroll)
- `src/tui/monitor/MonitorScreen.js:143-145` — `viewportHeight = rows - 6` miscounts (SessionTabs = 0/1/2 rows, ScrollableViewport indicators +1-2, toggle indicators +0-1)
- `src/tui/monitor/components/SessionTabs.js:39-63` — Returns null (0 rows), single row (1), or column with 2 rows (multi-project)
- `src/tui/monitor/MonitorScreen.js:350-360` — Toggle indicators rendering
- `src/tui/monitor/components/LlmBadge.js:9-32` — LLM_BADGE_CONFIG and badge rendering
- `src/tui/monitor/components/BashSection.js:20-25` — Command text rendering (no prefix)
- `src/tui/monitor/components/FileTreeSection.js:17-37` — File entries rendering
- `src/tui/monitor/monitor-utils.js:107-128` — buildFileTree with entry filtering

## Tasks & Acceptance

**Execution:**
- [x] `src/tui/monitor/MonitorScreen.js` — (1) **Sticky header fix**: add `height: rows` to outer Box (line 327). Dynamically compute `viewportHeight`: count actual header rows (title=1, spacer=1, SessionTabs=0/1/2, LlmBadge=0/1, spacer=1) and footer rows (spacer=1, indicators=0/1, shortcuts=1), then `viewportHeight = rows - headerRows - footerRows`. Account for ScrollableViewport indicator lines (above/below = +1 each when visible). (2) **Spacing**: replace empty `e(Text, null, '')` with proper spacing (`marginBottom` on Box or Newline). (3) **Sub-agent toggle**: add state `showSubAgents` (default `true`) with toggle key (e.g., `a`). Filter items passed to ScrollableViewport: exclude entries where `data.agent_id` is non-null. Add `[agent]`/`[solo]` indicator to shortcut bar.
- [x] `src/tui/monitor/components/LlmBadge.js` — Change `waiting` config: replace `yellowBright` background + white text with a legible scheme (e.g., `backgroundColor: 'yellow', color: 'black'` or remove background and use bold yellow text).
- [x] `src/tui/monitor/components/BashSection.js` — Prepend `$ ` to each command text in the items array.
- [x] `src/tui/monitor/monitor-utils.js` — In `pollSessions`: after reading each `.alive-{sid}`, check `fs.statSync` mtime. Skip sessions where `(now - mtime) > MONITOR_STALE_MS` (2 min = 120000ms). Do NOT delete any files — filtering is display-only. The 7-day cleanup in reader `purgeStale` remains the sole deletion mechanism.
- [x] `test/tui-monitor.test.js` — Add test for sub-agent toggle filtering, bash prefix rendering, and stale session filtering (alive mtime > 2 min excluded from pollSessions results).

**Acceptance Criteria:**
- Given the monitor screen with content exceeding terminal height, when user scrolls, then title/tabs/LLM badge stay visible at top and shortcuts stay at bottom.
- Given multi-project mode (2 tab rows), when rendered, then viewportHeight adjusts and no terminal overflow occurs.
- Given the monitor screen, when rendered, then visible vertical gaps exist between title, tabs, content, and shortcuts.
- Given LLM state "waiting", when badge renders, then text is legible (sufficient contrast).
- Given a bash command entry, when displayed, then it starts with `$ `.
- Given sub-agent toggle off, when monitor renders, then only entries with `agent_id === null` are shown.
- Given sub-agent toggle on (default), when monitor renders, then all entries are shown.
- Given a closed session (alive mtime > 2 min), when monitor polls, then the session is hidden from display but files remain on disk.

## Spec Change Log

## Verification

**Commands:**
- `node --test test/tui-monitor.test.js` — expected: all pass including new tests

## Suggested Review Order

**Sticky layout & dynamic viewport**

- Outer Box gains `height: rows`; dynamic headerRows/footerRows replace hardcoded `rows - 6`
  [`MonitorScreen.js:153`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L153)

- ScrollableViewport indicator rows reserved when items overflow available space
  [`MonitorScreen.js:163`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L163)

**Sub-agent toggle**

- Filter predicate + state; raw data renamed to `rawWrites`/`rawReads`/`rawCommands`
  [`MonitorScreen.js:120`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L120)

- `f` key handler in detail and normal modes
  [`MonitorScreen.js:226`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L226)

- Cursor clamp effect prevents stale index after toggle shrinks items
  [`MonitorScreen.js:203`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L203)

- `[agent]`/`[solo]` added to always-visible indicator line
  [`MonitorScreen.js:383`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L383)

**LLM badge legibility**

- Waiting state config changed from `yellowBright` to `yellow`
  [`LlmBadge.js:12`](../../bmad-statusline/src/tui/monitor/components/LlmBadge.js#L12)

- Render branch: bold yellow text, no background
  [`LlmBadge.js:28`](../../bmad-statusline/src/tui/monitor/components/LlmBadge.js#L28)

**Bash prefix**

- `$ ` prepended to deduped command text
  [`BashSection.js:21`](../../bmad-statusline/src/tui/monitor/components/BashSection.js#L21)

**Stale session filtering**

- `MONITOR_STALE_MS` (2 min) gate on alive file mtime; files never deleted
  [`monitor-utils.js:24`](../../bmad-statusline/src/tui/monitor/monitor-utils.js#L24)

**Tests**

- Sub-agent toggle: verifies `[agent]`/`[solo]` indicators and entry visibility
  [`tui-monitor.test.js:1084`](../../bmad-statusline/test/tui-monitor.test.js#L1084)

- Bash `$` prefix: direct renderBashSection unit tests
  [`tui-monitor.test.js:1145`](../../bmad-statusline/test/tui-monitor.test.js#L1145)

- Stale session: mtime filtering, file preservation, mixed scenarios
  [`tui-monitor.test.js:1166`](../../bmad-statusline/test/tui-monitor.test.js#L1166)
