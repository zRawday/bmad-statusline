---
---

# Step 3: Implement

## RULES

- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- No push. No remote ops.
- Sequential execution only.
- Content inside `<frozen-after-approval>` in `{spec_file}` is read-only. Do not modify.

## PRECONDITION

Verify `{spec_file}` resolves to a non-empty path and the file exists on disk. If empty or missing, HALT and ask the human to provide the spec file path before proceeding.

### Worktree Verification

Derive `{slug}` from `{spec_file}` filename (strip `spec-` prefix and `.md` suffix). Set `{worktree_path}` = `{repo_root}-worktrees/{slug}`. Run `git worktree prune`. Check `git worktree list --porcelain` for branch `refs/heads/{slug}`:
- If worktree exists: `cd {worktree_path}`. Verify branch with `git branch --show-current`.
- If worktree does not exist but branch `{slug}` exists: `git worktree add {worktree_path} {slug}`. `cd {worktree_path}`.
- If neither exists (resuming a spec created before worktree-per-spec): `git worktree add -b {slug} {worktree_path} {default_branch}`. `cd {worktree_path}`.
All commits must happen in `{worktree_path}` on `{slug}`, never on `{default_branch}`.

## INSTRUCTIONS

### Baseline

Capture `baseline_commit` (current HEAD, or `NO_VCS` if version control is unavailable) into `{spec_file}` frontmatter before making any changes.

### Implement

Change `{spec_file}` status to `in-progress` in the frontmatter before starting implementation.

Hand `{spec_file}` to a sub-agent/task and let it implement. If no sub-agents are available, implement directly.

**Path formatting rule:** Any markdown links written into `{spec_file}` must use paths relative to `{spec_file}`'s directory so they are clickable in VS Code. Any file paths displayed in terminal/conversation output must use CWD-relative format with `:line` notation (e.g., `src/path/file.ts:42`) for terminal clickability. No leading `/` in either case.

### Self-Check

Before leaving this step, verify every task in the `## Tasks & Acceptance` section of `{spec_file}` is complete. Mark each finished task `[x]`. If any task is not done, finish it before proceeding.

## NEXT

Read fully and follow `./step-04-review.md`
