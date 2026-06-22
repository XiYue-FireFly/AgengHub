# v1.0.1

This release summarizes changes since `v1.0.0`.

## New Features

- 新增 Claude CLI 本地模型读取支持，读取 `~/.claude/settings.json` 的 `ANTHROPIC_MODEL` 等环境变量，不伪造默认模型。
- 新增 MCP `resources/list` 和 `prompts/list` 枚举，设置页可展示工具数、资源数和 Prompt 数。
- 新增 IPC channel 唯一性测试，防止 `ipcMain.handle` 重复注册导致启动崩溃。
- 新增 Token 经济配置模块，支持 token 预算控制、工具描述/结果压缩和简洁回复指令。
- 新增中轮引导队列，用户可在 Agent 执行期间发送引导消息。
- 新增 Token 估算器，支持 CJK 字符感知的 token 计算。
- 新增请求历史清理模块，支持累积 token 预算控制，防止长会话上下文膨胀。
- 新增工具风暴中断器，防止重复工具调用膨胀动态历史。
- 新增历史修复模块，规范化加载的对话记录。
- 新增进行中任务追踪器，保证成功/错误/中止时清理。
- 新增工具调用参数修复模块，解包嵌套包装器和截断超大字符串。
- 新增追加式会话日志，有界内存窗口和完整磁盘重放。
- 新增本地 Claude Code JSONL 会话扫描功能，从 `~/.claude/projects/` 提取 usage 记录。
- 新增 usage ledger 月度分片支持，按月查询和管理 usage 历史。
- 新增 `cacheHitRate` 字段到 usage 统计，支持缓存命中率计算。
- 新增 `UsageTokenBreakdown` 扩展字段：`cacheHitTokens`、`cacheMissTokens`、`cacheHitRate`、`tokenEconomySavingsTokens`。
- 新增 Git push/sync 操作确认对话框，防止误操作。
- 新增 `release:checks` 真实 git 状态检查，不再返回硬编码假状态。

## Fixes

- 修复 IPC 重复注册问题，删除 40 个被 `workflow-ipc.ts` 覆盖的死代码注册。
- 修复 `turns:create` placeholder 问题，删除死代码模块 `thread-ipc.ts`。
- 修复 agentic 命令执行默认使用 `shell: true` 的安全问题，改为 `shell: false`。
- 修复 `assessApprovalRisk` 遗漏 `sudo rm`、`eval(`、`exec(` 等高风险命令。
- 修复 `scheduleStepsWithRouteDecision` 忽略路由决策的问题，现在路由决策会影响 lead step 的 agentId。
- 修复 `release:checks` 的 `hasGitTag` 逻辑，正确检查 tag 输出是否为空。
- 修复 `release:checks` 的 `gitClean` 硬编码为 `true` 的问题，现在通过 `git status --porcelain` 获取真实状态。
- 修复 plugin-manager clone 失败不回滚的问题，现在自动清理目标目录。
- 修复 `findSkillFiles` 缺少 symlink 越界防护，使用 `lstatSync` + `realpathSync` 防止逃逸。
- 修复 `batch4-modules.test.ts` plugin-manager 测试因全局目录干扰失败的问题。
- 修复 `managerFetchModels.test.ts` URL 候选列表期望值不匹配的问题。
- 修复 `ComposerBar.tsx` 中 `{false && (...)}` 的 `no-constant-binary-expression` lint 错误。
- 修复 `ProvidersTab.tsx` 中 `savePendingProviderEdits` 未使用的 lint warning。
- 修复 `Settings.tsx` 中 `onReorderForClaude` prop 传递问题。
- 修复 `mcp.ts` 中 `_initialized` 变量赋值后未读取的 lint warning。
- 修复 126 个 ESLint warnings，清理 39 个文件的未使用 import 和变量。

## Tests

- 新增 `ipc-registration-uniqueness.test.ts`：验证所有 IPC channel 唯一性（2 tests）。
- 新增 `local-usage-scanner.test.ts`：验证 Claude JSONL 扫描功能（4 tests）。
- 新增 `token-economy.test.ts`：验证 token 经济配置（10 tests）。
- 新增 `steering-queue.test.ts`：验证中轮引导队列（6 tests）。
- 新增 `context-estimator.test.ts`：验证 token 估算器（8 tests）。
- 新增 `request-history-hygiene.test.ts`：验证请求历史清理（5 tests）。
- 新增 `tool-storm-breaker.test.ts`：验证工具风暴中断器（8 tests）。
- 新增 `history-healing.test.ts`：验证历史修复（7 tests）。
- 新增 `inflight-tracker.test.ts`：验证进行中任务追踪器（7 tests）。
- 新增 `tool-call-repair.test.ts`：验证工具调用参数修复（7 tests）。
- 新增 `append-only-session-log.test.ts`：验证追加式会话日志（6 tests）。
- 新增 `local-models.test.ts` Claude CLI 配置读取测试（5 tests）。
- 新增 `mcp.test.ts` resources/prompts 枚举测试（2 tests）。
- 新增 `usage-stats.test.ts` cacheHitRate 和月度分片测试（4 tests）。
- 总测试数：111 个测试文件，702 个测试全部通过。

## Performance Improvements

- 新增 token 经济模式，支持压缩工具描述和结果以减少上下文膨胀。
- 新增请求历史清理，防止长会话累积过多工具输出。
- 新增工具风暴中断，防止重复工具调用消耗 token。
- 新增 usage ledger 月度分片支持，提升长期使用性能。
