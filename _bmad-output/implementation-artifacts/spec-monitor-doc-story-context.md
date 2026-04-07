---
title: 'Monitor doc/story context in tabs and LLM badge line'
type: 'feature'
created: '2026-04-05'
status: 'done'
baseline_commit: 'f0a9cd1'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The monitor shows workflow names in tabs but lacks contextual info about which story or document is being worked on, making it hard to distinguish sessions at a glance. The LLM badge also has no padding, so the background color clips the text.

**Approach:** Add story number to tab labels for story workflows. Display full story name or document name on the same line as the LLM badge (separated by 2 spaces). Add a leading and trailing space inside the LLM badge text so the background wraps the content cleanly.

## Boundaries & Constraints

**Always:** Use existing `story` and `document_name` fields from polled status JSON — no new data sources. Story workflows = `create-story`, `dev-story`, `code-review`. Extract story number with regex `\d+-\d+` from the story slug. Document name is never shown in tabs — only in the detail badge line.

**Ask First:** Changes to LlmBadge component internals beyond padding and adding the context suffix.

**Never:** Modify the hook system or status JSON schema. Add new polling logic.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Story workflow with story | `workflow: 'dev-story'`, `story: '7-7-detail-mode'` | Tab: `dev-story 7-7`. Badge line: ` ⬤  ACTIVE dev-story 5m `  `7-7 Detail Mode` | N/A |
| Story workflow, no story yet | `workflow: 'create-story'`, `story: null` | Tab: `create-story` (unchanged). Badge: padded, no suffix | N/A |
| Non-story workflow with doc | `workflow: 'create-prd'`, `document_name: 'prd.md'` | Tab: `create-prd` (unchanged). Badge line: ` ⬤  ACTIVE create-prd 2m `  `prd.md` | N/A |
| Non-story workflow, no doc | `workflow: 'quick-dev'`, `document_name: null` | Tab: unchanged. Badge: padded, no suffix | N/A |
| Story slug without title part | `story: '7-7'` | Tab: `dev-story 7-7`. Badge suffix: `7-7` | N/A |

</frozen-after-approval>

## Code Map

- `bmad-statusline/src/tui/monitor/components/SessionTabs.js` -- Tab label generation (line 26)
- `bmad-statusline/src/tui/monitor/components/LlmBadge.js` -- LLM state badge rendering, padding and context suffix
- `bmad-statusline/src/tui/monitor/MonitorScreen.js` -- Passes session data to LlmBadge (lines 342-346)
- `bmad-statusline/src/tui/monitor/monitor-utils.js` -- Utility functions

## Tasks & Acceptance

**Execution:**
- [x] `bmad-statusline/src/tui/monitor/monitor-utils.js` -- Add `extractStoryNumber(story)` and `formatStoryTitle(story)` helpers, add `STORY_WORKFLOWS` constant
- [x] `bmad-statusline/src/tui/monitor/components/SessionTabs.js` -- Append story number to tab label for story workflows
- [x] `bmad-statusline/src/tui/monitor/components/LlmBadge.js` -- Add leading/trailing space to badge text. After the badge (with 2 spaces gap), render story name or document name outside the bg-colored zone
- [x] `bmad-statusline/src/tui/monitor/MonitorScreen.js` -- Pass `story` and `document_name` props from session to LlmBadge

**Acceptance Criteria:**
- Given a `dev-story` session with `story: '7-7-detail-mode'`, when viewing tabs, then tab label shows `dev-story 7-7`
- Given the same session active, when viewing detail, then badge reads ` ⬤  ACTIVE dev-story 5m ` followed by 2 spaces then `7-7 Detail Mode`
- Given a `create-prd` session with `document_name: 'prd.md'`, when viewing detail, then badge line ends with 2 spaces then `prd.md`
- Given any session with null story/document, then badge is padded but no suffix appears
- LLM badge background color now wraps the text with space padding on both sides

## Design Notes

Story number extraction: `'7-7-detail-mode-pages'` → `/^(\d+-\d+)/` → `'7-7'`

Full story name: `'7-7-detail-mode'` → `/^(\d+-\d+)-(.+)$/` → `'7-7'` + `'detail mode'` (capitalize words) → `'7-7 Detail Mode'`

Badge layout change:
```
Before: [⬤  ACTIVE dev-story 5m]  (bg ends tight)
After:  [ ⬤  ACTIVE dev-story 5m ]  7-7 Detail Mode  (bg padded, context outside bg)
```

The context text (story/document name) renders outside the bg-colored zone, after 2 spaces.

## Verification

**Manual checks:**
- Launch monitor with active dev-story session with story set — verify tab shows `dev-story 7-7` and badge line shows padded badge + story name
- Launch monitor with create-prd session with document_name — verify badge line shows padded badge + document name
- Verify null story/document shows only padded badge, no suffix

## Suggested Review Order

**Helpers — shared constants and formatters**

- Story workflows constant and slug parsers — foundation for both tab and badge changes
  [`monitor-utils.js:125`](../../bmad-statusline/src/tui/monitor/monitor-utils.js#L125)

**Tab labels — story number in session tabs**

- Append story number to tab label, color resolved from baseLabel (not compound label)
  [`SessionTabs.js:26`](../../bmad-statusline/src/tui/monitor/components/SessionTabs.js#L26)

**LLM badge — padding and context suffix**

- Badge wraps in Box for bg isolation; leading/trailing space padding; contextLabel after 2-space gap
  [`LlmBadge.js:16`](../../bmad-statusline/src/tui/monitor/components/LlmBadge.js#L16)

**Wiring — session data passed to badge**

- contextLabel computed from story or document_name based on workflow type
  [`MonitorScreen.js:346`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L346)
