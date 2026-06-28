---
title: 'Prompt-based story detection for create-story / dev-story / code-review'
type: 'feature'
created: '2026-06-28'
status: 'ready-for-dev'
baseline_commit: '3a2d338'
context: ['_bmad-output/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The story widget only lights up once a story *file* is read/written (`STORY_FILE` prio 2) or sprint-status is touched. When a user explicitly names the story in the prompt — `/bmad-dev-story 2-4 ...`, or `/bmad-dev-story` then a follow-up `2-4 ...` / `story 2-4 ...` — that intent is ignored until a file event happens, so the widget stays empty during early discussion.

**Approach:** In `handleUserPrompt`, when the active workflow is `create-story`, `dev-story`, or `code-review`, parse an epic-story id from the prompt (after stripping any leading skill command) and set `status.story` at `STORY_FILE` priority (a hard lock, per user choice). Hook-only change; the reader already renders bare ids like `2-4` correctly.

## Boundaries & Constraints

**Always:**
- Detection fires only when `status.workflow` ∈ `STORY_WORKFLOWS` (`create-story`, `dev-story`, `code-review`).
- Match the story id at the **start** of the prompt remainder, optionally preceded by the word `story`. Strip a leading skill/legacy command token first (reuse the existing `SKILL_REGEX` / `LEGACY_COMMAND_REGEX` match) before matching.
- Set story at `STORY_PRIORITY.STORY_FILE` (2) via `shouldUpdateStory` — so it never clobbers a sprint-status pin (prio 1) and is not re-set once locked.
- Accept bare epic-story (`2-4`, `1-1a`) or full slug (`2-4-export-csv`); store exactly the captured token.
- Epic and story numbers limited to 1–3 digits to avoid matching dates (e.g. `2024-01`).

**Never:**
- No reader, widget-registry, defaults, installer, or version-bump changes — purely `bmad-hook.js` + tests.
- Do not detect from non-story workflows, nor from a story id appearing mid-sentence.
- Do not allow a prompt to override an already-locked story (prio ≤ 2) — switching stories mid-session by prompt is out of scope (consequence of the lock choice).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Command + id, same prompt | `/bmad-dev-story 2-4 do it` | `story='2-4'`, `story_priority=2` | N/A |
| create-story command + id | `/bmad-create-story 1-3` | `story='1-3'`, prio 2 | N/A |
| code-review (gds prefix) | `/gds-code-review 5-2 review` | `story='5-2'`, prio 2 | N/A |
| Follow-up bare id | workflow already `dev-story`; prompt `2-4 implement` | `story='2-4'`, prio 2 | N/A |
| Follow-up `story` keyword | workflow `dev-story`; prompt `story 2-4 please` | `story='2-4'`, prio 2 | N/A |
| Full slug typed | `/bmad-dev-story 2-4-export-csv` | `story='2-4-export-csv'`, prio 2 | N/A |
| bis-story suffix | `/bmad-dev-story 1-1a` | `story='1-1a'`, prio 2 | N/A |
| Command, no id | `/bmad-dev-story` | `story` unchanged (null) | N/A |
| Already locked (prio 2) | `story='3-1'` prio 2; prompt `2-4 switch` | unchanged — lock honored | N/A |
| Non-story workflow | `/bmad-create-architecture 2-4` | no story set | N/A |
| Bare id, no story workflow | workflow null; prompt `2-4 hi` | no story set | N/A |
| Date-like start | workflow `dev-story`; prompt `2024-01 deadline` | no match (>3 digits) | N/A |
| Mid-sentence id | `dev-story`; prompt `fix the 2-4 thing` | no match (not at start) | N/A |

</frozen-after-approval>

## Code Map

- `src/hook/bmad-hook.js` -- `handleUserPrompt` (~L220): hoist `legacyMatch`, add prompt story detection after skill assignment; add `PROMPT_STORY_REGEX` constant (~L20). Reuses `STORY_WORKFLOWS`, `STORY_PRIORITY`, `shouldUpdateStory`.
- `test/hook.test.js` -- new tests for the I/O matrix (alongside AC #1–#6 prompt tests, ~L210).
- `src/reader/shared-constants.cjs` -- `formatStoryName`: reference only; bare `2-4` already returns as-is (no change).

## Tasks & Acceptance

**Execution:**
- [ ] `src/hook/bmad-hook.js` -- Add constant near other regexes: `const PROMPT_STORY_REGEX = /^[\s:]*(?:story\s+)?(\d{1,3}[a-z]?-\d{1,3}[a-z]?(?:-[a-zA-Z][\w-]*)?)\b/i;`
- [ ] `src/hook/bmad-hook.js` -- In `handleUserPrompt`, restructure so `legacyMatch` is computed alongside `match` (not nested in the else). After the `if (skillName)` block, still inside `if (prompt)`: if `STORY_WORKFLOWS.includes(status.workflow)`, take `cmd = match || legacyMatch`, `rest = cmd ? prompt.slice(cmd[0].length) : prompt`, match `PROMPT_STORY_REGEX`; if it matches and `shouldUpdateStory(STORY_PRIORITY.STORY_FILE, status.story_priority)`, set `status.story = m[1]` and `status.story_priority = STORY_PRIORITY.STORY_FILE`.
- [ ] `test/hook.test.js` -- Add unit tests covering every I/O matrix row.

**Acceptance Criteria:**
- Given workflow `dev-story` and prompt `/bmad-dev-story 2-4 ...`, when the hook processes UserPromptSubmit, then `status.story='2-4'` and `story_priority=2`.
- Given workflow already `dev-story` from a prior prompt and a follow-up prompt `story 2-4 ...`, when processed, then `status.story='2-4'`.
- Given a prompt whose story id is not at the start (`fix the 2-4 thing`) or whose numbers exceed 3 digits (`2024-01 ...`), when processed, then `status.story` is unchanged.
- Given an already-locked story (`story_priority=2`), when a later prompt names a different id, then the story is unchanged.

## Design Notes

Order inside `handleUserPrompt`: skill detection (and its reset-on-change, which nulls `story`/`story_priority`) runs first; story detection runs after, so a fresh `/bmad-dev-story 2-4` reset-then-sets correctly in one event. UserPromptSubmit precedes any Read, so the prompt id wins and locks before a story-file read could enrich it to the full slug — the accepted trade-off of the "hard lock" choice (widget shows `2-4`, not `2-4 Export Csv`).

`cmd[0]` includes the leading `\s*\/?` and full command token, so slicing its length yields the clean remainder; `PROMPT_STORY_REGEX`'s `^[\s:]*` then absorbs the gap before the id.

## Verification

**Commands:**
- `npm test` -- expected: all existing tests pass + new prompt-story tests green.
- `node --test test/hook.test.js` -- expected: hook suite green.
