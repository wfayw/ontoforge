# OntoForge

开源数据操作平台 — 集 **本体引擎**、**数据集成**、**AI 平台**、**低代码应用** 于一体。对标 Palantir Foundry，面向中小企业和国产化场景。

## 架构

- **Backend**: Python 3.12 + FastAPI + SQLAlchemy + SQLite/PostgreSQL
- **Frontend**: React 18 + TypeScript + Ant Design + React Flow + Recharts
- **AI**: OpenAI 兼容 LLM 集成 (支持 OpenAI / Anthropic / 通义千问 / DeepSeek / 本地部署)

## 快速开始

### 前置依赖

- Docker & Docker Compose
- Node.js 20+ (本地前端开发)
- Python 3.12+ (本地后端开发)

### Docker Compose

```bash
docker compose up -d
```

启动 PostgreSQL、Redis、后端 (8000)、前端 (5173)。

### 本地开发

**后端:**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**前端:**

```bash
cd frontend
npm install
npm run dev
```

### 演示数据

```bash
cd demo
bash setup_demo.sh    # 一键创建 7 种实体 → 导入 335 对象 → 构建 600 关联 → 2 个 Workshop 应用
```

Demo 包含 20 家供应商(6 国) / 30 种零件 / 8 座工厂 / 150 笔采购订单 / 50 条质检 / 71 条物流记录，内嵌供应商风险、交货延迟、成本飙升等 7 种真实业务场景。详见 [demo/DEMO.md](demo/DEMO.md)。

### 访问

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5173 |
| 后端 API | http://localhost:8000 |
| API 文档 | http://localhost:8000/docs |

### 默认账户 (demo 模式)

| 角色 | 用户名 | 密码 | 权限 |
|------|--------|------|------|
| admin | admin | admin123 | 全部权限 + 用户管理 + 审计日志 |
| editor | editor | editor123 | 读写权限 (CRUD 本体/数据/应用) |
| viewer | viewer | viewer123 | 只读 + AI 对话 + Workshop 查看 |

## 核心功能

### 本体引擎 (Ontology Engine)

- 定义 Object Types (类型化属性) + Link Types (关系建模)
- Action Types — 操作类型定义 (create/edit/delete)，参数化执行 + dry_run 验证
- 可视化图谱编辑器 (React Flow 力导向布局)
- 全文搜索 + 对象实例浏览 + 详情 5-Tab (属性/关联/图谱/操作/血缘)

### 数据集成 (Data Integration)

- 数据源连接器: CSV 上传、PostgreSQL、REST API
- 可视化管道构建器 + 字段映射 + Transform (rename/filter/drop/fill/cast)
- **定时调度**: APScheduler cron/interval 触发
- **增量同步**: UPSERT 模式 (primary_key 去重, rows_created/updated/skipped 统计)
- **数据血缘**: 对象溯源 (数据源 → 管道 → 运行 → 行号)
- 管道运行历史 + 状态监控

### 告警系统 (Alert Notifications)

- 规则引擎: 条件评估 (==, !=, >, >=, <, <=, contains)
- 管道执行后自动检查新对象是否触发告警规则
- 顶栏铃铛 + 未读徽章 + Drawer 告警列表 + 点击跳转对象详情

### AI 平台 (AIP)

- 多 Provider LLM 管理 (OpenAI / Anthropic / 本地模型)
- AI Agent Studio — 5 类 10 个工具:
  - `ontology_query`: 查询/搜索/计数/图谱遍历
  - `action_execute`: 列出并执行操作
  - `analytics`: 聚合分析 (count/sum/avg/min/max + group_by + 时间粒度)
  - `instance_write`: 创建/修改对象
  - `document_search`: 文档知识库检索
- 多轮工具调用 (最多 5 轮自动 tool calling)
- **SSE 流式对话**: 逐字显示 + 工具调用实时动画
- **文档知识库 (RAG)**: 上传文档 → 自动分块 (500 字符) → 关键词检索
- AIP Functions (LLM 驱动的无代码函数) + 测试面板
- 自然语言查询 (NL Query) + 对话历史

### 低代码应用 (Workshop)

- Workshop Builder: 拖拽添加 (HTML5 DnD) + Grid 画布 + 属性配置 + Undo (Ctrl+Z) + 未保存提示
- **8 种 Widget**:
  - StatCard — 数字聚合 + countUp 动画
  - Table — 数据表格 + 条件格式 (阈值变色) + 排序
  - Chart — Recharts 图表 (bar/line/pie 切换) + drill-down Drawer
  - ActionButton — 操作按钮 + 确认弹窗
  - Filter — 筛选器 → 写入变量 → 联动其他 Widget
  - ObjectList — 卡片式对象列表 + 属性高亮
  - AgentChat — 嵌入 Agent SSE 流式对话
  - AlertList — 告警列表 + 严重程度 + 未读计数
- **事件联动**: `{{variable}}` 模板替换 + `useWorkshopEvents` 跨 Widget 变量通信
- 大屏交互: 自动刷新倒计时 + 全屏模式 + per-widget Skeleton + 入场动画

### 图谱探索 (Object Graph Explorer)

- 径向层次布局 + 力导向布局 (大规模图 N≥300 网格加速)
- 双击展开/折叠 + 类型过滤 + 控制面板
- **图内搜索**: 匹配高亮 + 不匹配半透明 (debounced)
- **面包屑导航**: 探索路径可视化 + 点击跳转
- **右键菜单**: 展开/折叠、查看详情、聚焦节点
- 自定义节点 (色带 + 属性展示 + badge + loading)

### Dashboard 数据洞察

- Recharts PieChart / 环形图 (Donut) + 中心总数
- 动画 StatCard (countUp) + sparkline
- 活动 Timeline + hover 浮起 + staggered 入场动画

### 安全治理 (Security & Governance)

- **RBAC 三角色**: admin (全权限) / editor (读写) / viewer (只读 + AI 对话)
- 首用户自动成为 admin
- 前端按角色隐藏创建按钮 + 403 统一提示 + 顶栏角色 Tag
- **操作审计**: 全操作审计日志 (登录/创建/删除/执行/角色变更)
- **用户管理**: admin 管理用户列表 / 修改角色 / 启停用户

### 国际化 & 主题

- 中英双语 (i18n) + 全中文文档
- Edge 风格主题系统 (system/light/dark)

## 运维参考

| 操作 | 命令 |
|------|------|
| 启动后端 | `cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` |
| 启动前端 | `cd frontend && npm run dev` |
| 查看后端进程 | `pgrep -af uvicorn` |
| 查看前端进程 | `pgrep -af vite` |
| 后端日志写文件 | `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 2>&1 \| tee backend.log` |

### AIP Studio / LLM 超时

若在 AIP Studio 对话中看到 **"LLM call failed: Request timed out"**：

1. **确认 LLM 配置**: AIP Studio → LLM Providers 中检查 Base URL、API Key、默认模型
2. **加大超时**: 在 `backend/.env` 中设置 `LLM_TIMEOUT=300`（秒），重启后端
3. **网络**: 配置 HTTP 代理或改用本地/内网 LLM 服务

## API 参考

访问 http://localhost:8000/docs 查看完整交互式 API 文档。

## 案例与路线图

- [CASES.md](CASES.md) — 六大千万级案例深度分析 & OntoForge 对标
- [ROADMAP.md](ROADMAP.md) — V1.0 开发路线图 (Phase 0-6 全部完成)
- [demo/DEMO.md](demo/DEMO.md) — 制造业供应链演示指南

## 差异化定位

| 定位 | 说明 |
|------|------|
| **开源免费** | Palantir 年费 $10M+，中小企业用不起 |
| **国产化适配** | 适配国产数据库 (达梦、OceanBase)、国产 LLM (通义千问、DeepSeek) |
| **私有部署** | 数据不出企业，满足合规要求 |
| **中文优先** | 全中文文档、中文 NL Query 优化、中英双语 UI |
| **快速交付** | 行业模板 + 一键 Demo，1 天完成 PoC |
