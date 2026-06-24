# v1.1.0

This release summarizes changes since `v1.0.2`.

## New Features

- Added **Model Routing Center** — replaces the old Model Capabilities grid in Settings → Models. Each model now shows provider status, upstream model mapping, context window, reasoning level, timeout, retry count, and Codex alias. Users can edit per-model settings inline, test connectivity, and export a Codex catalog file.
- Added per-model route settings (`ModelRouteSettings`) with Codex injection mode (`official_account` / `third_party_api` / `lan_share`), internal model lock, and configurable Codex model slots.
- Added `models:list`, `models:updateRoute`, `models:routeSettingsGet`, `models:routeSettingsSet`, `models:test`, and `models:exportCodexCatalog` IPC endpoints for full model management from the renderer.
- Added `app-event-log` runtime module — an append-only structured event log for provider, agent, and system lifecycle events.
- Added IPC modules for terminal, browser, conversation export/import, plugins, workspace, passthrough, hub threads, and missing handlers — extracted from the monolithic `index.ts` (reduced from ~2100 lines to ~700 lines).
- Added `registerPassthroughIpc` — a unified wiring layer that registers ~80 simple pass-through IPC handlers in one call, reducing boilerplate in `index.ts`.
- Added `registerHubThreadsIpc` — dedicated IPC module for hub threads, runtime, context, and dispatcher operations.
- Added `registerMissingIpc` — dedicated IPC module for skills, agentic, app, proxy, takeover, and AI quick-complete handlers.
- Added `schedule-helpers.ts` and `workspace-helpers.ts` — extracted scheduling and workspace utilities from `index.ts` for better testability.
- Added `sanitize.ts` renderer utility module — shared XSS-safe text processing for Markdown rendering and conversation export.
- Added model normalization pipeline in ProviderManager — all models now go through `normalizeModel()` which fills defaults for `enabled`, `contextWindow` (258K), `timeoutMs`, `retryCount`, `reasoningEnabled`, `defaultReasoningLevel`, and `supportedReasoningLevels`.
- Added `codexSlotCandidates()` helper for resolving Codex model slot fallback chains when using `third_party_api` or `lan_share` injection modes.
- Added model test endpoint (`models:test`) — sends a lightweight request to verify a model's connectivity and reports success/failure with timing.

## Fixes

- Fixed Git IPC error messages leaking sensitive local paths — all Git errors now pass through `sanitizeGitError()` which strips Windows drive paths (`C:\...`) and Unix home paths (`/home/...`) before reaching the renderer.
- Fixed Git IPC handlers not catching async errors consistently — all Git write operations (checkout, create, rename, delete, stage, unstage, revert, commit, fetch, pull, push, sync) are now wrapped with `wrapGit()` for uniform error handling.
- Fixed `buildModelList()` excluding models from disabled providers — the model list now includes all providers so users can see and configure models before enabling the provider.
- Fixed model `contextWindow` defaulting to 128K — now defaults to 258K to match the current Claude/GPT context window sizes.
- Fixed `index.ts` exceeding recommended module size — 1,406 lines of IPC handler registration extracted into 8 domain-specific modules.
- Fixed CRLF line-ending warnings on 25+ files — normalized line endings across TypeScript, CSS, and config files.
- Fixed ESLint config and Playwright config for stricter linting and more reliable test execution.

## Tests

- Added `batch2-modules.test.ts` for extracted runtime modules.
- Added `models-center-routes.test.ts` for model route settings and Codex slot resolution.
- Added `Settings.models.test.ts` for ModelsTab component behavior.
- Verified full project test suite passes after all changes.

## Performance Improvements

- Reduced `index.ts` from ~2,100 lines to ~700 lines by extracting 8 IPC modules, improving startup parse time and developer navigation.
- Reduced IPC registration boilerplate by ~80 handlers through `registerPassthroughIpc()` unified wiring.
- Reduced renderer bundle by sharing `sanitize.ts` across conversation export, Markdown rendering, and tool call display instead of duplicating XSS-safe logic.

## CSS / UI

- Reworked `globals.css` (847 insertions, 265 deletions) — expanded design token system, improved dark/light theme consistency, refined component spacing and typography.
- Improved WorkbenchLayout with better responsive behavior and panel resizing.
- Improved ComposerBar with refined agent/model selector styling.
- Reworked Settings → Models tab into a full Model Routing Center with inline editing, test connectivity, and Codex catalog export.

## Internal / Architecture

- Extracted IPC registration into 8 domain modules: `terminal-ipc.ts`, `browser-ipc.ts`, `conversation-ipc.ts`, `plugins-ipc.ts`, `workspace-ipc.ts`, `passthrough-ipc.ts`, `hub-threads-ipc.ts`, `missing-ipc.ts`.
- `index.ts` now only handles app lifecycle (window, tray, app events) and delegates all IPC registration to `registerAllIpcHandlers()`.
- Added `IpcRegistrationDeps` interface with explicit dependency injection for `runtimeStore`, `dispatcher`, `hub`, `router`, `proxy`, and `getMainWindow`.
- ProviderManager now supports `modelRoutes` config with `codexInjectionMode`, `codexInternalModelLock`, and `codexSlots` persisted in provider config.
