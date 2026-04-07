---
committed: false # set at runtime
new_status: '' # set at runtime from step 4
---

# Step 5: Commit

## RULES

- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- This step is fully automatic — no user confirmation needed.
- Never commit if tests failed.

## INSTRUCTIONS

### 0. Pre-conditions

If `{tests_passed}` = `false`, skip the commit. Announce: "Skipping commit — tests did not pass." Proceed to section 4.

If no changes are detected in the working tree (`git status --porcelain` is empty), skip the commit. Announce: "Nothing to commit — working tree is clean." Proceed to section 4.

### 1. Stage All Changes

Stage all changed files by listing them explicitly from `git status --porcelain` output (NOT `git add -A`).

### 2. Build Commit Message

Construct the commit message:

- **Title:** `fix({story_key}): code review corrections`
- **Body:** List the patches applied (one line per finding: severity, location, short description). If `defer` findings exist, add a line: "Deferred items noted for follow-up."

If `{story_key}` is not set (manual review, no story context), use title: `fix: code review corrections`

### 3. Create Commit

Run `git commit` with the constructed message. Set `{committed}` = `true`.

### 4. Wrap Up

Announce commit result (or skip reason). If a merge was performed, include the merge result.

Present follow-up options:

> **What would you like to do next?**
> 1. **Start the next story** — run `dev-story` to pick up the next `ready-for-dev` story
> 2. **Re-run code review** — review again after additional changes
> 3. **Done** — end the workflow

**HALT** — waiting for user choice.
