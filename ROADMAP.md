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
| **UI** | Edge 风格主题系统 (system/light/dark), i18n (中/英), 8 个完整页面, PageHeader 统一设计 | — |
| **基础设施** | JWT 认证, SQLite/PostgreSQL, Docker Compose | — |

### Phase 1: 操作闭环 ✅

> **案例驱动**: General Mills $14M/年 (AI→一键执行), Fortune 100 $100M (SKU聚合), Airbus +33% (图谱探索)

| 能力 | 实现 | 涉及文件 |
|------|------|---------|
| **Action Type 执行引擎** | create/edit/delete 三种 logic_type, 参数验证, 模板渲染, dry_run | `services/action_executor.py` |
| **Action API** | `POST /ontology/action-types/{id}/execute` + `validate` | `api/v1/ontology.py` |
| **聚合分析引擎** | count/sum/avg/min/max/count_distinct, group_by, time_granularity (day/week/month), filters | `services/analytics_service.py` |
| **聚合 API** | `POST /instances/objects/aggregate` | `api/v1/instances.py` |
| **Agent 工具扩展** | ontology_query + action_execute + analytics + instance_write + document_search (5 大类 10 个工具) | `services/aip_service.py` |
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
| **前端: 告警通知** | 顶栏铃铛 + 未读徽章, Drawer 告警列表, 点击跳转到对象详情 | `AppLayout.tsx` |
| **前端: 数据血缘** | 对象详情 "血缘" Tab: 数据源 → 管道 → 运行记录 → 行号 | `ObjectExplorer.tsx` |

### Phase 3: Workshop 低代码构建器 ✅

> **案例驱动**: 六大案例中 Workshop 是一线人员 (工厂经理、医生、采购员) 做决策的入口。

| 能力 | 实现 | 涉及文件 |
|------|------|---------|
| **Workshop 数据模型** | WorkshopApp + WorkshopWidget, JSON 配置 (layout/position/config/data_binding) | `models/workshop.py` |
| **Workshop API** | App CRUD + Widget CRUD + 批量布局保存 + 发布/取消 + 数据绑定解析 | `api/v1/workshops.py` |
| **数据绑定引擎** | resolve stat_card/table/chart 三种 Widget 的数据查询 (聚合/列表/分组) | `services/workshop_service.py` |
| **前端: Builder** | 左侧组件库 + 中间 Grid 画布 (react-grid-layout) + 右侧属性配置面板 | `WorkshopBuilder.tsx` |
| **前端: 运行视图** | 只读 Grid 渲染 + 实时数据加载 + Recharts 图表 | `WorkshopView.tsx` |
| **4 种 Widget** | StatCardWidget / TableWidget / ChartWidget / ActionButtonWidget | `WorkshopView.tsx` |

### Phase 3.5: 前端交互体验全面优化 ✅

> **对标 Palantir**: Workshop 遵循统一设计系统，所有组件交互一致、高质量。图谱模块是 Foundry 最具辨识度的交互。

| 能力 | 实现 | 涉及文件 |
|------|------|---------|
| **自定义 Hooks** | useAsync / useAutoRefresh / useDebounce / useContainerSize | `hooks/*.ts` |
| **共享 Widget 组件** | StatCardWidget (数字动画+sparkline) / ChartWidget (bar/line/pie切换+drill-down) / DataTableWidget (条件格式+排序) / ActionButtonWidget (确认+loading) | `components/widgets/*.tsx` |
| **Dashboard Recharts 重构** | PieChart 替代 Progress 条, 环形图 (donut) + 中心总数, 活动 Timeline, hover 浮起, staggered 入场动画 | `Dashboard.tsx` |
| **Workshop 大屏增强** | 数字 countUp 动画, Chart drill-down Drawer, 自动刷新倒计时, 全屏模式, per-widget Skeleton, 入场动画 | `WorkshopView.tsx` |
| **Workshop Builder 升级** | 拖拽添加 (HTML5 DnD), 实时预览, Undo (Ctrl+Z), 未保存提示, Widget 复制, Grid 点阵背景, 配置 Tabs | `WorkshopBuilder.tsx` |
| **图谱自定义节点** | OntologyBuilder SchemaNode (左色带+属性展示), ObjectGraphExplorer GraphNode (badge+loading) | `OntologyBuilder.tsx`, `ObjectGraphExplorer.tsx` |
| **图谱搜索** | 悬浮搜索栏, 匹配高亮 + 不匹配半透明, debounced | `ObjectGraphExplorer.tsx` |
| **图谱面包屑** | 探索路径可视化, 点击跳转 + fitView | `ObjectGraphExplorer.tsx` |
| **图谱右键菜单** | 展开/折叠, 查看详情, 聚焦节点 | `ObjectGraphExplorer.tsx` |
| **全局 CSS 增强** | card-hoverable, fadeSlideUp 动画, graph-node/breadcrumb/context-menu, builder-widget/drag-source/drop-target | `index.css` |

---

## 当前对标矩阵

| Palantir Foundry 能力 | OntoForge 状态 | Phase |
|----------------------|---------------|-------|
| Ontology — 对象/属性/关联 | ✅ 完整 | MVP |
| Data Connectivity — 多数据源 | ✅ CSV/PG/REST | MVP |
| Pipeline Builder — ETL | ✅ 字段映射 + Transform | MVP |
| **Action Types — 操作闭环** | ✅ create/edit/delete + 参数化 | Phase 1 |
| **Object Graph Explorer** | ✅ 径向层次 + 搜索 + 面包屑 + 右键菜单 | Phase 1+3.5 |
| **Aggregation API** | ✅ 6 种指标 + group_by + 时间序列 | Phase 1 |
| **Agent 执行 Action + 写入** | ✅ 5 类 10 个工具 + 多轮调用 (含 Phase 4 document_search) | Phase 1+4 |
| **Scheduled Pipelines** | ✅ APScheduler cron/interval | Phase 2 |
| **Incremental Sync (UPSERT)** | ✅ primary_key + rows_created/updated | Phase 2 |
| **Alert Notifications** | ✅ 规则引擎 + 自动触发 + 铃铛通知 | Phase 2 |
| **Data Lineage** | ✅ 对象溯源 (数据源→管道→运行→行号) | Phase 2 |
| **Workshop — 低代码应用** | ✅ Builder (拖拽+预览+Undo) + 4 种 Widget + Grid + 数据绑定 | Phase 3+3.5 |
| **Workshop 大屏交互** | ✅ countUp动画 + drill-down + 自动刷新 + 全屏 | Phase 3.5 |
| **Dashboard 可视化** | ✅ Recharts PieChart/Donut + Timeline + 动画 | Phase 3.5 |
| **Streaming Chat (SSE)** | ✅ 后端 StreamingResponse + 前端 ReadableStream 逐字显示 | Phase 4 |
| **RAG — 文档检索** | ✅ Document 模型 + 分块 + 关键词检索 + Agent document_search | Phase 4 |
| **AIPFunction 测试面板** | ✅ 输入变量 → 预览 Prompt → 执行 → 结果 | Phase 4 |
| **文档管理 UI** | ✅ 上传/列表/删除 + Documents Tab | Phase 4 |
| **FilterWidget 筛选联动** | ✅ 筛选器 → 变量 → 其他 Widget 自动筛选 | Phase 5 |
| **ObjectListWidget** | ✅ 卡片式对象列表 + 属性高亮 + 点击跳转 | Phase 5 |
| **AgentChatWidget** | ✅ 嵌入 Agent SSE 流式对话 | Phase 5 |
| **AlertListWidget** | ✅ 告警列表 + 严重程度 + 未读计数 | Phase 5 |
| **Widget 事件系统** | ✅ {{variable}} 替换 + 跨 Widget 变量通信 | Phase 5 |
| **RBAC — 细粒度权限** | ✅ admin/editor/viewer 三角色 + 前端 UI 控制 | Phase 6 |
| **Audit Log — 操作审计** | ✅ 全操作审计日志 + 管理员查看/筛选 | Phase 6 |
| **User Management** | ✅ 用户列表/角色修改/启停管理 (admin only) | Phase 6 |

---

### Phase 4: AIP 增强 — 流式对话 + 基础 RAG ✅

> **案例驱动**: 流式对话是用户体验基础 (对标 Palantir AIP Threads)。RAG 支撑 Airbus 维修手册检索、银行文档分析 (对标 Palantir AIP Agent Studio 文档上下文)。

| 能力 | 实现 | 涉及文件 |
|------|------|---------|
| **SSE 流式响应** | `POST /aip/chat/stream` + StreamingResponse, content_delta/tool_start/tool_end/done 事件 | `api/v1/aip.py`, `services/aip_service.py` |
| **流式 LLM 调用** | `chat_completion_stream` 异步生成器, tool_calls 缓冲拼接 | `services/llm_provider.py` |
| **Document 模型** | name/content/chunks/chunk_count/file_size/metadata, 自动分块 (500字符+50重叠) | `models/document.py` |
| **RAG 服务** | chunk_text (句边界分块) + search_documents (关键词评分) | `services/rag_service.py` |
| **Documents API** | CRUD + 关键词搜索 (`POST /documents/search`) | `api/v1/documents.py` |
| **Agent document_search 工具** | 5 类 10 个工具, 新增 document_search 类别 | `services/aip_service.py` |
| **前端: 流式对话** | fetch + ReadableStream + SSE 解析, 逐字显示 + 闪烁光标 + 工具调用实时动画 | `AIPStudio.tsx` |
| **前端: 文档管理** | Documents Tab — 上传/列表/删除, 显示 chunk_count/file_size | `AIPStudio.tsx` |
| **前端: Function 测试面板** | Drawer 面板 — 输入变量 → 预览 Prompt → 执行 → 结果 | `AIPStudio.tsx` |
| **i18n** | 20+ 条新增翻译 (streaming/documents/function test) | `locales/zh.ts`, `locales/en.ts` |

**新增依赖**: 无 (使用原生 fetch + ReadableStream)

---

### Phase 5: Workshop 完善 — 高级 Widget + 事件联动 ✅

> **对标 Palantir Workshop Event System**: 筛选器联动其他 Widget, Agent 嵌入应用 (Tier 3 Agentic Application)。

| 能力 | 实现 | 涉及文件 |
|------|------|---------|
| **FilterWidget** | 筛选器下拉 → 写入变量, 数据解析返回 distinct options | `FilterWidget.tsx`, `workshop_service.py` |
| **ObjectListWidget** | 卡片式列表, 属性高亮标签, 点击跳转对象详情 | `ObjectListWidget.tsx` |
| **AgentChatWidget** | 嵌入 Agent SSE 流式对话, 完整聊天 UI | `AgentChatWidget.tsx` |
| **AlertListWidget** | 告警列表, 严重程度颜色/图标, 未读计数 Badge | `AlertListWidget.tsx` |
| **Widget 事件系统** | `useWorkshopEvents` hook, `{{variable}}` 模板替换, 跨 Widget 变量通信 | `useWorkshopEvents.ts`, `WorkshopView.tsx` |
| **变量替换引擎** | `substitute_variables` — 后端 `filters` 中 `{{var}}` 自动替换 | `workshop_service.py` |
| **Builder 8 种 Widget** | 组件库 8 种 + 配置面板 (filter_field/variable/agent_id/severity 等) | `WorkshopBuilder.tsx` |
| **i18n** | 12 条新增翻译 (filter/objectList/agentChat/alertList/variable/events) | `locales/zh.ts`, `locales/en.ts` |

**事件联动机制**:
```
FilterWidget (选择 "SUP-001")
  → setVariable("supplier_filter", "SUP-001")
    → eventBus.version++
      → WorkshopView re-resolve (variables: {supplier_filter: "SUP-001"})
        → StatCard (filters: {supplier_code: "{{supplier_filter}}"}) → 自动筛选
        → ChartWidget / TableWidget → 同步更新
```

---

### Phase 6: Security + Audit ✅

> **案例驱动**: 医院 RBAC (医生/护士不同权限), 银行审计 (合规要求)。对标 Palantir Security & Governance。

| 能力 | 实现 | 涉及文件 |
|------|------|---------|
| **RBAC 三角色** | admin (全权限) / editor (读写) / viewer (只读+AIP对话), 首用户自动 admin | `services/auth_service.py` |
| **require_role 依赖** | FastAPI Depends 工厂, 所有写端点强制权限检查 | `services/auth_service.py` |
| **AuditLog 模型** | user_id/username/action/resource_type/resource_id/details/created_at | `models/audit_log.py` |
| **审计服务** | create_audit_log — 所有写操作/登录/角色变更产生审计日志 | `services/audit_service.py` |
| **审计 API** | `GET /audit/logs` (分页+筛选) + `GET /audit/actions` + `GET /audit/resource-types` | `api/v1/audit.py` |
| **用户管理 API** | `GET /auth/users` + `PATCH /auth/users/{id}/role` + `PATCH /auth/users/{id}` | `api/v1/auth.py` |
| **前端: 权限 Hook** | `usePermission` — isAdmin/isEditor/canWrite/canManageUsers | `hooks/usePermission.ts` |
| **前端: 用户管理** | Settings → 用户管理 Tab (角色下拉+启停开关), admin only | `pages/Settings.tsx` |
| **前端: 审计日志** | Settings → 操作审计 Tab (表格+筛选: 操作/资源/用户), admin only | `pages/Settings.tsx` |
| **前端: 权限 UI** | 创建按钮按角色隐藏, 403 统一提示, 顶栏角色 Tag | `AppLayout.tsx`, 各页面 |
| **i18n** | 15+ 条新增翻译 (userManagement/auditLog/noPermission 等) | `locales/zh.ts`, `locales/en.ts` |

### 6.1 验收标准

- [x] viewer 无法创建对象类型 (HTTP 403)
- [x] 所有 Action 执行产生审计日志
- [x] admin 可修改用户角色
- [x] 前端按角色隐藏创建按钮
- [x] 审计日志支持分页和筛选

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
| 数字动画 | requestAnimationFrame | 不引入新依赖, 原生高性能 |
| 拖拽 | HTML5 Drag and Drop API | 不引入新依赖, 浏览器原生支持 |

## 执行要点 (供 AI 上下文恢复)

1. **每个 Phase 开始前**: 阅读本文件对应 Phase 章节 + 阅读涉及文件的当前代码
2. **严格遵守约定**: CSS 变量 (var(--xxx)), PageHeader 组件, i18n, 现有 API 风格
3. **数据库变更**: SQLite 不支持 ALTER TABLE, 新增模型字段需删 .db 重建
4. **前端构建验证**: 每个 Phase 完成后 `npx tsc --noEmit` 确保无 TS 错误
5. **Demo 数据兼容**: 确保 setup_demo.sh 在新功能下仍可正常运行
6. **案例导向**: 开发时对标 CASES.md 六大场景, 确保功能支撑真实业务价值
