# v1.0.1

This release summarizes changes since `v1.0.0`.

## New Features

- Added editable Agent assignment for every dispatch mode in the run panel: Auto Route, Broadcast, Chain Handoff, Orchestrate, Lead + Workers, Parallel Review, Smart Five-role, and Custom Schedule.
- Added persisted schedule overrides for non-custom presets, so each mode can keep its own selected local Agents, roles, and dependency graph.
- Added Claude CLI local model config reading support from local Claude settings and environment-style configuration without inventing fake default models.
- Added MCP `resources/list` and `prompts/list` support so the Settings page can show tool, resource, and prompt availability.
- Added token economy controls for budget-aware execution, tool description compression, result compaction, and concise reply guidance.
- Added steering queue support for sending guidance while an Agent run is still active.
- Added CJK-aware token estimation and request history hygiene for long-running conversations.
- Added tool storm protection, in-flight task tracking, tool-call argument repair, and append-only session log support.
- Added local Claude Code JSONL usage scanning and monthly usage ledger sharding.
- Added `cacheHitRate` and expanded usage token breakdown fields for cache-aware statistics.
- Added Git push/sync confirmation dialogs to reduce accidental remote operations.
- Added real `release:checks` git status checks instead of hardcoded placeholder results.

## Fixes

- Fixed custom dispatch execution being limited to only Custom Schedule and Smart Five-role modes; any saved schedule graph can now execute through the custom schedule runner.
- Fixed the run panel showing fixed preview-only steps for most dispatch modes; all modes now expose the same Agent selector, role selector, dependency editor, and template controls.
- Fixed retry handling so turns with saved schedule graphs keep using the same custom execution path.
- Fixed IPC duplicate registration risk by removing stale overlapping registrations and adding uniqueness coverage.
- Fixed the `turns:create` placeholder path by removing dead placeholder routing and preserving the real send chain.
- Fixed unsafe default command execution paths by avoiding default shell execution and expanding high-risk command detection.
- Fixed high-risk approval flow copy and persistence behavior so the request content and risk reason are visible to the user.
- Fixed Claude CLI model reading tests and local model parser behavior around missing or partial local config.
- Fixed provider model fetch tests for compatible model-list URL derivation and failure preservation.
- Fixed MCP resource/prompt listing behavior and related status rendering.
- Fixed run-only custom schedule output leaking into normal chat answer text.
- Fixed several dark/light theme contrast issues in approval, statistics, memory, Skill, MCP, and execution views.
- Fixed prompt enhancement and thread output UI issues, including completed-process folding and final summary display.
- Fixed lint and test coverage gaps around schedule persistence, MCP/Skill polish, ThreadView status, and local model handling.

## Tests

- Added custom schedule override tests for persisted non-custom dispatch presets.
- Added Workbench routing state tests to ensure editable schedule graphs are dispatched for non-custom modes.
- Added main-process regression tests to ensure any supplied schedule graph is run by the custom scheduler.
- Updated RunTimeline tests for the unified editable schedule UI.
- Verified full project test suite: 111 test files, 709 tests passing.

## Performance Improvements

- Reduced UI confusion and rerender churn by using one shared editable schedule surface instead of mixing preview-only and editable schedule paths.
- Preserved default dispatcher behavior until a user actually saves an override for a preset, avoiding unnecessary custom scheduling work for untouched modes.
- Improved long-session usage and token bookkeeping with ledger sharding, cache-hit accounting, and request hygiene.
- Reduced repeated MCP and local config work through clearer status handling and targeted tests.

## Windows Installer

- `AgentHub-Setup-1.0.1.exe`
- `AgentHub-Setup-1.0.1.exe.blockmap`
