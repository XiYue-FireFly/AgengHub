# AgentHub

Electron + React + TypeScript desktop app for multi-agent collaboration.

## Quick Reference

```bash
npm run dev          # Start dev (electron-vite dev --watch)
npm run build        # Build main + preload + renderer
npm run typecheck    # tsc -b --noEmit (checks both tsconfig.node.json + tsconfig.web.json)
npm run test         # vitest run
npm run lint         # eslint .
npm run build:win    # Build + NSIS installer → dist/AgentHub-Setup-*.exe
```

**CI runs on Windows with Node 24.** The `npm ci` step requires npm 11+ to skip esbuild platform optional dependencies without EBADPLATFORM errors.

## Architecture

```
src/
├── main/                    # Electron main process (Node.js)
│   ├── index.ts             # App lifecycle (window, tray, app events)
│   ├── ipc/                 # IPC handlers by domain (git, memory, mcp, etc.)
│   │   └── index.ts         # Central registration via registerAllIpcHandlers()
│   ├── hub/                 # Agent dispatch, routing, registry, adapters
│   ├── agentic/             # Tool loop, approval, capabilities
│   ├── runtime/             # Feature modules (git, terminal, mcp, workflows, etc.)
│   ├── providers/           # Provider manager, client (OpenAI, Anthropic, etc.)
│   ├── routing/             # Proxy, takeover
│   ├── skills/              # Skills manager
│   └── store.ts             # AppStore (config.json in userData, encrypted secrets)
├── preload/
│   └── index.ts             # Single preload, typed bridge via contextBridge
├── renderer/
│   ├── main.tsx             # React entry
│   ├── App.tsx              # App shell, state, streaming
│   ├── workbench/           # Workbench components (views, panels, hooks)
│   ├── screens/             # Full-screen views (Settings, Skills, Tasks)
│   ├── glass/               # Shared glass-design components
│   ├── styles/              # Per-feature CSS files
│   ├── globals.css          # Design tokens + Tailwind import
│   └── vite-env.d.ts        # Renderer type declarations
└── shared/
    ├── ipc-types.ts         # IPC type contracts (single source of truth)
    └── errors.ts            # Shared error types
```

## TypeScript Setup

- **Strict mode** enabled in both tsconfig files
- **Project references**: `tsconfig.json` references `tsconfig.node.json` (main + preload) and `tsconfig.web.json` (renderer)
- **Path alias**: `@renderer/*` → `src/renderer/*` (in renderer tsconfig + vite)
- **Target**: ESNext for both node and web configs

## Testing

**Vitest** with electron stubbed out. Tests never require real electron binary.

```bash
npm run test                    # Run all tests
npm run test -- --watch         # Watch mode
npm run test -- path/to/file    # Run specific test file
```

**Key test setup:**
- `test/electron-stub.ts` mocks electron exports (app, safeStorage, ipcMain, etc.)
- `vitest.config.ts` aliases `electron` → `test/electron-stub.ts`
- Tests co-located in `__tests__/` directories adjacent to source
- E2E tests in `test/e2e/` (excluded from unit test runs)
- Test exclusions: `**/node_modules/**`, `**/test/e2e/**`, `**/.cc-switch-src/**`, `**/output/**`

**When writing tests:**
- Mock IPC at preload boundary, not internal modules
- Prefer integration tests over unit tests for agent logic
- Target: renderer ≥60% file coverage, main process ≥80% module coverage

## IPC Conventions

All IPC follows this pattern:

1. **Types** defined in `src/shared/ipc-types.ts`
2. **Handlers** registered in `src/main/ipc/<domain>-ipc.ts` (e.g., `git-ipc.ts`, `mcp-ipc.ts`)
3. **Central registration** via `registerAllIpcHandlers()` in `src/main/ipc/index.ts`
4. **Preload bridge** uses `contextBridge.exposeInMainWorld` only
5. **Renderer access** via `window.electronAPI` (never direct `ipcRenderer`)

When adding new IPC:
- Add type to `src/shared/ipc-types.ts`
- Create or extend domain IPC module in `src/main/ipc/`
- Register in `src/main/ipc/index.ts`
- Add to preload bridge in `src/preload/index.ts`

## Security Rules

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- API keys encrypted via Electron `safeStorage` (DPAPI on Windows, Keychain on macOS, libsecret on Linux)
- `store:get/set` access controlled by `isStoreKeyAllowed` — no sensitive keys exposed to renderer
- WebSocket server bound to `127.0.0.1` only, token-authenticated
- Path traversal checks on all file operations
- No `eval()` or `Function()` in renderer

## CSS / Styling

- **Design tokens** in `src/renderer/globals.css` (`:root` variables)
- **All colors** must use CSS variables — no hardcoded hex/rgba in components
- **Tailwind CSS 4** available for utility classes; semantic styles use custom classes
- **Dark/light themes** via `[data-theme]` attribute selector
- **Component-scoped CSS** allowed for complex features (prefixed with feature name)

## ESLint Rules (Non-Default)

The eslint config relaxes several rules for this codebase:
- `@typescript-eslint/no-explicit-any`: OFF (Electron/adapter code uses dynamic objects)
- `@typescript-eslint/no-unused-vars`: WARN (with `_` prefix ignore pattern)
- `@typescript-eslint/no-require-imports`: OFF (server.ts uses `require('ws')`)
- `@typescript-eslint/ban-ts-comment`: allows `@ts-ignore` with description
- `@typescript-eslint/no-this-alias`: OFF (adapter/dispatch pattern)
- `no-empty`: WARN with `allowEmptyCatch: true`

## Git Conventions

- Commit format: `<type>: <description>` (feat/fix/refactor/docs/test/chore/perf/ci)
- No emoji, no "Co-Authored-By", no "Generated with"
- One logical change per commit
- Run `git diff --check` before committing

## Module Size Limits

- Target: ≤ 500 lines per module
- Hard limit: 800 lines. Files exceeding this must be split.
- Current known violations (tracked):
  - `src/main/index.ts`: ~2128 lines — IPC extraction in progress
  - `src/renderer/workbench/WorkbenchLayout.tsx`: ~2333 lines — component extraction in progress
  - `src/renderer/screens/Settings.tsx`: ~2521 lines — sub-tab extraction needed
  - `src/renderer/globals.css`: ~10164 lines — CSS splitting in progress

## Build & Packaging

- **Build tool**: electron-vite (Vite-based, separate configs for main/preload/renderer)
- **Packager**: electron-builder
- **Windows**: NSIS installer, x64 only, `agenthub://` protocol registered
- **macOS**: DMG + ZIP, x64 + arm64, hardened runtime
- **Linux**: AppImage + deb, x64 only

**Build output:**
- `out/` — compiled JS (main + preload + renderer)
- `dist/` — packaged installers

## Gotchas

- **Electron binary in tests**: Never import electron directly in tests. The vitest alias handles this automatically, but if you add a new test that imports electron-dependent code, ensure it goes through the stub.
- **CSP in dev**: The `dev-csp-relax` vite plugin injects `'unsafe-inline' 'unsafe-eval'` for React Fast Refresh during dev only. Production CSP is strict.
- **Design icon sync**: `electron.vite.config.ts` copies agent icons from `AgentHub UI设计/` to renderer public dir. This directory may not exist in CI.
- **Path alias**: Use `@renderer/` prefix for imports within renderer code (configured in tsconfig.web.json and vite).
