# Story 10.5: Rev.7 flag reconciliation — widget count, Boundary 2 wording, intentional asymmetry

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **maintainer keeping docs and tests consistent with the shipped feature**,
I want **the three flags raised in Architecture Rev.7 reconciled across tests and project docs**,
so that **future agents see "13 widgets" everywhere, understand that the reader legitimately owns cache-dir bookkeeping, and know the widget/screen visibility asymmetry is intentional**.

## Context

This is the **final story of Epic 10** (Weekly Usage). It is a **documentation + reconciliation sweep — NO production code changes**. The feature is fully built and reviewed:

- **10.1 (done):** shared math (`computeWeeklyUsage`, `computeWeekDayTicks`, zones, `WEEKDAY_LABELS`) in `shared-constants.cjs`, bridged to ESM via `defaults.js`.
- **10.2 (done):** reader `weeklyusage` extractor + `persistUsageSnapshot()` writing the account-global `weekly-usage.json` snapshot, + self-color exclusion. Its review **fixed** the shared-`.tmp` concurrency by switching to a **per-process** temp (carry-in below).
- **10.3 (done):** 13th widget registered (`bmad-weeklyusage`) + configurator preview. Its dev **already moved the two `tui-*` test counts to 13**.
- **10.4 (done):** read-only "Weekly usage" TUI screen + Home button + app routing. Suite green at 718/718.

**The test suite is ALREADY green at 13** — `tui-widget-registry.test.js` and `tui-preview-utils.test.js` were updated by 10.3 (verified: `widgets.length === 13`, `Object.keys(SAMPLE_VALUES).length === 13`). So this story's `npm test` job is **regression-verification only**; the docs you edit are not asserted by any test. The real work is **prose**: `_bmad-output/project-context.md`, the `README.md` widget count, and one deferred `architecture.md` reconciliation.

### What this story touches (and ONLY this)

| File | Why | Kind |
|------|-----|------|
| `_bmad-output/project-context.md` | flags #1/#2/#3 + Pattern 29 ref + self-color prose | doc edits |
| `README.md` | flag #1 — widget count `11` → `13` + complete the widget list | doc edit |
| `_bmad-output/planning-artifacts/architecture.md` | **carry-in** — reconcile the `persistUsageSnapshot` `.tmp` reference to the as-built per-pid form (deferred from 10.2 review, "do in 10.5") | doc edit |

**No source code, no tests, no registry, no reader, no installer.** If you find yourself editing anything under `src/` or `test/`, stop — you are out of scope (see Anti-patterns).

### ⚠️ Reconciliation discipline — every doc change must match as-built CODE, not the old spec

This is a "make the docs tell the truth" story. Each edit below was checked against the live code on 2026-06-10. Do not invent; copy the verified target text. Where a line number is given it is a **2026-06-10 anchor** — match on the quoted text, since earlier edits in the same file shift later line numbers.

## Acceptance Criteria

### AC1: widget count → 13 everywhere (flag #1)
**Given** every "11 widgets" / "12 widgets" count and "all 12 widget IDs" reference in prose — specifically `_bmad-output/project-context.md` (the "**12 widgets** (widget registry…)" heading, the 12-row widget table, the three `"...all 12 widget IDs..."` JSON comments, the `widgetOrder` "**all 12 widget IDs**" rule, the BF1 "renders all 12 widgets" cell) **and `README.md`** (the "**11** configurable widgets across 3 lines" feature bullet, whose list also omits Context % and Weekly Usage)
**When** swept for this story
**Then** every widget-count reference reads **13**; the `project-context.md` widget table gains a `bmad-weeklyusage` row (`weeklyusage` / Weekly Usage / `false` / `—` / `dynamic`); the README bullet reads "**13** configurable widgets…" with `Context %` and `Weekly Usage` added to its widget list; and **no remaining prose claims 11 or 12 widgets**.
**And** the test-suite widget counts are confirmed already at 13 (`tui-widget-registry.test.js`, `tui-preview-utils.test.js`) — **no test edit is needed or allowed** for the widget count, and the **12-count *event-type* assertions** (`test/defaults.test.js`, `test/install.test.js`: "12 event types") are **left untouched** (they are not widget counts).

### AC2: Boundary 2 wording reconciled (flag #2)
**Given** `_bmad-output/project-context.md` "Boundary 2: Reader (runtime, standalone) — THE CONSUMER"
**When** updated
**Then** the "read-only consumer" framing is reconciled to "**read-only w.r.t. config & status; owns cache-dir bookkeeping (alive files + usage snapshot)**" consistent with Pattern 29 — so it no longer contradicts the reader's `persistUsageSnapshot` write. Pattern 20 (`Reader NEVER writes to config.json`) is already correctly narrow and stays as-is (it scopes the rule to `config.json`).

### AC3: intentional asymmetry documented (flag #3)
**Given** project documentation (project-context.md, and optionally README where the widget is described)
**When** updated
**Then** it states the intentional asymmetry as **deliberate, not a bug**: the `bmad-weeklyusage` **statusline widget renders only inside a tracked BMAD session** (the `line N` reader returns `''` when there is no status file), while the **TUI "Weekly usage" screen works anywhere** (the snapshot is persisted **before** the `line N` early-return).

### AC4: Pattern 29 referenced where reader cache-dir duties are described
**Given** Pattern 29 (Reader Usage-Snapshot Cache) is realized in code (the call-site comments in `bmad-sl-reader.js` already say `(Pattern 29)`)
**When** `project-context.md` is reviewed
**Then** it references **Pattern 29 / the `weekly-usage.json` snapshot** where the reader's cache-dir responsibilities are described (the "Reader piggybacking cleanup" and/or Boundary 2 area), so the documented contract matches the as-built reader.

### AC5: self-coloring exclusion prose lists all three (flag #1 corollary)
**Given** the "Color application in `line N`" prose stating *"`bmad-llmstate` AND `bmad-contextpct` are excluded from generic fixed-color application"*, and the DO/DON'T summary line repeating the two-widget form
**When** updated for this story
**Then** both list **all three** self-coloring widgets — `bmad-llmstate`, `bmad-contextpct`, **and `bmad-weeklyusage`** — matching the as-built guard (`bmad-sl-reader.js:286`, which already excludes all three). No stale two-widget wording remains.

### AC6: full reconciliation, suite green
**Given** the full reconciliation
**When** `npm test` runs
**Then** all tests pass (full suite — `node --test --test-concurrency=4 --test-timeout=30000 test/*.test.js`), **zero failures**, and no doc references contradict the 13-widget, snapshot-writing reader reality. (Doc-only edits must not change any test outcome; a non-green suite means something other than docs was touched.)

### AC7: `.tmp` per-pid reconciliation in architecture.md (deferred-work carry-in)
**Given** `deferred-work.md` records (under "Deferred from … 10-2 … do in 10.5") that the Rev.7 `persistUsageSnapshot` reference body in `_bmad-output/planning-artifacts/architecture.md` still shows the **old shared `weekly-usage.json.tmp`** form and the "torn read is impossible" safety prose still assumes a shared temp
**When** updated for this story
**Then** the architecture.md reference body and its concurrency prose are reconciled to the **as-built per-process temp** form (`USAGE_PATH + '.' + process.pid + '.tmp'`, with unlink-on-failure), so the locked spec matches the corrected 10.2 implementation. (This is the one planning-artifact edit; it is explicitly assigned to this story.)

## Tasks / Subtasks

- [x] **Task 1 — Widget count → 13 in project-context.md + README** (AC: 1)
  - [x] 1.1 `project-context.md` line ~643: `**12 widgets (widget registry — \`src/tui/widget-registry.js\` \`INDIVIDUAL_WIDGETS\`):**` → `**13 widgets …`.
  - [x] 1.2 `project-context.md` widget table (ends with the `bmad-timer` row, ~line 658): **append a 13th row** immediately after the `bmad-timer` row (registry order — `weeklyusage` is the last `INDIVIDUAL_WIDGETS` entry, index 12):
    `| \`bmad-weeklyusage\` | \`weeklyusage\` | Weekly Usage | false | — | dynamic |`
  - [x] 1.3 `project-context.md` lines ~602, ~613, ~618: change each `"...all 12 widget IDs..."` JSON comment to `"...all 13 widget IDs..."` (3 occurrences).
  - [x] 1.4 `project-context.md` line ~633: `- \`widgetOrder\` array contains **all 12 widget IDs**` → `**all 13 widget IDs**`. (Optional, recommended: in the trailing parenthetical, add that `bmad-weeklyusage` is likewise appended to pre-Rev.7 configs by `ensureWidgetOrder()` — this matches `tui-widget-registry.test.js`'s AC3 "appends bmad-weeklyusage to a legacy config" test.)
  - [x] 1.5 `project-context.md` line ~1037 (BF1 row): `Edit Line renders all 12 widgets from \`INDIVIDUAL_WIDGETS\`.` → `all 13 widgets`.
  - [x] 1.6 (Recommended, AC1 consistency) `project-context.md` line ~635: the `colorModes[id].mode` "dynamic" valid list `(valid for bmad-workflow, bmad-project, bmad-activeskill, bmad-llmstate, bmad-contextpct)` → add `bmad-weeklyusage` (its `defaultMode` is `dynamic`/self-colored).
  - [x] 1.7 (Optional, AC3 tie-in) `project-context.md` line ~660 default-layout note: add a clause that `bmad-weeklyusage` is registered but `defaultEnabled: false`, so it is selectable via `widgetOrder` yet appears on **no default line** (sets up the intentional-asymmetry note).
  - [x] 1.8 `README.md` line ~20: `- **11 configurable widgets across 3 lines** — LLM State, Project, Initial Skill, Active Skill, Story, Step, Next Step, Document, File Read, File Write/Edit, Timer` → `- **13 configurable widgets across 3 lines** — LLM State, Project, Initial Skill, Active Skill, Story, Step, Next Step, Document, File Read, File Write/Edit, Context %, Timer, Weekly Usage` (count → 13; add the two missing names `Context %` and `Weekly Usage`).
  - [x] 1.9 **Verify, do NOT edit:** `test/tui-widget-registry.test.js` (`widgets.length === 13`) and `test/tui-preview-utils.test.js` (`Object.keys(SAMPLE_VALUES).length === 13`) are already at 13. Do **not** touch the `12`-count **event-type** assertions in `test/defaults.test.js` / `test/install.test.js`.
- [x] **Task 2 — Boundary 2 wording (project-context.md)** (AC: 2)
  - [x] 2.1 In "Boundary 2: Reader (runtime, standalone) — THE CONSUMER" (line ~902), reconcile the "read-only" framing. Keep the heading, but make the body state the narrower truth: **read-only w.r.t. `config.json` & the status file; owns cache-dir bookkeeping (alive files + the `weekly-usage.json` usage snapshot)**. Concretely, augment the bullet `- Piggybacking cleanup: alive touch + stale purge on every invocation` to also mention the usage-snapshot write and cite Pattern 29 (e.g. add a bullet: `- Cache-dir bookkeeping (Pattern 29): writes \`.alive-*\` files and the account-global \`weekly-usage.json\` snapshot — never \`config.json\` (Pattern 20) and never the status file (Boundary 1).`).
  - [x] 2.2 Leave Pattern 20 (line ~363 `Reader NEVER writes to config.json — read-only consumer.`) **unchanged** — it is already correctly scoped to `config.json`.
- [x] **Task 3 — Intentional asymmetry doc** (AC: 3)
  - [x] 3.1 Add a concise note in `project-context.md` (natural spot: right after the widget table's default-layout note ~660, or in the `line N` extractor area). Text intent: *"Intentional asymmetry (Rev.7): the `bmad-weeklyusage` **widget** renders only inside a tracked BMAD session (the `line N` reader returns `''` with no `status-<sid>.json`), but the **TUI "Weekly usage" screen** works anywhere because the reader persists `weekly-usage.json` **before** the `line N` no-status early-return. Deliberate — not a bug."*
  - [x] 3.2 (Optional) Mirror a one-line version of the same note in `README.md` if/where the Weekly Usage widget is described. README currently does not describe the widget beyond the list; a short note is fine but not required by the AC.
- [x] **Task 4 — Pattern 29 reference (project-context.md)** (AC: 4)
  - [x] 4.1 Add a short **Pattern 29 — Reader Usage-Snapshot Cache** reference where reader cache-dir duties are described — the cleanest spot is right after the "Reader piggybacking cleanup" bullet block (~886) and/or folded into the Boundary 2 bullet from Task 2.1. Describe: the reader writes the account-global `weekly-usage.json` (`{ used_percentage, resets_at, captured_at }`) to the cache dir via atomic per-pid `.tmp`→rename with a content-change throttle; it is a side effect for the standalone TUI; the widget itself computes live from stdin and never reads the snapshot.
  - [x] 4.2 (Optional, flag #4 housekeeping) Bump the front-matter `existing_patterns_found: 28` → `29` if you add the Pattern 29 reference as a named pattern. Also optional: reconcile the pre-existing doc-version caption (`architecture.md (Rev.5)` on line ~14 and the line ~23 "Architecture Rev.5 … v1.2.1" caption) toward Rev.7 — this is flag #4 (pre-existing drift); keep the touch light and do not rewrite the front-matter wholesale.
- [x] **Task 5 — Self-coloring exclusion prose (project-context.md)** (AC: 5)
  - [x] 5.1 Line ~860: `- **\`bmad-llmstate\` AND \`bmad-contextpct\` are excluded from generic fixed-color application** (line ~251) — both self-color inside their extractor.` → list all three: `**\`bmad-llmstate\`, \`bmad-contextpct\`, AND \`bmad-weeklyusage\` are excluded …** (line ~286)` (also correct the stale `~251` → `~286`, the as-built guard line).
  - [x] 5.2 Line ~1220 (DO/DON'T summary): `- \`bmad-llmstate\` and \`bmad-contextpct\` self-color in their extractors — never apply generic fixed-color wrapping to them` → add `bmad-weeklyusage` to the list.
  - [x] 5.3 (Optional) Line ~863 self-color bullets: add a `bmad-weeklyusage` line mirroring the `bmad-contextpct` one (extractor self-colors via the zone color from `computeWeeklyUsage`).
- [x] **Task 6 — architecture.md `.tmp` per-pid reconciliation (carry-in)** (AC: 7)
  - [x] 6.1 In `_bmad-output/planning-artifacts/architecture.md` "Snapshot file — … I/O contract", update the `persistUsageSnapshot` reference body (the `fs.writeFileSync(USAGE_PATH + '.tmp', …)` / `fs.renameSync(USAGE_PATH + '.tmp', USAGE_PATH)` lines, ~2304-2305) to the **as-built per-process temp** form:
    ```js
    // Per-process temp: weekly-usage.json is account-global, so concurrent line N /
    // native readers must not share one .tmp (they would tear each other's write).
    // Scope the temp by pid; only the rename is shared, and rename is atomic.
    const tmp = USAGE_PATH + '.' + process.pid + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(snap, null, 2) + '\n'); // atomic (Pattern 8)
      fs.renameSync(tmp, USAGE_PATH);
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch {} // don't leak our temp on failure
      throw e;
    }
    ```
  - [x] 6.2 Update the concurrency prose just below (~2310): the "atomic `.tmp`→rename … the first writes, the rest see 'unchanged' and skip, and a torn read is impossible" sentence should reflect that **each writer owns a private per-pid temp** (so even non-identical concurrent writes can't tear each other), and only the final `renameSync` is shared and atomic.
- [x] **Task 7 — Verify** (AC: 6)
  - [x] 7.1 Run the full suite: `node --test --test-concurrency=4 --test-timeout=30000 test/*.test.js`. Expect **all green, zero failures** (doc edits don't affect tests; this confirms you didn't accidentally touch code/tests).
  - [x] 7.2 Final grep for stragglers: no remaining `11 widgets` / `12 widgets` / `all 12 widget IDs` / two-widget self-color wording in `project-context.md` or `README.md`. (Ignore the legitimate `12 event types` strings — those are not widget counts.)

## Dev Notes

### Exact current → target text (the precise sweep)

**project-context.md (line numbers are 2026-06-10 anchors; match on text):**

| Loc | Current | Target |
|-----|---------|--------|
| ~602 | `"widgetOrder": ["bmad-project", "bmad-workflow", "bmad-story", "...all 12 widget IDs..."],` | `…"...all 13 widget IDs..."],` |
| ~613 | `"widgetOrder": ["...all 12 widget IDs..."],` | `…all 13…` |
| ~618 | `"widgetOrder": ["...all 12 widget IDs..."],` | `…all 13…` |
| ~633 | `…contains **all 12 widget IDs** —…` | `**all 13 widget IDs**` |
| ~635 | `…(valid for bmad-workflow, bmad-project, bmad-activeskill, bmad-llmstate, bmad-contextpct)…` | `…, bmad-contextpct, bmad-weeklyusage)` |
| ~643 | `**12 widgets (widget registry — …):**` | `**13 widgets …**` |
| after ~658 | (table ends at `bmad-timer` row) | append `\| \`bmad-weeklyusage\` \| \`weeklyusage\` \| Weekly Usage \| false \| — \| dynamic \|` |
| ~860 | `**\`bmad-llmstate\` AND \`bmad-contextpct\` are excluded …** (line ~251)` | `**\`bmad-llmstate\`, \`bmad-contextpct\`, AND \`bmad-weeklyusage\` are excluded …** (line ~286)` |
| ~1037 | `Edit Line renders all 12 widgets from \`INDIVIDUAL_WIDGETS\`.` | `all 13 widgets` |
| ~1220 | `\`bmad-llmstate\` and \`bmad-contextpct\` self-color in their extractors …` | `\`bmad-llmstate\`, \`bmad-contextpct\`, and \`bmad-weeklyusage\` self-color …` |

**README.md ~20:** `**11 configurable widgets across 3 lines** — …, File Write/Edit, Timer` → `**13 configurable widgets across 3 lines** — …, File Write/Edit, Context %, Timer, Weekly Usage`.

### Verified as-built facts (so the docs match code, not the old spec)
- **Registry entry (`src/tui/widget-registry.js:18`)** — `{ id: 'bmad-weeklyusage', command: 'weeklyusage', name: 'Weekly Usage', hint: 'Claude plan weekly consumption vs week elapsed (subscribers)', defaultEnabled: false, defaultColor: null, defaultMode: 'dynamic' }`. → table row `weeklyusage / Weekly Usage / false / — / dynamic`. It is the **last** entry (index 12, the 13th), so append its table row after `bmad-timer`.
- **Self-color guard (`src/reader/bmad-sl-reader.js:286`)** — `if (widgetId !== 'bmad-llmstate' && widgetId !== 'bmad-contextpct' && widgetId !== 'bmad-weeklyusage' && colorMode && colorMode.mode === 'fixed' && colorMode.fixedColor) {` → the doc's exclusion list must name all **three**. (The old "~251" line ref is stale; it's ~286 now.)
- **`persistUsageSnapshot` is per-pid (`src/reader/bmad-sl-reader.js:182-207`)** — `const tmp = USAGE_PATH + '.' + process.pid + '.tmp';` then write→rename in a try, `unlinkSync(tmp)` + rethrow on failure. Call sites (`:261`, `:420`) already comment `(Pattern 29)`. This is the truth architecture.md must be reconciled to (Task 6).
- **Tests already at 13** — `test/tui-widget-registry.test.js:17,156` (`widgets.length, 13`), `:133-134,174,207` (`widgetOrder.length, 13`); `test/tui-preview-utils.test.js:13,26` (`13 widget keys`, `Object.keys(SAMPLE_VALUES).length, 13`). **Do not edit these** — they pass.

### Why no test/code changes (scope guard)
The widget-count test migration was **completed by story 10.3** (it owned the two `tui-*` test files) and re-verified green by 10.4 (718/718). This story is the **prose/doc tail** that 10.1–10.4 each deferred to "the 10.5 reconciliation sweep". Editing `src/` or `test/` here would (a) duplicate done work and (b) risk regressions a doc story has no business causing. The only non-prose-doc files in scope are the three doc files in the table above.

### Anti-patterns to avoid (would fail review)
- ❌ Editing any `src/**` or `test/**` file. The feature and its tests are done. (If `npm test` was green before and red after, you touched something you shouldn't have.)
- ❌ "Fixing" the `12 event types` assertions in `test/defaults.test.js` / `test/install.test.js` — those count hook **event types**, not widgets. Out of scope; leave them.
- ❌ Clamping `usagePct` / hardening `computeWeeklyUsage` (the out-of-range `used_percentage` item deferred from 10.4). That requires touching the **locked 10.1** `shared-constants.cjs` — explicitly forbidden here. It is upstream hardening for a future pass, NOT this doc story. Leave it in `deferred-work.md`.
- ❌ Refactoring the self-color `!==` chain into a `SELF_COLORED_WIDGETS` Set (deferred-work.md, "future pass"). That is a **code** change; this story only documents the existing three-way guard.
- ❌ Regenerating `project-context.md` wholesale or rewriting the front-matter. Make **surgical** edits to the lines listed; preserve everything else (structure, other patterns, rule counts).
- ❌ Changing Pattern 20 line 363 (`Reader NEVER writes to config.json`) — it is already correct. Boundary 2 is the AC2 target, not Pattern 20.
- ❌ Inventing new widget-table columns or reordering the existing rows. Append one row; change only the counts.
- ❌ Touching `epics.md` Story 10.5 ACs (that's the spec you're implementing, not an edit target).

### Pattern 29 + Boundary 2 — the reconciled message (for your wording)
The reader is **not** a pure read-only consumer; it has **always** owned cache-dir bookkeeping (`touchAlive`/`purgeStale` write/delete `.alive-*` files). Pattern 29 (Reader Usage-Snapshot Cache) makes that explicit and adds one more piece of the same kind: the account-global `weekly-usage.json` snapshot. The invariants that **do** hold: never writes `config.json` (Pattern 20), never writes the per-session status file (Boundary 1 — hook is sole status writer). So Boundary 2 should read "read-only **w.r.t. config & status**; owns **cache-dir bookkeeping**", not a blanket "read-only / NEVER writes".

### Intentional asymmetry — the deliberate behavior to document (Rev.7 flag #3)
`handleLineCommand()` returns `''` when there's no `status-<sid>.json` for the session, so the **statusline widget** shows nothing outside a tracked BMAD session (consistent with every other widget). But `persistUsageSnapshot(stdin)` is called **before** that early-return (`bmad-sl-reader.js:261`), so the snapshot exists account-globally — which is why the **TUI screen** (10.4) can render real data anywhere. This is by design (Architecture Rev.7 flag #3): document it as deliberate so a future agent doesn't "fix" the widget to render outside a session or move the snapshot write.

### Existing-test impact
**None expected.** No test asserts on `project-context.md`, `README.md`, or `architecture.md` content. After the doc edits, the full suite must stay exactly as green as it is now (718 pass as of 10.4). If anything goes red, you edited code/tests by mistake — revert that.

### Project Structure Notes
- Files touched: `_bmad-output/project-context.md` (several surgical prose edits), `README.md` (one feature bullet), `_bmad-output/planning-artifacts/architecture.md` (one reference-body + prose reconciliation). No `src/` or `test/` changes.
- Aligns with Epic 10's "purely additive brownfield" framing — this story changes **documentation only** to match the as-built reality; no contract, schema, or behavior changes.
- This closes Epic 10. After it: `epic-10-retrospective` is optional.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.5] — the 6 BDD acceptance criteria (lines 2495-2526).
- [Source: _bmad-output/planning-artifacts/architecture.md#Rev.7 Conflicts / Flags Against the Current Design] — flags #1 (widget count), #2 (Boundary 2 / "Reader NEVER writes"), #3 (intentional asymmetry), #4 (doc-version drift) (lines 2476-2483).
- [Source: _bmad-output/planning-artifacts/architecture.md#Rev.7 New Pattern — Pattern 29 Reader Usage-Snapshot Cache] — the pattern to reference (lines 2456-2467).
- [Source: _bmad-output/planning-artifacts/architecture.md#🔴 Rev.7 Key Decision — Usage Snapshot Persistence] — "why this is not a boundary violation"; the reconciled Boundary-2 message (lines 2253-2272); the snapshot I/O contract + `persistUsageSnapshot` reference body to reconcile (lines 2274-2314).
- [Source: _bmad-output/implementation-artifacts/deferred-work.md:11] — the per-pid `.tmp` doc reconciliation explicitly assigned to 10.5 (AC7); :5 and :12 are the two items that stay deferred (out of scope here).
- [Source: _bmad-output/project-context.md] — exact edit targets: `...all 12 widget IDs...` (602/613/618), `all 12 widget IDs` (633), dynamic-mode list (635), `12 widgets` heading (643), widget table (645-658), self-color exclusion (860, 1220), Boundary 2 (902-908), BF1 (1037); front-matter (8/14/23) for optional flag #4.
- [Source: README.md:20] — the "11 configurable widgets" feature bullet + its 11-name list (missing Context %, Weekly Usage).
- [Source: src/tui/widget-registry.js:18] — verified `bmad-weeklyusage` registry entry (table-row field source).
- [Source: src/reader/bmad-sl-reader.js:286] — verified three-way self-color exclusion guard.
- [Source: src/reader/bmad-sl-reader.js:182-207, 261, 420] — verified as-built per-pid `persistUsageSnapshot` + `(Pattern 29)` call-site comments (architecture.md reconciliation source).
- [Source: test/tui-widget-registry.test.js:17,133-134,156,174,207] and [test/tui-preview-utils.test.js:13,26] — confirmation the test counts are already 13 (do not edit).
- [Source: _bmad-output/implementation-artifacts/10-4-tui-weekly-usage-screen-home-button-app-routing.md] — prior story; its Anti-patterns list (244) and Intentional-asymmetry note (247-248) explicitly hand the doc sweep to 10.5.

### Dependency note for the SM/dev
Per epics.md Epic 10, **10.5 runs after 10.1–10.4** (all done) — it "sweeps prose/docs once the feature exists." This is the **last story of Epic 10**; keep it confined to the three doc files. There is no downstream story; after `dev-story` + `code-review`, Epic 10 is complete (retrospective optional).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context)

### Debug Log References

- Full suite (`npm test` = `node --test --test-concurrency=4 --test-timeout=30000 test/*.test.js`): **718 pass / 0 fail / 123 suites** — identical to the 10.4 baseline (718/718), confirming the doc-only edits changed no test outcome and no `src/`/`test/` file was touched.
- Straggler grep over `project-context.md` and `README.md` for `11 widget` / `12 widget` / `all 12 widget IDs` / two-widget self-color wording → **no matches** (the legitimate `12 event types` assertions were intentionally left untouched).

### Completion Notes List

Documentation + reconciliation sweep only — **no production code or test changes** (verified by the unchanged 718/718 suite). All edits checked against live code on 2026-06-10.

**AC1 — widget count → 13 (flag #1):** `project-context.md` heading `12 widgets` → `13 widgets`; appended the 13th table row `bmad-weeklyusage | weeklyusage | Weekly Usage | false | — | dynamic` after `bmad-timer` (registry index 12, source `src/tui/widget-registry.js:18`); the three `"...all 12 widget IDs..."` JSON comments → `13`; the `widgetOrder` "all 12 widget IDs" rule → `13` (+ noted `ensureWidgetOrder()` appends `bmad-weeklyusage` to pre-Rev.7 configs); BF1 "all 12 widgets" → `13`; dynamic-mode valid list gained `bmad-weeklyusage`. `README.md` feature bullet → "13 configurable widgets…" with `Context %` and `Weekly Usage` added to the list. Test widget-counts confirmed already at 13 (no test edit); the `12 event types` assertions left untouched.

**AC2 — Boundary 2 wording (flag #2):** Boundary 2 reframed from blanket "read-only consumer" to "read-only w.r.t. `config.json` (Pattern 20) and the status file (Boundary 1), but owns cache-dir bookkeeping" — now consistent with the reader's `persistUsageSnapshot` write. Pattern 20 (line ~363, `config.json`-scoped) left unchanged as instructed.

**AC3 — intentional asymmetry (flag #3):** added a "deliberate, not a bug" note after the widget-table default-layout note: the widget renders only inside a tracked BMAD session (`line N` returns `''` with no `status-<sid>.json`), while the TUI screen works anywhere because `persistUsageSnapshot(stdin)` runs **before** the no-status early-return (`bmad-sl-reader.js:261`).

**AC4 — Pattern 29 reference:** added a "Reader cache-dir bookkeeping (Pattern 29)" bullet describing the account-global `weekly-usage.json` atomic per-pid `.tmp`→rename + content-change throttle, write-only side effect for the TUI; folded the same reference into Boundary 2. Bumped front-matter `existing_patterns_found: 28 → 29`.

**AC5 — self-color exclusion (flag #1 corollary):** the exclusion-list prose (`line ~286`, corrected from the stale `~251`) and the DO/DON'T summary line now list all three self-coloring widgets — `bmad-llmstate`, `bmad-contextpct`, `bmad-weeklyusage` — matching the as-built guard at `bmad-sl-reader.js:286`; added the matching self-color bullet for `bmad-weeklyusage`.

**AC6 — suite green:** 718/718, zero failures.

**AC7 — architecture.md `.tmp` per-pid reconciliation (carry-in from 10.2 review):** the `persistUsageSnapshot` reference body in `architecture.md` now shows the as-built per-process temp form (`USAGE_PATH + '.' + process.pid + '.tmp'` with unlink-on-failure + rethrow), and the concurrency prose now states each writer owns a private per-pid temp (so even non-identical concurrent writes can't tear each other) with only the atomic `renameSync` shared.

**Optional sub-tasks — scoping decisions (transparency):**
- Task 3.2 (mirror the asymmetry note into `README.md`): README has **no dedicated Weekly Usage description section** to mirror into, and AC3 explicitly does not require it — intentionally left out to keep the README touch surgical.
- Task 4.2 second clause (reconcile the pre-existing `architecture.md (Rev.5)` doc-version captions toward Rev.7, flag #4): intentionally left light per the task's own "keep the touch light / do not rewrite the front-matter wholesale" guidance; only the well-justified `existing_patterns_found` bump (28→29, because Pattern 29 is now a named reference) was applied.

### File List

- `_bmad-output/project-context.md` (modified — widget-count sweep, Boundary 2 reconciliation, Pattern 29 reference, intentional-asymmetry note, self-color exclusion prose, front-matter `existing_patterns_found` bump)
- `README.md` (modified — Features bullet widget count 11→13 + added `Context %` and `Weekly Usage`)
- `_bmad-output/planning-artifacts/architecture.md` (modified — `persistUsageSnapshot` reference body + concurrency prose reconciled to the as-built per-pid temp)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — story status ready-for-dev → in-progress → review)
