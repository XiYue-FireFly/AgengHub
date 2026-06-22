你是 AgentHub 项目的高级全栈 / Agent 架构工程师。请在 `E:\Agent\AgentHub` 中基于当前代码进行稳定化迭代。**不要重写项目，不要提交无关文件，不要引入假功能。** 改动前先阅读现有实现与参考项目源码。

## 参考源码（只读对照，借鉴模式，不照搬代码）

- AgentHub（本仓库）：`E:\Agent\AgentHub`
- CCGUI：`E:\Agent\desktop-cc-gui`（Tauri+React，技术栈不同，借鉴其多来源扫描/流式渲染/事件背压设计）
- Kun：`E:\Agent\Kun`（Electron+React，最贴近本项目，借鉴其进程分层/CJK 检索/编码处理/持久化）
- cc-switch：`E:\Agent\.refs\cc-switch`（借鉴配置接管的原子写/备份/回滚安全）
- openai/codex：`E:\Agent\.refs\codex`（codex 事件协议/沙箱语义/审批数据形状的权威来源）

## 总体目标

把 AgentHub 从「功能堆叠但状态不稳」收敛成可靠的本地 Agent 工作台。优先修复**真实 bug**，不做大规模重写。聚焦：MCP 误报、长期记忆中文召回、审批不持久/不结构化、usage 依赖 runtime events、index.ts 巨石化、五角色调度可解释性、provider direct 与本地 Agent 边界、本地 CLI 能力检测、UI 深浅色与流畅度。

## 硬约束（违反即任务失败）

1. **禁止重写项目**。每个改动落到具体文件的小颗粒补丁，可独立审查、可回滚。
2. **禁止 `git add -A`**。只暂存本人改动的具体文件。本仓库多 Claude / Codex 并行：发现他人未提交改动不回滚、不格式化、不重排（当前工作树已有 `src/main/runtime/mcp.ts` 的未提交改动与 `mcp.ts.bak`，先确认归属再动）。
3. **不改跨进程契约**（IPC 通道名、`window.electronAPI` 形状、`providers/types.ts` schema、adapter `protocol`、路由端口 9528）除非该条目显式声明并给迁移。
4. **零回归 / 默认等价**：新增行为有显式开关或默认等于现状（审批默认 `allow`、agentic 默认行为不被悄改）。
5. **不引入假功能**：不写空实现、不写 `expect(true)` 凑测试、不把桌面 GUI 伪装成可用 CLI。
6. **Windows 一等公民**：路径、spawn、CRLF、taskkill、GBK/UTF-8 解码全部按现状语义保留。
7. **不可变写法**：构造新对象，不就地改入参；函数 < 50 行、文件聚焦、嵌套 < 4 层、无 `console.log`、无硬编码密钥。
8. **改动前必读**对应现有实现 + 至少一个参考项目的对应做法，在报告中写明对照结论。

## 执行顺序：严格 P0 → P1 → P2，每条独立成切片

---

### P0（必须先全部完成）

**1. 中文 mojibake 体检（先验证，再决定是否修）**
- 现状核查：`README.md`、`package.json`、`memory-library.ts`、`schedules.ts` 经审计**当前是干净 UTF-8**；`ecc-commands.ts` 的 `hasMojibake()`、`process-decoder.ts` 的 GBK→UTF8 检测、`stdio-adapter.ts:214` 的 `�` 守卫都是**有意的检测器**，不要误删。
- 任务：跑一遍全仓扫描确认无新增乱码；为「禁止乱码字符（`�` 替换符、典型 GBK-as-UTF8 序列）进入核心文案与记忆规则」加一条静态回归测试（断言 `memory-library.ts` 噪声词表、调度模板文案不含替换符）。
- 若发现真实乱码再恢复为 UTF-8；无则只补测试，并在报告写明「体检通过，无需修复」。

**2. 修复 MCP 测试误报（`src/main/runtime/mcp.ts`，最高优先）**
- 现状缺陷（`probeStdioServer`）：① 约 `mcp.ts:169` 行存在**非法/损坏代码**——`let appVersion=...; try{...}catch{}; clientInfo:{...}` 被塞进对象字面量内部，且用 `process.cwd()/package.json`（打包后路径错误）。② stderr 命中 `/mcp|json-rpc|server|listening|ready/i` 即判成功（假阳性）。③ 仅正则匹配 stdout 含 `"jsonrpc":"2.0"`+`"id":1`，从不解析响应、不区分 `result` vs `error`。④ HTTP 探测只发 `HEAD` 收 2xx-3xx，从不做 MCP initialize 握手。
- 修复要求：stdio MCP **仅当解析到合法 JSON-RPC `initialize` 的 `result`（非 `error`）才算成功**；stderr 只作诊断，不作成功条件；`clientInfo.version` 用 Electron 安全方式从应用 `package.json` 读取（不硬编码、不用 cwd）。
- 借鉴 codex 的 initialize 契约（`.refs/codex` 的 JSON-RPC handshake 字段）确认 result 形状；借鉴 CCGUI `mcp_config.rs` 的「解析失败带路径与原因记日志、不让单个坏配置整体失败」。
- MCP 页面显示：来源、命令、cwd、args/env 数量、最近错误（参考 CCGUI `McpSection.tsx` 按 engine 分组 + `settings-inline-error` 行内错误）。
- 加测试：合法 result 通过、`error` result 失败、纯 stderr 不算成功、缺 result 失败。

**3. 修复长期记忆污染与中文召回（`src/main/memory-library.ts`）**
- 现状缺陷：① `isMemoryWorthText`(509-521) 噪声词表已含 `test/继续/随便/测试/收到` 等，但是**白名单门控**（517-520）——无偏好/纠正/决策关键词的有价值自由事实会被丢弃，需放宽为「噪声黑名单优先 + 价值信号加权」而非硬白名单。② `tokenizeMemoryQuery`(543-548) 用 `/[一-鿿]{2,}/g` 取**整段 CJK 连续串**，靠 `includes(term)` 全子串匹配——「项目发布流程」无法召回只含「发布」的条目（中文零召回 bug）。
- 修复要求：参考 Kun `memory-store.ts:189-208 ngrams()`（CJK 跑 bigram、ASCII 跑 trigram、按 gram 覆盖率×置信度打分）与 `write-retrieval-service.ts:162`（NFKC 归一 + `\p{Script=Han}+` 提 Han 跑 + 滑动 2-4 gram），把 CJK 检索改为 n-gram 召回。
- 记忆候选需含：精华化摘要、来源、置信度、scope、category，可禁用/删除（参考 Kun `FileMemoryStore` 的 Zod 校验 + 软删除 `deletedAt/disabledAt` + `atomicWriteFile`）。
- 每轮任务结束只提取高价值偏好/纠正/项目事实/格式要求（保持现有「不从 runtime 快照自动建记忆」的克制）。
- 加测试：噪声词被拒、中文 n-gram 部分重叠可召回、白名单放宽后自由事实可保留、软删除可恢复。

**4. 审批系统增强（`src/main/agentic/approval.ts` + `dispatcher.ts`）**
- 现状缺陷：① 策略配置已持久化（`agentic.approval.v1`），但**待审批请求是内存 `Map`（dispatcher.ts:126），重启/刷新即丢**，2 分钟超时自动拒。② `ApprovalRequest`(34-43) 只有 `stepId/agentId/tool/toolName/label/detail`——**无结构化 action/target/risk/reason/preview**，全靠 `detail` 自由文本塞。
- 修复要求：审批请求结构化为「动作类型 + 目标（文件/命令/工具）+ 风险等级 + 原因 + 预览内容」。直接借鉴 codex 数据形状：`approvals.rs` 的 `ExecApprovalRequestEvent`（command/cwd/reason/parsed_cmd/available_decisions）、`ApplyPatchApprovalRequestEvent`（changes 即 diff 预览/grant_root）、`GuardianRiskLevel`(low|medium|high|critical) + `GuardianAssessmentEvent`(risk_level/rationale/status)。
- 高风险不静默阻断，弹卡片让用户选继续/停止；服务端可指定可选按钮，否则按字段派生（codex `default_available_decisions` 模式）。
- 待审批请求持久化，刷新/重启后可恢复或明确标注「已失效」。
- UI 参考 Codex 底部卡片风格，减少用户输入。
- 加测试：请求含全部结构化字段、风险分级正确、持久化后可恢复、超时/取消落到 Denied。

**5. Usage 统计持久化（`src/main/runtime/usage-stats.ts`）**
- 现状缺陷：`buildUsageRecords()`(249-294) **每次调用都重放 `runtime.eventsSince(thread.id,0)` 临时重建**全部历史；只持久化定价规则（`usage.pricing.v1`）。**runtime events 被裁剪/轮转后，对应 usage 历史永久丢失**。token 估算 `CHARS_PER_TOKEN=4`(line 21) 严重低估中文。
- 修复要求：新增**请求级 append-only usage ledger**：provider/model/agent/thread/turn/input/output/cache/cost/status/latency/source；runtime events 裁剪后历史不丢。借鉴 Kun `hybrid-thread-store.ts` 的「JSONL 追加（`open('a')`+`handle.sync()` 保证落盘）+ 索引可重建 + 每次 SQLite 操作失败回退 JSONL」的可恢复持久化思路（AgentHub 用 JSONL/electron-store 即可，无需引入 SQLite）。
- 真实 usage 优先（参考 codex `TurnCompletedEvent.Usage`：input/cached_input/output/reasoning_output tokens）；无 usage 的本地 CLI/ACP 才估算并标注「约/含估算」。
- 加测试：event 裁剪后 ledger 历史仍在、真实优先于估算、估算项有标注、缓存命中/成本计算正确。

---

### P1（架构收敛）

**6. 拆分 `src/main/index.ts`（现 ~1862 行 / ~166 个 `ipcMain.handle`）**
- 现状：除 IPC 接线外，还混入五角色执行器 `runCustomScheduleTurn`(544-694)、guard 评估 `evaluateGuardVerdict/emitGuardVerdict`(355-401)、step 提示构造 `promptForScheduleStep`(729-783)、provider-direct 决策(1137-1148)、事件 fan-out(808-819)——典型 god-file。
- 拆为：runtime-ipc、schedule-runner、guard-approval-service、memory-service、provider-direct-service、open-target-service；**保持现有 IPC 通道名/形状完全兼容**。
- 借鉴 Kun `src/main/{ipc,services,runtime,terminal}/` 分层：`index.ts` 只编排（`registerAppIpcHandlers`/`registerRuntimeSseIpc` 等），每个 concern 自带 `*.test.ts`；并借鉴其 `parseIpcPayload(channel, schema, payload)` 用 Zod 校验每个 IPC 入参（低成本硬化进程边界）。
- 每模块补基础测试。

**7. 强化五角色调度（现 `index.ts:runCustomScheduleTurn`）**
- 语义：router → main → reviewer → executor → gatekeeper。现状已对的部分**保留**：router 先跑且不喂 main 输出、非 final step `visibility:"run"` 不进聊天。
- 待修：① `GuardVerdict` 现从自由文本首行 `PASS/WARN/REVISE/BLOCK` 正则解析，脆弱——改为结构化契约（工具调用或 JSON schema 输出 `{level,status,reasons[]}`），借鉴 codex `GuardianAssessmentEvent` 的结构化 verdict。② 中间内容泄漏仅靠 gatekeeper 听话 + 首行 strip，body 内若回显 router JSON 无防护——加正式的「最终结果只取 gatekeeper/main 释放段、剥离全部中间 JSON/verdict」过滤。
- executor 只执行 `approvedActions`。运行面板展示每个 agent 的过程、状态、风险、总结。
- 加测试：verdict 结构化解析、中间 JSON 不入 final、executor 只跑已批准动作。

**8. Provider direct 与本地 Agent 严格隔离**
- 现状已较好：`isProviderDirectSelection`(index.ts:243) 分流，`Dispatcher.dispatch` 收到 `source==="provider"` 直接抛错（硬隔离），stdio usage 用 binding 自身 provider/model 标记。**provider 失败无 CLI fallback**（失败即 `failed`，正确）。
- 任务：审计并加测试锁定——选 API 厂商模型必走 provider HTTP/API direct，不进本地 CLI、不进 lead-workers/orchestrate fallback；失败显示 provider 错误不回退 Codex/Claude；选本地 Agent 则清空 provider modelSelection。借鉴 cc-switch `commands/proxy.rs:288` 的「类别硬隔离 + 本地化错误」表达方式。
- 加测试：provider 选择不触发任何 stdio spawn、provider 失败不 fallback、切到本地 Agent 清空 modelSelection。

**9. 本地 CLI 改为能力检测（`agent-detector.ts` / `agent-locator.ts`）**
- 现状缺陷：`agent-detector.ts:probe`(40-62) 只有 found/not-found 两态，无法区分能用 CLI 与「响应 --version 的 GUI」。`agent-locator.ts` 有 `source:'desktop'|'terminal'` 与 `verification:'version'|'manual'`，但 `minimaxCodeCandidates`(241-251) 把 GUI `opencode.exe` 当一等 `'desktop'` 候选且无 `manual` 标记；`scanClaudeCodeApp`/codex desktop 同样把 GUI 内置 exe 当一等候选；仅 Marvis(259-266) 正确排除。无 `'needs-login'`/`'acp'` 态。
- 修复要求：能力检测区分 path detected / desktop candidate / stdio headless / ACP / needs login / needs prompt args；Composer **只显示真实可用 Agent**；GUI-only 候选必须带 `manual` 或排除，不伪装成非交互 CLI。
- 加测试：GUI 二进制不被标为可用 stdio CLI、各能力态正确分类、Composer 过滤逻辑。

---

### P2（体验优化）

**10. Skills 页面改多来源 inventory**
- 借鉴 CCGUI `skills.rs`：扫描 `.claude/.codex/.agents/.gemini/custom/plugin` 多来源（含 `~/.claude/plugins/cache/<owner>/<plugin>/skills`），按优先级去重合并，**拒绝符号链接目录**（防逃逸），1MB 文件上限、30 行 frontmatter 上限、单目录 IO 错误吞掉不整体失败。
- 显示来源、路径、描述、启用状态；**只列出不强制导入**（参考 `SkillsSection.tsx`）。
- 加测试：多来源扫描、优先级去重、符号链接被拒、坏目录不致全失败。

**11. MCP 页面改 inventory**
- 借鉴 CCGUI `mcp_config.rs`：支持 workspace/global/user 来源 + fallback 链（`~/.claude.json` → 应用配置），每条带 `source` 标来源，object 形与 array 形 `mcpServers` 都解析，`disabledMcpServers` 算 enabled。
- 测试失败显示清晰原因（接 P0-2 的结构化错误）。
- 加测试：多来源解析、provenance 标记、坏配置降级。

**12. UI 与流畅度**
- 深浅色 token 审计：禁止硬编码浅色破坏暗色主题。借鉴 CCGUI 语义 token（`--surface-*/--text-*/--border-*/--status-*`）+ `.reduced-transparency` 不透明回退，并**加一条「CSS 当文本读、断言选择器作用域」的 Vitest 守卫测试**（参考 `layout-swapped-platform-guard.test.ts`）防止暗色回归。
- ThreadView/RunTimeline 运行中用增量 buffer、完成后再 Markdown 渲染：借鉴 CCGUI `LiveMarkdown.tsx` 两级渲染（流式期轻量 block parser 渐进揭示，完成后 react-markdown 富渲染）+ `eventBackpressure.ts`（rAF 合并、上限 200 事件/128KB、coalesceKey 折叠状态事件）。
- 长历史虚拟化或分页：借鉴 CCGUI `MessagesTimeline.tsx` 条件虚拟化（虚拟列表 + 重测冷却 + 「显示更早消息」）。
- Composer 去除多余上下文图标，保持简洁。
- 借鉴 CCGUI `events.ts` 引用计数单监听 hub（多组件共享一个 IPC 监听，最后一个退订才拆）修订渲染层潜在监听泄漏。

**13. 打开文件/编辑器**
- 借鉴 Kun `workspace-editors.ts`：声明式 `EDITOR_CANDIDATES`（VS Code/Cursor/Windsurf/Zed/系统默认/文件管理器，含 `winAppPaths` 用 `LOCALAPPDATA`/`PROGRAMFILES`），`buildEditorArgs()` 按编辑器格式化跳行参数，解析失败回退 `shell.openPath`/`shell.showItemInFolder`；检测/启动留在 main，renderer 只传 target（`open-workspace-path.ts`）。
- 借鉴 CCGUI 文件链接打开：右键菜单平台感知（Reveal in Finder/Show in Explorer）、去 `:line:col`/`#L123` 后缀、Copy Link 产 `file://`、打开失败非致命 toast。
- 支持默认打开目标 VS Code/Cursor/Windsurf/Antigravity/系统默认/文件管理器；代码路径右键支持打开文件、打开所在位置、复制路径。

---

## 多 Agent 分工 + 多层核验（每个切片必走）

- **planner**：读目标文件现状，列最小改动点、受影响契约、回滚方式、细粒度步骤。
- **tdd-guide**：先写失败测试（覆盖正常路径 + 边界：Windows 路径、二进制/大 diff、空状态、未知输入、CJK 查询），红→绿→重构。
- **worker**：实现，遵守硬约束。
- **多层核验（并行分角色，互相独立，不附和）**：
  1. 事实审查员：是否真满足条目描述、有无偷换需求、对照参考项目断言是否属实。
  2. code-reviewer：可读性、契约、回归面、跨进程边界。
  3. security-reviewer：路径逃逸、命令注入、密钥、IPC 暴露面、proxy 入站解析、符号链接逃逸、原子写。
  4. 一致性审查员：与 `docs/AGENTIC.md`、`DESIGN*.md`、`VERSION.md` 是否自洽。
  5. 冗余/死代码检查员：未用导出、重复实现、应复用却新写。
- 所有阻塞与高优先级问题收尾前必须修复；中优先级尽量修；低优先级记入 backlog。

## 测试要求

- 每个 P0 修复必须有单元或静态回归测试。
- 最后运行（逐条贴 exit code 与关键输出）：

```
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
git diff --check
```

- `eslint` 如用须 `eslint src`（仓库已知 `eslint .` 会扫到不属本仓库的 `.cc-switch-src/`、`output/playwright/`，不得为它们改任何东西）；`vitest` 沿用既有 `--exclude` 写法排除 `.cc-switch-src` 与 `output`。
- 测试失败：判定是否本切片引入；本切片引入须修到绿；既有/环境问题写明命令、报错摘要、是否阻塞，**不得改切片范围外文件凑绿**。
- 不提交截图（`agenthub-screen*.png`）、dist/out 临时文件、log、无关缓存、用户本地配置、`*.bak`。

## 输出要求（最终报告）

1. **实际改动文件与模块**（逐条）。
2. **已修复问题与对应测试**（一一对应，引用修复的 file:line）。
3. **参照对照结论**：每个切片借鉴了哪个参考项目的哪个文件/做法、是否落地。
4. **多层核验结论**：5 个角色各自阻塞/高/中/低问题与处理结果。
5. **验证门结果**：四条命令逐一贴 exit code 与关键输出。
6. **未完成但建议后续处理的事项**（记入 backlog，不擅自动手）。
7. **协作声明**：确认未 `git add -A`、未触碰他人未提交改动（含 `mcp.ts` 既有未提交改动归属）、未越界改文件。

措辞约束：不夸大；不说「完全参考/搬运某项目」；只说明「在 AgentHub 基础上完成稳定化与体验优化」。

## 一句话总纲

> 小步、可回滚、默认等价、真实修复、对照参考项目的成熟做法、多角色独立核验、四门全绿、只动自己声明的文件——以「绝不破坏并行协作者与现有契约」为最高优先级，按 P0→P1→P2 推进稳定化。
