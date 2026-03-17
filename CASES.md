# OntoForge 能力与案例参考

> 基于行业客户案例、Forrester TEI 报告和 AIPCon 公开资料的深度调研。
> 聚焦"传统数据平台做不到、企业级数据平台能带来千万级效果"的场景。

---

## 一、为什么传统数据平台做不到？

### 传统平台 (Snowflake / Databricks / PowerBI) 的根本限制

| 维度 | 传统数据平台 | 企业级数据平台 |
|------|------------|------------------|
| **数据模型** | 表和列 (schema-on-read/write) | **本体 (Ontology)** — 业务实体 + 关系 + 操作的语义层 |
| **操作方向** | 只读分析 (Read-only BI) | **读写双向** — 分析结果直接驱动操作 (Action → 回写) |
| **决策闭环** | 分析 → 报告 → 人工操作 → 等待 | 分析 → AI 推荐 → 一键执行 → 反馈学习 |
| **跨系统集成** | ETL 后静态快照 | **实时数字孪生** — 多 ERP/MES/WMS 统一本体 |
| **AI 集成** | 独立的 ML pipeline | **AI 深度嵌入操作流程** — Agent 可直接修改数据 |
| **用户群体** | 数据分析师 / IT | **全员** — 工厂经理、采购员、一线技师均可操作 |
| **应用开发** | 需专业前端开发 | **低代码 Workshop** — 拖拽式构建操作面板 |

**核心差异一句话**: 传统平台回答 "发生了什么"，企业级数据平台回答 "应该做什么并帮你做"。

---

## 二、六大标杆案例深度解析

### 案例 1: General Mills — AI 驱动供应链自动决策

> **年化收益: $14M+ (每天 $40,000 节省)**
> **来源**: AIPCon March 2024 Impact Study

#### 痛点

General Mills 运营北美最复杂的食品供应链之一:
- 4,000 家供应商、200+ 工厂、~120 万年客户订单
- 运营人员每年做出约 **5,000 万个手动决策**
- 供应链中断 (天气、原材料短缺、运输延误) 导致的损失巨大

**传统平台的局限**: BI 仪表盘能看到问题但无法自动行动。一个简单的 "供应商延迟" 告警到 "调整替代路线" 需要 3-5 天人工协调。

#### 行业解决方案: Project ELF

1. **本体建模**: 供应商、工厂、仓库、运输路线、订单建模为本体对象
2. **实时约束集成**: 持续消化产能、成本、网络约束等实时信号
3. **AI Agent 推荐**: AIP Agent 自动识别中断，计算最优补救方案
4. **人机协作**: 70%+ 的 AI 推荐被运营人员直接接受执行
5. **反馈闭环**: 接受/拒绝记录反哺模型

#### OntoForge 对标能力

| 所需能力 | 状态 | 实现 |
|---------|------|------|
| Ontology 建模 | ✅ Phase 0 | Object Types + Link Types + Properties |
| **Action 执行闭环** | ✅ Phase 1 | approve_po / reject_po / mark_delivered / flag_quality_issue |
| **AI Agent 触发 Action** | ✅ Phase 1 | action_execute 工具 + 多轮 tool calling |
| **Agent 聚合分析** | ✅ Phase 1 | aggregate_objects (6 种指标 + group_by) |
| **定时管道 (实时信号更新)** | ✅ Phase 2 | APScheduler cron/interval |
| **告警通知** | ✅ Phase 2 | 规则引擎 + 管道触发 + 铃铛通知 |
| Workshop 操作面板 | ✅ Phase 3+5 | Builder (拖拽+预览+Undo) + 8种Widget + 事件联动 + drill-down |
| Workshop 大屏交互 | ✅ Phase 3.5 | countUp动画 + 自动刷新 + 全屏模式 |
| **文档知识库 (RAG)** | ✅ Phase 4 | document_search + SSE 流式对话 |

---

### 案例 2: Fortune 100 消费品公司 — 7 大 ERP 整合 + SKU 级盈利优化

> **年化收益: 估算 $100M (基于 1-2% 生产优化)**
> **来源**: 行业 Use Case

#### 痛点

- 数据分散在 **7 个独立 ERP 系统**
- 计算单个 SKU 的真实成本和利润率需要 **数周** 跨部门手工汇总
- 无法快速回答: "更换配方 A 为配方 B，整体成本影响是多少？"

**传统平台的局限**: ETL 整合 7 个 ERP 需 6-12 个月。即使完成也只是静态报表。

#### 行业解决方案

1. **5 天**内将 7 个 ERP 数据整合为统一本体
2. 供应链经理在**无代码界面**中直接与业务对象交互
3. SKU 级粒度的 COGS 盈利模型
4. BOM 优化工作流 + 配方模拟

#### OntoForge 对标能力

| 所需能力 | 状态 | 实现 |
|---------|------|------|
| 多数据源集成 | ✅ Phase 0 | CSV/PostgreSQL/REST |
| **聚合分析引擎** | ✅ Phase 1 | count/sum/avg/min/max + group_by + time_granularity |
| **Dashboard 数据洞察** | ✅ Phase 3.5 | Recharts PieChart/Donut + 动画StatCard + Timeline |
| **增量同步** | ✅ Phase 2 | UPSERT 模式, rows_created/updated/skipped |
| **数据血缘** | ✅ Phase 2 | 数据源→管道→运行→对象 溯源链 |
| Workshop what-if 分析 | ⬜ 未来 | 配方模拟面板 (超出 V1.0 范围) |

---

### 案例 3: Tampa General Hospital — AI 驱动的医疗运营协调

> **核心成果: 患者安置时间缩短 83%, 脓毒症住院时间缩短 30%**
> **来源**: Tampa General Hospital Press Release 2024

#### 痛点

- 大型医院每天 **数千个运营决策**: 床位分配、护理调度、手术排程
- 各系统 (HIS、LIS、PACS、EHR) 数据孤岛
- 脓毒症等紧急情况的早期识别严重依赖人工判断

#### 行业解决方案

1. **全院本体**: 患者、床位、医护、设备、药品 + 动态关系
2. **AI 预测**: 入院需求预测、最优床位匹配
3. **实时调度**: AIP Agent 自动生成最优分配方案
4. **应急响应**: Hurricane Ian 期间实时追踪

#### OntoForge 对标能力

| 所需能力 | 状态 | 实现 |
|---------|------|------|
| Ontology 跨系统建模 | ✅ Phase 0 | Object + Link Types |
| **Action + 自动化工作流** | ✅ Phase 1 | Action 执行引擎 |
| **告警预警** | ✅ Phase 2 | 阈值规则 + 自动触发 + 通知 |
| **定时数据更新** | ✅ Phase 2 | APScheduler + 增量同步 |
| Workshop 调度大屏 | ✅ Phase 3+3.5+5 | Builder拖拽 + 8种Widget + 事件联动 + drill-down + 全屏 |
| RBAC (医生/护士权限) | ✅ Phase 6 | admin/editor/viewer 三角色 |
| **操作审计** | ✅ Phase 6 | 全操作审计日志 + 管理员查看/筛选 |

---

### 案例 4: Airbus Skywise — 航空制造数字孪生

> **核心成果: A350 生产效率提升 33%, 12,300+ 架飞机接入, 48,000+ 用户**
> **来源**: Airbus Skywise 案例

#### 痛点

- A350 有 **500 万个零件**，4 个国家 400+ 团队协作
- 每架飞机 PB 级传感器数据
- 工程师花 60% 时间找数据而非分析

#### 行业解决方案

1. 500 万零件 + 传感器数据统一到 Skywise 本体
2. 预测性维护 + 数字孪生
3. 多语言 AI + 生态开放

#### OntoForge 对标能力

| 所需能力 | 状态 | 实现 |
|---------|------|------|
| 本体 + 图谱可视化 | ✅ Phase 0 | React Flow + 力导向布局 |
| **交互式图谱探索** | ✅ Phase 1+3.5 | 径向布局 + 搜索 + 面包屑 + 右键菜单 + 自定义节点 |
| **聚合分析 + 图表** | ✅ Phase 3.5 | Recharts PieChart/Donut + 动画 |
| **数据血缘** | ✅ Phase 2 | 完整溯源链 |
| RAG + 文档集成 | ✅ Phase 4 | 文档分块 + 关键词检索 + Agent document_search |

---

### 案例 5: 全球零售商 — 供应链控制塔 (缺货率降低 50%)

> **核心成果: 缺货率降低约 50%, 大幅减少周转损失**
> **来源**: Unit8 Case Study

#### 痛点

- 数千个门店、数万 SKU, 库存决策分散
- 缺货导致的销售损失远超库存持有成本

#### 行业解决方案

1. 供应链控制塔: 门店/仓库/供应商/运输 本体对象
2. 实时可见性 + AI 补货推荐
3. 告警 + Action: 缺货风险自动触发紧急补货

#### OntoForge 对标能力

| 所需能力 | 状态 | 实现 |
|---------|------|------|
| Ontology 建模 | ✅ Phase 0 | 门店/仓库/供应商/SKU/订单 |
| **Pipeline 数据导入** | ✅ Phase 0 | CSV/PG/REST 连接器 |
| **定时管道** | ✅ Phase 2 | cron/interval 调度 |
| **告警 + Action** | ✅ Phase 1+2 | 规则引擎 + Action 闭环 |
| **AI Agent 分析** | ✅ Phase 1+4 | 聚合 + 查询 + 写入 + 文档检索 |
| Workshop 控制塔面板 | ✅ Phase 3+3.5+5 | Builder拖拽 + 8种Widget + 筛选联动 + drill-down + 自动刷新 + 全屏 |

---

### 案例 6: 瑞士大型银行 — 早期预警与反欺诈

> **核心成果: 风险识别时间从数天缩短至分钟**
> **来源**: Unit8 Early Warning Indicators

#### 痛点

- 海量交易，欺诈检测主要靠静态规则
- 新型欺诈模式出现后规则更新需数周
- 合规团队需跨系统手动拼接客户画像

#### 行业解决方案

1. 客户 360° 本体 + 图谱关联分析
2. AI 早期预警 (LLM + 结构化交易模式)
3. 动态规则引擎 + 调查工作台

#### OntoForge 对标能力

| 所需能力 | 状态 | 实现 |
|---------|------|------|
| 本体 + 图谱 | ✅ Phase 0+1+3.5 | 交互式图谱 + 搜索 + 面包屑 + 右键菜单 |
| **告警规则引擎** | ✅ Phase 2 | 条件评估 + 自动创建告警 |
| **Agent 查询/分析** | ✅ Phase 1+4 | 5 类 10 个工具 + 多轮调用 |
| RAG (文档分析) | ✅ Phase 4 | 文档分块 + 关键词检索 + Agent document_search |
| Workshop (调查工作台) | ✅ Phase 3+3.5+5 | Builder拖拽 + 8种Widget + 筛选联动 + Agent嵌入 + drill-down |
| 审计日志 (合规) | ✅ Phase 6 | 全操作审计 + 管理员筛选查看 |

---

## 三、案例背后的共性模式

### 模式 A: "数字孪生 + 操作闭环" — ✅ 已实现

```
传统:    数据 → 分析 → 报告 → 人阅读 → 人操作 → 等待
OntoForge: 数据 → 本体 → AI分析 → 推荐Action → 一键执行 → 状态更新
```

Phase 1 实现了完整的读写闭环: Action Type 定义 → 参数化执行 → AI Agent 触发 → 状态变更。

### 模式 B: "异构系统语义统一" — ✅ 已实现

- CSV/PostgreSQL/REST 三种连接器 → Pipeline 字段映射 → 统一本体
- 增量同步 UPSERT (Phase 2) 避免重复数据
- 数据血缘 (Phase 2) 追溯每个对象的来源

### 模式 C: "AI 不止于问答，而是执行" — ✅ 已实现

Agent 工具矩阵:

| 工具类别 | 工具 | 能力 |
|---------|------|------|
| ontology_query | get_object_types, search_objects, count_objects, get_neighbors | 查询 + 图谱遍历 |
| action_execute | list_actions, execute_action | 列出并执行操作 |
| analytics | aggregate_objects | 聚合分析 |
| instance_write | create_object, update_object | 直接写入 |
| document_search | document_search | 文档知识库检索 (RAG) |

支持最多 5 轮自动工具调用, 对话历史自动清洗。

### 模式 D: "全员低代码操作" — ✅ Phase 3+3.5+5 已实现

Workshop 低代码应用构建器 + 前端交互全面优化 + 高级 Widget + 事件联动:
- **Builder**: 拖拽添加 (HTML5 DnD) + 实时预览 + Undo (Ctrl+Z) + 未保存提示 + Widget复制 + Grid点阵背景
- **大屏**: countUp 数字动画 + Chart drill-down Drawer + bar/line/pie 切换 + 自动刷新倒计时 + 全屏模式 + per-widget Skeleton + staggered 入场动画
- **数据表格**: 条件格式 (阈值变色) + 排序 + 行点击跳转
- **图谱**: 自定义节点 (色带+属性) + 图内搜索 + 面包屑导航 + 右键菜单
- ✅ **FilterWidget**: 筛选器下拉 → 写入变量 → 联动其他 Widget 自动刷新 (Phase 5)
- ✅ **ObjectListWidget**: 卡片式对象列表 + 属性高亮 Tag + 点击跳转详情 (Phase 5)
- ✅ **AgentChatWidget**: 在 Workshop 内嵌入 Agent SSE 流式对话 (Phase 5)
- ✅ **AlertListWidget**: 告警列表 + 严重程度颜色 + 未读计数 Badge (Phase 5)
- ✅ **事件系统**: `{{variable}}` 模板替换 + `useWorkshopEvents` hook + 跨 Widget 变量通信 (Phase 5)

### 模式 E: "AI 驱动的文档理解" — ✅ Phase 4 已实现

AI 驱动的文档上下文能力:
- ✅ Agent 可检索上传的文档内容回答问题 (RAG — 关键词分块检索 + document_search 工具)
- ✅ 流式对话提升用户体验 (SSE — StreamingResponse + ReadableStream 逐字显示)
- ✅ AIPFunction 测试面板 (输入变量 → 预览 Prompt → 执行 → 结果)

---

## 四、OntoForge 当前对标总结

| 维度 | 企业级平台 | OntoForge 现状 | 状态 |
|------|-----------------|---------------|------|
| 本体建模 | Object / Link / Interface | Object / Link / Properties | ✅ |
| 操作闭环 | Action Types + Functions | Action 执行引擎 (create/edit/delete) + AI 触发 | ✅ |
| 数据集成 | 100+ 连接器 + 实时同步 | 3 种连接器 + 定时调度 + 增量同步 | 🟡 |
| AI 平台 | Agent (4 tier) + RAG + Logic + Evals | Agent (5 类 10 工具 + 多轮) + RAG + SSE 流式 + NLQ + Functions | ✅ |
| 低代码应用 | Workshop + Slate + Carbon | Workshop Builder (拖拽+预览+Undo) + 8 种 Widget + 事件联动 | ✅ |
| 大屏可视化 | Workshop COP + 统一设计系统 | 动画StatCard + Recharts图表 + 自动刷新 + 全屏 | ✅ |
| Widget 联动 | Workshop Event System | FilterWidget → 变量替换 → 跨 Widget 通信 | ✅ |
| Agent 嵌入 | Workshop Agent Chat | AgentChatWidget (SSE 流式, 嵌入低代码应用) | ✅ |
| AIP 函数 | Functions (可复用 AI 模板) | 创建/编辑/测试 + 对象详情一键分析 + Agent 对话内调用 | ✅ |
| 图谱交互 | Object Explorer + Object Views | 径向布局 + 搜索 + 面包屑 + 右键 + 自定义节点 | ✅ |
| 分析工具 | Quiver + Contour | 聚合 API + Dashboard Recharts + Timeline | 🟡 |
| 安全治理 | 细粒度 RBAC + 审计 + 血缘 | RBAC 三角色 + 审计日志 + 数据血缘 | ✅ |

**Phase 1-6 已全部完成**。OntoForge V1.0 功能开发完毕。

### V2.0 新增能力 (Phase 7-10)

| 维度 | V1.0 | V2.0 目标 | Phase |
|------|------|----------|-------|
| 本体建模效率 | 手动逐一创建 | AI 自然语言 → 自动生成完整本体 | 7a |
| 操作闭环 | 只改本体内部 | Webhook/REST API 写回外部 ERP/CRM | 7b |
| 业务逻辑 | 无计算层 | Ontology Functions (Python 表达式沙箱) | 7c |
| 文档检索 | 关键词匹配 | pgvector 向量语义搜索 | 8a |
| 数据连接 | 3 种连接器 | 6+ 种 (MySQL/Excel/MongoDB) | 8b |
| 复用交付 | Demo 脚本 | JSON 导入导出 + 行业模板市场 | 8c |
| Agent 能力 | 无状态对话 | 读写 Workshop 变量 + 可视化编排 | 9a-b |
| AI 质量 | 无评估 | Evals 测试套件 | 9c |

---

## 五、OntoForge 差异化定位

### 针对中小企业和国产化需求

| 定位要素 | 说明 |
|---------|------|
| **高性价比** | 商用数据平台年费 $10M+，中小企业用不起 |
| **国产化适配** | 适配国产数据库 (达梦、OceanBase)、国产 LLM (通义千问、DeepSeek) |
| **私有部署** | 数据不出企业，满足合规要求 |
| **中文优先** | 全中文文档、中文 NL Query 优化、中英双语 UI |
| **快速交付** | 提供行业模板，1 天完成 Demo |
| **专业交互** | countUp 动画、drill-down、自动刷新、图谱搜索 — 媲美商业产品 |

### 首批目标场景

1. **制造业供应链** (已有完整 Demo: 7 实体 / 335 对象 / 600 关联 / 7 种业务场景) — 采购优化、质量管控、物流追踪、供应商风险
2. **医疗运营** — 床位管理、排班优化、设备调度
3. **金融风控** — 客户画像、交易监控、合规报告

每个场景提供: 本体模板 + 示例数据 + 预配置 Agent + AIP 函数模板

### AIP 函数集成架构

AIP 函数 (AI Prompt Templates) 是 OntoForge 的可复用 AI 能力单元，三大引用路径：

| 入口 | 使用方式 | 典型场景 |
|------|---------|---------|
| **对象浏览器 → AI 分析 Tab** | 选中对象后一键执行，自动将对象属性填入模板 | 供应商风险评估、订单异常检测、质检报告 |
| **AI Agent 对话** | Agent 在对话中调用 `list_aip_functions` 和 `run_aip_function` | "用供应商风险评估函数分析一下 SUP-015" |
| **AIP 工作室 → 测试面板** | 手动填入参数执行，用于模板调试 | 函数开发和测试 |

Demo 预置 3 个 AIP 函数: 供应商风险评估、订单异常检测、质检报告生成。

### Ontology Functions 集成架构

Ontology Functions (可计算业务逻辑) 是 OntoForge 的 Logic 层，三大引用路径：

| 入口 | 使用方式 | 典型场景 |
|------|---------|---------|
| **本体构建器 → 计算函数 Tab** | 创建/编辑/测试 Python 表达式函数 | 总金额计算、风险评分、到货天数 |
| **AI Agent 对话** | Agent 调用 `list_ontology_functions` 和 `run_ontology_function` | "计算 PO-001 的总金额" |
| **API 直调** | `POST /ontology/functions/{id}/execute` | 第三方系统集成 |

Demo 预置 3 个计算函数: 总金额计算、供应商风险评分、预计到货天数。

### Action 写回引擎

Action 执行成功后，可通过配置的 Side-Effects 回调外部业务系统：

| 配置项 | 说明 |
|--------|------|
| `url` | 外部 API 地址，支持 `{{var}}` 模板变量 |
| `method` | HTTP 方法 (POST/PUT/PATCH/DELETE) |
| `headers` | 请求头，支持模板变量 (如 Bearer Token) |
| `body` | 请求体 JSON，支持模板变量 |
| `retry_count` | 失败重试次数 |
| `timeout` | 超时时间 (秒) |
