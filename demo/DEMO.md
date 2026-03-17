# OntoForge 演示：制造业供应链管理（案例驱动）

> 基于 [CASES.md](../CASES.md) 六大千万级案例分析，在 OntoForge 中复现核心场景。
> 覆盖 Phase 0-6 全部能力。**真实业务复杂度**：7 种实体、335 个对象、600 条关联、7 种内嵌业务场景。

## 1. 案例驱动场景

| # | 案例 | 来源 | 年化收益 | OntoForge 对标能力 | Phase |
|---|------|------|---------|-------------------|-------|
| 1 | General Mills | AIPCon 2024 | **$14M/年** | AI 推荐 → 一键执行 (Action 闭环) | P1 |
| 2 | Fortune 100 消费品 | 行业案例 | **$100M/年** | SKU 级聚合分析 + Dashboard 洞察 | P1 |
| 3 | Airbus Skywise | Airbus 合作 | **+33% 效率** | 图谱探索定位零件问题 | P1+3.5 |
| 4 | 供应链控制塔 | Unit8 | **-50% 缺货** | 定时管道 + 告警预警 | P2 |
| 5 | 医院预警 | Tampa General | **-83% 安置** | 规则引擎 + 自动告警 + 通知 | P2 |
| 6 | ERP 集成 | Fortune 100 | — | 增量同步 + 数据血缘 | P2 |
| 7 | Workshop 低代码 | 六大案例共性 | — | 低代码 Builder + 监控大屏 | P3+3.5 |
| 8 | AIP 增强 | 对标 AIP Threads | — | SSE流式+文档RAG+Function测试 | P4 |
| 9 | Workshop 完善 | 对标 Workshop Events | — | 筛选联动+Agent嵌入+告警列表 | P5 |
| 10 | Security + Audit | 对标 Governance | — | RBAC三角色+操作审计+用户管理 | P6 |

## 2. 业务背景

**华锐汽车零部件集团** — 跨国供应链管理平台：

- **20 家供应商**（中国、德国、日本、韩国、美国、加拿大、法国、瑞典、爱尔兰）
- **30 种零件**（发动机、电子、制动、变速箱、底盘、电池、电驱、照明、内饰、安全等 10 大类）
- **8 座工厂**（上海、重庆、长春、广州、成都、武汉、泰国罗勇、德国慕尼黑）
- **6 个仓库**（上海嘉定、重庆保税、长春集散、广州南沙、Hamburg 欧洲中转、Laem Chabang 泰国）
- **150 笔采购订单**（2024-07 至 2026-02，跨 18 个月，8 种状态）
- **50 条质量检测记录**（合格/轻微缺陷/不合格/待复检 4 种结果）
- **71 条物流记录**（8 家承运商：中远海运、马士基、DHL、顺丰、德邦、京东、FedEx、DB Schenker）
- **600+ 条关联实例**（供应商↔零件↔采购订单↔工厂↔仓库↔质检↔物流 全链路）
- **6 种操作类型**（审批/驳回订单、确认到货、标记质量问题、确认物流到达、标记物流延迟）

### 内嵌业务场景（数据中已 Mock）

| # | 场景 | 数据特征 | 期望 AI/告警 发现 |
|---|------|---------|-------------------|
| ① | **供应商风险** | SUP-015 泰源精密，评级 C，质检不合格率高 | Agent 建议降低份额，告警触发 |
| ② | **交货延迟** | 20 笔订单状态为"延迟"，集中在 C 级供应商 | 图谱追溯延迟根因 |
| ③ | **成本飙升** | PRT-10009 涡轮增压器 2025-06 后涨价 20% | 聚合分析发现价格趋势 |
| ④ | **工厂瓶颈** | PLT-GZ 广州工厂状态"维护中" | Dashboard 识别产能瓶颈 |
| ⑤ | **时间序列** | 订单跨 18 个月，有季节性波动 | 月度/季度趋势图表 |
| ⑥ | **跨国供应链** | 6 国供应商 + 3 国工厂 + 多币种 | 图谱可视化跨国网络 |
| ⑦ | **物流异常** | 部分物流状态"异常"，C 级供应商延迟严重 | 物流追踪看板 + 告警 |

## 3. 本体模型

### 3.1 对象类型 (7 种)

| 对象类型 | 编码 | 属性数 | 说明 |
|---------|------|--------|------|
| 供应商 | `supplier` | 6 | 编码、国家、城市、邮箱、评级(A/B/C)、成立年份 |
| 零件 | `part` | 7 | 编号、分类(10大类)、单价、单位、交货周期、最小订购量、供应商编码 |
| 工厂 | `plant` | 6 | 编码、城市、国家、日产能、产品线、状态(运行中/维护中) |
| 仓库 | `warehouse` | 5 | 编码、城市、国家、容量(㎡)、状态 |
| 采购订单 | `purchase_order` | 11 | 订单号、零件/供应商/工厂编码、数量、单价、总金额、日期、状态、币种 |
| 质量检测 | `quality_inspection` | 9 | 检测编号、订单号、零件编号、检测员、日期、抽样数、缺陷数、结果、备注 |
| 物流记录 | `delivery` | 8 | 物流编号、订单号、承运商、发货日期、ETA、实际到达、状态、运单号 |

### 3.2 关联类型 (8 种)

```
供应商 ──供应零件──▸ 零件 (one_to_many)
零件   ──被采购──▸   采购订单 (one_to_many)
采购订单 ──交付工厂──▸ 工厂 (many_to_many)
采购订单 ──质量检测──▸ 质量检测 (one_to_many)
采购订单 ──物流追踪──▸ 物流记录 (one_to_many)
工厂   ──工厂仓库──▸ 仓库 (one_to_many)
供应商 ──供货入仓──▸ 仓库 (many_to_many)
仓库   ──存储零件──▸ 零件 (many_to_many)
```

### 3.3 操作类型 (6 种)

| 操作 | 编码 | 目标类型 | 效果 |
|------|------|---------|------|
| 审批采购订单 | `approve_po` | 采购订单 | 状态 → 已审批 |
| 驳回采购订单 | `reject_po` | 采购订单 | 状态 → 已驳回 |
| 确认到货 | `mark_delivered` | 采购订单 | 状态 → 已到货 |
| 标记质量问题 | `flag_quality_issue` | 质量检测 | 结果 → 不合格 |
| 确认物流到达 | `mark_delivery_arrived` | 物流记录 | 状态 → 已到达 |
| 标记物流延迟 | `flag_delivery_delay` | 物流记录 | 状态 → 异常 |

## 4. 一键部署

```bash
cd demo
python3 generate_data.py  # (可选) 重新生成数据
bash setup_demo.sh         # 自动创建本体 → 导入数据 → 构建图谱 → 创建应用 → 全量验证
```

部署约需 3 分钟（主要耗时在创建 600 条关联实例）。

## 5. 演示场景

### 场景 1: General Mills — AI 推荐 → 一键执行 ($14M/年)

**UI 操作路径**:
1. 对象浏览器 → 筛选 "采购订单" → 可看到 150 笔订单，22 笔"已下单"
2. 点击一笔"已下单"订单 → 详情弹窗 → **操作 Tab**
3. 可看到 "审批采购订单"、"驳回采购订单"、"确认到货"
4. 点击 **执行** → 状态实时变为"已审批"
5. 切换 **关联对象 Tab** → 可看到关联的零件、供应商、工厂、仓库、物流

**AI Agent 操作**:
1. AI 工作室 → 选择 "供应链分析师" Agent
2. 输入: *"请将所有已下单的采购订单审批通过"*
3. Agent 自动调用: `search_objects(status=已下单)` → `list_actions` → `execute_action` (多轮)
4. 输入: *"SUP-015 泰源精密的供应风险如何？"*
5. Agent 调用: `search_objects(supplier_code=SUP-015)` + `aggregate_objects` + `document_search(供应商风险)`
6. 返回风险分析 + 知识库中的 Q4 风险报告内容

### 场景 2: Fortune 100 — SKU 级聚合分析 ($100M/年)

**Dashboard**:
- 动画 StatCard: 供应商(20) / 订单总额(¥7000万+) / 质检(50批) / 物流(71条)
- PieChart: 8 种订单状态分布 (已验收 28% / 已下单 15% / 生产中 14% / 延迟 13% ...)
- Donut: 质检结果分布 (合格 64% / 轻微缺陷 30% / 不合格 6%)
- 活动 Timeline + hover 浮起 + staggered 入场动画

**AI 聚合查询**:
- *"按供应商统计采购金额 TOP5"* → SUP-011 宁德时代 ¥2100万 (电池包高单价)
- *"PRT-10009 涡轮增压器的采购价格趋势"* → 2025-06 前 ¥3,500 → 之后 ¥4,200 (涨幅20%)
- *"哪些供应商的质检不合格率最高？"* → SUP-015 泰源精密

### 场景 3: Airbus — 图谱探索 (+33% 效率)

**UI 操作路径**:
1. 对象浏览器 → 筛选 "质量检测" → 找到 "不合格" 记录 (3 条)
2. 详情 → **图谱 Tab**: 以质检记录为中心的交互式图谱
3. **depth=1**: 质检 → 采购订单
4. **depth=2**: 质检 → 采购订单 → 零件 / 工厂 / 物流
5. **depth=3**: 质检 → 订单 → 零件 → **供应商** (完整追溯)
6. **图内搜索**: 输入 "泰源" → SUP-015 节点高亮
7. **右键节点** → 查看详情 / 聚焦 / 展开邻居
8. 完整追溯链: `质检(不合格) → 采购订单(延迟) → PRT-10025(铸铝副车架) → SUP-015(泰源精密/C级)`

### 场景 4: 供应链控制塔 — 告警 + 定时调度

**告警系统**:
- 3 条预配规则: 质检缺陷≥3(critical) / 缺陷≥1(warning) / 金额≥500万(info)
- 管道导入数据后自动触发告警 → 顶栏铃铛显示未读数
- 点击铃铛 → Drawer 展示告警列表 → 点击跳转到对象详情

**定时调度**:
- 管道列表 → 点击"调度" → 配置 cron(`0 */6 * * *`) 或 interval(60分钟)
- 定时自动重新导入数据 + 触发告警检查

### 场景 5: 增量同步 + 数据血缘

**增量同步**: 管道设置 sync_mode=incremental + primary_key → UPSERT 去重
**数据血缘**: 对象详情 → 血缘 Tab → 完整溯源链: 数据源(CSV) → 管道(导入采购订单) → 运行记录 → 源行号

### 场景 6: Workshop 低代码应用

**2 个预配应用**:

**应用1: 供应链监控大屏** (13 个 Widget)
1. 侧栏 → 应用工坊 → "供应链监控大屏" → 预览
2. Widget 矩阵:
   - 4 × StatCard: 供应商数 / 订单总额 / 质检批次 / 物流记录 — **countUp 动画**
   - 2 × Chart: 订单状态饼图 + 供应商采购金额柱图 — **bar/line/pie 切换 + drill-down**
   - 2 × Table: 质检记录 (条件格式: 缺陷≥3标红) + 物流追踪
   - 1 × ActionButton: 审批采购订单 — 确认弹窗 + loading
   - 1 × Filter: 供应商筛选 → 联动其他 Widget
   - 1 × ObjectList: 供应商卡片列表 (评级高亮)
   - 1 × AlertList: 质量告警 (严重程度颜色)
   - 1 × AgentChat: 嵌入 AI 供应链助手对话
3. **筛选联动**: 选择 SUP-001 → StatCard/Chart/Table 自动筛选该供应商数据
4. **自动刷新**: 30s 倒计时 + 手动刷新
5. **全屏模式**: 纯大屏展示

**应用2: 物流追踪看板** (4 个 Widget)
1. StatCard: 物流总数
2. PieChart: 物流状态分布 (已到达/运输中/已发出/清关中/异常)
3. BarChart: 承运商订单量
4. Table: 物流记录明细

**Builder 交互**:
- 拖拽添加 (HTML5 DnD) + Grid 画布 + 属性配置
- Undo (Ctrl+Z) + 未保存提示 + Widget 复制

### 场景 7: AIP 增强 — 流式对话 + 文档知识库

**3 份预配文档**:
1. 供应链管理手册 V2.0 — 采购/质量/物流/风控全流程
2. 设备维修指南 — 工厂设备故障排除
3. 供应商风险评估报告 2025-Q4 — SUP-015 风险分析

**SSE 流式对话**:
- 逐字显示 + 工具调用实时动画 + 闪烁光标

**文档 RAG**:
- 输入: *"SUP-015 泰源精密的风险情况和改善建议？"*
- Agent 调用 `document_search` → 返回 Q4 风险报告内容
- 结合本体数据 (`aggregate_objects`) 生成综合分析

### 场景 8: Security + Audit

**三种角色**:

| 角色 | 账户 | 密码 | 权限 |
|------|------|------|------|
| admin | admin | admin123 | 全部权限 + 用户管理 + 审计日志 |
| editor | editor | editor123 | 读写权限 (CRUD), 无用户管理 |
| viewer | viewer | viewer123 | 只读 + AI 对话 + Workshop 查看 |

**验证**: viewer 登录 → 创建按钮消失 + API 返回 403

**操作审计**: 设置 → 操作审计 Tab → 筛选操作/资源/用户

## 6. 能力对标

| 企业级数据平台能力 | OntoForge 实现 | 案例对标 | Phase |
|----------------------|----------------|---------|-------|
| Ontology | 7 类型, 52 属性, 8 关联, 335 对象, 600 关联 | 所有 | ✅ MVP |
| Data Integration | CSV/PG/REST + 字段映射 + Transform | 所有 | ✅ MVP |
| **Action Types** | 6 种操作, 参数化执行, dry_run | General Mills | ✅ P1 |
| **Object Graph** | 径向层次 + 搜索 + 面包屑 + 右键 + 自定义节点 | Airbus | ✅ P1+3.5 |
| **Aggregation** | 6 种指标 + group_by + 时间粒度 | Fortune 100 | ✅ P1 |
| **AIP Agent** | 5 类 10 工具 + 多轮调用 + 可视化 | General Mills | ✅ P1+4 |
| **Dashboard** | Recharts PieChart/Donut + 动画StatCard + Timeline | Fortune 100 | ✅ P3.5 |
| **Scheduled Pipelines** | APScheduler cron/interval | 控制塔 | ✅ P2 |
| **Incremental Sync** | UPSERT + rows_created/updated/skipped | ERP 集成 | ✅ P2 |
| **Alerts** | 规则引擎 + 管道触发 + 铃铛 + 规则管理 | 医院预警 | ✅ P2 |
| **Data Lineage** | 数据源→管道→运行→对象 | ERP 集成 | ✅ P2 |
| **Workshop** | Builder + 8 种 Widget + 数据绑定 + 事件联动 | 六大案例 | ✅ P3-5 |
| **Workshop COP** | countUp + drill-down + 自动刷新 + 全屏 | 六大案例 | ✅ P3.5 |
| **SSE Streaming** | StreamingResponse + ReadableStream 逐字显示 | 所有 | ✅ P4 |
| **RAG** | Document 分块 + 关键词检索 + Agent document_search | Airbus/银行 | ✅ P4 |
| **AIPFunction** | 输入变量 → 预览 Prompt → 执行 → 结果 | 所有 | ✅ P4 |
| **Workshop Events** | Filter 变量联动 + 跨 Widget 通信 | 所有 | ✅ P5 |
| **Advanced Widgets** | Filter/ObjectList/AgentChat/AlertList (8种) | 所有 | ✅ P5 |
| **RBAC** | admin/editor/viewer 三角色 + UI 控制 | 医院/银行 | ✅ P6 |
| **Audit Log** | 全操作审计 + 管理员查看/筛选 | 银行合规 | ✅ P6 |

## 7. V2.0 新增演示场景

### 7.1 AI Ontology Builder (Phase 7a)

**演示**: 在本体管理页面点击 "AI 生成" → 输入自然语言描述 → 预览 AI 生成的类型/关联/操作 → 确认导入。

```text
示例输入: "我是一家汽车零部件企业，管理供应商、零件、工厂、采购订单、质检和物流"
预期输出: 自动生成 7 种对象类型 + 属性 + 8 种关联 + 6 种操作 + AIP 函数建议
```

### 7.2 Action 外部写回 (Phase 7b)

**演示**: 编辑 Action → 配置外部回调 (Webhook URL + Body 模板) → 执行 Action → 查看审计日志中的回调结果。

```text
场景: "审批采购订单" Action
  → 修改 Ontology 对象 status = "已审批"
  → 异步 POST https://erp.example.com/api/orders/PO-001/approve
  → 审计日志记录: HTTP 200, 响应内容, 耗时
```

### 7.3 Ontology Functions (Phase 7c)

**演示**: 创建 Function → Python 表达式 → Workshop 引用为派生列 → Agent 调用计算。

```text
场景: total_amount = quantity * unit_price
  → Workshop TableWidget 自动显示 "总金额" 列
  → Agent: "计算 PO-001 的总金额" → 调用 Function → 返回结果
```

## 8. 文件结构

```
demo/
├── DEMO.md                   # 本文档 (案例驱动演示指南)
├── generate_data.py          # 数据生成器 (335 对象, 7 种业务场景)
├── setup_demo.sh             # 一键部署 + Phase 0-6 全量验证
├── suppliers.csv             # 供应商数据 (20 行 / 6 国)
├── parts.csv                 # 零件数据 (30 行 / 10 大类)
├── plants.csv                # 工厂数据 (8 行 / 3 国)
├── warehouses.csv            # 仓库数据 (6 行 / 3 国)
├── purchase_orders.csv       # 采购订单数据 (150 行 / 18 月)
├── quality_inspections.csv   # 质量检测数据 (50 行 / 4 种结果)
└── deliveries.csv            # 物流记录数据 (71 行 / 8 家承运商)
```
