---
title: 'Prompt-based story detection for create-story / dev-story / code-review'
type: 'feature'
created: '2026-06-28'
status: 'done'
baseline_commit: '41cf240'
context: ['_bmad-output/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The story widget only lights up once a story *file* is read/written (`STORY_FILE` prio 2) or sprint-status is touched. When a user explicitly names the story in the prompt — `/bmad-dev-story 2-4 ...`, or `/bmad-dev-story` then a follow-up `2-4 ...` / `story 2-4 ...` — that intent is ignored until a file event happens, so the widget stays empty during early discussion.

**Approach:** In `handleUserPrompt`, when the active workflow is `create-story`, `dev-story`, or `code-review`, parse an epic-story id from the prompt (after stripping any leading skill command). **Explicit** signals — a skill command bearing the id, or the `story` keyword — set `status.story` at `STORY_FILE` priority (a lock). A **bare** follow-up id (no command, no keyword) sets it only as a `CANDIDATE`, so a later real story-file Read can correct or enrich it. Hook-only change; the reader already renders bare ids like `2-4` correctly.

## Boundaries & Constraints

**Always:**
- Detection fires only when `status.workflow` ∈ `STORY_WORKFLOWS` (`create-story`, `dev-story`, `code-review`).
- Match the story id at the **start** of the prompt remainder, optionally preceded by the word `story`. Strip a leading skill/legacy command token first (reuse the existing `SKILL_REGEX` / `LEGACY_COMMAND_REGEX` match) before matching.
- **Explicit signal → lock:** when the id comes from a skill command in this prompt (`cmd` matched) OR is preceded by the `story` keyword, set it at `STORY_PRIORITY.STORY_FILE` (2). **Bare follow-up id → candidate:** otherwise set it at `STORY_PRIORITY.CANDIDATE` (3). Both go through `shouldUpdateStory`, so neither clobbers a sprint-status pin (prio 1) nor an existing lock (prio 2).
- Accept bare epic-story (`2-4`, `1-1a`) or full slug (`2-4-export-csv`); store exactly the captured token.
- Epic and story numbers limited to 1–3 digits to avoid matching dates (e.g. `2024-01`).

**Never:**
- No reader, widget-registry, defaults, installer, or version-bump changes — purely `bmad-hook.js` + tests.
- Do not detect from non-story workflows, nor from a story id appearing mid-sentence.
- Do not allow a prompt to override an already-locked story (prio ≤ 2) — switching stories mid-session by re-issuing the same skill command is out of scope.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Command + id, same prompt (explicit) | `/bmad-dev-story 2-4 do it` | `story='2-4'`, `story_priority=2` (lock) | N/A |
| create-story command + id | `/bmad-create-story 1-3` | `story='1-3'`, prio 2 | N/A |
| code-review (gds prefix) | `/gds-code-review 5-2 review` | `story='5-2'`, prio 2 | N/A |
| Follow-up `story` keyword (explicit) | workflow `dev-story`; prompt `story 2-4 please` | `story='2-4'`, prio 2 (lock) | N/A |
| Follow-up bare id (candidate) | workflow already `dev-story`; prompt `2-4 implement` | `story='2-4'`, prio 3 | N/A |
| Bare candidate enriched by file | after bare `2-4`; later Read `2-4-export-csv.md` | `story='2-4-export-csv'`, prio 2 | N/A |
| Prose false-positive recovered | `dev-story`; prompt `5-6 errors in build` then Read `7-7-real-story.md` | candidate `5-6` (prio 3) → corrected to `7-7-real-story` (prio 2) | N/A |
| Explicit lock not enriched | `/bmad-dev-story 2-4` then Read `2-4-export-csv.md` | `story='2-4'`, prio 2 (lock holds) | N/A |
| Full slug typed | `/bmad-dev-story 2-4-export-csv` | `story='2-4-export-csv'`, prio 2 | N/A |
| bis-story suffix | `/bmad-dev-story 1-1a` | `story='1-1a'`, prio 2 | N/A |
| Command, no id | `/bmad-dev-story` | `story` unchanged (null) | N/A |
| Already locked (prio 2) | `story='3-1'` prio 2; bare prompt `2-4 switch` | unchanged — candidate can't override lock | N/A |
| Non-story workflow | `/bmad-create-architecture 2-4` | no story set | N/A |
| Bare id, no story workflow | workflow null; prompt `2-4 hi` | no story set | N/A |
| Date-like start | workflow `dev-story`; prompt `2024-01 deadline` | no match (>3 digits) | N/A |
| Mid-sentence id | `dev-story`; prompt `fix the 2-4 thing` | no match (not at start) | N/A |

</frozen-after-approval>

## Code Map

- `src/hook/bmad-hook.js` -- `handleUserPrompt` (~L237): hoist `legacyMatch`, add hybrid prompt story detection after skill assignment; add `PROMPT_STORY_REGEX` constant (~L19, group 1 = `story` keyword, group 2 = id). Reuses `STORY_WORKFLOWS`, `STORY_PRIORITY`, `shouldUpdateStory`.
- `test/hook.test.js` -- 16 prompt-story tests for the I/O matrix (after AC #6, ~L308).
- `src/reader/shared-constants.cjs` -- `formatStoryName`: reference only; bare `2-4` already returns as-is (no change).

## Tasks & Acceptance

**Execution:**
- [x] `src/hook/bmad-hook.js` -- Add constant near other regexes: `const PROMPT_STORY_REGEX = /^[\s:]*(story\s+)?(\d{1,3}[a-z]?-\d{1,3}[a-z]?(?:-[a-zA-Z][\w-]*)?)\b/i;` (group 1 = keyword, group 2 = id).
- [x] `src/hook/bmad-hook.js` -- In `handleUserPrompt`, restructure so `legacyMatch` is computed alongside `match` (not nested in the else). After the `if (skillName)` block, still inside `if (prompt)`: if `STORY_WORKFLOWS.includes(status.workflow)`, take `cmd = match || legacyMatch`, `rest = cmd ? prompt.slice(cmd[0].length) : prompt`, match `PROMPT_STORY_REGEX`. If it matches, compute `explicit = !!cmd || !!sm[1]`, choose `priority = explicit ? STORY_FILE : CANDIDATE`, and if `shouldUpdateStory(priority, status.story_priority)`, set `status.story = sm[2]` and `status.story_priority = priority`.
- [x] `test/hook.test.js` -- 16 unit tests covering every I/O matrix row (explicit lock, candidate, recovery/enrichment via file Read), all green.

**Acceptance Criteria:**
- Given workflow `dev-story` and prompt `/bmad-dev-story 2-4 ...`, when the hook processes UserPromptSubmit, then `status.story='2-4'` and `story_priority=2` (explicit lock).
- Given workflow already `dev-story` and a follow-up `story 2-4 ...`, when processed, then `story='2-4'`, prio 2; given a bare follow-up `2-4 ...`, then `story='2-4'`, prio 3 (candidate).
- Given a bare candidate (e.g. prose `5-6 errors`), when a real story-file is later Read, then the story is corrected/enriched to the file's slug at prio 2.
- Given a prompt whose id is not at the start (`fix the 2-4 thing`) or whose numbers exceed 3 digits (`2024-01 ...`), then `status.story` is unchanged.
- Given an already-locked story (`story_priority=2`), when a later bare prompt names a different id, then the story is unchanged.

## Spec Change Log

- **2026-06-28 — bad_spec/intent renegotiation (priority scheme).** *Triggering finding:* adversarial review (blind + edge-case hunters) showed the original hard-lock-at-`STORY_FILE` rule let a prose follow-up beginning with `N-M` (e.g. `5-6 errors`) lock a wrong story **uncorrectably** for the rest of the workflow, and blocked slug enrichment from the real file Read. *Amended:* Intent, Boundaries (Always priority rule), and the I/O Matrix — prompt detection is now **hybrid**: explicit signals (skill command + id, or `story` keyword) lock at prio 2; a bare follow-up id is a `CANDIDATE` (prio 3) that a later story-file Read can correct/enrich. *Known-bad avoided:* an uncorrectable false-positive story. *KEEP:* explicit `/bmad-...story 2-4` and `story 2-4` must still LOCK (prio 2); the 1–3 digit date guard; start-anchored matching; hook-only scope; full I/O-matrix test coverage.

## Design Notes

Order inside `handleUserPrompt`: skill detection (and its reset-on-change, which nulls `story`/`story_priority`) runs first; story detection runs after, so a fresh `/bmad-dev-story 2-4` reset-then-sets correctly in one event.

**Hybrid priority.** `explicit = !!cmd || !!sm[1]` — true when the id rides a skill command in this prompt, or is preceded by the `story` keyword (regex group 1). Explicit → `STORY_FILE` lock (the prompt id wins and is not enriched by a later file Read — the accepted trade-off: widget shows `2-4`, not `2-4 Export Csv`). Bare follow-up → `CANDIDATE`, which `shouldUpdateStory` lets a real story-file Read (prio 2) upgrade — recovering prose false positives and enriching to the full slug.

`cmd[0]` includes the leading `\s*\/?` and full command token, so slicing its length yields the clean remainder; `PROMPT_STORY_REGEX`'s `^[\s:]*` then absorbs the gap before the id.

## Verification

**Commands:**
- `npm test` -- expected: all existing tests pass + new prompt-story tests green.
- `node --test test/hook.test.js` -- expected: hook suite green.

## Suggested Review Order

**Detection logic (the design)**

- Entry point — hybrid priority decision: explicit signal locks, bare follow-up is a candidate.
  [`bmad-hook.js:282`](../../src/hook/bmad-hook.js#L282)

- The detection block: strip command token, match remainder, gate via `shouldUpdateStory`.
  [`bmad-hook.js:271`](../../src/hook/bmad-hook.js#L271)

- The regex: group 1 = `story` keyword (explicit marker), group 2 = id; 1–3 digit date guard.
  [`bmad-hook.js:23`](../../src/hook/bmad-hook.js#L23)

- Refactor: `legacyMatch` hoisted alongside `match` so the command token is reusable.
  [`bmad-hook.js:241`](../../src/hook/bmad-hook.js#L241)

**Tests**

- 16 prompt-story tests — explicit lock, candidate, recovery/enrichment via file Read.
  [`hook.test.js:309`](../../test/hook.test.js#L309)

- Key case: a prose false positive (`5-6 errors`) is corrected by the real story-file Read.
  [`hook.test.js:443`](../../test/hook.test.js#L443)
