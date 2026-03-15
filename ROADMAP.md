# OntoForge 开发路线图 — V1.0

> 对标 Palantir Foundry，在 MVP 基础上完成从"原型"到"可交付产品"的跨越。
> 优先级排序基于 Palantir 六大千万级案例的共性模式分析 (详见 CASES.md)。

---

## 已完成能力总览

### Phase 0: MVP ✅

| 模块 | 能力 | 对标 Palantir |
|------|------|--------------|
| **Ontology Engine** | Object Types + Properties + Link Types + React Flow 图谱 + 全文搜索 | Object Types, Link Types |
| **Data Integration** | CSV/PostgreSQL/REST 连接器, Pipeline + 字段映射, Transform (rename/filter/drop/fill/cast), 运行历史 | Data Connectivity, Pipeline Builder |
| **AIP** | 多 LLM Provider 管理, AI Agent + 多轮工具调用, AIP Functions, NL Query, 对话历史 | AIP Agent Studio, AIP Logic |
| **UI** | Edge 风格主题系统 (system/light/dark), i18n (中/英), 7 个完整页面, PageHeader 统一设计 | — |
| **基础设施** | JWT 认证, SQLite/PostgreSQL, Docker Compose | — |

### Phase 1: 操作闭环 ✅

> **案例驱动**: General Mills $14M/年 (AI→一键执行), Fortune 100 $100M (SKU聚合), Airbus +33% (图谱探索)

| 能力 | 实现 | 涉及文件 |
|------|------|---------|
| **Action Type 执行引擎** | create/edit/delete 三种 logic_type, 参数验证, 模板渲染, dry_run | `services/action_executor.py` |
| **Action API** | `POST /ontology/action-types/{id}/execute` + `validate` | `api/v1/ontology.py` |
| **聚合分析引擎** | count/sum/avg/min/max/count_distinct, group_by, time_granularity (day/week/month), filters | `services/analytics_service.py` |
| **聚合 API** | `POST /instances/objects/aggregate` | `api/v1/instances.py` |
| **Agent 工具扩展** | ontology_query + action_execute + analytics + instance_write (4 大类 10 个工具) | `services/aip_service.py` |
| **多轮工具调用** | 最多 5 轮自动 tool calling, 历史消息清洗 `_sanitize_history` | `services/aip_service.py` |
| **对象详情增强** | 5 个 Tab: 详情 / 关联对象 / 图谱 / 操作 / 血缘 | `ObjectExplorer.tsx` |
| **交互式图谱探索** | 径向层次布局, 双击展开/折叠, 网格加速力导向 (N≥300), 类型过滤, 控制面板 | `ObjectGraphExplorer.tsx` |
| **本体图谱** | 力导向布局, 属性节点展开/折叠, 统一控制面板 | `OntologyBuilder.tsx` |
| **Dashboard 洞察** | 数据分布图 (Progress bars) + PO 状态分布 + 未读告警 + 调度任务卡片 | `Dashboard.tsx` |
| **工具调用可视化** | Chat UI 内联显示 tool name + args + result | `AIPStudio.tsx` |

### Phase 2: 数据增强 ✅

> **案例驱动**: 供应链控制塔 (定时管道), 医院预警 (告警), ERP 数据持续变化 (增量同步)

| 能力 | 实现 | 涉及文件 |
|------|------|---------|
| **定时管道调度** | APScheduler, cron/interval 两种触发器, 启动时加载已有调度 | `services/scheduler.py` |
| **调度 API** | `PUT/DELETE /pipelines/{id}/schedule`, `GET /pipelines/scheduler/status` | `api/v1/pipelines.py` |
| **增量同步** | Pipeline.sync_mode (full/incremental), primary_key_property, UPSERT 逻辑 | `services/pipeline_executor.py` |
| **同步统计** | PipelineRun.rows_created / rows_updated / rows_skipped | `models/data_integration.py` |
| **告警规则模型** | AlertRule (条件引擎: ==, !=, >, >=, <, <=, contains) + Alert | `models/alert.py` |
| **告警评估** | 管道执行后自动检查新对象是否触发规则, 去重 | `services/alert_service.py` |
| **告警 API** | 规则 CRUD, 告警列表 (分页/筛选), 未读计数, 标记已读/全部已读 | `api/v1/alerts.py` |
| **数据血缘** | ObjectInstance.source_pipeline_id/run_id/row_index, 溯源 API | `api/v1/instances.py` |
| **前端: 管道调度** | 调度配置弹窗 (cron/interval), 管道列表显示调度信息 + sync_mode | `PipelineBuilder.tsx` |
| **前端: 创建管道** | 可选 sync_mode (全量/增量) + primary_key | `PipelineBuilder.tsx` |
| **前端: 告警规则管理** | "告警规则" Tab, 创建/删除规则, 字段/运算符/阈值配置 | `PipelineBuilder.tsx` |
| **前端: 告警通知** | 顶栏铃铛 + 未读徽章, Drawer 告警列表, 点击跳转到对象详情 | `AppLayout.tsx` |
| **前端: 数据血缘** | 对象详情 "血缘" Tab: 数据源 → 管道 → 运行记录 → 行号 | `ObjectExplorer.tsx` |
| **前端: 运行详情** | 管道运行记录显示 created/updated/skipped 列 | `PipelineBuilder.tsx` |

---

## 当前对标矩阵

| Palantir Foundry 能力 | OntoForge 状态 | Phase |
|----------------------|---------------|-------|
| Ontology — 对象/属性/关联 | ✅ 完整 | MVP |
| Data Connectivity — 多数据源 | ✅ CSV/PG/REST | MVP |
| Pipeline Builder — ETL | ✅ 字段映射 + Transform | MVP |
| **Action Types — 操作闭环** | ✅ create/edit/delete + 参数化 | Phase 1 |
| **Object Graph Explorer** | ✅ 径向层次 + 展开/折叠 + 1000+ 性能 | Phase 1 |
| **Aggregation API** | ✅ 6 种指标 + group_by + 时间序列 | Phase 1 |
| **Agent 执行 Action + 写入** | ✅ 4 类 10 个工具 + 多轮调用 | Phase 1 |
| **Scheduled Pipelines** | ✅ APScheduler cron/interval | Phase 2 |
| **Incremental Sync (UPSERT)** | ✅ primary_key + rows_created/updated | Phase 2 |
| **Alert Notifications** | ✅ 规则引擎 + 自动触发 + 铃铛通知 + 规则管理 UI | Phase 2 |
| **Data Lineage** | ✅ 对象溯源 (数据源→管道→运行→行号) | Phase 2 |
| Workshop — 低代码应用 | ⬜ 未开始 | Phase 3 |
| Streaming Chat (SSE) | ⬜ 未开始 | Phase 4 |
| RAG — 文档检索 | ⬜ 未开始 | Phase 4 |
| RBAC — 细粒度权限 | ⬜ 未开始 | Phase 6 |
| Audit Log — 操作审计 | ⬜ 未开始 | Phase 6 |

---

## Phase 3: Workshop 低代码构建器 (待开发)

> **案例驱动**: 六大案例中 Workshop 是一线人员 (工厂经理、医生、采购员) 做决策的入口。General Mills 70% AI 推荐接受率发生在 Workshop 中。
> 依赖 Phase 1 的聚合 API 和 Action 执行。

### 3.1 后端 — Workshop 数据模型

**新建文件**: `backend/app/models/workshop.py`, `backend/app/api/v1/workshop.py`, `backend/app/services/workshop_service.py`

```python
class WorkshopApp(Base):
    id, name, description, icon
    layout: JSON          # 页面布局配置 (grid)
    variables: JSON       # 应用变量 (筛选条件等)
    is_published: bool
    created_by, created_at, updated_at

class WorkshopWidget(Base):
    id, app_id (FK)
    widget_type: str      # "stat_card" | "table" | "chart" | "object_list" | "action_button" | "filter" | "agent_chat"
    title: str
    config: JSON          # Widget 特定配置
    position: JSON        # {"x": 0, "y": 0, "w": 6, "h": 4}
    data_binding: JSON    # 数据源绑定 (object_type_id, filter, etc.)
    order: int
```

API 端点:
- `GET/POST /api/v1/workshop/apps` — 应用 CRUD
- `GET/PATCH/DELETE /api/v1/workshop/apps/{id}`
- `GET/POST /api/v1/workshop/apps/{id}/widgets` — Widget CRUD
- `POST /api/v1/workshop/apps/{id}/publish`
- `POST /api/v1/workshop/resolve` — 解析 Widget 数据绑定

### 3.2 前端 — Workshop Builder + 核心 Widget

**新建文件**: `frontend/src/pages/Workshop.tsx`, `WorkshopBuilder.tsx`, `WorkshopView.tsx`

**新增依赖**: `recharts`, `react-grid-layout`

1. **Workshop 列表页** (`/workshop`): 应用卡片 + 新建/预览/编辑
2. **Workshop Builder** (`/workshop/:id/edit`): 左侧组件库(拖拽) + 中间 Grid 画布 + 右侧属性面板
3. **Workshop 运行视图** (`/workshop/:id`): 渲染 Widget + 数据动态加载 + Filter 联动

核心 Widget:
- `StatCardWidget` — 数字指标 (count/sum/avg)
- `TableWidget` — 对象列表表格
- `ChartWidget` — 图表 (bar/line/pie, Recharts)
- `ActionButtonWidget` — 触发 Action

### 3.3 验收标准

- [ ] 创建 "供应链监控大屏" Workshop App
- [ ] StatCard: 供应商总数 / 订单总额 / 不合格率
- [ ] Chart: 按状态分组的采购订单分布 (饼图)
- [ ] Table: 最近的质量检测记录
- [ ] ActionButton: "审批采购订单"
- [ ] Builder 中可拖拽调整 Widget 布局
- [ ] 数据实时从 Ontology 对象获取

---

## Phase 4: AIP 增强 — 流式对话 + 基础 RAG (待开发)

> **案例驱动**: 流式对话是用户体验基础。RAG 支撑 Airbus 维修手册检索、银行文档分析。

### 4.1 后端 — SSE 流式响应

```python
@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    async def generate():
        async for chunk in aip_service.chat_stream(db, request):
            yield f"data: {json.dumps(chunk)}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")
```

### 4.2 后端 — 基础 RAG (文档上传 + 关键词检索)

简化策略: V1 不引入向量搜索，使用分块 + 关键词匹配。

- `Document` 模型: name, content, chunks (JSON), metadata
- `rag_service.py`: upload_document (分块 500 字符), search_documents (关键词匹配)
- Agent 新工具: `document_search`

### 4.3 前端 — 流式对话 + 文档管理

- 流式对话: `fetch` + ReadableStream 接收 SSE, 逐字显示
- AIPStudio "Documents" Tab: 上传/列表/删除/搜索测试
- AIPFunction 测试面板: 输入变量 → 预览 prompt → 执行 → 显示输出

### 4.4 验收标准

- [ ] 对话时 assistant 回复逐字流式显示
- [ ] 上传 .txt 文档, Agent 可基于内容回答问题
- [ ] AIPFunction 可在测试面板中预览和执行

---

## Phase 5: Workshop 完善 + Analytics 增强 (待开发)

> Workshop Phase 3 实现核心框架, 本 Phase 补全高级 Widget 和分析能力。

### 5.1 高级 Widget

- `FilterWidget` — 筛选器 (下拉/日期/搜索), 联动其他 Widget
- `ObjectListWidget` — 卡片式对象列表
- `AgentChatWidget` — 嵌入 Agent 对话 (使用流式, 依赖 Phase 4)
- `AlertListWidget` — 告警列表 (依赖 Phase 2)

### 5.2 Widget 事件联动

```
FilterWidget (选择 "上海工厂")
  → 更新 app.variables.plant_filter = "PLT-SH"
    → TableWidget 自动筛选
    → ChartWidget 重新加载
    → StatCardWidget 更新
```

### 5.3 Dashboard 趋势图

- 最近 7 天对象创建趋势 折线图 (Recharts)
- 按类型分布 饼图

### 5.4 验收标准

- [ ] FilterWidget 联动 Table 和 Chart
- [ ] AgentChatWidget 嵌入 Workshop
- [ ] Dashboard 趋势图 + 分布图

---

## Phase 6: Security + Audit (待开发)

> **案例驱动**: 医院 RBAC (医生/护士不同权限), 银行审计 (合规要求)

### 6.1 RBAC

角色: admin (所有权限) / editor (读写) / viewer (只读+AIP+Workshop)

```python
@require_role("admin")
@require_role("editor", "admin")
```

### 6.2 Audit Log

```python
class AuditLog(Base):
    id, user_id, action, resource_type, resource_id
    details: JSON  # {old_value, new_value}
    ip_address, created_at
```

### 6.3 验收标准

- [ ] viewer 无法创建对象类型
- [ ] 所有 Action 执行产生审计日志
- [ ] admin 可修改用户角色

---

## Phase 7: 集成测试 + 演示升级 (待开发)

### 7.1 Demo 场景升级

- Workshop 演示: "供应链监控中心" App (StatCard + Chart + Table + ActionButton)
- 完整流程: 登录 → Dashboard → Ontology → ObjectExplorer → Workshop → Agent 对话

### 7.2 验收标准

- [ ] setup_demo.sh 一键部署含所有功能
- [ ] 完整演示流程可顺畅执行
- [ ] 对标矩阵: ≥85% 核心能力覆盖

---

## 技术决策备忘

| 决策项 | 选择 | 原因 |
|-------|------|------|
| 图表库 | Recharts | React 原生, 声明式 API, 主题适配容易 |
| Grid 布局 | react-grid-layout | Workshop 拖拽布局标准方案 |
| 定时调度 | APScheduler | 轻量纯 Python, 无需 Celery |
| 文档检索 | 关键词匹配 (V1) | 避免 numpy/pgvector 依赖, 后续可升级向量搜索 |
| 流式响应 | SSE (Server-Sent Events) | 无需 WebSocket, 前端原生支持 |
| 图谱布局 | 自定义径向层次 + 力导向 | 适配展开/折叠交互, 大规模图性能 |

## 执行要点 (供 AI 上下文恢复)

1. **每个 Phase 开始前**: 阅读本文件对应 Phase 章节 + 阅读涉及文件的当前代码
2. **严格遵守约定**: CSS 变量 (var(--xxx)), PageHeader 组件, i18n, 现有 API 风格
3. **数据库变更**: SQLite 不支持 ALTER TABLE, 新增模型字段需删 .db 重建
4. **前端构建验证**: 每个 Phase 完成后 `npx tsc --noEmit` 确保无 TS 错误
5. **Demo 数据兼容**: 确保 setup_demo.sh 在新功能下仍可正常运行
6. **案例导向**: 开发时对标 CASES.md 六大场景, 确保功能支撑真实业务价值
