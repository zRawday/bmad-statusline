# Deferred Work

## Deferred from: tui-project-color-picker (2026-04-02)

- **Standalone reader commands ignore custom colors** — `node reader project sid` and `node reader workflow sid` call `COMMANDS[cmd](status)` with no lineConfig, so custom `projectColors`/`skillColors` overrides from config.json are never checked. Only affects standalone mode (not used by ccstatusline, which always uses `line N` mode). Fix: read config.json in standalone path and pass to extractors.

## Deferred from: tui-polish-rename-descriptions (2026-04-02)

- **Active Skill widget** — New widget `bmad-activeskill` showing the currently executing skill when it differs from the initial prompted skill. Requires: new `active_skill` field in status JSON, hook spike to detect skill changes during execution, reader command, widget registry entry, conditional visibility logic (hide when active_skill == workflow). Place after Initial Skill in default widget order.

## Deferred from: review of spec-tui-ux-polish-preview-menu-defaults (2026-04-01)

- `isValidV2` in config-loader.js does not validate `colorModes` exists on each line — a config missing `colorModes` passes validation then crashes at render time in ThreeLinePreview and EditLineScreen. Pre-existing, not caused by this change.
- `editingLine` null guard missing in EditLineScreen — crash if screen is rendered before navigate sets `editingLine`. Pre-existing, mitigated by unmount/remount cycle.

## Deferred from: review of spec-tui-ux-polish-3 (2026-04-02)

- Stale widget IDs (bmad-step, bmad-progress, bmad-progressbar) persist in existing user configs' `line.widgets` arrays indefinitely. `ensureWidgetOrder` only rebuilds `widgetOrder`, never prunes `widgets`. Benign at runtime (reader skips unknown commands, UI filters them out), but pollutes config.json on every write.

## Deferred from: code review of 6-2-reader-line-n-command-story-formatting-workflow-colors-legacy-composites (2026-04-01)

- Health extractor uses inline ANSI codes (`\x1b[32m`, `\x1b[33m`, `\x1b[90m`) instead of referencing `COLOR_CODES` constants — violates Pattern 3 spirit, pre-existing from health widget introduction

## Deferred from: review of spec-tui-ux-polish-inline-editing-header-bugfixes (2026-04-01)

- `ensureWidgetOrder` does not patch stale `widgetOrder` arrays (missing new widgets if registry grows). Future-proof by checking length/completeness, not just `Array.isArray`.
- `formatStoryName` with double-hyphen slugs (e.g., `5-3-auth--login`) produces double spaces in output — cosmetic, very low probability
- `resolveSeparator` treats empty string `customSeparator: ""` as falsy, falling back to serre instead of respecting user intent for no separator — only reachable via hand-editing config.json
- `readStatusFile` and `touchAlive` use `session_id` directly in file path construction without sanitization — path traversal possible if stdin is untrusted, pre-existing pattern
- `purgeStale` outer try/catch aborts entire loop if `fs.statSync` fails on one file (TOCTOU race with concurrent reader processes) — pre-existing
- `formatProgressBar` with very large `step.total` (e.g., 999999) creates multi-MB string — pre-existing, no cap on display size

## Deferred from: code review of 6-3-config-system-config-loader-v2-config-writer-v2-migration (2026-04-01)

- `writeInternalConfig` silently swallows all errors; app.js catch blocks at lines 91-95 and 101-105 are dead code (never reached). Pattern 14 mandates silent failure. App.js tagged for full rewrite in story 6.4.
- `syncCcstatuslineIfNeeded` and `syncCcstatuslineFromScratch` access `config.lines[i].widgets.length` with no null guard. Internal callers always provide well-formed v2 configs. Add defensive guards if these functions become part of a public API.
- `onConfigChange` in app.js clones old rawConfig but never applies UI changes to it before writing to disk. Config changes lost on restart. App.js explicitly tagged for full rewrite in story 6.4.
- v1 lineWidgets array iteration in migrateV1Config could crash on null entries (e.g., `w.id?.startsWith` handles undefined id but not null w). ccstatusline doesn't produce null entries in practice.

## Deferred from: code review of 6-1-foundation-internal-config-schema-widget-registry-dead-code (2026-04-01)

- `onConfigChange` does not persist separator changes to `rawConfig` — old `rebuildWithSeparator` deleted per spec, new handler clones `rawConfig` verbatim without applying `changes`. SeparatorStyleScreen works in-memory but reverts on restart. Fix in story 6.4 state model rewrite.
- `rawConfig` in default-state (not-found/invalid-json) set to `{ lines: [[], [], []] }` — wrong for both v1 and v2 formats. `saveConfig` writes garbage if triggered. Fix with v2 config-loader in story 6.3/6.4.
- Duplicate default-state construction blocks in `useEffect` (not-found and invalid-json branches identical). Extract to helper in story 6.4 rewrite.
- `selectedWidget`/`setSelectedWidget` state has no setter call site — colorPicker screen unreachable after routing cleanup. Dead state until 6.4 rewires navigation.
- `presets` state loaded from config but no consumer screen remains — no preset functionality until story 6.5.
- `deriveTuiState` expects v1 `Array.isArray(line)` format — incompatible with v2 `{ widgets, colorModes }` object lines. Will silently skip separator lookup on v2 configs. Fix in story 6.3/6.4.
- `SEPARATOR_STYLES` constant in widget-registry.js preserved per spec but unreachable — only consumer was deleted `buildWidgetConfig`. May be useful for future stories or should be exported.

## Deferred from: code review of 6-6-installer-uninstaller-per-line-deployment-config-creation-upgrade-v1-v2 (2026-04-01)

- Séparateurs `sep-bmad-*` orphelins non détectés par fresh install path — ni ancien ni nouveau code ne les détecte, l'uninstaller nettoie correctement
- Pas de test pour v1 upgrade préservant user widgets sur la même ligne — dépend de la résolution du finding sur le target line
- Pas de test pour échec validation `writeJsonSafe` + restore `.bak` — pré-existant, non introduit par ce changement

## Deferred from: code review of 6-5-tui-v2-sub-screens-color-picker-preset-save-load-reorder-lines (2026-04-01)

- `formatPresetSlot` duplicated across PresetSaveScreen.js and PresetLoadScreen.js — same widget-name-lookup logic in 3 files, DRY concern. Spec says "no new utility files" so not extracted.
- No preview on initial render for slot 0 in PresetLoadScreen — `applyPreviewForSlot` only called on arrow key navigation. Consistent with `SelectWithPreview` which also doesn't fire `onHighlight` on mount (deferred from 5-3).
- Tests use fixed 50ms `delay()` for async state settling — potentially flaky on slow CI runners. Pre-existing pattern from story 5-1.
- PresetLoadScreen doesn't use `SelectWithPreview` component as spec component reuse table requires — functionally correct with custom cursor logic, but violates spec constraint. Refactoring would require significant rework.

## Deferred from: code review of 6-4-tui-v2-core-app-shell-state-model-shared-components-home-edit-line (2026-04-01)

- I/O inside React state updater (`updateConfig` in app.js:38-46) — `writeInternalConfig` and `syncCcstatuslineIfNeeded` called inside `setConfig` updater function. React Strict Mode may double-fire in dev. Writes are idempotent, no production impact. Spec Pattern 15 mandates this exact pattern.

## Deferred from: code review of 5-6-presets-screen-confirm-dialog (2026-03-30)

- `customSeparator` absent du snapshot preset — le round-trip est impossible pour les separateurs custom. Regression introduite par le commit 5-4 qui a ajoute `customSeparator` a tuiState mais n'a pas mis a jour `handleSavePreset`/`handleLoadPreset` dans app.js. Fix: ajouter `customSeparator` au snapshot dans `handleSavePreset` et le restaurer dans `handleLoadPreset`.
- `isActive: true` code en dur pour PresetsScreen dans app.js (ligne ~404) — les autres ecrans passent `isActive: !statusMessage` pour empecher la capture de touches sous l'overlay d'erreur. Inconsistance introduite dans le commit 5-5.
- `delay(50)` utilise dans tous les tests TUI async — potentiellement flaky sur des runners CI lents. Pattern pre-existant depuis la story 5-1, pas introduit par 5-6.
- `config.presets` lu depuis le fichier config sans validation de structure — un fichier corrompu avec des entrees malformees pourrait crasher l'UI. Amelioration de robustesse a faible priorite.

## Deferred from: code review of 5-3-widget-detail-color-mode-color-picker (2026-03-30)

- Stale `previewTuiState` — `useState(tuiState)` captures initial prop only in ColorModeScreen and ColorPickerScreen. If `tuiState` changes externally while screen is mounted, preview is stale. Pre-existing pattern from TargetLineScreen/SeparatorStyleScreen (Story 5.4).
- `onConfigChange` + `onBack` called sequentially — if `saveConfig` throws, `setStatusMessage` fires then `onBack` still pops nav stack. Pre-existing pattern across all screens using `onConfigChange`.
- `SelectWithPreview` does not fire `onHighlight` on initial mount — highlighted item set from `defaultValue` but callback not invoked until user moves cursor. Pre-existing in component from Story 5.4.
- Test AC11(d) try-before-you-buy tests verify cursor position only (`> fixed`, `> white`) but don't assert DualPreview content changed. Consistent with existing screen test patterns from Story 5.4.

## Deferred from: code review of 7-2-installer-upgrade-bash-stop-notification-matchers (2026-04-04)

- **`hookPath` command injection via template literal** — `node "${hookPath}"` in `getHookConfig()` allows shell injection if hookPath contains quotes/backticks. Pre-existing pattern since Phase 3 (same template for Read/Write/Edit/UserPromptSubmit/SessionStart). Low risk: hookPath is constructed internally from `paths.hookDest`, not user input.
- **Hook dispatch handlers for new events** — Installer now configures Bash/Stop/Notification matchers, but hook dispatch handler verification belongs to story 7-1 (commit 04db605). Edge Case Hunter flagged potential silent no-ops; spec confirms handlers were added in 7-1.

## Deferred from: code review of 7-1-hook-expansion-history-arrays-llm-state-atomic-write (2026-04-04)

- **_outputFolders unavailable for pre-existing sessions** — `detectDocumentAndStep` needs `_outputFolders` but it's only computed on first event (when `!earlyStatus.project`). Sessions started before 7.1 never get `_outputFolders` populated. Bonus feature (document_name tracking), not part of core 7.1 spec.
- **is_new unreliable when reads[] capped by 10MB guard** — `handleWrite` computes `is_new` from `reads[]` which stops growing past 10MB. A file read after the cap won't appear in reads[], causing false `is_new: true`. Design trade-off, acceptable.
- **Windows case-sensitive displayPath** — `inProject` uses `toLowerCase()` for matching but `normPath.slice()` uses original casing for `displayPath`. If drive letter casing differs between events, displayPath could be wrong. Pre-existing pattern across all handlers.
- **Walk-up _bmad could match wrong parent** — No depth limit on parent traversal. Could match `_bmad/` in an unrelated ancestor project. Unlikely in practice. Bonus feature.
- **Step enrichment regex won't match Edit partial content** — Frontmatter regex requires content to start with `---` but Edit's `new_string` is typically a partial fragment. Best-effort bonus feature.
- **Large bash commands stored verbatim** — No truncation on `cmd` field in `commands[]`. A very long command could balloon the status file. 10MB guard provides sufficient protection.
- **`old_string || null` should be `?? null`** — In handleEdit's writes[] push, `payload.tool_input.old_string || null` coerces empty string `""` to `null`. Should use `??` to preserve empty strings. Edge case: Claude Edit tool requires non-empty old_string in practice. Trivial fix: `|| null` → `?? null` on line 458 (Toulou commit 04db605).

## Deferred from: code review of 7-4-monitor-foundation-polling-routing-homescreen-integration (2026-04-04)

- **Ghost sessions — no staleness check on `.alive` files** — `pollSessions` treats every `.alive-*` file as active with no `mtime`/`updated_at` check. Dead sessions display until `purgeStale` runs elsewhere. Spec defers inactive state computation to story 7.5.
- **No upper bound on sessions array** — unbounded `readdirSync` + `readFileSync` loop if cache dir contains thousands of `.alive-*` files. Theoretical concern; 1-5 concurrent sessions in practice.
- **No stable ordering for sessions** — `readdirSync` order is OS-dependent (alphabetical on NTFS, inode on ext4). 7.4 only shows count; story 7.5 renders rows and should add ordering.

## Deferred from: code review of 7-6-file-bash-sections-tree-view-command-display (2026-04-04)

- **buildFileTree collision fichier/répertoire même nom** — Si un fichier `src` (sans extension) et un répertoire `src/` coexistent, l'arbre est corrompu. Scénario extrêmement rare en pratique.
- **Pas de mémoisation sur items/orderedGroups** — Recalculés à chaque poll (1.5s). Performance acceptable pour un TUI, pas un bug fonctionnel.
- **pollSessions filtre `if (status.skill)`** — Sessions avec `workflow` mais sans `skill` sont ignorées silencieusement. Pré-existant (7.4).
- **Indicateurs `*` et `🔀` non colorés** — Le spec demande `color: 'green'` pour `*` et `color: 'cyan'` pour `🔀`, le code les rend en texte brut dans le même Text element. Cosmétique, les indicateurs sont déjà visuellement distincts.

## Deferred from: code review of 7-5-tabs-badge-two-level-session-navigation-llm-state (2026-04-04)

- **Garde 10MB supprimée** — `canAppendHistory` et sa vérification `fs.statSync(fp).size < 10MB` supprimées. Les tableaux d'historique sont aussi supprimés donc pas de vecteur de croissance actuel, mais d'anciens fichiers status de la v1 (7.1) avec de gros tableaux pourraient causer un pic mémoire au parsing. Auto-résolution: le prochain `writeStatus` écrase sans les tableaux.
- **SessionTabs Box vide pour activeProject périmé** — Si `groups.get(activeProject)` retourne `undefined` (clé périmée après changement de sessions), la rangée session est un Box vide. Auto-correction au prochain poll quand `clampedProjectIndex` recalcule.

## Deferred from: code review of 7-7-detail-mode-pages-tree-navigation-file-command-details (2026-04-04)

- **Snapshot command entries vs live file entries** — `getDetailEntries` pour commands retourne `item.data.entries` (snapshot à l'ouverture), tandis que les fichiers sont re-filtrés live depuis `writes`/`readOnly`. Incohérence mineure, UX acceptable.
- **Scroll offset non clampé si `contentItems` rétrécit** — Dans `MonitorDetailScreen`, si les entries changent via polling et réduisent la taille du contenu, `scrollOffset` peut dépasser les bounds → viewport vide momentanément.

## Deferred from: code review of 7-8-chronology-export-timeline-csv-generation (2026-04-04)

- **`formatRelativeTime` retourne '' pour timestamps futurs** — clock skew entre machines peut produire des timestamps dans le futur, affichés comme vides au lieu de 'maintenant'. Edge case défensif.
- **Sort NaN avec dates invalides truthy dans `mergeChronology`** — si `at` est truthy mais non parseable (ex: `"pending"`), `new Date(x).getTime()` retourne NaN, ordre de tri indéterminé. Le hook produit toujours des ISO valides.
- **Collision nom fichier CSV si 2 exports dans la même seconde** — le timestamp est à la seconde (`HHmmss`), deux exports rapides écrasent le premier. Ajouter des millisecondes serait trivial.

## Deferred from: code review of 7-9-toggles-polish-auto-scroll-bell-contextual-shortcuts (2026-04-04)

- **Toggle indicators always visible** — User wants all toggle states (`[AUTO]`/`[bell]`/`[alpha]`/`[relatif]` and their off-state counterparts) always visible in the appropriate shortcut bar area, not hidden when at default values. Current implementation only shows non-default indicators. Redesign indicator line to show all toggle states persistently.

## Deferred from: review of spec-story-widget-display-modes (2026-04-04)

- **Mode shortcut 'm' always visible** — The `NAVIGATE_SHORTCUTS` array unconditionally shows `{ key: 'm', label: 'Mode' }` regardless of whether the story widget exists on the current line. Other contextual features could similarly benefit from conditional shortcut display. UX improvement, not a bug.

## Deferred from: review of spec-deferred-config-tui-fixes (2026-04-05)

- **`isValidV2` accepts arrays for `colorModes`** — `typeof [] === 'object'` is true. A hand-edited config with `colorModes: [...]` would pass validation then crash at render. Pre-existing pattern (same as `skillColors`/`projectColors` checks in `ensureWidgetOrder` which DO reject arrays). Practically impossible — configs are code-generated.
- **`PresetLoadScreen` crash on presets with < 3 lines** — `applyPreviewForSlot` hard-codes `i < 3` loop. A manually-edited preset with fewer lines crashes on `.widgets` access. Pre-existing.
- **`SelectWithPreview` crash on empty `options` array** — Enter key accesses `options[0].value` with no guard. Pre-existing, all callers pass non-empty arrays.
- **Preset save omits `colorModes`** — Saved presets store `widgets` and `widgetOrder` but not `colorModes`. Silent degradation on load (fallbacks work). Pre-existing design decision.

## Deferred from: review of spec-deferred-cosmetic-edge-fixes (2026-04-05)

- **buildFileTree trailing-slash paths produce empty-string leaf** — `entry.path.split(/[/\\]/)` on `"src/utils/"` yields `["src", "utils", ""]`. The empty string becomes a tree key rendered as a blank filename. Pre-existing, not caused by this change.

## Deferred from: code review of 5-4-target-line-separator-style-reset (2026-03-30)

- `KNOWN_SEPARATORS` (app.js) et `SEPARATOR_CONTENT` (SeparatorStyleScreen.js) dupliquent les constantes de widget-registry.js `SEPARATOR_STYLES` (non exporté). Si les valeurs changent dans le registry, les deux copies deviendraient silencieusement incorrectes. Fix futur: exporter les constantes depuis widget-registry.js.
- Tests TUI async utilisent `delay(50)` fixe — pattern potentiellement flaky sur CI lent. Préexistant depuis story 5-1, pas introduit par 5-4.
- `MOCK_TUI_STATE` dans tui-app.test.js manque `customSeparator: null`. Pas d'impact fonctionnel (DualPreview utilise VISUAL_SEPARATORS quand separator !== 'custom').

## Deferred from: review of spec-monitor-ux-polish (2026-04-05)

- **Spacers `e(Text, null, '')` non remplacés par marginBottom** — Le spec demandait de remplacer les empty Text spacers par `marginBottom` ou `Newline`, mais les spacers fonctionnent correctement et sont déjà comptés dans le calcul dynamique de viewportHeight. Cosmétique, aucune régression.
- **Pas de message "terminal trop petit"** — Sur un terminal très petit (< 10 rows), le viewportHeight est clampé à 1 mais le footer/header peut déborder. Edge case rare, pas de crash grâce à `Math.max(1, ...)`.

## Deferred from: monitor-doc-story-context (2026-04-05)

- **No unit tests for extractStoryNumber / formatStoryTitle** — New helpers in monitor-utils.js lack test coverage. Add tests to tui-monitor-components.test.js or a dedicated monitor-utils test file.

## Deferred from: monitor-state-detection-fixes (2026-04-05)

- **Idle sessions triées par alive mtime au lieu de updated_at** — Les sessions incluses via le fallback `updated_at` gardent `_mtime` (stale alive mtime) comme clé de tri. Entre sessions idle, l'ordre reflète la date du dernier hook event plutôt que la dernière activité réelle. Cosmétique — n'affecte pas la visibilité, juste l'ordre.

## Deferred from: monitor-scroll-layout-fixes (2026-04-06)

- **Double spacer visible in reorder mode** — When reorderMode is active, viewport is null but the spacer-before-viewport and spacer-after-viewport both render, creating 2 consecutive blank lines. Pre-existing behavior (spacers existed before but collapsed to 0 rows). Cosmetic only during reorder mode.

## Deferred from: monitor-inline-reorder (2026-04-05)

- **Test coverage for reorder interactions** — Only entry paths (r/R keys) are tested. Grab, move, drop, cancel-grab, and exit-reorder interactions lack automated tests.
- **Visual desync if poll data changes during active reorder** — If a session disappears mid-reorder, the ID array in sessionOrders retains stale entries. SessionTabs renders from poll-derived data, so cursor index could point at wrong tab. Lightweight fix: freeze tab list at reorder entry and derive tabs from frozen list while reorder is active.

## Deferred from: code review of 8-3-installer-defaults-new-hook-matcher-registration (2026-04-07)

- **Stale UserPromptSubmit wildcard on Rev.4 upgrade** — Real users who installed with old defaults.js have `UserPromptSubmit: [{ matcher: '' }]` (wildcard, fires on ALL prompts). Rev.5 upgrade adds the regex matcher alongside but never removes the stale wildcard. Fix: add stale-matcher cleanup in installTarget5().
- **Phase4 fixture doesn't represent real deployed state** — `claude-settings-with-hooks-phase4.json` has regex matcher but old code deployed `''`. Fix: create wildcard variant fixture and add upgrade test.

## Deferred from: monitor-scroll-stable-keys (2026-04-06)

- **MonitorDetailScreen scrollOffset not clamped** — Unlike MonitorScreen which has an explicit clamp effect, MonitorDetailScreen does not clamp scrollOffset when contentItems shrinks (e.g., sort toggle changes entry count). The `above` indicator can show a stale count. Fix: add a useEffect clamp similar to MonitorScreen lines 218-221.
- **MonitorDetailScreen empty contentItems collapses viewport** — When no entries exist for a detail view, contentItems is empty and the viewport early-returns a zero-height Box (bypassing the fixed-height layout). MonitorScreen guards against this (line 430), but MonitorDetailScreen always renders the viewport. Fix: guard or ensure minimum content.

## Deferred from: code review of 8-4-shared-constants-reader-new-llm-state-support (2026-04-07)

- **`computeDisplayState` timeout converts `active:subagent` to `inactive` for long-running subagents** — The 5-minute `INACTIVE_TIMEOUT_MS` in `computeDisplayState()` applies to all states including `active:subagent`. A subagent running without frequent `updated_at` refreshes will silently appear as INACTIVE. Pre-existing behavior (spec forbids modifying `computeDisplayState()`). Consider adding subagent-specific freshness logic or heartbeat in a future story.

## Deferred from: code review of story-8.2 (2026-04-07)

- **Missing AC#5 test coverage for subagent_type clearing via existing handlers** — Tests only verify SubagentStop, PostToolUseFailure, PermissionDenied clear subagent_type. Missing coverage for UserPromptSubmit, Read, Write, Edit, Bash, PreToolUse, Stop, Notification transitioning out of active:subagent. Code does clear it, but tests don't verify.
- **No test for StopFailure clearing subagent_type from active:subagent** — 8.1 handler; no test seeds active:subagent → fires StopFailure → checks subagent_type=null.
- **No test for SubagentStart overwriting existing error state** — error → active:subagent transition untested.
- **No integration test for full subagent lifecycle** — No test exercises UserPromptSubmit → SubagentStart → tool uses → SubagentStop → Stop sequence.
- **Missing test for error_type clearing via Read/Write/Edit/Bash** — 8.1 clearing logic in Read/Write/Edit/Bash handlers untested (only UserPromptSubmit, Stop, PreToolUse tested).
