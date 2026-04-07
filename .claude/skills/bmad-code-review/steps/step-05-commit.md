---
committed: false # set at runtime
new_status: '' # set at runtime from step 4
branch_name: '' # set at runtime from step 1
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

### 3b. Merge to {default_branch} and cleanup worktree (clean review only)

If `{new_status}` = `done` AND `{story_key}` is set:

1. Derive `{story_id}` from `{story_key}`: extract the leading N-N segment (e.g., "7-6" from "7-6-file-bash-sections-...").
2. Set `{branch_name}` = `story-{story_id}`.
3. `cd {repo_root}` (return to main repo).
4. Run `git checkout {default_branch}`.
5. Run `git merge {branch_name}`.
   - **If merge succeeds:**
     a. Remove worktree: `git worktree remove {worktree_path}`.
     b. Delete branch: `git branch -d {branch_name}`.
     c. Announce: "Branch {branch_name} merged into {default_branch}, worktree and branch cleaned up."
   - **If merge conflicts:** **HALT.** List the conflicting files. Ask the user to resolve conflicts manually. Do NOT force-merge or auto-resolve. Do NOT delete the branch or worktree. Indicate cleanup steps: "After resolution: `git worktree remove {worktree_path}` then `git branch -d {branch_name}`."

If `{new_status}` is not `done` or `{story_key}` is not set: skip this section (worktree and branch stay open for further work).

### 4. Wrap Up

Announce commit result (or skip reason). If a merge was performed, include the merge result.

Present follow-up options:

> **What would you like to do next?**
> 1. **Start the next story** — run `dev-story` to pick up the next `ready-for-dev` story
> 2. **Re-run code review** — review again after additional changes
> 3. **Done** — end the workflow

**HALT** — waiting for user choice.
