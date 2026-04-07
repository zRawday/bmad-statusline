---
title: 'Active Skill widget — hook detection via Read events, conditional visibility'
type: 'feature'
created: '2026-04-02'
status: 'done'
baseline_commit: '22f08a5'
context: ['_bmad-output/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users cannot see when a BMAD workflow delegates to a sub-skill (e.g., quick-dev invoking code-review). The statusline shows only the initial skill, not the currently active one.

**Approach:** Add `bmad-activeskill` widget that shows the currently executing skill when it differs from the initial skill. Detect active skill in the hook by matching Read events against `.claude/skills/{skill-name}/` paths. Widget is invisible when active_skill == workflow (initial). Enter on Active Skill in EditLineScreen navigates to the same SkillColorsScreen — they share colors.

## Boundaries & Constraints

**Always:**
- Detect active skill from Read event file paths matching `.claude/skills/(bmad|gds|wds)-[\w-]+/`
- `active_skill` field in status JSON is null when same as initial workflow
- Widget produces empty string when active_skill is null or equals workflow → reader skips it
- Active Skill and Initial Skill share the same `skillColors` config and SkillColorsScreen
- Reset `active_skill` to null in handleUserPrompt when user invokes a new skill

**Ask First:** Extending detection to Write/Edit events beyond Read.

**Never:** Add new hook matchers (Skill tool). Break existing Read handler logic. Add dependencies.

</frozen-after-approval>

## Code Map

- `src/hook/bmad-hook.js` -- Active skill detection in handleRead, reset in handleUserPrompt, add active_skill to default status
- `src/reader/bmad-sl-reader.js` -- New `activeskill` command: conditional on active_skill != workflow, uses same skillColors
- `src/tui/widget-registry.js` -- New widget bmad-activeskill after bmad-workflow
- `src/tui/screens/EditLineScreen.js` -- Enter on bmad-activeskill → navigate('skillColors'), getColorOptions returns dynamic+ANSI
- `src/tui/preview-utils.js` -- Sample value for bmad-activeskill
- `test/` -- Hook active_skill detection tests, reader activeskill command tests, fixture updates

## Tasks & Acceptance

**Execution:**
- [x] `src/hook/bmad-hook.js` -- In handleRead after cwd scoping and status read: match normPath against `/\.claude\/skills\/((?:bmad|gds|wds)-[\w-]+)\//`, extract workflow name, set `status.active_skill` when different from `status.workflow`, clear when same. In handleUserPrompt: reset `status.active_skill = null` on skill change. Add `active_skill: null` to both default status objects
- [x] `src/reader/bmad-sl-reader.js` -- Add `activeskill` command: return empty if `!s.active_skill || s.active_skill === s.workflow`, else colorize with `getWorkflowColor(s.active_skill, lc.skillColors)`
- [x] `src/tui/widget-registry.js` -- Add widget `{ id: 'bmad-activeskill', command: 'activeskill', name: 'Active Skill', hint: 'Shown only when different from Initial Skill', defaultEnabled: true, defaultColor: null, defaultMode: 'dynamic' }` after bmad-workflow
- [x] `src/tui/screens/EditLineScreen.js` -- Enter on bmad-activeskill navigates to 'skillColors'. Add bmad-activeskill to getColorOptions dynamic list
- [x] `src/tui/preview-utils.js` -- Add sample value `'bmad-activeskill': 'code-review'`
- [x] `test/` -- Hook: Read from different skill dir sets active_skill, Read from same skill dir clears it, new skill prompt resets it. Reader: activeskill returns empty when null/same, returns colored when different. Update fixtures for new widget

**Acceptance Criteria:**
- Given a Read event for `.claude/skills/bmad-code-review/workflow.md` while workflow is `quick-dev`, then `status.active_skill` is set to `code-review`
- Given active_skill == workflow, when reader renders activeskill widget, then empty string (widget hidden)
- Given active_skill != workflow, when reader renders activeskill widget, then colored active_skill name using skillColors
- Given EditLineScreen with cursor on Active Skill, when Enter pressed, then SkillColorsScreen opens (same as Initial Skill)
- Given a new UserPromptSubmit with different skill, then active_skill resets to null

## Verification

**Commands:**
- `node --test test/*.test.js` -- expected: full suite green

## Suggested Review Order

**Hook detection**

- Active skill detection from Read event paths + reset on new skill
  [`bmad-hook.js:142`](../../bmad-statusline/src/hook/bmad-hook.js#L142)

**Reader conditional visibility**

- activeskill command: dedup when Initial Skill visible, fallback when not
  [`bmad-sl-reader.js:344`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L344)

**Widget & TUI**

- New widget: Active Skill, defaultEnabled false, dynamic mode
  [`widget-registry.js:8`](../../bmad-statusline/src/tui/widget-registry.js#L8)

- Enter on both Initial Skill and Active Skill → same skillColors screen
  [`EditLineScreen.js:122`](../../bmad-statusline/src/tui/screens/EditLineScreen.js#L122)

**Config migration**

- ensureWidgetOrder adds missing widget IDs to existing configs
  [`config-loader.js:65`](../../bmad-statusline/src/tui/config-loader.js#L65)
