# v1.1.1

This release summarizes changes since `v1.1.0`.

## New Features

- Added stable editor-opening support for generated file paths and code references. Users can now open a target in the configured editor, reveal it in the file manager, open it with the system default app, or choose a specific supported editor from the context menu.
- Added visible error feedback when a file or editor action fails, instead of silently doing nothing.
- Added tests covering editor target resolution, Markdown file actions, thread switching stability, titlebar menu layering, and simplified Composer behavior.

## Fixes

- Fixed Workbench startup repeatedly switching between chat records. The selected thread is now persisted and async workspace loads can no longer overwrite a user's current thread selection with stale snapshot data.
- Fixed chat flicker caused by backend `activeThreadId` updates continuously driving the main conversation selection after the user had already opened a thread.
- Fixed direct local Agent and provider-direct runs being affected by custom dispatch settings. Direct runs now bypass custom schedules and keep provider/API selection isolated from local CLI Agent execution.
- Fixed cases where selecting an API provider model could fall back into the wrong local Agent path.
- Fixed "Open editor" and right-click "Open" actions not invoking the intended editor target.
- Fixed file-action context menu coverage for editor, file manager, system default, VS Code, Cursor, Antigravity, and copy actions.
- Fixed titlebar menus that could be visually covered by other Workbench panels.
- Improved MCP, skills, settings, runtime store, and Workbench event tests to guard against regressions in recently repaired flows.

## UI / UX

- The Workbench now keeps the last selected conversation stable after restart and after returning from Settings.
- Generated output file references have clearer actions and failure messages.
- Runtime output handling is less likely to show stale status after switching between sessions.

## Tests

- Added `thread-switching-layout.test.ts` for startup and thread selection stability.
- Added `open-editor-actions.test.ts` for top-level and right-click editor actions.
- Added `titlebar-menu-layering.test.ts` for menu interaction layering.
- Added `composer-simplification.test.ts` for Composer direct-selection behavior.
- Updated runtime, MCP, skills, memory, provider routing, slash command, and Workbench runtime-event tests.

## Windows Installer

- Published a Windows x64 NSIS installer for `v1.1.1`.
- Installer artifact: `AgentHub-Setup-1.1.1.exe`.
- Blockmap artifact: `AgentHub-Setup-1.1.1.exe.blockmap`.
