# AgentHub Neko-Route 风格模型路由与 Mac/Win 双 UI 实现

## 参考点

本轮参考 neko-route 的“模型是一等路由入口”思想：模型条目不仅保存展示名和上下文，还保存 provider、真实上游模型、推理能力、超时、重试、fallback 与 Codex catalog 映射。AgentHub 没有迁移到 Tauri/Rust，也没有照搬其存储结构，而是在现有 ProviderManager、provider direct、设置页和外观系统上增量实现。

## AgentHub 实现差异

- Provider 仍是 API Key、Base URL、协议和模型拉取的配置入口。
- 服务商增加协议语义：OpenAI Chat Completions、Anthropic Messages、Gemini GenerateContent，并在模型中心展示。
- ModelDefinition 变为可路由对象，支持 `enabled`、`providerId`、`upstreamModel`、`timeoutMs`、`retryCount`、`reasoningEnabled`、`defaultReasoningLevel`、`supportedReasoningLevels`、`codexAlias`。
- 成功拉取模型后以服务商真实返回列表为准；不存在于返回结果的旧模型不会被为了路由绑定而伪造保留。
- provider direct 与本地 Agent 继续互斥：选择 API 模型走 provider HTTP；选择本地 Agent 走 CLI/ACP。
- Codex 配置默认只读预览；只有用户点击导出时写入 `~/.codex/model-catalogs/agenthub-neko-route.json`。

## 数据模型

- `ModelRouteSettings`
  - `fallbackModelId`：未知或禁用模型的降级目标，可写 `provider/model`。
  - `codexDefaultModel`：Codex 默认模型入口。
  - `codexInjectionMode`：`official_account`、`third_party_api`、`lan_share`，用于 Codex slot 映射语义。
  - `codexInternalModelLock`：未配置 slot 时锁定默认模型，避免内部辅助模型打到错误上游。
  - `codexSlots`：Codex slot 到 AgentHub 模型的映射。
- `ModelDefinition`
  - `id` 是 AgentHub 内部模型 ID。
  - `upstreamModel` 是真实请求上游的模型 ID；为空时使用 `id`。
  - `timeoutMs` 覆盖单模型请求超时；为空时使用全局 Agent 超时。
  - `retryCount` 预留给请求失败重试策略，当前 UI 已持久化。

## 用户流程

1. 在“供应商”页配置 API URL 和 API Key，点击拉取模型。
2. 在“模型”页查看全局模型目录。
3. 对单个模型设置真实上游模型、上下文、超时、重试和启用状态。
4. 点击“测试”发送最小请求，查看延迟、错误和 usage。
5. 配置默认模型或 fallback 模型。
6. 点击“导出 Codex Catalog”生成 Codex 兼容模型目录。
7. 在 Composer 选择 API 厂商模型时，AgentHub 使用模型路由解析后的 upstream 发起请求。

## 全局日志

- 新增全局 JSONL 日志：`<userData>/logs/agenthub-events.jsonl`。
- 覆盖主进程加载、所有 IPC start/done/error、provider 模型拉取、模型路由、provider direct 错误、未捕获异常。
- 日志会脱敏 `apiKey`、`token`、`secret`、`password`、`authorization` 等字段。
- 前端可通过 `window.electronAPI.diagnostics.logPath()` 获取日志路径，便于用户反馈问题时附带。

## Mac/Win UI

- 外观页继续使用 `AppearancePreferences.uiStyle: "mac" | "win"`。
- Mac 风格增加更圆润面板、较宽 sidebar、毛玻璃和柔和阴影。
- Windows 风格增加紧凑尺寸、方正边界和低阴影。
- Provider、模型中心、设置 shell、Composer 和运行输出共享同一套 token，不维护两套页面代码。

## 测试清单

- 模型路由：direct、upstream、禁用模型、fallback unknown、Codex internal lock。
- 模型拉取合并：保留旧模型的 enabled、upstream、timeout、retry、reasoning 和 alias。
- Codex catalog：slug 唯一、target_model_id 使用 upstream、context_window 正确。
- UI：模型中心可搜索、编辑、测试、导出；Mac/Win 在浅色、深色、窄窗口不溢出。
- 回归：`npm.cmd run typecheck`、`npm.cmd run test`、`npm.cmd run build`、`git diff --check`。

## 已知限制

- 本轮不自动写 `~/.codex/config.toml`，只导出 catalog 文件。
- 模型测试需要有效 API Key 和可达网络；离线时只显示错误，不清空旧模型。
- `retryCount` 已持久化并进入模型路由中心，深度重试策略后续可在 provider client 层扩展。
