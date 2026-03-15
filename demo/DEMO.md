# OntoForge 演示：制造业供应链管理（案例驱动）

> 基于 [CASES.md](../CASES.md) 六大千万级案例分析，在 OntoForge 中复现核心场景。
> 覆盖 Phase 1 + Phase 2 全部能力。

## 1. 案例驱动场景

| # | 案例 | 来源 | 年化收益 | OntoForge 对标能力 | Phase |
|---|------|------|---------|-------------------|-------|
| 1 | General Mills | AIPCon 2024 | **$14M/年** | AI 推荐 → 一键执行 (Action 闭环) | Phase 1 |
| 2 | Fortune 100 消费品 | Palantir 官方 | **$100M/年** | SKU 级聚合分析 + Dashboard 洞察 | Phase 1 |
| 3 | Airbus Skywise | Palantir-Airbus | **+33% 效率** | 图谱探索定位零件问题 | Phase 1 |
| 4 | 供应链控制塔 | Unit8 | **-50% 缺货** | 定时管道 + 告警预警 | Phase 2 |
| 5 | 医院预警 | Tampa General | **-83% 安置** | 规则引擎 + 自动告警 + 通知 | Phase 2 |
| 6 | ERP 集成 | Fortune 100 | — | 增量同步 + 数据血缘 | Phase 2 |

## 2. 业务背景

一家汽车零部件制造商需要管理跨国供应链：

- **8 家供应商**（中国、德国、日本），包括宝钢特钢、Bosch、Denso 等
- **12 种零件**（发动机、电子、制动、变速箱等品类）
- **4 座工厂**（上海、重庆、长春、广州）
- **30 笔采购订单**（从下单到验收全生命周期）
- **12 条质量检测记录**（合格、轻微缺陷、不合格）
- **85+ 条关联实例**（供应商↔零件↔采购订单↔工厂↔质检 全链路关联）
- **4 种操作类型**（审批/驳回订单、确认到货、标记质量问题）

## 3. 本体模型

### 3.1 对象类型

| 对象类型 | 编码 | 属性数 | 说明 |
|---------|------|--------|------|
| 供应商 | `supplier` | 6 | 编码、国家、城市、邮箱、评级、成立年份 |
| 零件 | `part` | 7 | 编号、分类、单价、单位、交货周期、最小订购量、供应商编码 |
| 工厂 | `plant` | 6 | 编码、城市、国家、日产能、产品线、状态 |
| 采购订单 | `purchase_order` | 11 | 订单号、零件编号、供应商编码、工厂编码、数量、单价、总金额、日期、状态等 |
| 质量检测 | `quality_inspection` | 9 | 检测编号、订单号、零件编号、检测员、日期、抽样数、缺陷数、结果、备注 |

### 3.2 关联类型

```
供应商 ──供应零件──▸ 零件 (one_to_many)
零件   ──被采购──▸   采购订单 (one_to_many)
采购订单 ──交付工厂──▸ 工厂 (many_to_many)
采购订单 ──质量检测──▸ 质量检测 (one_to_many)
```

### 3.3 操作类型 (Action Types)

| 操作 | 编码 | 目标类型 | 效果 |
|------|------|---------|------|
| 审批采购订单 | `approve_po` | 采购订单 | 状态 → 已审批 |
| 驳回采购订单 | `reject_po` | 采购订单 | 状态 → 已驳回 |
| 确认到货 | `mark_delivered` | 采购订单 | 状态 → 已到货 |
| 标记质量问题 | `flag_quality_issue` | 质量检测 | 结果 → 不合格 |

## 4. 一键部署

```bash
cd demo
bash setup_demo.sh    # 自动创建本体 → 上传CSV → 创建管道 → 导入数据 → 创建操作/关联/Agent → 全量验证
```

## 5. Phase 1 案例演示

### 案例 1: General Mills — AI 推荐 → 一键执行 ($14M/年)

**UI 操作路径**:
1. 对象浏览器 → 筛选 "采购订单" → 点击一笔 "已下单" 的订单
2. 详情弹窗 → **操作 Tab** → 可看到 "审批采购订单"、"驳回采购订单"、"确认到货"
3. 点击 **执行** → 状态实时从 "已下单" 变为 "已审批"
4. 切换到 **关联对象 Tab** → 可看到关联的零件、供应商、工厂

**AI Agent 操作**:
1. AI 工作室 → 选择 "供应链分析师" Agent
2. 输入: "请将所有已下单的采购订单审批通过"
3. Agent 调用: `list_actions` → `search_objects` → `execute_action` (多轮)
4. **工具调用过程在聊天中实时显示**（工具名 + 参数 + 结果）

**API 验证**:
```
POST /api/v1/ontology/action-types/{approve_id}/execute
Body: {"params": {"target_id": "{po_uuid}"}}
→ {"success": true, "message": "Object updated", "changes": {"status": {"old": "已下单", "new": "已审批"}}}
```

### 案例 2: Fortune 100 — SKU 级聚合分析 ($100M/年)

**Dashboard**:
- 8 张统计卡片: 对象类型 / 关联类型 / 实例数 / 数据源 / 管道 / Agent / 未读告警 / 调度任务
- 数据分布图: 各类型对象数量 (Progress bars)
- 采购订单状态图: 按状态分组的数量和占比

**AI Agent 分析**:
1. "按供应商分析采购金额，找出最大供应商" → `aggregate_objects(purchase_order, sum, total_amount, group_by=supplier_code)`
2. "按月统计采购金额趋势" → `aggregate_objects(..., time_granularity=month)`

**API 验证**:
```
POST /instances/objects/aggregate — {"metric": "count", "group_by": "status"}
POST /instances/objects/aggregate — {"metric": "sum", "property_name": "total_amount", "group_by": "supplier_code"}
POST /instances/objects/aggregate — {"metric": "sum", "property_name": "total_amount", "time_granularity": "month", "date_property": "order_date"}
```

### 案例 3: Airbus — 图谱探索定位零件问题 (+33% 效率)

**UI 操作路径**:
1. 对象浏览器 → 筛选 "质量检测" → 找到 "不合格" 记录
2. 详情 → **图谱 Tab**: 以当前质检记录为中心的交互式图谱
3. **双击采购订单节点** → 展开更多关联 (零件、工厂)
4. **再双击零件节点** → 展开供应商
5. 完整追溯链: `质检(不合格) → 采购订单 → 零件 → 供应商`

**关键交互**: 双击展开/收起 | 类型筛选 | 全部展开/收起 | 节点点击跳转详情

**API 验证**:
```
GET /instances/objects/{qc_id}/neighbors?depth=1  — 质检→订单
GET /instances/objects/{qc_id}/neighbors?depth=2  — 质检→订单→零件/工厂
GET /instances/objects/{qc_id}/neighbors?depth=3  — 完整链路到供应商
```

## 6. Phase 2 案例演示

### 案例 4: 供应链控制塔 — 定时管道调度

**功能**: 管道可配置 cron/interval 调度，自动定时执行数据更新。

**UI 操作路径**:
1. 数据管道 → 管道列表 → 点击 "调度" 按钮
2. 选择调度类型: cron (如 `0 */6 * * *` 每6小时) 或 interval (如 60 分钟)
3. 保存 → 管道列表 "调度" 列显示调度信息

**API 验证**:
```
PUT  /pipelines/{id}/schedule — {"type":"cron","cron":"0 */6 * * *"}
GET  /pipelines/scheduler/status — {"running": true, "jobs": [...]}
DELETE /pipelines/{id}/schedule — 取消调度
```

### 案例 5: 医院预警 — 告警系统

**功能**: 基于规则的告警引擎，管道执行后自动检查新对象是否触发告警。

**UI 操作路径**:
1. 数据管道 → **告警规则 Tab** → 创建规则
2. 配置: 对象类型=质量检测, 字段=defect_count, 运算符=>=, 阈值=3, 严重程度=Critical
3. 管道导入数据后 → 自动触发告警 → 顶栏铃铛显示未读数
4. 点击铃铛 → Drawer 展示告警列表 → **点击告警跳转到对象详情**

**API 验证**:
```
POST /alerts/rules — {"name":"...","object_type_id":"...","condition":{"field":"defect_count","operator":">=","value":3},"severity":"critical"}
GET  /alerts/count — {"unread": N}
GET  /alerts/ — [告警列表]
POST /alerts/mark-all-read
```

### 案例 6: ERP 增量同步 + 数据血缘

**增量同步**:
1. 创建管道时选择 "同步模式=增量" + 设置唯一键属性
2. 重复运行管道 → 已有对象 UPDATE, 新对象 INSERT, 不重复
3. 运行记录显示 created / updated / skipped 详细统计

**数据血缘**:
1. 对象浏览器 → 任意对象 → 详情弹窗 → **血缘 Tab**
2. 显示: 数据源(CSV/PG/REST) → 管道名称 → 运行记录(状态+行数+时间) → 源行号

**API 验证**:
```
GET /instances/objects/{id}/lineage
→ {"data_source": {...}, "pipeline": {...}, "pipeline_run": {...}, "source_row_index": N}
```

## 7. 对标 Palantir Foundry

| Palantir Foundry 能力 | OntoForge 实现 | 案例对标 | Phase |
|----------------------|----------------|---------|-------|
| Ontology — 对象/属性/关联 | 5 类型, 39 属性, 4 关联, 85+ 实例 | 所有案例 | ✅ MVP |
| Data Integration — Pipeline | CSV/PG/REST + 字段映射 + Transform | 所有案例 | ✅ MVP |
| **Action Types — 操作闭环** | 4 种操作, 参数化执行, dry_run | General Mills | ✅ P1 |
| **Object Graph — 图谱探索** | 径向层次布局 + 展开/折叠 + 1000+ 性能 | Airbus | ✅ P1 |
| **Aggregation — 聚合分析** | 6 种指标 + group_by + 时间粒度 | Fortune 100 | ✅ P1 |
| **AIP Agent — AI 执行操作** | 4 类 10 工具 + 多轮调用 + 可视化 | General Mills | ✅ P1 |
| **Dashboard — 数据洞察** | 8 卡片 + 分布图 + 状态图 | Fortune 100 | ✅ P1 |
| **Scheduled Pipelines — 定时调度** | APScheduler cron/interval | 控制塔 | ✅ P2 |
| **Incremental Sync — 增量同步** | UPSERT + created/updated/skipped | ERP 集成 | ✅ P2 |
| **Alert Notifications — 告警通知** | 规则引擎 + 管道触发 + 铃铛 + 规则管理 UI | 医院预警 | ✅ P2 |
| **Data Lineage — 数据血缘** | 数据源→管道→运行→对象 | ERP 集成 | ✅ P2 |
| Workshop — 低代码应用 | 规划中 | — | ⬜ P3 |
| Streaming Chat — SSE | 规划中 | — | ⬜ P4 |

## 8. 文件结构

```
demo/
├── DEMO.md                   # 本文档 (案例驱动演示指南)
├── setup_demo.sh             # 一键部署 + Phase 1 + Phase 2 全量验证
├── suppliers.csv             # 供应商数据 (8 行)
├── parts.csv                 # 零件数据 (12 行)
├── plants.csv                # 工厂数据 (4 行)
├── purchase_orders.csv       # 采购订单数据 (30 行)
└── quality_inspections.csv   # 质量检测数据 (12 行)
```
