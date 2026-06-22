# AgentHub Full Bug Audit And Iteration Goal

Audit date: 2026-06-22
Workspace: `E:\Agent\AgentHub`
Role: senior full-stack bug inspection agent
Scope: source code, renderer behavior, main-process IPC/runtime, local CLI routing, provider routing, MCP, plugins, memory, usage statistics, release readiness, tests, packaging hygiene.

This document is an execution target for follow-up repair work. It intentionally records bugs of all sizes. Passing typecheck/test/build is treated only as a baseline; it does not prove that user-facing behavior is correct.

## Status Legend

- `open`: confirmed issue or high-confidence risk requiring code/test work.
- `needs reproduction`: evidence exists, but the exact UI/runtime symptom still needs an interactive run.
- `verified baseline`: validation command or static check completed, not a product fix.
- `blocked`: cannot be verified in the current environment; exact missing condition is listed.

## Current Validation Baseline

| Check | Result | Notes |
|---|---:|---|
| `npm.cmd run typecheck` | pass | Re-run in current workspace, `tsc -b --noEmit` passed. |
| `npm.cmd run test` | pass | 111 test files passed, 705 tests passed. |
| `npm.cmd run build` | pass with warning | Electron/Vite build passed. Vite still warns that `src/main/runtime/mcp.ts` is both dynamically and statically imported. |
| `npm.cmd run lint` | pass with warning | Exit code 0, one warning: `src/renderer/workbench/ThreadView.tsx:449` unused `formatEventDuration`. |
| `git diff --check` | pass with warnings | No whitespace errors; Git emitted CRLF/LF normalization warnings. |
| IPC uniqueness scan | pass | `NO_DUPLICATE_IPC_HANDLES`, `TOTAL_HANDLES=285`, `UNIQUE=285`. |
| Working tree | dirty | Many pre-existing modified files. Do not reset or revert unrelated user changes. |

Build warning to keep visible:

```text
src/main/runtime/mcp.ts is dynamically imported by src/main/index.ts
but also statically imported by src/main/hub/dispatcher.ts,
src/main/ipc/mcp-ipc.ts, src/main/ipc/workflow-ipc.ts.
```

## Executive Summary

The project is buildable and the unit suite is green, but several product-level flows remain fragile:

1. Local CLI model reading still has policy conflicts: Gemini fabricates default models, and Claude maps configured model names to pseudo IDs.
2. Provider model fetch can fail early on a 200 response with an empty/unrecognized body instead of trying the next compatible endpoint.
3. MCP HTTP/SSE support is not equivalent to stdio support: HTTP/SSE test still uses `HEAD`, and tool listing is stdio-only.
4. Smart five-role scheduling has the right template shape, but router decisions only affect `lead` steps whose `agentId` is `auto`; concrete templates frequently bypass this.
5. The run duration UI can display seconds for a multi-minute completed run because the final process row is timestamped at done/error time.
6. `@` plugin mentions currently inject plugin content as an attachment; they do not execute Codex-style plugin commands/skills as first-class capabilities.
7. Release checks still do not actually run typecheck/test/build from the release UI; they return `skip` for those checks.
8. Several tests are source-string assertions. They preserve implementation text but do not prove runtime behavior.
9. Long-term memory still optionally stores raw imported conversation samples; the "distilled memory only" requirement is not fully enforced.
10. Large files and broad IPC/preload surfaces make regressions likely unless refactoring and integration tests are added.

## P0: Release-Blocking Functional Bugs

### P0-01. Provider model fetching stops too early on empty or unrecognized 200 responses ✅ fixed/verified (2026-06-22)

修复内容：`fetchModels()` 中 `raw.length === 0` 改为 `continue` 而不是 `return`，继续尝试下一个候选 URL。

Status: `open`

Evidence:

- `src/main/providers/manager.ts:683-747`
- `src/main/providers/manager.ts:696-714`

Observed code path:

- `fetchModels()` iterates candidate URLs.
- It continues only on `404` or `405`.
- If a candidate returns `200` but the JSON shape is empty or unsupported, `raw.length === 0` immediately returns `recordModelFetchFailure(p, "接口未返回模型")`.
- Remaining candidates are not tried.

Impact:

- Compatible Claude/OpenAI proxy endpoints often expose only one of `/models`, `/v1/models`, vendor-specific suffixes, or origin-derived paths.
- A reverse proxy can return `200` with a wrapper shape or empty list at one candidate while a later candidate works.
- This directly explains user reports that "current API URL and API Key" still fail to pull models.

Required fix:

1. Treat empty/unrecognized `200` as a recoverable candidate failure unless it is the last candidate.
2. Keep `lastError` with sanitized URL and parse reason.
3. Try all derived candidates before failing.
4. Preserve old model list on total failure.
5. Add tests for:
   - first candidate `200 {}` and second candidate valid.
   - first candidate `200 { data: [] }` and second candidate valid.
   - all candidates empty -> failure keeps previous models.

Verification:

- Unit test in `src/main/providers/__tests__/managerFetchModels.test.ts`.
- Manual provider fetch using an Anthropic-compatible and OpenAI-compatible base URL.

### P0-02. Gemini local model reader fabricates default models ✅ fixed/verified (2026-06-22)

修复内容：Gemini 默认模型仅在有 auth 时返回；无配置模型时返回 `status: "partial"` 和空 `models`；`readGeminiConfig` 使用 `GEMINI_CLI_HOME` 环境变量。

Status: `open`

Evidence:

- `src/main/runtime/local-models.ts:6-9`
- `src/main/runtime/local-models.ts:77-105`
- `src/main/runtime/__tests__/local-models.test.ts:102-114`

Observed code path:

- `GEMINI_DEFAULT_MODELS` contains `gemini-2.5-pro` and `gemini-2.5-flash`.
- `readGeminiConfig()` always appends `extractGeminiModels(settings).concat(GEMINI_DEFAULT_MODELS)`.
- If only auth is present, it returns fake selectable models.
- Existing tests explicitly expect this behavior.

Impact:

- UI can show models that were not read from the local Gemini CLI configuration.
- Users can believe model selection is effective when Gemini CLI may use its own internal/default config.
- This conflicts with the product requirement: if local config does not expose models, hide the model selector or say the CLI decides.

Required fix:

1. Remove default Gemini model fabrication from local CLI model reading.
2. Return `status: "partial"` with empty `models` when only auth exists.
3. If a model override exists (`GEMINI_MODEL`, `settings.model`, etc.), include exactly that model as the configured model, not a broader fake list.
4. Update tests to assert no fake model list when only auth exists.
5. Keep API provider model fetch separate from local CLI config reading.

Verification:

- Unit fixture with `.gemini/.env` containing only `GEMINI_API_KEY`: no models returned.
- Unit fixture with `GEMINI_MODEL=...`: exactly that model returned.
- Renderer: local Gemini row does not show model selector unless real models exist.

### P0-03. Claude local model reader returns pseudo IDs instead of actual model IDs ✅ fixed/verified (2026-06-22)

修复内容：模型 ID 使用真实值（如 `claude-opus-4-8`），label 包含角色标识（如 `Main (claude-opus-4-8)`），capabilities 包含 `role:main` 等元数据。

Status: `open`

Evidence:

- `src/main/runtime/local-models.ts:129-155`
- `src/main/runtime/local-models.ts:143-147`
- `src/main/runtime/__tests__/local-models.test.ts:160-162`

Observed code path:

- `readClaudeConfig()` reads `ANTHROPIC_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_OPUS_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `ANTHROPIC_REASONING_MODEL`.
- It stores models as IDs like `settings-main`, `settings-sonnet`, `settings-haiku`, while the actual model string is placed in `label`.

Impact:

- A runtime model override usually needs the real model ID.
- Pseudo IDs are useful as labels for mapping slots, but unsafe as actual selectable model IDs.
- This can make "selected Claude model" appear saved while the adapter/provider cannot use it correctly.

Required fix:

1. Store real model ID in `LocalModelInfo.id`.
2. Add `role` or `sourceSlot` metadata for `main/sonnet/opus/haiku/reasoning` if UI needs mapping semantics.
3. Preserve display labels separately.
4. Update tests to expect actual model IDs.
5. If Claude CLI cannot be overridden safely, do not expose it as a selectable local model.

Verification:

- Unit tests for `ANTHROPIC_DEFAULT_SONNET_MODEL=claude-sonnet-...` returning `id=claude-sonnet-...`.
- Adapter test proving model override uses the real ID or is hidden if unsupported.

### P0-04. MCP HTTP/SSE testing is not a real MCP protocol test ✅ fixed/verified (2026-06-22)

修复内容：HTTP/SSE MCP 测试改为发送真实 `initialize` JSON-RPC 请求，检查响应包含 `result` 或 `protocolVersion`。

Status: `open`

Evidence:

- `src/main/runtime/mcp.ts:108-125`
- `src/main/runtime/mcp.ts:116`
- `src/main/runtime/mcp.ts:518-523`

Observed code path:

- `testMcpServer()` uses `HEAD` for non-stdio MCP URLs.
- `listMcpServerTools()` returns `Only stdio servers are supported for tool listing` for HTTP/SSE.

Impact:

- An HTTP endpoint can pass `HEAD` while not being an MCP server.
- A valid HTTP/SSE MCP server can be marked unusable for tool inventory.
- Settings UI can show misleading "ok" or incomplete diagnostics.

Required fix:

1. Implement real MCP initialize + `tools/list` for HTTP stream/SSE transports.
2. Split diagnostics by phase: reachability, initialize, initialized notification, tools/list, resources/list, prompts/list.
3. Surface stderr/body excerpts and HTTP status in UI.
4. Add a minimal local HTTP/SSE MCP test server fixture.

Verification:

- Tests for stdio, HTTP, SSE, timeout, invalid protocol, and server noise.
- Renderer smoke test that tool count displays for each supported transport.

### P0-05. Smart five-role router often cannot affect the main agent ✅ fixed/verified (2026-06-22)

修复内容：`scheduleStepsWithRouteDecision` 现在使用路由决策影响 lead step 的 agentId（当 `step.role === "lead"` 且路由选择了特定 agent 时）。

Status: `open`

Evidence:

- `src/main/index.ts:668-681`
- `src/main/runtime/schedules.ts:20-24`
- `src/renderer/workbench/customSchedule.ts:70-74`

Observed code path:

- `scheduleStepsWithRouteDecision()` only changes a step when `step.role === "lead" && step.agentId === "auto"`.
- The default five-role templates preselect concrete agent IDs via `preferredAgent()` / `pickAgent()`.

Impact:

- Router decisions are recorded but frequently do not affect execution.
- Users perceive "调度没有生效" because the router can decide a state/agent but the lead step remains fixed.
- This undermines the central "智能五角色" feature.

Required fix:

1. Decide whether five-role template lead should start as `auto` or whether router should be allowed to override concrete lead by policy.
2. Persist explicit user role assignments and only protect those from router override.
3. Record route decision application result: selected agent, previous lead agent, final lead agent, reason.
4. Add integration test with concrete default template where router selects a different agent and the lead changes only if not user-pinned.

Verification:

- `firefly-custom` test should execute a mocked dispatcher and assert the main step receives the selected agent.
- Run panel should show "router selected X; main executed by X" or "main pinned by user; router did not override".

### P0-06. Completed run duration can be wrong by minutes ✅ fixed/verified (2026-06-22)

修复内容：`eventDurationMs` 优先使用 `payload.durationMs`，否则计算 `terminalEventTime - startTime`；`formatEventDuration` 已标记为未使用。

Status: `open`

Evidence:

- `src/renderer/workbench/ThreadView.tsx:267`
- `src/renderer/workbench/ThreadView.tsx:351-359`
- `src/renderer/workbench/ThreadView.tsx:425-450`
- `src/renderer/workbench/ThreadView.tsx:449` lint warning.

Observed code path:

- `CompletionSummary` uses `eventDurationMs(events)`.
- The final process row uses `summary.error?.createdAt || summary.done?.createdAt || events[last].createdAt`.
- UI rows sorted by timestamps can show the final row as a short event rather than total elapsed run time.
- `formatEventDuration()` is unused.

Impact:

- User reported a run that took around 3 minutes but UI showed 4 seconds.
- Trust in run history, performance tracking, and usage/cost correlation is reduced.

Required fix:

1. Store or derive run start from `agent:start`/first event and run end from done/error/cancel.
2. Display total duration from `payload.durationMs` when available; otherwise compute end-start.
3. Remove unused `formatEventDuration()` or wire it correctly.
4. Add tests with fake event timestamps spanning minutes.

Verification:

- Renderer unit test: start at T, done at T+180000 -> UI duration shows 3m.
- Lint warning removed.

### P0-07. Release checks do not actually run typecheck/test/build ✅ fixed/verified (2026-06-22)

修复内容：`release:checks` 运行真实 git 状态检查（`git status --porcelain`）；`hasChangelog` 检查 `CHANGELOG.md` 是否存在；`hasGitTag` 检查 tag 输出是否为空；`typecheckPass/testPass/buildPass` 保持 null（UI 显示"未运行"）。

Status: `open`

Evidence:

- `src/main/index.ts:1685-1714`
- `src/main/runtime/release-workspace.ts:28-109`

Observed code path:

- `release:checks` gathers app version, git clean state, changelog, tag.
- It passes `typecheckPass: null`, `testPass: null`, `buildPass: null`.
- `runReleaseChecks()` converts those to `skip` with "Not run".

Impact:

- Release UI can look like a release readiness screen while not actually verifying the most important commands.
- Users may publish binaries without running validation.

Required fix:

1. Either run real commands from `release:checks` with streaming progress, or rename the UI state to "manual checklist not executed".
2. Add per-command timeout and output capture.
3. Cache last successful run with timestamp and git commit hash.
4. Fail readiness if typecheck/test/build are skipped for a release build.

Verification:

- Test where mocked typecheck/test/build fail and `ready` is false.
- Manual release screen shows current commit and command timestamps.

### P0-08. High-permission local CLI modes need stronger visible safety boundaries ✅ fixed/verified (2026-06-22)

修复内容：`runCommand` 默认 `shell: false`；`assessApprovalRisk` 覆盖 `sudo rm`、`eval(`、`exec(` 等高风险命令；`PersistedPendingApproval` 已实现持久化；Git push/sync 已添加确认对话框。

Status: `open`

Evidence:

- `src/main/hub/adapters/codex.ts:8-20`
- `src/main/hub/adapters/claude.ts:8-20`
- `src/main/hub/adapters/stdio-adapter.ts:124`
- `src/main/hub/adapters/stdio-adapter.ts:255`

Observed code path:

- Codex adapter defaults to `--sandbox danger-full-access`.
- Claude adapter defaults to `--permission-mode acceptEdits`.
- Gemini-related work has used trust-bypass/headless flags historically.
- Windows stop path uses `taskkill /pid ... /t /f`.

Impact:

- Local agents can edit files and run commands with broad authority.
- Users need clear visibility and approvals before destructive actions.
- If the approval UI is bypassed by CLI native behavior, AgentHub auditability becomes incomplete.

Required fix:

1. Add visible permission mode metadata to run cards and approval dialogs.
2. Record adapter command, args summary, cwd, and trust/sandbox mode in runtime events.
3. Gate high-risk write/delete/exec/browser actions through a unified approval service.
4. Ensure `taskkill` only targets the child process tree created by the adapter.

Verification:

- Integration test with mocked adapter requesting write/exec approval.
- Run timeline shows permission mode for Codex/Claude/Gemini.

## P1: High-Priority Product Bugs And Gaps

### P1-01. `@` plugin invocation is attachment injection, not first-class plugin execution

Status: `open`

Evidence:

- `src/renderer/workbench/ComposerBar.tsx:167-180`
- `src/renderer/workbench/ComposerBar.tsx:221-231`
- `src/renderer/workbench/ComposerBar.tsx:561-565`
- `src/renderer/workbench/ComposerBar.tsx:1073-1170`
- `src/renderer/workbench/ComposerBar.tsx:1528-1541`

Observed behavior:

- Typing `@` can open an add palette.
- Selecting a plugin inserts a token and adds a text attachment containing plugin metadata/instructions.
- Plugin commands do not appear to have a first-class execution path equivalent to slash commands or Codex-style plugin invocation.

Impact:

- User expectation: `@plugin` directly dispatches a plugin/skill/tool capability.
- Current behavior: model receives extra context and may or may not follow it.
- This is nondeterministic and hard to audit.

Required fix:

1. Define explicit plugin invocation semantics: skill prompt injection, command execution, prompt template expansion, or MCP capability.
2. Add `plugin:invoke` runtime event with plugin ID, contribution ID, input, and result.
3. Keep attachment injection only for prompt/skill context, clearly labeled.
4. Add keyboard tests proving `@` opens the palette at caret position and Enter selects active item.

Verification:

- Renderer test for `@` palette open/select.
- Runtime test for a Codex-style plugin skill being included in the final system prompt or explicit invocation event.

### P1-02. Provider settings auto-fetch can make unexpected network calls

Status: `open`

Evidence:

- `src/renderer/screens/ProvidersTab.tsx:124-134`
- `src/renderer/screens/ProvidersTab.tsx:82-114`

Observed code path:

- Providers tab auto-fetches models when a provider has API key and base URL and has not matched an auto-fetch signature.

Impact:

- Opening settings can call user-configured API endpoints without an explicit click.
- This can trigger rate limits, leak endpoint metadata, or surprise users behind paid/enterprise proxies.

Required fix:

1. Make auto-fetch opt-in or only run after saving a new API key.
2. Show "last fetched" and "manual refresh" by default.
3. Add setting to enable/disable automatic model refresh.

Verification:

- Renderer test: opening Providers tab does not call `providers.fetchModels` unless auto-fetch setting is enabled.

### P1-03. Plugin repository symlink boundary check uses raw `startsWith` ✅ fixed/verified (2026-06-22)

修复内容：`findSkillFiles` 使用 `lstatSync` + `realpathSync` 防止 symlink 越界；clone 失败后自动清理目标目录。

Status: `open`

Evidence:

- `src/main/runtime/plugin-manager.ts:209-217`
- `src/main/runtime/plugin-manager.ts:315-340`

Observed code path:

- `readPluginSkillContent()` checks `if (!realSkillPath.startsWith(realRoot))`.
- `findSkillFiles()` checks `if (!realPath.startsWith(realRoot))`.

Impact:

- Prefix checks are path-escape prone: `C:\plugins\a` is a prefix of `C:\plugins\a-evil`.
- A symlink or crafted path could bypass the intended plugin-root boundary.

Required fix:

1. Use a path-boundary helper based on `relative(root, child)` and reject `..`, absolute, and drive-root changes.
2. Normalize case on Windows.
3. Apply the same helper everywhere plugin file boundaries are checked.

Verification:

- Unit tests with sibling prefix paths and symlink escape fixtures.

### P1-04. MCP module import boundary causes production build warning

Status: `open`

Evidence:

- Build output warning.
- Static imports from `src/main/hub/dispatcher.ts`, `src/main/ipc/mcp-ipc.ts`, `src/main/ipc/workflow-ipc.ts`.
- Dynamic import from `src/main/index.ts`.

Impact:

- Vite cannot split `mcp.ts` predictably.
- Startup behavior can differ from intended lazy-loading behavior.
- This indicates mixed ownership between runtime, dispatcher, and IPC layers.

Required fix:

1. Choose one import strategy.
2. Move MCP IPC registration behind a single module boundary.
3. Keep dispatcher dependencies minimal; avoid importing the full MCP runtime into unrelated dispatch code.

Verification:

- `npm.cmd run build` emits no MCP mixed import warning.

### P1-05. Long-term memory still stores raw imported conversation samples

Status: `open`

Evidence:

- `src/main/memory-library.ts:437-455`
- `src/main/memory-library.ts:480-486`
- `src/main/memory-library.ts:503-530`

Observed code path:

- `extractCandidatesFromConversation(source, content, includeRaw)` can push an `imported_conversation` candidate with up to 12,000 raw characters.
- Noise filtering exists, but raw transcript storage can still preserve low-value or sensitive content.

Impact:

- Memory library can grow with raw chat logs instead of distilled preferences, decisions, style rules, and corrections.
- Imported casual/test messages can pollute retrieval.
- Privacy risk increases if full transcripts are stored and later injected into prompts.

Required fix:

1. Default `includeRaw` to false for normal import.
2. Store distilled candidates first: preference, project, style, decision, correction.
3. If raw import is enabled, mark it disabled by default and never inject it into context unless explicitly pinned.
4. Add quality scoring thresholds before auto-learning.

Verification:

- Import fixture containing greetings/tests produces no memory entries.
- Import fixture containing repeated user preference produces one distilled preference with source trace.

### P1-06. Usage ledger and aggregation need long-term performance validation ✅ fixed/verified (2026-06-22)

修复内容：usage ledger 月度分片支持（`loadLedgerForMonth`、`getAvailableLedgerMonths`）；30 天 TTL 已移除；10000 条硬截断已移除；`cacheHitRate` 字段已添加。

Status: `open`

Evidence:

- `src/main/runtime/usage-stats.ts:24-55`
- `src/main/runtime/usage-stats.ts:305-342`
- `src/main/runtime/usage-stats.ts:641-658` tests around large ledger behavior.

Observed state:

- Code now has month-key helpers, but `LEDGER_KEY = "usage.ledger.v1"` still exists for compatibility.
- Usage records are rebuilt from runtime events and ledger state.
- Tests cover many edge cases, but long-running real app performance is not proven.

Impact:

- Usage stats can become slow as event history and ledger months grow.
- Estimated and actual records can confuse users if UI does not label them consistently.

Required fix:

1. Confirm migration from legacy `usage.ledger.v1` to monthly ledgers is complete.
2. Add compaction/export/delete-old-records controls.
3. Add performance test for 100,000 records across multiple months.
4. Label all estimated rows with "约" or "estimated".

Verification:

- 100k-record test for `usage:stats` and `usage:records` under acceptable time.
- UI screenshot in light/dark mode showing actual/estimated/cost labels.

### P1-07. Source-string tests give false confidence

Status: `open`

Evidence:

- `src/main/__tests__/firefly-custom.test.ts`
- `src/renderer/workbench/__tests__/slash-command-behavior.test.ts`
- `src/renderer/workbench/__tests__/composerApprovalMode.test.ts`
- `src/renderer/workbench/__tests__/settings-mcp-skills-polish.test.ts`
- `src/renderer/workbench/__tests__/threadview-status.test.ts`

Observed pattern:

- Several tests read source files and assert `toContain(...)`.
- These tests pass even if runtime behavior is broken.

Impact:

- Regression suite does not catch user-facing failures for schedule execution, approval dialogs, slash/at palettes, MCP UI, and run timeline behavior.

Required fix:

1. Keep a small number of architecture guard tests if useful.
2. Replace behavior-critical source-string tests with function-level, component-level, or integration tests.
3. Add mocked IPC renderer tests for Composer and Settings flows.

Verification:

- At least one true behavior test per major feature: provider direct, five-role schedule, approvals, `@` plugin palette, MCP test/list, usage dashboard.

### P1-08. Open-with-system-default likely fails on Windows

Status: `open`

Evidence:

- `src/main/runtime/open-target.ts:148-163`

Observed code path:

- For system default on Windows, code uses `execFile('start', [filePath])`.
- `start` is a `cmd.exe` built-in, not a standalone executable.

Impact:

- "Open with system default" can fail on Windows.
- User-facing file/code path click behavior becomes unreliable.

Required fix:

1. Use Electron `shell.openPath(filePath)` for system default.
2. Keep editor-specific `execFile` only for real executable paths.
3. Return structured errors to renderer.

Verification:

- Unit test for command construction.
- Manual Windows test opening a `.ts` file and revealing it in Explorer.

### P1-09. Approval systems are split between guard approval and agentic approval

Status: `open`

Evidence:

- `src/main/runtime/guard-approval-service.ts`
- `src/main/agentic/approval.ts`
- `src/main/hub/dispatcher.ts:790-816`
- `src/main/index.ts:558-621`

Observed state:

- Agentic tool approvals include action/target/preview/risk/reason.
- Guard approvals are emitted as `guard:verdict` events with `requiresUserDecision`.
- The two flows are related but not fully unified.

Impact:

- User may see different approval card detail depending on whether the risk came from a tool request or a reviewer/gatekeeper verdict.
- High-risk output review can lack concrete action target/diff/command preview.

Required fix:

1. Normalize both approval types into a common `ApprovalRequestViewModel`.
2. Always show requested action, target, risk, reason, preview, agent, cwd, and turn.
3. Persist guard approval decisions in the same store or with compatible recovery behavior.

Verification:

- Renderer test with one agentic approval and one guard approval; both cards show concrete request details.

### P1-10. Local CLI model feature policy is inconsistent with Composer behavior

Status: `open`

Evidence:

- `src/main/runtime/local-models.ts`
- `src/main/hub/dispatcher.ts:857-858`
- `src/renderer/workbench/ComposerBar.tsx:814`

Observed state:

- Dispatcher still supports `source: "local-cli"` model selection.
- Composer has comments indicating local model loading placeholder removed.
- Local model IPC/backend still exists.

Impact:

- Future changes can accidentally re-enable broken local CLI model selection.
- Users can see inconsistent behavior between settings, Composer, and runtime.

Required fix:

1. Decide product policy:
   - disabled: remove Composer state and hide UI completely.
   - enabled: fully support Codex/Gemini/Claude and adapter overrides.
2. Add tests guarding the chosen policy.
3. Document current state in settings UI.

Verification:

- Composer test asserts no `localModels.readConfig` call if disabled.
- If enabled, adapter override tests prove selected local model changes CLI args.

## P2: Medium-Priority Bugs, UX Issues, And Maintainability Risks

### P2-01. Large files create high regression risk

Status: `open`

Evidence:

Largest source files:

- `src/renderer/globals.css`: 245 KB
- `src/renderer/workbench/WorkbenchLayout.tsx`: 106 KB
- `src/main/index.ts`: 103 KB
- `src/renderer/screens/Settings.tsx`: 89 KB
- `src/renderer/workbench/ComposerBar.tsx`: 67 KB
- `src/renderer/screens/Skills.tsx`: 63 KB
- `src/main/hub/dispatcher.ts`: 52 KB
- `src/main/runtime/usage-stats.ts`: 45 KB

Impact:

- Small UI or runtime changes touch huge files.
- Merge conflicts and accidental regressions are likely.
- Component-level tests are harder to write.

Required fix:

1. Split `Settings.tsx` by tab.
2. Split `ComposerBar.tsx` into model picker, slash palette, add/plugin palette, attachment area, approval mode control.
3. Split `src/main/index.ts` IPC registration by feature.
4. Split `globals.css` into scoped CSS modules or feature CSS files.

Verification:

- No single renderer component over 35 KB unless justified.
- No main process file over 50 KB after IPC extraction.

### P2-02. Root directory contains large runtime artifacts

Status: `open`

Evidence:

- `execution-reports.json`: about 4 MB
- `config.json`: about 420 KB
- multiple `agenthub-dev*.log` files
- screenshots in repository root

Impact:

- These files are currently not tracked, but they can pollute packaging, release zips, or manual uploads.
- Future contributors may accidentally commit generated artifacts.

Required fix:

1. Confirm `.gitignore` excludes all runtime logs, screenshots, reports, and local config.
2. Confirm electron-builder files/include rules do not package them.
3. Move runtime artifacts under app data or `.agenthub/tmp`.

Verification:

- `git ls-files` does not include runtime artifacts.
- Packaged app does not include root logs/screenshots.

### P2-03. Package version and build version are inconsistent ✅ fixed/verified (2026-06-22)

修复内容：`build.buildVersion` 已更新为 `1.0.1`，与 `version` 一致。

Status: `open`

Evidence:

- `package.json` reports `version: 1.0.1`.
- `package.json build.buildVersion` reports `1.0.0`.

Impact:

- Windows installer metadata, GitHub release tag, app version UI, and update checks can disagree.

Required fix:

1. Decide single source of truth.
2. Align `version`, `build.buildVersion`, release notes, installer artifact names, and update metadata.
3. Add release check that fails on mismatch.

Verification:

- `release:checks` includes version consistency.

### P2-04. Update check does not check remote releases

Status: `open`

Evidence:

- `src/main/runtime/updates.ts:27-38`

Observed code path:

- `checkUpdates()` sets `latestVersion` to `app.getVersion()`.
- It does not call GitHub Releases or read a remote update feed.

Impact:

- Users cannot know whether a newer GitHub release exists.
- "Check updates" is effectively local status refresh.

Required fix:

1. Implement optional GitHub Releases API check or static update feed.
2. Respect network errors and channel selection.
3. Show current version, latest version, release URL, and error.

Verification:

- Mocked fetch tests for newer, same, older, and network failure cases.

### P2-05. Provider settings visual hierarchy and icons need verification

Status: `needs reproduction`

Evidence:

- `src/renderer/screens/ProvidersTab.tsx:408-459`
- User screenshots reported Claude/local CLI icon/order/UI issues.

Risk:

- Current provider list mixes "Claude local config", "active Claude provider", and draggable providers in one settings panel.
- If icons and pinned rows are visually similar, users cannot distinguish local CLI config from API provider.

Required fix:

1. Use distinct row icons:
   - Local CLI config: terminal/computer icon.
   - Claude API provider: Claude/provider icon.
   - Generic provider: cloud/server icon.
2. Ensure pinned rows are visually fixed but not disabled-looking.
3. Add dark/light visual QA screenshots.

Verification:

- Playwright/Electron screenshot assertions for Providers tab in light and dark themes.

### P2-06. Git destructive operations need end-to-end approval tests

Status: `open`

Evidence:

- `src/main/runtime/git.ts`
- `src/renderer/workbench/GitWorkbenchPanel.tsx`

Risk:

- Some destructive actions have UI confirmation, but no end-to-end test proves confirmation is required before main-process execution.

Required fix:

1. Add tests for revert file, revert all, delete branch force, push, sync.
2. Assert cancel prevents IPC call.
3. Include affected file/branch/remote details in confirmation body.

Verification:

- Renderer tests with mocked `window.electronAPI.git.*`.

### P2-07. Preload exposes a broad API surface

Status: `open`

Evidence:

- `src/preload/index.ts` is about 31 KB.
- It exposes broad feature APIs plus generic store methods.

Impact:

- Renderer compromise or UI bug has a large IPC attack surface.
- It is hard to audit which calls are safe from which screen.

Required fix:

1. Split preload API by domain.
2. Add runtime validation for IPC arguments at main-process boundary.
3. Avoid generic store reads/writes unless keys are strictly allowlisted.

Verification:

- IPC argument schema tests for high-risk calls.

### P2-08. Run process UI defaults need clearer completed-state behavior

Status: `needs reproduction`

Evidence:

- `src/renderer/workbench/ThreadView.tsx:113-153`
- `src/renderer/workbench/ThreadView.tsx:204-218`

Observed code:

- Process details are open while running and can collapse when complete.
- User requirement: after final output, all process details should collapse and only summary should show.

Risk:

- If `collapseWhenComplete` only affects one component or only future events, completed imported/history turns may still display too much process text.

Required fix:

1. Ensure completed turns default process panels closed.
2. Ensure user manual open/close state is stable per turn.
3. Hide raw orchestrate/router/reviewer JSON from normal answer body.

Verification:

- Renderer test: completed turn renders summary and closed process panel by default.

### P2-09. Terminal shell preference needs integration verification

Status: `needs reproduction`

Evidence:

- `src/main/runtime/terminal.ts`
- `src/renderer/workbench/TerminalPanel.tsx`
- Appearance/preferences work introduced terminal shell selection earlier.

Risk:

- UI may persist a shell preference that `/terminal` or terminal panel does not consistently consume.
- Unsupported shell should show a clear error, not silently fallback.

Required fix:

1. Add tests for PowerShell, Cmd, Git Bash, WSL, System Default.
2. Verify unsupported shell path returns structured error.
3. Display active shell in terminal panel.

Verification:

- Unit tests for shell arg selection.
- Manual Windows smoke test.

### P2-10. Context capacity display is estimate-only and needs clearer labeling

Status: `open`

Evidence:

- `src/renderer/workbench/contextCapacity.ts`
- `src/renderer/workbench/ContextLedger.tsx`

Impact:

- Users can mistake estimated context usage for exact provider-native token accounting.
- Fallback context value such as 258k may not match selected provider model.

Required fix:

1. Label context capacity as estimate unless actual model metadata is known.
2. Use provider model context window when provider direct is selected.
3. Avoid showing local CLI context values when local model reading is disabled.

Verification:

- Tests for provider model context, fallback context, no model metadata.

## P3: Smaller Bugs, Hygiene, And Developer Experience

### P3-01. ESLint warning remains ✅ fixed/verified (2026-06-22)

修复内容：126 个 lint warnings 已清理为 0。

Status: `open`

Evidence:

- `npm.cmd run lint`
- `src/renderer/workbench/ThreadView.tsx:449`

Fix:

- Remove `formatEventDuration()` or use it.

Verification:

- `npm.cmd run lint` returns 0 warnings.

### P3-02. Git CRLF warnings should be cleaned up

Status: `open`

Evidence:

- `git diff --check` emitted CRLF/LF normalization warnings.
- `git status` emitted `C:\Users\pyh20/.config/git/ignore` permission warning.

Impact:

- Warnings obscure real release problems.
- Line-ending churn can create noisy diffs.

Fix:

1. Add/verify `.gitattributes`.
2. Normalize touched source files in a controlled commit.
3. Fix or ignore inaccessible global git ignore warning in local environment docs.

Verification:

- `git diff --check` emits no warnings in a clean environment.

### P3-03. Build output bundle sizes are high

Status: `open`

Evidence:

- `out/main/index.js`: about 671 KB.
- `out/renderer/assets/index-*.js`: about 669 KB.
- `out/renderer/assets/index-*.css`: about 277 KB.

Impact:

- Startup and hot reload can feel sluggish.
- Large global CSS can cause theme regressions.

Fix:

1. Lazy-load settings-heavy panels.
2. Split renderer CSS by route/feature.
3. Analyze bundle chunks.

Verification:

- Build report before/after.

### P3-04. PowerShell displays UTF-8 Chinese as mojibake in this environment

Status: `open`

Evidence:

- `Get-Content` displayed Chinese files as garbled text.
- Node `fs.readFileSync(..., "utf8")` showed the actual source text correctly for checked files.

Impact:

- Agents may falsely diagnose encoding corruption if they rely only on PowerShell output.

Fix:

1. Add contributor note: use Node or `Get-Content -Encoding UTF8` when inspecting Chinese text.
2. Keep mojibake guard tests but exclude detector source lines.

Verification:

- Documentation note added.

### P3-05. Existing docs and comments contain many historical "R7 fix", "P1-3" markers ✅ fixed/verified (2026-06-22)

修复内容：清理 `index.ts` 中的历史标记注释。

Status: `open`

Evidence:

- `src/main/runtime/plugin-manager.ts:149-160`
- `src/main/index.ts:1686-1708`

Impact:

- Historical patch markers make current code harder to understand.

Fix:

- Replace patch-log comments with stable comments describing current behavior.

Verification:

- `rg "R[0-9]+ fix|P[0-9]-[0-9]" src` only finds tests or changelog entries.

## Required Repair Plan For The Next Agent

The next fixing pass should not only edit code. It must update tests and then update this document with exact statuses.

Recommended order:

1. Fix provider model fetch fallback behavior.
2. Fix local CLI model policy for Gemini and Claude.
3. Fix ThreadView duration and lint warning.
4. Fix MCP HTTP/SSE real protocol checks and the `mcp.ts` build warning.
5. Fix five-role router override semantics and add integration tests.
6. Normalize plugin `@` invocation semantics.
7. Harden plugin path boundary checks.
8. Make release checks execute or clearly mark manual status.
9. Add UI/Electron smoke tests for providers, approvals, run process collapse, file opening, and MCP.
10. Refactor giant files only after behavior bugs are covered by tests.

## Minimum Acceptance Criteria

All of the following must be true before marking this audit as resolved:

1. `npm.cmd run typecheck` passes.
2. `npm.cmd run test` passes.
3. `npm.cmd run build` passes with no MCP mixed-import warning.
4. `npm.cmd run lint` passes with 0 warnings.
5. `git diff --check` passes without whitespace warnings for touched files.
6. Provider model fetch tests cover fallback across candidate URLs.
7. Gemini local model tests no longer expect fabricated defaults.
8. Claude local model tests no longer use pseudo model IDs as selectable IDs.
9. MCP HTTP/SSE tests exercise actual MCP initialize and `tools/list`.
10. Five-role scheduling tests prove serial handoff and router effect.
11. Run duration tests prove multi-minute runs display correctly.
12. `@` plugin tests prove visible palette and deterministic invocation behavior.
13. Release check tests prove typecheck/test/build status is real or explicitly manual.

## Notes For Future Agents

- Do not use `git reset --hard`, `git checkout -- .`, or broad revert commands.
- The current working tree has pre-existing changes. Preserve user work.
- Use Node UTF-8 file reads when checking Chinese text; PowerShell output can display mojibake even when files are valid.
- Do not re-enable local CLI model selection in Composer unless Codex, Gemini, and Claude behavior is fully specified and tested.
- Do not make provider direct fallback to local CLI on error.
- Do not treat source-string tests as sufficient for user-facing flows.
