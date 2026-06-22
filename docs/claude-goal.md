你是 AgentHub 项目的高级全栈 / Electron / React / TypeScript / 本地 Agent 架构工程师。请在 E:\Agent\AgentHub 中基于当前代码新增功能与产品能力，不要重写项目，不要引入假功能，不要提交无关文件。

当前项目：
- AgentHub：E:\Agent\AgentHub

参考源码：
- CCGUI：E:\Agent\desktop-cc-gui
- Kun：E:\Agent\Kun
- cc-switch：E:\Agent\.refs\cc-switch
- openai/codex：E:\Agent\.refs\codex

重要要求：
1. 参考源码只用于理解交互、数据模型、错误处理和架构分层。
2. 不要直接复制参考项目源码。
3. 不要在 README、Release Notes、UI、commit message 中写“参考 Kun / CCGUI / cc-switch / Codex”。
4. 最终实现必须是 AgentHub 自己的模块、命名、样式、数据结构。
5. 新增功能必须真实可用，不能只做 UI 假壳。
6. 所有外部依赖能力，例如 MCP、provider、GitHub、browser、CLI，都必须有失败态、空态、加载态。
7. 新增持久化数据必须有 version、normalize、migration。
8. 新增 IPC 必须补 preload 暴露、类型定义、main 层测试。
9. 最后必须运行：
   - npm.cmd run typecheck
   - npm.cmd run test
   - npm.cmd run build
   - git diff --check

本轮目标：
只新增功能与产品能力。不要把主要精力放在已有 bug 修复上，除非它直接阻塞新功能接入。目标是把 AgentHub 从普通多 Agent 聊天工具，扩展为“本地 Agent 工作流、模型、记忆、MCP、Skill、任务、发布、项目知识”一体化桌面工作台。

一、参考内容阅读要求

在开始实现前，先只读分析以下参考区域，并输出简短设计摘录，不要改代码。

1. 参考 CCGUI 的内容：
重点学习：
- Git 工作台如何组织变更、分支、提交、diff、历史。
- MCP 页面如何做本地配置扫描、测试、错误展示、工具列表。
- Skill 页面如何展示技能卡片、多来源目录、安装/启用状态。
- 设置页如何组织 provider、terminal、theme、proxy、auth、backup。
- 会话 UI 如何展示运行过程、消息、错误、空状态。

建议重点阅读路径：
- E:\Agent\desktop-cc-gui 中 Git 相关模块
- E:\Agent\desktop-cc-gui 中 MCP / Skill / Settings / Provider / Session 相关模块

AgentHub 需要吸收的能力：
- 多来源 inventory，而不是单一导入列表。
- 每个外部能力都展示来源、路径、状态、最近错误。
- 卡片 + 列表结合的管理界面。
- 高风险操作必须明确提示和确认。
- 工具配置失败不能伪装为可用。

不要照搬：
- 不要照搬 CCGUI 的具体 UI 样式、文件结构、命名。
- 不要把 CCGUI 的 Tauri/Rust 实现直接迁移到 AgentHub。
- AgentHub 仍然使用 Electron main / preload / renderer 架构。

2. 参考 Kun 的内容：
重点学习：
- 长期记忆如何组织 category、scope、source、confidence、retrieval。
- 上下文容量如何估算、裁剪、展示。
- approval gate / user input gate 如何建模。
- tool provider / MCP provider / skill provider 如何作为统一工具层。
- delegation / child agent 如何管理输入输出和执行状态。
- 文件打开、工具调用、shell/file 操作如何做权限边界。
- append-only session log、thread store、runtime event reducer 的结构。

建议重点阅读路径：
- E:\Agent\Kun\kun\src\memory
- E:\Agent\Kun\kun\src\loop
- E:\Agent\Kun\kun\src\contracts
- E:\Agent\Kun\kun\src\adapters\tool
- E:\Agent\Kun\kun\src\delegation
- E:\Agent\Kun\kun\src\domain
- E:\Agent\Kun\kun\src\cache

AgentHub 需要吸收的能力：
- 记忆不是简单存聊天，而是“精华化、可追踪、可禁用、可检索”的知识资产。
- 上下文不是黑盒，要展示组成、token 占比、裁剪建议。
- 工具/Skill/MCP 可以统一成 capability layer。
- 子 Agent / delegation 要有明确输入、输出、状态、失败原因。
- 长任务要可恢复、可取消、可总结。

不要照搬：
- 不要整体迁移 Kun 的状态管理。
- 不要引入完整 RAG 或向量数据库作为第一版。
- 不要复制 Kun 的 UI 或命名。
- AgentHub 第一版以轻量关键词、标签、时间衰减、scope 评分为主。

3. 参考 cc-switch 的内容：
重点学习：
- Provider 配置、模型配置、模型列表获取、provider health。
- token usage / cost / cache 统计方式。
- MCP / Skill / prompt 的统一管理面板。
- provider failover、代理、速度测试、健康状态。
- Codex/Gemini/Claude 本地配置读取方式。
- Hermes memory panel 的交互方式。

建议重点阅读路径：
- E:\Agent\.refs\cc-switch\src\components\providers
- E:\Agent\.refs\cc-switch\src\components\mcp
- E:\Agent\.refs\cc-switch\src\components\skills
- E:\Agent\.refs\cc-switch\src\components\hermes
- E:\Agent\.refs\cc-switch\src\components\settings
- E:\Agent\.refs\cc-switch\src-tauri 中 provider / config / usage 相关模块

AgentHub 需要吸收的能力：
- Provider 不只是 API Key 表单，还应有模型、健康、速度、成本、失败原因。
- Usage 不只是 token 总数，还应有请求明细、真实/估算、输入/输出/cache、成本。
- MCP 和 Skill 是资产库，而不是隐藏配置。
- 配置读取失败时保留已有数据并显示失败原因。
- 用户应能看到“当前模型从哪里来、是否可用、上次成功是什么”。

不要照搬：
- 不要迁移 Tauri/Rust 后端。
- 不要写用户本地 CLI 配置。
- 不要为了显示模型而伪造模型列表。
- 不要让 provider 失败后静默 fallback 到其他 Agent。

4. 参考 openai/codex 的内容：
重点学习：
- 审批卡片如何让用户快速确认工具/文件/命令操作。
- 代码路径如何点击打开、右键打开所在位置、复制路径。
- 长任务执行过程如何展示，最终如何总结。
- 沙箱、终端、文件写入、浏览器操作的风险边界。
- 对话输入区如何保持简洁，减少用户输入成本。
- tool call 与 assistant final answer 如何区分，避免中间 JSON 混入回答。

建议重点阅读路径：
- E:\Agent\.refs\codex 中与 approval、tool call、open file、exec、conversation UI、sandbox 相关模块

AgentHub 需要吸收的能力：
- 审批应该清楚说明“要做什么、为什么、风险是什么、预览是什么”。
- 用户操作应通过按钮/卡片完成，而不是要求用户输入长文本。
- 文件路径应该是可点击/可右键的工作对象。
- 工具调用过程和最终回答必须分离。
- 长任务完成后应该生成清晰总结。

不要照搬：
- 不要把 Codex 的内部协议整体搬入 AgentHub。
- 不要改变 AgentHub 当前 provider direct / local Agent 架构。
- 不要让审批成为阻碍普通聊天的噪声。

二、AgentHub 新增功能总目标

请新增以下产品能力，并按阶段实现。每个功能都必须：
- 接入真实数据源。
- 有 main/preload/renderer 类型闭环。
- 有空态、加载态、错误态。
- 有测试。
- 有持久化 normalize/migration，如果涉及本地存储。
- 有清晰 UI，不要堆叠按钮。
- 不提交无关文件。

三、第一阶段：核心资产管理功能

1. Models 页面 / 模型中心

新增 Models 页面，统一管理 API provider 和模型。

功能要求：
- 聚合所有已配置 provider。
- 展示 provider 名称、启用状态、baseUrl、模型数量、最近刷新时间、最近错误。
- 展示模型列表：
  - model id
  - display name
  - context window
  - input price
  - output price
  - cache read price
  - cache write price
  - capabilities：vision / tools / json / reasoning / long-context
  - hidden / favorite / tags
- 支持刷新 provider 模型。
- 刷新失败时保留旧模型并显示错误原因。
- 支持模型收藏、隐藏、排序、标签。
- 支持按任务类型设置默认模型：
  - chat
  - code
  - review
  - summary
  - long-context
  - cheap
  - fast
- Composer 选择 API 厂商模型时必须走 provider direct，不调用本地 CLI。

参考要求：
- 学习 cc-switch provider/model form、model fetch、失败保留策略、health 状态。
- 学习 CCGUI 设置页分组方式。
- 不要伪造模型列表。

验收：
- 未配置 provider 时显示空态。
- provider 拉取失败显示失败原因。
- DeepSeek/OpenAI/Anthropic/Gemini 等 provider 模型可显示。
- 选择 provider 模型后发送请求走 provider direct。

2. Budget 页面 / 成本预算中心

新增 Budget 页面，用于管理 token、成本、预算策略。

功能要求：
- 用户可设置：
  - 每日预算
  - 每月预算
  - 单次请求最大费用
  - 单次请求最大 token
  - 超预算策略：仅提醒 / 阻止 / 建议便宜模型
- Composer 发送前显示预计：
  - 输入 token
  - 上下文占用
  - 当前模型价格
  - 预计费用
- Usage 页面新增：
  - provider 成本排行
  - model 成本排行
  - Agent 成本排行
  - workflow 成本明细
  - 请求明细表
- 支持本地模型定价表编辑。
- 未定价模型显示“未定价”，不要伪造成本。

参考要求：
- 学习 cc-switch usage / cost / cache 统计。
- 学习 Kun contracts/usage 的结构化数据。
- 保留 AgentHub 现有 usage:stats 兼容。

验收：
- 真实 usage 优先。
- 无 usage 的本地 CLI 只估算并标注“约”。
- cache token 单独展示。
- runtime event 裁剪后历史 usage 不丢失。

3. Memory Studio / 长期记忆中心

新增 Memory Studio 页面。

功能要求：
- 记忆分类：
  - preference
  - style
  - project
  - decision
  - correction
  - command
  - forbidden
  - imported_conversation
- 记忆字段：
  - id
  - category
  - scope
  - summary
  - details
  - source
  - confidence
  - createdAt
  - updatedAt
  - lastUsedAt
  - disabled
  - pinned
  - tags
- 支持编辑、禁用、删除、合并、置顶。
- 支持从聊天、导入记录、README、项目配置中提取候选记忆。
- 支持“不要记住这次对话”。
- Composer 发送前可查看本轮注入了哪些记忆。
- 记忆必须精华化，不记录测试语、继续、随便、临时输出、调度日志。

参考要求：
- 学习 Kun memory-store 的 category/scope/retrieval 思路。
- 学习 cc-switch HermesMemoryPanel 的管理方式。
- 第一版不要引入向量数据库，使用关键词、CJK n-gram、标签、时间衰减、置信度评分。

验收：
- 中文记忆召回可用。
- 低价值文本不会成为长期记忆。
- 每条记忆都可追踪来源。
- 禁用记忆不会注入上下文。

4. MCP Inventory / MCP 工具资产库

新增 MCP Inventory 页面。

功能要求：
- 扫描多个来源：
  - workspace
  - user
  - global
  - Claude
  - Codex
  - Gemini
  - AgentHub 自定义
- 展示：
  - server name
  - source
  - transport
  - command/url
  - cwd
  - args count
  - env count
  - enabled
  - last status
  - last error
  - tools/resources/prompts 数量
- 支持测试 MCP。
- stdio MCP 只有收到合法 initialize result 才算成功。
- stderr 只作为诊断。
- 支持查看工具列表。
- 支持按 workspace 启用/禁用。
- 支持复制命令、打开配置位置。

参考要求：
- 学习 CCGUI/cc-switch MCP inventory、测试和错误展示方式。
- 不要把 stderr/listening/ready 当成功。
- 不要把无法测试的 MCP 显示为可用。

验收：
- 成功/失败/超时/命令不存在都有明确状态。
- 用户能知道 MCP 从哪里扫描到。
- MCP 可绑定到 workflow 步骤。

5. Skill Inventory / Skill 资产库

新增 Skill Inventory 页面。

功能要求：
- 扫描：
  - .claude skills
  - .codex skills
  - .agents skills
  - .gemini skills
  - 项目内 skills
  - 用户自定义 skill 目录
  - 插件 skill
- 展示：
  - name
  - description
  - source
  - path
  - tags
  - enabled
  - installedFor agents
- 支持搜索、筛选、启用、禁用、打开路径。
- 支持绑定到 Agent、Team、Workflow、Slash Command。
- 不要求全部导入才能使用。

参考要求：
- 学习 CCGUI/cc-switch SkillCard、UnifiedSkillsPanel、RepoManager 的信息结构。
- 保持 AgentHub 自己的视觉语言，不复制样式。

验收：
- 多来源 skill 可展示。
- 不存在路径时显示错误。
- 禁用 skill 不注入 Agent 上下文。

四、第二阶段：工作流与多 Agent 能力

6. Workflow Center / 工作流中心

新增 Workflows 页面。

工作流步骤类型：
- Agent chat
- Provider direct
- MCP tool
- Shell command
- Git operation
- Browser action
- File read/write
- Approval
- Condition
- Delay
- Summary

每个步骤支持：
- name
- type
- input mapping
- output mapping
- dependency
- timeout
- retry
- continueOnError
- approvalRequired
- riskLevel
- condition

内置模板：
- 代码审查
- 自动修复
- Git 提交
- PR 准备
- Release 发布
- 文档生成
- UI 检查
- 研究总结
- 多 Agent 辩论
- 测试验证

运行要求：
- 运行过程进入 RunTimeline。
- 可暂停、继续、取消、重试单步。
- 每个步骤显示输入摘要、输出摘要、耗时、状态、错误。
- 高风险步骤进入审批卡片。
- workflow 结果可保存为 Task。

参考要求：
- 学习 Kun delegation 和 runtime event 结构。
- 学习 Codex tool call 与 final answer 分离方式。
- 学习 CCGUI 任务/会话 UI 的过程展示。

验收：
- 工作流可保存、复制、导入、导出。
- 失败步骤可重试。
- 审批步骤可等待用户选择。
- 不把中间 JSON 混入聊天正文。

7. Team Builder / 多 Agent 团队

新增 Team Builder 页面。

功能要求：
- 用户可创建 Agent Team。
- 每个 Team 包含角色：
  - main
  - router
  - reviewer
  - executor
  - gatekeeper
  - summarizer
  - optional experts
- 每个角色可绑定：
  - 本地 CLI Agent
  - ACP Agent
  - API provider model
- 支持模板：
  - 编程团队
  - 写作团队
  - 研究团队
  - UI 设计团队
  - 测试团队
  - Git 发布团队
  - 安全审查团队
- Composer 可选择单 Agent 或 Team。
- Team 运行时展示每个 Agent 的过程和最终总结。

五角色语义要求：
- router 只看最近用户消息和当前输入，不看 main 输出。
- main 负责主要回答。
- reviewer 检查危险、错误、越权、代码质量。
- executor 只执行 approvedActions。
- gatekeeper 检查最终输出格式和用户规则。
- summarizer 生成执行总结。
- 普通聊天只展示 gatekeeper/main 放行后的最终回答。

参考要求：
- 学习 Kun delegation/child-agent-executor。
- 学习 Codex 审批与工具执行边界。
- 保持 AgentHub 调度系统兼容。

验收：
- Team 配置可持久化。
- 每个角色可选择 Agent/model。
- 中间过程在 RunTimeline 可查看。
- 最终输出不混入 reviewer/router JSON。

8. Agent Capability Profile / Agent 能力画像

新增 Agent 能力画像系统。

字段：
- capabilities：
  - code
  - write
  - review
  - shell
  - browser
  - git
  - memory
  - long-context
  - vision
  - fast
  - cheap
  - reasoning
- metrics：
  - successRate
  - averageLatency
  - userSelectedCount
  - recentFailureReason
  - lastUsedAt
  - averageCost
- user notes
- enabled / disabled

功能：
- 手动编辑能力标签。
- 自动根据历史运行结果更新表现指标。
- Team Builder 和 Workflow 推荐 Agent 时使用能力画像。
- Composer Agent picker 可按能力过滤。

参考要求：
- 学习 Kun capability contracts。
- 学习 cc-switch provider health / speed / status 思路。

验收：
- 能力画像持久化。
- 可按任务类型推荐 Agent。
- 失败率高的 Agent 不默认推荐。

9. Prompt Library / Prompt 指令库

新增 Prompt Library 页面。

功能要求：
- 保存常用 prompt。
- 支持变量：
  - {{input}}
  - {{file}}
  - {{selection}}
  - {{workspace}}
  - {{agent}}
  - {{date}}
  - {{memory}}
  - {{gitDiff}}
- Prompt 可绑定：
  - slash command
  - workflow step
  - Agent Team
  - Composer 快捷按钮
- 支持分类、标签、搜索、导入、导出。
- 支持预览变量替换结果。

参考要求：
- 学习 cc-switch prompts panel。
- 与 AgentHub slash commands 集成。

验收：
- 输入 / 能看到自定义 prompt command。
- Prompt 变量替换可测试。
- Prompt 可导入导出。

10. Slash Command Builder / Slash 命令编辑器

新增自定义 slash command 编辑器。

命令类型：
- prompt
- workflow
- team
- MCP tool
- Git action
- shell command
- browser action

字段：
- command
- title
- description
- category
- icon
- args schema
- action type
- target
- enabled

要求：
- Composer 输入 / 时展示用户自定义命令。
- 命令可启用/禁用。
- 高风险命令需要审批。
- 与 Workflow、Prompt Library、MCP Inventory 打通。

验收：
- 用户可创建 /release、/review、/fix、/write 等自定义命令。
- 命令执行结果进入 runtime timeline。
- 错误显示清晰。

五、第三阶段：项目、发布、浏览器、编辑器

11. Task Center / 任务中心

新增 Task Center 页面。

功能要求：
- 每个长任务可保存为 Task。
- Task 字段：
  - title
  - goal
  - status
  - steps
  - linked thread
  - linked workspace
  - linked files
  - linked workflow
  - logs
  - verification results
  - createdAt / updatedAt
- 支持暂停、继续、取消、归档、复制、导出。
- 支持从聊天消息一键创建任务。
- 支持任务完成总结。

参考要求：
- 学习 CCGUI 会话/任务展示。
- 学习 Kun append-only session log 和 runtime event reducer。

验收：
- 长任务可恢复。
- Task 与 RunTimeline 关联。
- 任务导出不包含 secret。

12. Project Knowledge / 项目知识库

新增 Project Knowledge 页面。

功能要求：
- 每个 workspace 维护：
  - 项目简介
  - 技术栈
  - 常用命令
  - 目录说明
  - 编码规范
  - 测试命令
  - 发布流程
  - 重要文件
  - 禁止事项
- 支持从 README、package.json、Git 历史、用户对话生成初稿。
- 用户可编辑。
- Composer 可选择是否注入项目知识。
- 与 Memory Studio 区分：Project Knowledge 属于 workspace，Memory 属于用户长期偏好。

参考要求：
- 学习 Kun workspace/contracts/context 组织方式。
- 不要把所有项目知识塞入每次请求，要按任务相关性选择。

验收：
- 不同 workspace 有不同知识库。
- 上下文预览可看到注入内容。
- 可关闭注入。

13. Release Workspace / 发布工作台

新增 Release Workspace 页面。

功能要求：
- 支持版本号管理：
  - patch
  - minor
  - major
  - custom
- 支持：
  - 生成 changelog
  - 整理 commit 摘要
  - 生成 release notes
  - 创建 tag
  - 打包 Windows 安装包
  - 上传 GitHub Release
  - 生成发布检查清单
- Release Notes 中文模板：
  - 新增功能
  - 优化改进
  - 修复问题
  - 已知问题
  - 下载说明
- 所有 GitHub 上传、tag、push 操作需要审批。

参考要求：
- 学习 CCGUI Git 工作台组织方式。
- 学习 Codex 审批模式。
- 不提交打包产物，除非用户明确要求 release。

验收：
- 可生成 release draft。
- 可预览将要执行的 Git/GitHub 操作。
- 高风险操作弹审批。

14. GitHub 集成

新增 GitHub 页面。

功能要求：
- 配置 GitHub token。
- 支持：
  - 查看 issues
  - 查看 pull requests
  - 创建 issue
  - 创建 PR
  - 生成 PR 描述
  - 生成 review comments
  - 根据 issue 创建本地任务
  - 上传 GitHub Release assets
- 所有写操作必须审批。
- token 必须安全存储或提示用户环境变量方式。

参考要求：
- 使用 AgentHub 现有 GitHub 能力或新增轻量 API client。
- 不把 token 写入日志、诊断包、导出文件。

验收：
- 无 token 时显示配置引导。
- API 失败显示 status/message。
- 创建 PR 前可预览 title/body/files。

15. Browser Workspace / 浏览器工作台

新增 Browser Workspace。

功能要求：
- 支持打开 URL。
- 支持截图。
- 支持提取页面文本。
- 支持自动填写表单。
- 支持点击操作。
- 支持记录操作步骤。
- 支持将页面内容作为上下文发送给 Agent。
- 高风险操作，例如提交表单、上传文件、下载、支付相关按钮，必须审批。

参考要求：
- 学习 Codex computer/browser 操作边界。
- 不默认执行高风险网页动作。

验收：
- 用户可看到浏览器操作轨迹。
- 高风险动作需要审批。
- 页面提取失败显示原因。

16. Open Target / 文件与编辑器集成

新增 Open Target 设置。

支持打开目标：
- VS Code
- Cursor
- Windsurf
- Antigravity
- 系统默认
- 文件管理器

使用位置：
- 聊天消息中的文件路径
- diff 文件名
- Git 面板文件路径
- 错误堆栈路径
- 运行日志路径
- Markdown code reference

右键菜单：
- 打开文件
- 打开所在位置
- 复制绝对路径
- 复制相对路径
- 用默认编辑器打开

参考要求：
- 学习 Codex/Kun 的代码路径打开交互。
- Windows 中文路径、空格路径必须处理。

验收：
- 路径点击可用。
- 右键菜单可用。
- 不存在文件时显示提示。

17. Writing Workspace / 写作工作台

新增 Writing Workspace。

功能要求：
- 左侧大文档编辑区。
- 右侧 AI 写作助手。
- 支持：
  - 大纲生成
  - 改写
  - 润色
  - 扩写
  - 缩写
  - 语气调整
  - 中英互译
  - 标题生成
  - 摘要生成
  - 格式检查
- 支持草稿池。
- 支持把写作偏好写入 Memory Studio。
- 支持选择写作 Team 或写作 Agent。

参考要求：
- 学习 Kun 写作和上下文组织方式。
- 不需要第一版引入完整富文本编辑器，可先用 textarea/markdown editor。

验收：
- 写作助手输出不覆盖原文，必须用户确认应用。
- 草稿可保存恢复。
- 写作偏好可进入候选记忆。

六、第四阶段：平台化能力

18. Plugin Manager / 插件管理

新增 Plugin Manager。

插件 manifest 可贡献：
- skills
- slash commands
- MCP servers
- workflow templates
- prompt templates
- provider presets
- themes

功能：
- 插件扫描。
- 启用/禁用。
- 查看贡献项。
- 打开插件路径。
- 插件错误诊断。
- 插件高风险动作必须审批。

参考要求：
- 学习 CCGUI/cc-switch skill repo/plugin 管理思路。
- 不允许插件静默执行命令。

验收：
- 插件 manifest 无效时显示错误。
- 禁用插件后贡献项消失。
- 不写用户配置外的文件。

19. Backup / 数据备份恢复

新增 Backup 页面。

支持导出：
- settings
- provider 配置，不含 secret
- skills
- MCP
- workflows
- teams
- prompts
- memories
- tasks
- usage ledger
- project knowledge

支持导入：
- 预览导入内容。
- 选择性导入。
- 冲突处理。
- secret 提示用户重新输入。

参考要求：
- 学习 cc-switch backup/import/export 交互。
- 导出包必须脱敏。

验收：
- 导出不包含 API key。
- 导入前可预览。
- 版本不兼容有提示。

20. Diagnostics / 诊断中心

新增 Diagnostics 页面。

显示：
- app version
- runtime status
- IPC 调用统计
- provider 请求统计
- Agent 运行统计
- MCP 测试结果
- 最近错误
- 性能指标
- store 大小
- 最近 crash/log 路径

支持：
- 导出诊断包。
- 复制错误。
- 清理旧日志。
- 重新检测本地 Agent。
- 重新测试 MCP。

要求：
- 诊断包必须脱敏。
- 不包含 API key、token、用户完整对话原文，除非用户明确选择。

21. Notifications / 通知中心

新增通知中心。

通知类型：
- 任务完成
- 审批等待
- 工作流失败
- provider 失败
- MCP 测试完成
- 打包完成
- GitHub Release 上传完成

支持：
- Windows toast。
- 应用内通知列表。
- 已读/未读。
- 设置页开关。
- 点击通知跳转相关页面。

参考要求：
- 与 Task/Workflow/Approval 系统打通。
- 不弹过多噪声通知。

22. Keyboard Shortcuts / 快捷键系统

新增快捷键设置页面。

默认快捷键：
- 打开命令面板
- 聚焦 Composer
- 新建会话
- 切换 Agent
- 打开 Settings
- 打开 Git
- 打开 Memory
- 打开 MCP
- 打开 Skills
- 停止当前任务
- 打开 Workflow
- 打开 Task Center

功能：
- 搜索。
- 修改。
- 冲突检测。
- 重置默认。
- 导入导出。

参考要求：
- 学习 Kun/Codex 快捷键交互。
- 快捷键不可破坏输入框正常输入。

23. Onboarding / 应用内引导

新增首次启动引导。

步骤：
- 选择工作目录
- 配置 provider
- 检测本地 Agent
- 选择默认 Agent
- 测试 MCP
- 启用 Skills
- 创建第一个 Workflow
- 发送第一条消息

要求：
- 用户可跳过。
- 设置页可重新打开。
- 每步有明确成功/失败/跳过状态。
- 不强迫用户配置所有内容。

七、统一架构要求

新增主进程模块建议：
- src/main/runtime/models.ts
- src/main/runtime/budget.ts
- src/main/runtime/workflows.ts
- src/main/runtime/teams.ts
- src/main/runtime/tasks.ts
- src/main/runtime/project-knowledge.ts
- src/main/runtime/open-target.ts
- src/main/runtime/backup.ts
- src/main/runtime/diagnostics.ts
- src/main/runtime/notifications.ts
- src/main/runtime/plugin-manager.ts
- src/main/runtime/keyboard-shortcuts.ts

新增 renderer 页面建议：
- src/renderer/screens/Models.tsx
- src/renderer/screens/Budget.tsx
- src/renderer/screens/MemoryStudio.tsx
- src/renderer/screens/McpInventory.tsx
- src/renderer/screens/SkillInventory.tsx
- src/renderer/screens/Workflows.tsx
- src/renderer/screens/TeamBuilder.tsx
- src/renderer/screens/TaskCenter.tsx
- src/renderer/screens/ProjectKnowledge.tsx
- src/renderer/screens/ReleaseWorkspace.tsx
- src/renderer/screens/GitHub.tsx
- src/renderer/screens/BrowserWorkspace.tsx
- src/renderer/screens/WritingWorkspace.tsx
- src/renderer/screens/PluginManager.tsx
- src/renderer/screens/Backup.tsx
- src/renderer/screens/Diagnostics.tsx
- src/renderer/screens/Notifications.tsx
- src/renderer/screens/KeyboardShortcuts.tsx
- src/renderer/screens/Onboarding.tsx

所有新增 store key 必须：
- versioned
- normalize on read
- migration safe
- tolerate missing/corrupt data
- tested

所有新增 IPC 必须：
- main handler
- preload bridge
- renderer type
- error normalization
- unit test

所有新增 UI 必须：
- loading state
- empty state
- error state
- disabled state
- dark/light theme compatible
- keyboard accessible where practical

八、实施顺序

第一批必须先完成：
1. Models 页面
2. Budget 页面
3. Memory Studio
4. MCP Inventory
5. Skill Inventory
6. Open Target 设置
7. Keyboard Shortcuts 页面

第二批：
8. Workflow Center
9. Team Builder
10. Agent Capability Profile
11. Prompt Library
12. Slash Command Builder
13. Task Center

第三批：
14. Project Knowledge
15. Release Workspace
16. GitHub 集成
17. Browser Workspace
18. Writing Workspace

第四批：
19. Plugin Manager
20. Backup
21. Diagnostics
22. Notifications
23. Onboarding

九、测试要求

每批完成后运行：
- npm.cmd run typecheck
- npm.cmd run test
- npm.cmd run build
- git diff --check

测试覆盖要求：
- 每个新增 store：normalize/migration test。
- 每个新增 IPC：main handler test。
- 每个新增页面：renderer/static test。
- 外部服务：必须 mock 成功、失败、超时、未配置。
- 高风险动作：必须测试审批触发。
- provider direct：必须测试不会调用本地 CLI。
- MCP：必须测试失败原因可见。
- Skill：必须测试多来源扫描和禁用不注入。
- Memory：必须测试低价值文本不入库。

十、最终输出格式

完成后输出：

1. 新增功能清单
   - 已完成
   - 基础版完成
   - 待后续完善

2. 实际改动文件和模块

3. 新增 IPC / store key / 类型

4. 新增测试

5. 验证命令结果：
   - npm.cmd run typecheck
   - npm.cmd run test
   - npm.cmd run build
   - git diff --check

6. 风险与后续建议

禁止事项：
- 不要重写项目。
- 不要复制参考项目源码。
- 不要使用假数据冒充真实能力。
- 不要隐藏失败状态。
- 不要提交 dist/out/node_modules/log/screenshot/cache。
- 不要泄露 API key/token。
- 不要让插件/MCP/Workflow 静默执行高风险动作。
- 不要让 provider API 失败后自动 fallback 到本地 CLI。
