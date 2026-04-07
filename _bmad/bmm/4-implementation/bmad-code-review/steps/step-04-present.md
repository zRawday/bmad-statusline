---
deferred_work_file: '{implementation_artifacts}/deferred-work.md'
tests_passed: true # set at runtime during patch application
---

# Step 4: Present and Act

## RULES

- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- When `{spec_file}` is set, always write findings to the story file before applying patches.
- `decision-needed` findings must be resolved before handling `patch` findings.

## INSTRUCTIONS

### 1. Clean review shortcut

If zero findings remain after triage (all dismissed or none raised): state that and proceed to section 6 (Sprint Status Update).

### 2. Write findings to the story file

If `{spec_file}` exists and contains a Tasks/Subtasks section, append a `### Review Findings` subsection. Write all findings in this order:

1. **`decision-needed`** findings (unchecked):
   `- [ ] [Review][Decision] <Title> — <Detail>`

2. **`patch`** findings (unchecked):
   `- [ ] [Review][Patch] <Title> [<file>:<line>]`

3. **`defer`** findings (checked off, marked deferred):
   `- [x] [Review][Defer] <Title> [<file>:<line>] — deferred, pre-existing`

Also append each `defer` finding to `{deferred_work_file}` under a heading `## Deferred from: code review ({date})`. If `{spec_file}` is set, include its basename in the heading (e.g., `code review of story-3.3 (2026-03-18)`). One bullet per finding with description.

### 3. Present summary

Announce what was written:

> **Code review complete.** <D> `decision-needed`, <P> `patch`, <W> `defer`, <R> dismissed as noise.

If `{spec_file}` is set, add: `Findings written to the review findings section in {spec_file}.`
Otherwise add: `Findings are listed above. No story file was provided, so nothing was persisted.`

### 4. Resolve decision-needed findings

If `decision_needed` findings exist, classify each as **technical** or **non-technical**:

- **Technical** (code style, architecture choice, implementation approach, library selection, error handling strategy, naming, performance optimization): resolve autonomously using expert judgment. Convert to `patch` (if fixable) or `defer` (if pre-existing). Log the decision rationale in the finding detail.
- **Non-technical** (product behavior, business logic ambiguity, UX intent, feature scope, user-facing text, data model semantics): **HALT** and present the finding with clear options in `{communication_language}`, explained simply for a non-technical audience. Wait for user input. Once resolved, convert to `patch`, `defer`, or dismiss.

If the user chooses to defer a non-technical finding, ask for a one-line reason, then append it to both the story file bullet and `{deferred_work_file}`.

### 5. Handle `patch` findings

If `patch` findings exist (including any promoted from step 4), apply all fixes automatically:

1. Apply each patch fix in sequence.
2. After all patches are applied, run the project's test suite to verify no regressions.
3. If tests pass: check off patched items in the story file (if `{spec_file}` is set). Set `{tests_passed}` = `true`.
4. If tests fail: revert the last patch, log the failure, and reclassify that finding as `defer`. Re-run tests to confirm green. Set `{tests_passed}` accordingly.
5. Present a summary of changes made, any patches that were reverted, and test results.

If no `patch` findings exist, set `{tests_passed}` = `true`.

**✅ Code review actions complete**

- Decision-needed resolved: <D>
- Patches applied: <P>
- Deferred: <W>
- Dismissed: <R>

### 6. Update story status and sync sprint tracking

Skip this section if `{spec_file}` is not set.

#### Determine new status based on review outcome

- If all `decision-needed` and `patch` findings were resolved (fixed or dismissed) AND no unresolved HIGH/MEDIUM issues remain: set `{new_status}` = `done`. Update the story file Status section to `done`.
- If `patch` findings were left as action items, or unresolved issues remain: set `{new_status}` = `in-progress`. Update the story file Status section to `in-progress`.

Save the story file.

#### Sync sprint-status.yaml

If `{story_key}` is not set, skip this subsection and note that sprint status was not synced because no story key was available.

If `{sprint_status}` file exists:

1. Load the FULL `{sprint_status}` file.
2. Find the `development_status` entry matching `{story_key}`.
3. If found: update `development_status[{story_key}]` to `{new_status}`. Update `last_updated` to current date. Save the file, preserving ALL comments and structure including STATUS DEFINITIONS.
4. If `{story_key}` not found in sprint status: warn the user that the story file was updated but sprint-status sync failed.

If `{sprint_status}` file does not exist, note that story status was updated in the story file only.

#### Completion summary

> **Review Complete!**
>
> **Story Status:** `{new_status}`
> **Issues Fixed:** <fixed_count>
> **Action Items Created:** <action_count>
> **Deferred:** <W>
> **Dismissed:** <R>

## NEXT

Read fully and follow `./step-05-commit.md`
