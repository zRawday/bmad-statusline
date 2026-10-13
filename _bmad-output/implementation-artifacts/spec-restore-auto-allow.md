---
title: 'Restore Auto-Allow — global + per-session, guarded by a tool allowlist'
type: 'feature'
created: '2026-08-15'
baseline_commit: b88f3e890d1c4a39b9c70553f2cd1842145bf1d9
status: 'done'
review_loop_iteration: 1
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Auto-Allow was removed in `9e82367` because the hook stopped gating on `_bmad/`, making `handlePermissionRequest` reachable everywhere — a global `config.autoAllow` would then have auto-approved *every* tool in *every* directory. The user wants the feature back, including the global switch, and README still documents it (L22, L153-160) so code and docs currently disagree.

**Approach:** Restore the removed implementation **verbatim** from `9e82367^` — global `config.autoAllow`, per-session `.autoallow-{sid}` with `off` override, the two-row `AutoAllowMenu`, the `a` shortcut and the red title indicator — then add **one new guard**: the hook emits `allow` only when `payload.tool_name` is on an explicit allowlist. The human was shown that this leaves the global flag machine-wide and accepted it; the allowlist is what makes that acceptable, by ensuring no tool that asks the human a question can ever be auto-answered.

## Boundaries & Constraints

**Always:**
- The allow decision requires **both** auto-allow enabled (session flag `on`, or global `true` with no `off` override) **and** an allowlisted `tool_name`. Either missing → observe only, `llm_state='permission'`.
- Flag precedence is unchanged from the original: session `.autoallow-{sid}` (`on`/`off`) wins, else global `config.autoAllow`, else disabled.
- `process.stdout.write` is the ONLY hook stdout, and only for the decision JSON (Pattern 1 exception). Never `console.log`.
- Decision shape is `{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}` — `decision` is an object; verified against the Claude Code hooks docs.
- Synchronous I/O only (Pattern 2). `isSafeId()` validates the session id before any path is built.
- `resolveAutoAllow` in `monitor-utils.js` stays the single source the title indicator reads, mirroring the hook's precedence exactly, so the UI cannot lie about what the hook will do.
- Auto-allowing keeps `llm_state='active'` — never `'permission'`.

**Ask First:**
- Adding any tool to the allowlist beyond the seven named below plus the `mcp__` prefix.
- Making the allowlist implicit (broader wildcards, "allow unless denied", or reading it from `config.json`).

**Never:**
- No `deny` decisions, no `updatedInput`, no `interrupt` — allow, or stay silent.
- Do not gate the global flag on `foundBmad`. The human explicitly chose machine-wide scope after being shown the BMAD-scoped alternative.
- Do not restore the removed `_bmad/` walk-up exit — non-BMAD session tracking stays exactly as it is.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Session flag on, allowlisted tool | `.autoallow-{sid}`=`on`, `tool_name:"Bash"` | allow JSON, `llm_state='active'` | N/A |
| Global on, no session flag | `config.autoAllow=true`, `tool_name:"Edit"` | allow JSON, `llm_state='active'` | N/A |
| MCP tool, enabled | enabled, `tool_name:"mcp__claude_ai_Gmail__send_message"` | allow JSON, `llm_state='active'` | N/A |
| Session off overrides global on | flag=`off`, `config.autoAllow=true` | no stdout, `llm_state='permission'` | N/A |
| Interactive tool, enabled | enabled, `tool_name:"AskUserQuestion"` | no stdout, `llm_state='permission'` | N/A |
| Unknown/new tool, enabled | enabled, `tool_name:"SomeFutureTool"` | no stdout, `llm_state='permission'` | fail-safe by design |
| `tool_name` absent or empty | enabled, no `tool_name` key | no stdout, `llm_state='permission'` | N/A |
| Nothing enabled | no flag, no `autoAllow` | no stdout, `llm_state='permission'` | reads throw → disabled |
| Unsafe session id | `session_id` fails `isSafeId()` | no stdout, `llm_state='permission'` | no path built |
| `config.json` corrupt | invalid JSON, no session flag | no stdout, `llm_state='permission'` | try/catch → disabled |

</frozen-after-approval>

## Code Map

Most of this is a revert. `git show 9e82367` is the removal diff; `git show 9e82367^:<path>` recovers any file verbatim.

- `src/hook/bmad-hook.js` -- restore `CONFIG_DIR` (§2, after `CACHE_DIR` L10) and `isAutoAllowEnabled(sid)` (after `shouldUpdateStory()`, ~L64). Rewrite `handlePermissionRequest()` (L648-652, currently observe-only) with the restored branch **plus** the new tool check. `isSafeId()` L37. Dispatch L221-222 needs no change.
- `test/hook.test.js` -- `makePermissionRequestPayload()` L187 **must gain a `tool_name` argument**. Entry-point structure test L1656 asserts `CACHE_DIR` precedes `readFileSync(0` — new constants stay in §2. Test L2856 (`never emits a decision`) **must be rewritten**: it now holds only for non-allowlisted tools. The 5 removed auto-allow tests are recoverable and still valid once given an allowlisted `tool_name`.
- `src/tui/monitor/monitor-utils.js` -- restore `resolveAutoAllow(cachePath, configDir, sessionId)` verbatim (was L67-95 pre-commit), including the `path` import if the revert dropped it.
- `src/tui/monitor/components/AutoAllowMenu.js` -- NEW file, restored verbatim. Only edit: the two warning lines must state that allow is limited to the allowlisted tools, not "All permission prompts" — same two-line layout, accurate wording.
- `src/tui/monitor/MonitorScreen.js` -- restore `path`/`os` imports (L1-2 pre-commit), the `AutoAllowMenu` import (L11), `resolveAutoAllow` in the `monitor-utils` import (L8), `autoAllowMenu` state (after L107), the `configDir` + memoized `isAutoAllowActive` block **above** the detail early-return (~L203, rules of hooks), the `a` handler (~L260), the `useInput` guard (L301), the title indicator (L421-424), the content-hiding branch (L438-439), the footer branch (L447-452), and the shortcut entry in `getShortcuts` (L40+, before `Esc`).
- `test/tui-monitor-components.test.js`, `test/tui-monitor.test.js` -- restore the removed suites verbatim (4 component tests incl. the global-flag one, 2 monitor tests).
- `README.md` -- L22 bullet and L153-160 `### Auto-Allow` describe the feature but predate the allowlist; add the tool restriction.
- `_bmad-output/project-context.md` -- L454 truth-table row carries `Do not reintroduce it.` Rewrite it to the restored contract, recording that the machine-wide scope is a deliberate human decision and the allowlist is the guard, so a future agent does not re-remove it.

## Tasks & Acceptance

**Execution:**
- [x] **Task 0 (investigation, do first)** -- register a temporary PermissionRequest hook dumping `payload` to the scratchpad; trigger `AskUserQuestion` and a plan-mode exit; record whether either fires `PermissionRequest` and with what `tool_name`. Remove the temporary hook before any commit. Record the finding in Design Notes. Method precedent: story 8-6.
- [x] `src/hook/bmad-hook.js` -- add `AUTO_ALLOW_TOOLS` (`Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `WebFetch`) and `CONFIG_DIR` in §2; restore `isAutoAllowEnabled()`; add `isAutoAllowableTool()`; rewrite `handlePermissionRequest()` to require both -- the whole feature; §2 placement keeps the L1656 structure test green.
- [x] `src/tui/monitor/monitor-utils.js` -- restore and export `resolveAutoAllow` -- the indicator must not diverge from hook precedence.
- [x] `src/tui/monitor/components/AutoAllowMenu.js` -- NEW, verbatim restore, warning wording corrected -- a WARNING banner that overstates what happens is a defect.
- [x] `src/tui/monitor/MonitorScreen.js` -- restore all nine integration points listed in the Code Map -- returns the exact prior interaction.
- [x] `test/hook.test.js` -- add `tool_name` to the payload factory; cover every I/O Matrix row; rewrite the L2856 observe-only test to assert non-allowlisted tools still emit nothing -- the allowlist is the load-bearing guard and needs the densest coverage.
- [x] `test/tui-monitor-components.test.js`, `test/tui-monitor.test.js` -- restore the removed suites.
- [x] `README.md`, `_bmad-output/project-context.md` -- document the restored feature **and** its tool restriction; replace the `Do not reintroduce it.` rule -- docs currently contradict the code in both directions.

**Round 1 review — added 2026-08-15. All of the above stays; these are additive.**

- [x] `package.json` -- bump `version` to `1.8.0` -- **without this the feature never runs.** `isDeployStale()` (`src/deploy.js:56`) returns false when the deploy stamp equals the package version, so every existing 1.7.0 install keeps executing the old observe-only `~/.config/bmad-statusline/bmad-hook.js` while the monitor shows the toggle and the red indicator working.
- [x] `src/tui/monitor/components/AutoAllowMenu.js`, `src/tui/monitor/MonitorScreen.js`, `src/tui/app.js` -- the menu must **not** write `config.json` itself. Route the `Always` toggle through the App-owned config state (a callback prop threaded to `MonitorScreen` and on to the menu, in the style of `updateConfig`) -- App holds the config loaded at startup and `writeInternalConfig` full-replaces on quit and on every edit, so a direct disk write is silently undone. The safety-critical direction is disabling: turning `Always` off then quitting rewrites `autoAllow: true`.
- [x] `src/hook/bmad-hook.js` -- replace `process.stdout.write(...)` with a guarded synchronous write (`try { fs.writeSync(1, json); } catch {}`) -- the dispatcher calls `process.exit(0)` immediately after, and stdout-to-pipe is asynchronous on POSIX, so the decision can be dropped before flush; an EPIPE would also throw and break the silent-always contract. This satisfies the frozen "ONLY hook stdout" boundary, which constrains *what* is written and that there is a single channel, not which API call is used.
- [x] `src/tui/monitor/monitor-utils.js` -- `resolveAutoAllow` must apply the same session-id validation as the hook's `isSafeId()` before building any path -- the frozen boundary requires it to mirror the hook exactly; without the guard the indicator can read an arbitrary path and contradict the hook.
- [x] `test/tui-monitor-components.test.js`, `test/tui-app.test.js` -- test both toggle directions, not only off→on: a second Enter on `This session` removes the flag file; `Always` starting from `autoAllow: true` writes `false`; and an App-level test that mounts `App`, toggles in the monitor, quits, and re-reads `config.json` in **both** directions -- mutation testing proved both off-paths can be broken with the suite still fully green.
- [x] `src/tui/monitor/components/AutoAllowMenu.js` -- banner wording: `mcp__*` (currently renders as "mcp__ / permission prompts", which reads as "mcp__ permission prompts"), and state that `Always` applies to every session on the machine in any directory -- the banner names the tools but omits the scope that made the allowlist necessary.
- [x] `src/tui/monitor/MonitorScreen.js` -- gate the `a` entry in `getShortcuts` on having an active session -- the handler already requires `sessionId`, so the bar currently advertises an inert key.
- [x] `test/hook.test.js` -- rename the `AC10`/`AC11`/`AC12` test titles (this spec's ACs are unnumbered; `AC12` labels three different tests) and assert the hook exits 0 in `execHookWithConfig` -- the catch returns `e.stdout || ''`, so every "must not be auto-allowed" assertion would pass vacuously if the hook crashed.

**Acceptance Criteria:**
- Given a user already installed at the previous version, when they upgrade and start a session, then the deployed hook is re-synced and auto-allow actually takes effect.
- Given `Always` is on and the user turns it off in the monitor and then quits the TUI, when the TUI is relaunched or a `PermissionRequest` fires, then auto-allow is off — the setting survives the App's own config write in both directions.
- Given a `PermissionRequest` that is auto-allowed, when the hook exits, then the complete decision JSON has reached stdout (synchronous write, never truncated by process exit).
- Given `config.autoAllow=true` and no session flag, when a `PermissionRequest` fires for `Bash` in any directory, then stdout carries the allow JSON and `llm_state` is `active`.
- Given auto-allow enabled by any tier, when a `PermissionRequest` fires for a tool absent from the allowlist, then stdout is empty and `llm_state` is `permission`.
- Given the monitor in normal mode with an active session, when the user presses `a`, then the two-row menu opens, the content viewport is hidden, and the main `useInput` stops responding until `Esc`.
- Given the menu, when `Always` is toggled, then `config.json` gains `autoAllow: true` and the red `Auto-allow` indicator appears for sessions without an `off` override.
- Given the repository, when `npm test` runs, then every test passes.

## Spec Change Log

### 2026-08-15 — review round 1 (blind hunter + edge case hunter + verification gap)

Human chose to amend and fix in place rather than revert and re-derive. The round-1 implementation is sound where it was specified; every finding below is a gap the spec left open, not a deviation from it.

**1. bad_spec — the feature would never have run.** The spec said nothing about the deploy mechanism. `isDeployStale()` compares the deploy stamp to `package.json`'s version, which the change did not touch, so every existing 1.7.0 install keeps running the old observe-only hook while the restored monitor UI reports auto-allow as active. Known-bad state avoided: shipping a permission feature whose UI claims it is on while the deployed hook ignores it — the exact inverse of the spec's own "the UI cannot lie about what the hook will do" invariant. Amended with a `package.json` version-bump task.

**2. bad_spec — the off switch did not persist.** The spec's "restore verbatim" instruction carried over a `config.json` writer that bypasses the App-owned config state. App loads the config at startup and `writeInternalConfig` full-replaces on quit and on every edit, so the menu's direct write is silently undone. Verified empirically by the verification-gap reviewer running the real `loadConfig`/`writeInternalConfig` modules in production order, in both directions. Known-bad state avoided: a user disables machine-wide auto-approval, quits, and `autoAllow: true` is written back — the hook keeps auto-approving `Bash`/`Write`/`Edit`/MCP everywhere while the user believes it is off. Amended to route the toggle through App state.

**3. bad_spec — non-atomic config write.** Same writer used a plain `fs.writeFileSync` on `config.json`, while `src/tui/config-writer.js:19-24` deliberately uses temp+rename with a comment naming this exact hazard. The whole widget layout, colors and presets live in that file. Folded into finding 2's fix: routing through App state means the atomic writer is the only path.

**4. bad_spec — the allow decision could be dropped.** `process.stdout.write` is followed immediately by `process.exit(0)`; stdout-to-pipe is asynchronous on POSIX, and an EPIPE would throw and break the silent-always contract. Both hunters raised it independently. Amended to a guarded `fs.writeSync(1, …)`.

**5. bad_spec — both off-paths were untested.** Mutation testing proved it: inverting `writeGlobalFlag(configDir, !globalFlag)` and the session `null`/unlink arm left 122 tests passing. Failure mode is one-way — auto-allow could be switched on but not off. Amended with bidirectional toggle tests plus an App-level round-trip test.

**6. patch — `resolveAutoAllow` did not mirror the hook's `isSafeId` guard**, contradicting the frozen boundary that requires exact mirroring. Plus banner wording (`mcp__*`, and the missing machine-wide scope statement), the `a` shortcut advertised without an active session, and test titles citing `AC10`/`AC11`/`AC12` which do not exist in this spec.

**KEEP on any re-derivation:**
- The two-conjunct structure in `handlePermissionRequest` and `isAutoAllowableTool`'s fail-closed shape — mutation testing confirmed the conjunct is load-bearing (removing it fails exactly 3 tests), and set membership (not prefix matching) for the named tools is what makes `Bashful` fail.
- `AUTO_ALLOW_TOOLS` declared in §2 — the entry-point structure test asserts `CACHE_DIR` precedes `readFileSync(0`.
- `MonitorScreen.js` byte-identical to its pre-removal state, apart from the round-1 fixes listed above.
- The hook test matrix: near-miss names, non-string `tool_name`, `autoAllow` truthy-but-not-`true`, unsafe session id, corrupt config, and the source-level assertion that the hook never denies, escalates, rewrites input, or calls `console.log`.
- The `project-context.md` Auto-Allow section recording that the restoration and the machine-wide scope are deliberate human decisions — it exists to stop a future agent removing the feature again.
- The Task 0 finding table, including that `ExitPlanMode` really does reach `handlePermissionRequest` and is deliberately off the allowlist.
- The non-BMAD tracking changes from `9e82367` must stay unreverted.

## Design Notes

The only genuinely new code. Fail-closed on anything that is not a non-empty string, so a malformed payload can never widen approval:

```js
const AUTO_ALLOW_TOOLS = new Set(['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch']);

function isAutoAllowableTool(name) {
  if (typeof name !== 'string' || !name) return false;
  return AUTO_ALLOW_TOOLS.has(name) || name.startsWith('mcp__');
}
```

`handlePermissionRequest` gains one conjunct: `if (isAutoAllowEnabled(sessionId) && isAutoAllowableTool(payload.tool_name))`. Everything else in that function is the restored original.

`mcp__` is a prefix rule because MCP tool names are server-generated and cannot be enumerated in advance. The human accepted this when choosing the allowlist over the MCP-excluded variant.

`AskUserQuestion` and `ExitPlanMode` appear nowhere in the Claude Code hooks documentation, so whether they surface as `PermissionRequest` is unverified — Task 0 settles it. The allowlist makes the answer non-load-bearing, which is why it was preferred over a denylist.

### Task 0 finding (2026-08-15) — settled from the official docs, not a live hook dump

**Method deviation, stated plainly.** The spec prescribed registering a temporary `PermissionRequest` hook and dumping payloads. That was not done: registering a hook means editing a Claude Code settings file, which an agent must not do on its own, and the two triggers (`AskUserQuestion`, plan-mode exit) cannot be driven from inside a subagent run anyway. The question was instead settled against the official reference, which turned out to answer it directly.

**Findings** (source: `code.claude.com/docs/en/tools-reference.md`, `Permission required` column; and `code.claude.com/docs/en/hooks.md`):

| Tool | Permission required | Fires `PermissionRequest`? | On the allowlist? | Net effect |
|------|--------------------|---------------------------|-------------------|------------|
| `AskUserQuestion` | **No** | No — never enters the permission flow | No | Always reaches the human. Guarded twice. |
| `ExitPlanMode` | **Yes** | **Yes**, `tool_name: "ExitPlanMode"` | No | Hook stays silent; plan approval still reaches the human. |
| `Bash`, `Write`, `Edit`, `WebFetch` | Yes | Yes | Yes | Auto-allowed when a flag tier is on. |
| `Read`, `Glob`, `Grep` | No (inside cwd) | Only outside the working directory | Yes | Auto-allowed when they do prompt. |

So the case the allowlist was designed for is real: `ExitPlanMode` genuinely arrives at `handlePermissionRequest`, and only the allowlist keeps it from being auto-approved. `tool_name` is a documented core field of the `PermissionRequest` payload, so the conjunct always has something to test.

**Decision shape re-verified.** The frozen boundary's `decision: { behavior: 'allow' }` (object) is **correct** — confirmed verbatim against the `PermissionRequest Decision Control` section of the hooks reference, which documents `behavior` as a required key accepting `"allow" | "deny" | "escalate"`, alongside optional `message` and `updatedInput`. A research pass initially reported `decision` as a plain string; that was wrong and was refuted by fetching the section directly. No code change followed from it.

## Verification

**Commands:**
- `npm test` -- expected: full suite green, including the new allowlist matrix tests and the unchanged entry-point structure test.
- `git diff 9e82367^ -- src/hook/bmad-hook.js src/tui/monitor/` -- expected: the only differences from the pre-removal state are the allowlist constant, `isAutoAllowableTool`, the added conjunct, the corrected warning wording, and whatever `9e82367` legitimately changed for non-BMAD tracking (walk-up, `started_at`, `sessionLabel`, `pollSessions` shape check) — which must NOT be reverted.

- `grep -n '"version"' package.json` -- expected: `1.8.0`, so `isDeployStale()` re-syncs the deployed hook.
- `grep -n 'process.stdout.write' src/hook/bmad-hook.js` -- expected: no match; the decision goes out through a guarded `fs.writeSync(1, …)`.
- `grep -n 'writeFileSync' src/tui/monitor/components/AutoAllowMenu.js` -- expected: no `config.json` write; the `Always` toggle goes through the App-owned config path.

**Round-1 mutation checks** (run each, confirm it fails, then restore):
- Invert the `Always` toggle (`writeGlobalFlag(configDir, !globalFlag)` → `true`) -- expected: at least one test fails.
- Invert the session off-path (`globalFlag ? 'off' : null` → `globalFlag ? 'off' : 'on'`) -- expected: at least one test fails.
- Drop the `isAutoAllowableTool` conjunct -- expected: at least 3 tests fail.

**Round-1 mutation results (2026-08-15, all confirmed killed):**

| Mutation | Result |
|----------|--------|
| `setAutoAllow(!globalFlag)` → `setAutoAllow(true)` | 2 failures |
| session off-path `globalFlag ? 'off' : null` → `… : 'on'` | 1 failure |
| drop the `isAutoAllowableTool` conjunct | 3 failures |
| `setAutoAllow` body → no-op (toggle never reaches App state) | 4 failures — all App round-trip tests |
| `resolveAutoAllow`'s `isSafeId` guard → `!sessionId` | 2 failures |
| `fs.writeSync(1, …)` → `process.stdout.write` | 1 failure (source-assertion test) |

The last one is caught structurally, not behaviourally: on Windows a pipe write is
synchronous, so the dropped-output failure mode cannot be reproduced on this machine.
The assertion that `process.stdout.write` does not appear in the hook's code is what
holds the line — noted as a known limitation rather than a claim of behavioural proof.

The `isSafeId` and no-op-`setAutoAllow` mutations initially survived; the tests that
kill them were added in response. Two of the new App tests also had to be given a
`finally { unmount() }`, because MonitorScreen polls on an interval and a failing
assertion left the runner hanging instead of reporting — a test that hangs on failure
is not a test that passes.

**Manual checks (if no CLI):**
- Toggle `Always` on, start a fresh session in an unrelated directory, run a command needing permission — it executes without a prompt.
- Toggle `Always` **off**, quit the TUI with `q`, relaunch it, and confirm it is still off.
- With auto-allow on, confirm an interactive question still stops and waits for you.

## Suggested Review Order

**The decision path — start here**

- Entry point: both conjuncts required before any decision is emitted.
  [`bmad-hook.js:678`](../../src/hook/bmad-hook.js#L678)

- The guard that carries the whole intent — fail-closed, set membership, one prefix rule.
  [`bmad-hook.js:91`](../../src/hook/bmad-hook.js#L91)

- The allowlist itself, in §2 so the entry-point structure test stays green.
  [`bmad-hook.js:15`](../../src/hook/bmad-hook.js#L15)

- Flag precedence: session file wins, global config falls back, everything else is off.
  [`bmad-hook.js:72`](../../src/hook/bmad-hook.js#L72)

- `fs.writeSync` not `process.stdout.write` — the dispatcher exits before an async flush lands.
  [`bmad-hook.js:690`](../../src/hook/bmad-hook.js#L690)

**Config ownership — the round-1 fix that matters most**

- App owns the global flag; committed immediately, never left in the debounce window.
  [`app.js:74`](../../src/tui/app.js#L74)

- `immediate` opt-in added to Pattern 15's writer; additive, existing call sites untouched.
  [`app.js:51`](../../src/tui/app.js#L51)

- The menu now receives the flag and a setter — it must never write `config.json` itself.
  [`AutoAllowMenu.js:32`](../../src/tui/monitor/components/AutoAllowMenu.js#L32)

**Monitor surface**

- Menu mounts with App-owned state, replacing the shortcut bar while open.
  [`MonitorScreen.js:472`](../../src/tui/monitor/MonitorScreen.js#L472)

- Shortcut gated on an active session, so the bar never advertises an inert key.
  [`MonitorScreen.js:88`](../../src/tui/monitor/MonitorScreen.js#L88)

- Indicator resolution mirrors the hook, `isSafeId` guard included.
  [`monitor-utils.js:95`](../../src/tui/monitor/monitor-utils.js#L95)

- Banner names the allowlisted tools and the machine-wide scope — overstating either is a defect.
  [`AutoAllowMenu.js:88`](../../src/tui/monitor/components/AutoAllowMenu.js#L88)

**Peripherals**

- Version bump — without it `isDeployStale()` never re-syncs the deployed hook.
  [`package.json:3`](../../package.json#L3)

- Round-trip persistence across a real App quit, in both directions.
  [`tui-app.test.js:299`](../../test/tui-app.test.js#L299)
