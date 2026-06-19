# AgentHub Self-Iteration Backlog

This backlog records reviewed improvement slices for AgentHub. Items are scoped as small patches with explicit tests so worker agents and reviewer agents can coordinate without relying on chat history.

## P0

### 1. Bound Git Status And Diff Work

- Target files: `src/main/runtime/git.ts`, `src/renderer/workbench/GitWorkbenchPanel.tsx`
- Patch slice: add changed-file/stat limits, large and binary diff skip metadata, and lazy full-diff loading for the selected path.
- Risk: line counts may become approximate for very large changes.
- Tests: Git runtime tests for many changed files, binary/large files, and UI empty/truncated diff states.

### 2. Safe Git Remote Operation Previews

- Target files: `src/main/runtime/git.ts`, `src/renderer/workbench/GitWorkbenchPanel.tsx`
- Patch slice: replace one-click pull/push/sync with remote/branch/options preview and incoming/outgoing commit preview.
- Risk: remote mutations must keep conservative defaults.
- Tests: command argument tests for fetch/pull/push, no-upstream cases, branch normalization, and cancelled dialogs.

### 3. Provider And Model Capability Normalization

- Target files: `src/main/providers/manager.ts`, `src/renderer/workbench/ComposerBar.tsx`, `src/renderer/workbench/contextCapacity.ts`, `src/main/runtime/usage-stats.ts`
- Patch slice: add a pure model capability helper used by provider fetch, picker rows, context capacity, and usage stats.
- Risk: context window fallback changes can alter capacity warnings.
- Tests: fetched models preserve context windows, picker displays metadata, selected provider model never silently switches.

### 4. Composer `@path` References

- Target files: `src/renderer/workbench/ComposerBar.tsx`, `src/renderer/workbench/ThreadView.tsx`, `src/main/index.ts`
- Patch slice: disambiguate `@agent` commands from `@path` references, then add read-only extraction/display and scoped context injection.
- Risk: workspace path resolution must avoid escaping the active workspace.
- Tests: Windows paths, quoted paths, `file://` URLs, adjacent text, spaces, and unknown `@path` sends.

## P1

### 5. Usage-Aware Context Capacity

- Target files: `src/renderer/workbench/contextCapacity.ts`, `src/main/runtime/context-ledger.ts`
- Patch slice: feed latest actual prompt/usage tokens into capacity estimates, cache block estimates, and surface 75/85 percent threshold recommendations.
- Risk: mixed actual and estimated numbers need clear UI labels.
- Tests: threshold behavior, model-window override, actual usage fallback.

### 6. Strengthened Long Memory Retrieval

- Target files: `src/main/memory-library.ts`, `src/main/index.ts`, `src/main/hub/dispatcher.ts`
- Patch slice: approved-only retrieval, pinned-first context packs, bounded relevance scoring, and context evidence metadata.
- Risk: over-including pinned memories can bloat context if limits are not enforced.
- Tests: pinned approved entries always included within limit, candidates/disabled excluded, scoring order, retrieval cap.

### 7. Incremental Usage Stats

- Target files: `src/main/runtime/usage-stats.ts`, `src/renderer/screens/UsageStatsDashboard.tsx`
- Patch slice: memoize records by runtime event sequence, expose cache hit/savings consistently, and add local pricing defaults.
- Risk: stale aggregates if invalidation misses event mutations.
- Tests: event append invalidates cache, actual vs estimated split, cache-read billing, pricing fallback.

## P2

### 8. Worktree Lifecycle Safety

- Target files: `src/main/runtime/worktrees.ts`, workbench Git/worktree UI
- Patch slice: add dirty/conflict status, safe sync, remove/force confirmation metadata, and path safety checks.
- Risk: destructive cleanup paths.
- Tests: dirty worktree blocks removal, path checks, sync status transitions.

### 9. Write Workspace Growth

- Target files: `src/renderer/workbench/WriteWorkspace.tsx`
- Patch slice: add file-backed markdown open/save, selected-text quick actions, recent edits, and export hooks.
- Risk: editor scope can balloon if rich editing is attempted too early.
- Tests: save/load round trip, selected-text prompt payload, recent edit trimming, export disabled state.

### 10. Performance And Test Gates

- Target files: `package.json`, `src/renderer/workbench/*`, focused test suites
- Patch slice: add small perf smoke scripts, extract pure helpers from large UI files, and replace source-string sentinel tests with behavior tests over time.
- Risk: new gates may expose existing debt.
- Tests: script self-tests, helper tests, timeline/composer smoke perf baseline.
