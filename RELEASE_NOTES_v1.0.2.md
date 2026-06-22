# v1.0.2

This release summarizes changes since `v1.0.1`.

## New Features

- Added clearer completed-run reporting for Agent execution summaries. Completed runs can now show historical failed attempts without marking the whole report as failed.
- Added local CLI model labeling for Codex, Gemini, and Claude-style local Agent runs in runtime events and usage request details.
- Added compatibility for common local CLI Agent aliases such as `codex-cli`, `gemini-cli`, and `claude-cli` when resolving local model configuration.

## Fixes

- Fixed a usage statistics mismatch where local CLI requests could still appear as stale API provider models such as `openai / gpt-4o`, `anthropic / claude-sonnet-*`, or `local-cli / unknown`.
- Fixed stdio and ACP local Agent stream events so they prefer the current local CLI model from `localModels:readConfig` before falling back to route bindings.
- Fixed request detail records so new local CLI runs are recorded as `local-cli / <configured local model>` when a configured model is available.
- Fixed execution reports showing `failed` after the final turn was already completed because one intermediate tool attempt failed and then recovered.
- Fixed route-only and guard-only metadata cards inheriting a later Agent failure state.
- Fixed empty `0ms` execution reports appearing for cards that had no reportable tool activity, final output, file change, or terminal run state.
- Reworked execution report labels to distinguish final failure from completed runs with failed attempts.

## Tests

- Added dispatcher regression coverage for local CLI runs with stale API bindings and current local model config.
- Added usage request detail coverage to verify local CLI records use the locally configured model.
- Added ThreadView coverage for completed reports with failed attempts, route-only metadata status, and empty report suppression.
- Added ExecutionReport coverage for the new `outcome` field and completed reports with historical failed attempts.
- Verified full project test suite: 111 test files, 714 tests passing.

## Performance Improvements

- Reduced UI noise in completed runs by suppressing empty execution report cards.
- Reduced misleading error recovery loops by keeping final run status separate from intermediate failed attempts.
- Reduced usage page confusion by aligning local CLI request labels with the local model configuration already shown in Settings.

## Windows Installer

- `AgentHub-Setup-1.0.2.exe`
- `AgentHub-Setup-1.0.2.exe.blockmap`
