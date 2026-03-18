# OntoForge 对标 Palantir Foundry 深度调研分析（备份）

- 文档日期：2026-03-18
- 调研范围：Palantir Foundry 官方文档体系（Ontology / Actions / AIP / Security / Branches / Pipeline）+ 当前仓库代码扫描
- 仓库版本：`main` 分支，已包含近期安全与性能修复提交

## 1. 执行摘要

当前 OntoForge 已具备“可用产品雏形”：本体建模、数据集成、Agent 工具调用、低代码应用、基础审计与 RBAC 均已落地。  
但如果目标是接近 Foundry 的企业级能力（多团队治理、高合规、安全分级、可控 AI、规模化数据处理），核心差距仍集中在：

1. 安全治理边界（默认配置安全、数据级权限、租户隔离）
2. 运行时扩展能力（大数据管道执行、调度 HA、多副本一致性）
3. AI 治理闭环（Evals、观测、版本化发布与回滚）

综合判断：当前能力约在 Foundry 对标带的 **45%-55%（部门级 PoC+/早期产品化）**。

---

## 2. 方法与输入

### 2.1 代码扫描

- 后端核心模块：`backend/app/api/v1/*`、`backend/app/services/*`、`backend/app/models/*`
- 前端性能路径：`frontend/src/App.tsx`、`frontend/vite.config.ts`
- 测试与稳定性：`backend/tests/*`

### 2.2 运行验证

- 在 `backend` 虚拟环境执行：`pytest -q`
- 结果：`10 passed`

### 2.3 对标维度

按 Foundry 常见能力带对齐：

- Ontology（对象/关系/动作/生命周期）
- AIP（Agent / Logic / Functions / Evals / Observability）
- Security & Governance（RBAC + 数据级控制 + 审计）
- Data Pipelines（连接、转换、调度、血缘、规模化）
- 变更管理（Branch/Proposal/审批发布）

---

## 3. 现状能力盘点（项目内）

## 3.1 已具备能力（优势）

1. **本体与动作闭环基础完整**
   - Object/Link/Action API 完整，支持执行与审计。
2. **AIP 可用**
   - 多工具调用、流式对话、会话持久化、函数执行。
   - 会话已按 `user_id` 做隔离查询。
3. **安全能力已较此前显著提升**
   - 写操作 RBAC 强化（editor/admin）。
   - 敏感配置加密（LLM Key、数据源连接字段）。
   - REST URL SSRF 基础校验（禁私网地址，debug 可放开）。
4. **性能已做首轮优化**
   - Workshop 列表与图谱邻居查询 N+1 改善。
   - 前端路由懒加载 + Vite 手工分包已上线。
5. **工程化基本可维护**
   - 测试框架到位，现有安全相关测试可通过。

---

## 4. 关键问题清单（按优先级）

## P0（必须优先）

1. **生产默认安全风险**
   - `DEBUG` 默认开启且关键密钥存在开发回退路径。
   - 参考：`backend/app/config.py:13`, `backend/app/config.py:40`, `backend/app/config.py:47`
   - 风险：误部署到生产时安全边界被削弱。

2. **访问控制粒度仍偏粗**
   - 多数查询端点只要求“已登录”，缺少 workspace/tenant/object-set 级数据边界。
   - 参考：`backend/app/api/v1/instances.py:27`, `backend/app/api/v1/pipelines.py:20`, `backend/app/api/v1/alerts.py:106`
   - 风险：多团队或多业务线并存时产生横向可见性过大问题。

3. **注册入口缺少治理开关**
   - `/auth/register` 直接开放，无邀请制/注册开关/速率限制。
   - 参考：`backend/app/api/v1/auth.py:17`
   - 风险：公开环境可被批量注册与撞库。

## P1（高价值，建议紧跟）

4. **告警未读状态是全局态，不是“用户态”**
   - `alerts` 表无 `user_id`，`mark-all-read` 会影响所有人。
   - 参考：`backend/app/models/alert.py:25`, `backend/app/api/v1/alerts.py:148`
   - 风险：多用户协作体验与审计语义不准确。

5. **管道执行在大数据量下扩展性有限**
   - 全量 DataFrame 拉取 + `iterrows()` 行级处理，内存/CPU 压力较大。
   - 参考：`backend/app/services/pipeline_executor.py:83`, `backend/app/services/pipeline_executor.py:135`
   - CSV 上传同样是整文件入内存。
   - 参考：`backend/app/services/data_integration_service.py:198`

6. **调度器为进程内模型，不适合多副本 HA**
   - APScheduler in-process，若后端多副本可能重复调度。
   - 参考：`backend/app/services/scheduler.py:17`, `backend/app/services/scheduler.py:71`

## P2（中期演进）

7. **Schema 管理策略偏“运行时修补”**
   - 启动执行 `create_all` + compatibility DDL，长期不利于严谨变更治理。
   - 参考：`backend/app/main.py:20`, `backend/app/database.py:32`

8. **AIP 治理闭环未完整**
   - 当前有 Agent/Function/tool-calling，但缺少体系化 Evals、质量门禁、线上观测。

---

## 5. 与 Foundry 的能力差距映射

1. **Ontology 治理深度**
   - 现状：模型与动作可用。
   - 差距：缺少企业级 lifecycle（提案/审批/分支发布）、细粒度访问策略。

2. **AIP 工程化闭环**
   - 现状：能用 Agent 做查询与执行。
   - 差距：缺少 Evals 基线、版本对比、上线门禁、可观测追踪。

3. **Security from RBAC to Data Policy**
   - 现状：角色级控制（admin/editor/viewer）。
   - 差距：行列级/对象级/标签化（marking）数据策略仍未落地。

4. **Scale & Operations**
   - 现状：单体服务可跑通 demo 与中小规模业务。
   - 差距：批流一体、分布式调度、弹性扩缩、长链路稳定性治理尚在早期。

---

## 6. 建议落地路线（分阶段）

## 阶段 A（1-2 周，安全基线）

1. 强制生产 `DEBUG=False`，禁止密钥回退。
2. 增加 `ALLOW_PUBLIC_REGISTRATION` 开关（默认 false）。
3. 增加登录/注册速率限制与基础防爆破策略。
4. 补充安全相关测试：配置误用、开放注册、越权读取。

## 阶段 B（2-4 周，数据级治理）

1. 引入 workspace/tenant 字段并在核心实体传播。
2. 核心查询默认注入租户过滤。
3. 告警改为“用户可见性模型”（`user_id` 或 inbox 映射表）。
4. 增加对象集合（object set）与策略层。

## 阶段 C（2-4 周，性能与可用性）

1. 管道处理改为 chunk/batch（避免全量 DataFrame + iterrows）。
2. 调度器外置（如 Celery beat/Temporal/任务队列）以支持多副本。
3. 增加关键指标观测：吞吐、失败率、P95、重试、死信。

## 阶段 D（持续，AIP 治理闭环）

1. 引入 AIP Eval 数据集与回归评测流程。
2. Prompt/Tool 版本化与发布门禁。
3. 统一 trace + audit 关联，支持“会话到动作”的可追溯链路。

---

## 7. 结论

OntoForge 目前已经跨过“纯原型阶段”，并完成了一轮有价值的安全/性能修复，适合继续推进到“可商用试点”。  
若要向 Foundry 级别靠近，下一阶段必须从“功能覆盖”转向“治理深度 + 运行规模 + AI 可控”三条主线并行建设。

---

## 8. 参考链接（调研输入）

以下为本次对标分析使用的 Foundry 官方文档入口（建议后续做逐条二次核对与内部摘录）：

- https://www.palantir.com/docs/foundry/ontology/overview/
- https://www.palantir.com/docs/foundry/ontology/object-types-overview/
- https://www.palantir.com/docs/foundry/ontology/actions/overview/
- https://www.palantir.com/docs/foundry/aip/agent-studio/overview/
- https://www.palantir.com/docs/foundry/aip/logic/overview/
- https://www.palantir.com/docs/foundry/aip/functions/overview/
- https://www.palantir.com/docs/foundry/aip/evaluations/overview/
- https://www.palantir.com/docs/foundry/ontology/security/markings/
- https://www.palantir.com/docs/foundry/enterprise-branches/branches-overview/
- https://www.palantir.com/docs/foundry/building-pipelines/pipeline-builder-overview/
