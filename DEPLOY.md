# OntoForge 部署与运维手册

## 目录

- [1. 环境要求](#1-环境要求)
- [2. 首次部署](#2-首次部署)
- [3. 服务管理](#3-服务管理)
- [4. 配置说明](#4-配置说明)
- [5. 代码更新与发布](#5-代码更新与发布)
- [6. 演示数据初始化](#6-演示数据初始化)
- [7. 数据备份与恢复](#7-数据备份与恢复)
- [8. 日志与监控](#8-日志与监控)
- [9. 常见问题排查](#9-常见问题排查)
- [10. 安全加固](#10-安全加固)

---

## 1. 环境要求

### 服务器

| 项目 | 最低要求 | 推荐配置 |
|------|----------|----------|
| OS | CentOS 7+ / Ubuntu 20.04+ | CentOS 7+ |
| CPU | 2 核 | 4 核+ |
| 内存 | 4 GB | 8 GB+ |
| 磁盘 | 20 GB 可用 | 50 GB+ |
| Docker | 20.10+ | 26.x |
| Docker Compose | v2.0+ | v2.27+ |

### 网络

| 端口 | 服务 | 说明 |
|------|------|------|
| 5173 | 前端 (Vite) | 用户访问入口 |
| 8000 | 后端 (FastAPI) | API 服务 + Swagger 文档 |
| 5432 | PostgreSQL | 仅容器内部通信，可不对外暴露 |
| 6379 | Redis | 仅容器内部通信，可不对外暴露 |

### 当前部署信息

| 项目 | 值 |
|------|------|
| 服务器 IP | `10.201.0.202` |
| 项目路径 | `/root/ontoforge` |
| 前端地址 | http://10.201.0.202:5173 |
| 后端 API | http://10.201.0.202:8000 |
| API 文档 | http://10.201.0.202:8000/docs |

---

## 2. 首次部署

### 2.1 Docker 镜像源配置

国内服务器通常无法直接访问 Docker Hub，需要配置镜像加速器。

```bash
# 编辑 Docker 配置
cat > /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io"
  ]
}
EOF

# 重启 Docker 使配置生效
systemctl restart docker

# 验证
docker info | grep -A5 "Registry Mirrors"
```

> **备选镜像源**（按可用性择一）：
> - `https://docker.m.daocloud.io` — DaoCloud（当前在用）
> - `https://docker.1panel.live` — 1Panel
> - `https://registry.cn-hangzhou.aliyuncs.com` — 阿里云

### 2.2 上传代码

从开发机同步代码到服务器（排除不需要的目录）：

```bash
rsync -avz --progress \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='__pycache__' \
  --exclude='.venv' \
  --exclude='*.pyc' \
  --exclude='frontend/dist' \
  -e "ssh" \
  . root@10.201.0.202:/root/ontoforge/
```

### 2.3 构建并启动

```bash
ssh root@10.201.0.202
cd /root/ontoforge

# 构建镜像
docker compose build

# 启动所有服务（后台运行）
docker compose up -d
```

首次启动时前端容器会自动执行 `npm install`（约 20-30 秒），请等待安装完成后再访问。

### 2.4 验证部署

```bash
# 检查容器状态（4 个服务均应为 Up）
docker compose ps

# 健康检查
curl http://localhost:8000/health
# 期望: {"status":"ok","version":"0.1.0"}

# 前端页面
curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/
# 期望: 200

# API 代理（未登录返回 401 是正常的）
curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/api/v1/ontology/object-types
# 期望: 401
```

---

## 3. 服务管理

### 3.1 日常操作

```bash
cd /root/ontoforge

# 查看所有服务状态
docker compose ps

# 启动所有服务
docker compose up -d

# 停止所有服务（保留数据）
docker compose down

# 重启单个服务
docker compose restart backend
docker compose restart frontend

# 查看日志（实时跟踪）
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres

# 查看最近 100 行日志
docker compose logs --tail 100 backend
```

### 3.2 服务架构

```
                      ┌─────────────────────────────────────────┐
                      │            Docker Network               │
 用户浏览器            │                                         │
    │                 │  ┌──────────┐       ┌──────────┐       │
    │  :5173          │  │ frontend │──/api→│ backend  │       │
    ├────────────────►│  │  (Vite)  │ proxy │ (FastAPI)│       │
    │                 │  └──────────┘       └────┬─────┘       │
    │  :8000          │                          │              │
    ├────────────────►│  ┌──────────┐       ┌────┴─────┐       │
    │ (API 直连)       │  │  redis   │       │ postgres │       │
                      │  │  :6379   │       │  :5432   │       │
                      │  └──────────┘       └──────────┘       │
                      └─────────────────────────────────────────┘
```

- **前端** 通过 Vite 内置代理将 `/api/*` 转发到后端容器
- **后端** 通过 Docker 内网连接 PostgreSQL 和 Redis
- 用户可以直接访问 `:5173`（前端+API 代理）或 `:8000`（仅 API）

---

## 4. 配置说明

### 4.1 环境变量

后端支持通过环境变量或 `.env` 文件配置。优先级：环境变量 > `.env` 文件 > 代码默认值。

在服务器上创建 `/root/ontoforge/backend/.env`：

```bash
cat > /root/ontoforge/backend/.env << 'EOF'
# === 安全相关（生产环境必须修改）===
SECRET_KEY=your-random-secret-key-at-least-32-chars
ENCRYPTION_KEY=your-aes-encryption-key-32bytes!

# === 数据库（Docker Compose 已通过环境变量设置，此处无需重复）===
# DATABASE_URL=postgresql+asyncpg://ontoforge:ontoforge@postgres:5432/ontoforge

# === LLM 配置 ===
OPENAI_API_KEY=sk-your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
DEFAULT_LLM_MODEL=gpt-4o-mini
LLM_TIMEOUT=120

# === 其他 ===
DEBUG=false
EOF
```

### 4.2 全部配置项

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SECRET_KEY` | `ontoforge-dev-secret-key-...` | JWT 签名密钥，**生产必改** |
| `ENCRYPTION_KEY` | `ontoforge-encryption-key-...` | AES 加密密钥（保护数据源密码、API Key），**生产必改** |
| `DATABASE_URL` | `sqlite+aiosqlite:///./ontoforge.db` | 数据库连接串（Docker 中已覆盖为 PostgreSQL） |
| `REDIS_URL` | 空 | Redis 连接串（Docker 中已覆盖） |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `720` | JWT Token 有效期（分钟） |
| `OPENAI_API_KEY` | 空 | LLM API Key（也可通过 UI 中 LLM Providers 配置） |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | LLM API 地址 |
| `DEFAULT_LLM_MODEL` | `gpt-4o-mini` | 默认 LLM 模型 |
| `LLM_TIMEOUT` | `120` | LLM 请求超时（秒） |
| `DEBUG` | `true` | 调试模式 |

### 4.3 Docker Compose 环境变量

`docker-compose.yml` 中已为各服务预设了环境变量：

| 服务 | 变量 | 值 |
|------|------|------|
| postgres | `POSTGRES_USER` | `ontoforge` |
| postgres | `POSTGRES_PASSWORD` | `ontoforge` |
| postgres | `POSTGRES_DB` | `ontoforge` |
| backend | `DATABASE_URL` | `postgresql+asyncpg://ontoforge:ontoforge@postgres:5432/ontoforge` |
| backend | `REDIS_URL` | `redis://redis:6379/0` |
| frontend | `VITE_API_TARGET` | `http://backend:8000` |

如需修改 PostgreSQL 密码，需同时修改 `postgres` 和 `backend` 服务的环境变量。

---

## 5. 代码更新与发布

### 5.1 常规更新流程

在开发机上完成代码修改后：

```bash
# 1. 同步代码到服务器
rsync -avz --progress \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='__pycache__' \
  --exclude='.venv' \
  --exclude='*.pyc' \
  --exclude='frontend/dist' \
  -e "ssh" \
  . root@10.201.0.202:/root/ontoforge/

# 2. SSH 到服务器
ssh root@10.201.0.202
cd /root/ontoforge
```

### 5.2 按修改范围选择重启方式

**仅修改了前端代码** (`.tsx`, `.ts`, `.css`)：

```bash
# Vite HMR 会自动热重载，无需操作
# 如果 HMR 失效，手动重启前端：
docker compose restart frontend
```

**仅修改了后端代码** (`.py`)：

```bash
# uvicorn --reload 会自动重载，无需操作
# 如果自动重载失效：
docker compose restart backend
```

**修改了后端依赖** (`requirements.txt`)：

```bash
docker compose build backend
docker compose up -d backend
```

**修改了前端依赖** (`package.json`)：

```bash
# 删除旧的 node_modules 卷并重建
docker compose down frontend
docker volume ls | grep node_modules  # 找到匿名卷名称
docker volume rm <volume_name>        # 删除旧卷
docker compose build frontend
docker compose up -d frontend
```

**修改了 Docker 配置** (`Dockerfile`, `docker-compose.yml`)：

```bash
docker compose down
docker compose build
docker compose up -d
```

### 5.3 一键更新脚本

在开发机的项目根目录保存此脚本：

```bash
#!/bin/bash
# deploy.sh — 一键部署到远程服务器
SERVER="root@10.201.0.202"
REMOTE_DIR="/root/ontoforge"

echo ">>> 同步代码..."
rsync -avz --progress \
  --exclude='.git' --exclude='node_modules' \
  --exclude='__pycache__' --exclude='.venv' \
  --exclude='*.pyc' --exclude='frontend/dist' \
  -e "ssh" . ${SERVER}:${REMOTE_DIR}/

echo ">>> 重建并重启服务..."
ssh ${SERVER} "cd ${REMOTE_DIR} && docker compose build && docker compose up -d"

echo ">>> 检查状态..."
ssh ${SERVER} "cd ${REMOTE_DIR} && docker compose ps && curl -s http://localhost:8000/health"

echo ">>> 部署完成！"
```

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 6. 演示数据初始化

### 6.1 生成 CSV 数据

```bash
cd /root/ontoforge/demo
python3 generate_data.py
```

生成 7 个 CSV 文件：`suppliers.csv`, `parts.csv`, `plants.csv`, `warehouses.csv`, `purchase_orders.csv`, `quality_inspections.csv`, `deliveries.csv`。

### 6.2 执行 Demo 部署脚本

```bash
cd /root/ontoforge/demo
bash setup_demo.sh
```

该脚本会通过 API 自动创建：
- 7 种实体类型 + 8 种关联类型 + 6 种操作类型
- 335 个对象实例 + ~600 条关联
- 3 条告警规则 + 3 个 Agent
- 2 个 Workshop 应用（供应链监控大屏 + 物流追踪看板）
- 3 篇知识库文档

### 6.3 清空重做

`setup_demo.sh` 开头包含清理逻辑，重新执行即可清空并重建所有 Demo 数据。

---

## 7. 数据备份与恢复

### 7.1 数据库备份

```bash
# 备份 PostgreSQL 数据
docker compose exec postgres pg_dump -U ontoforge ontoforge > backup_$(date +%Y%m%d_%H%M%S).sql

# 压缩备份
docker compose exec postgres pg_dump -U ontoforge ontoforge | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### 7.2 数据库恢复

```bash
# 从 SQL 文件恢复
cat backup_20260317.sql | docker compose exec -T postgres psql -U ontoforge ontoforge

# 从压缩文件恢复
gunzip -c backup_20260317.sql.gz | docker compose exec -T postgres psql -U ontoforge ontoforge
```

### 7.3 定时备份（crontab）

```bash
crontab -e
```

添加每日凌晨 2 点自动备份：

```cron
0 2 * * * cd /root/ontoforge && docker compose exec -T postgres pg_dump -U ontoforge ontoforge | gzip > /root/backups/ontoforge_$(date +\%Y\%m\%d).sql.gz 2>/dev/null
```

确保备份目录存在：

```bash
mkdir -p /root/backups
```

### 7.4 Docker 卷备份

```bash
# 备份整个 PostgreSQL 数据卷
docker run --rm -v ontoforge_pgdata:/data -v /root/backups:/backup alpine \
  tar czf /backup/pgdata_$(date +%Y%m%d).tar.gz -C /data .

# 恢复数据卷
docker compose down
docker run --rm -v ontoforge_pgdata:/data -v /root/backups:/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/pgdata_20260317.tar.gz -C /data"
docker compose up -d
```

---

## 8. 日志与监控

### 8.1 查看日志

```bash
# 所有服务的实时日志
docker compose logs -f

# 单个服务的日志
docker compose logs -f backend --since 1h    # 最近 1 小时
docker compose logs backend --tail 200       # 最近 200 行

# 搜索错误
docker compose logs backend 2>&1 | grep -i error
```

### 8.2 容器资源监控

```bash
# 实时资源使用
docker stats --no-stream

# 输出示例：
# NAME                  CPU %   MEM USAGE / LIMIT   NET I/O
# ontoforge-backend-1   0.50%   120MiB / 31GiB      1.2MB / 500kB
# ontoforge-frontend-1  0.10%   80MiB / 31GiB       800kB / 1.5MB
# ontoforge-postgres-1  0.30%   50MiB / 31GiB       200kB / 100kB
# ontoforge-redis-1     0.05%   5MiB / 31GiB        50kB / 30kB
```

### 8.3 磁盘清理

```bash
# 查看 Docker 磁盘使用
docker system df

# 清理未使用的镜像、容器、网络
docker system prune -f

# 清理所有未使用的镜像（包括悬空镜像）
docker image prune -a -f

# 清理构建缓存
docker builder prune -f
```

---

## 9. 常见问题排查

### 9.1 Docker 拉取镜像失败

**现象**: `Get "https://xxx/v2/": dial tcp: lookup xxx: no such host`

**原因**: Docker 镜像源 DNS 不通。

**解决**:

```bash
# 测试当前镜像源是否可用
curl -s --connect-timeout 5 -o /dev/null -w '%{http_code}' https://docker.m.daocloud.io/v2/

# 如果返回 000，换一个镜像源：
cat > /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io"
  ]
}
EOF
systemctl restart docker
```

### 9.2 前端 `vite: not found`

**原因**: npm install 未成功执行。

**解决**:

```bash
# 方案 1: 重启容器（会自动重新 npm install）
docker compose restart frontend

# 方案 2: 进入容器手动安装
docker compose exec frontend sh -c "npm install && npx vite --host"

# 方案 3: 清除 node_modules 卷后重建
docker compose down frontend
docker volume rm $(docker volume ls -q | grep node_modules) 2>/dev/null
docker compose up -d frontend
```

### 9.3 后端连接 PostgreSQL 失败

**现象**: `connection refused` 或 `could not translate host name "postgres"`

**解决**:

```bash
# 检查 PostgreSQL 是否健康
docker compose ps postgres
# 状态应为 "Up (healthy)"

# 如果不健康，查看日志
docker compose logs postgres --tail 50

# 重启 PostgreSQL
docker compose restart postgres

# 等待健康后重启后端
sleep 10
docker compose restart backend
```

### 9.4 前端 API 请求返回 502 / 无响应

**原因**: Vite 代理无法连接后端。

**解决**:

```bash
# 确认后端正在运行
docker compose ps backend
curl http://localhost:8000/health

# 确认 VITE_API_TARGET 环境变量
docker compose exec frontend env | grep VITE

# 重启前端
docker compose restart frontend
```

### 9.5 LLM 对话超时

**现象**: AIP Studio 对话报 `"LLM call failed: Request timed out"`

**解决**:

1. 在 UI 的 **AIP Studio → LLM Providers** 中检查 Base URL、API Key
2. 增大超时时间：编辑 `/root/ontoforge/backend/.env`，设置 `LLM_TIMEOUT=300`
3. 重启后端：`docker compose restart backend`
4. 如果服务器无法访问外网 LLM，考虑部署本地模型（Ollama/vLLM）

### 9.6 磁盘空间不足

```bash
# 检查磁盘
df -h /

# 清理 Docker 构建缓存（可能占用大量空间）
docker builder prune -af
docker image prune -af
docker system prune -af --volumes
```

---

## 10. 安全加固

### 10.1 生产环境检查清单

- [ ] 修改 `SECRET_KEY` 为随机字符串（至少 32 字符）
- [ ] 修改 `ENCRYPTION_KEY` 为随机字符串（正好 32 字节）
- [ ] 修改 PostgreSQL 默认密码（`docker-compose.yml` 中 `POSTGRES_PASSWORD`）
- [ ] 关闭 `DEBUG` 模式（`.env` 中设置 `DEBUG=false`）
- [ ] 仅暴露 `:5173` 端口，关闭 `:8000`、`:5432`、`:6379` 的外部访问
- [ ] 配置防火墙规则限制访问 IP
- [ ] 启用 HTTPS（前置 Nginx 反向代理 + SSL 证书）
- [ ] 定期备份数据库
- [ ] 修改服务器 SSH 端口 + 禁用密码登录

### 10.2 仅暴露必要端口

修改 `docker-compose.yml`，将内部服务端口绑定到 `127.0.0.1`：

```yaml
services:
  postgres:
    ports:
      - "127.0.0.1:5432:5432"   # 仅本机可访问
  redis:
    ports:
      - "127.0.0.1:6379:6379"   # 仅本机可访问
  backend:
    ports:
      - "127.0.0.1:8000:8000"   # 通过前端代理访问，无需对外
```

### 10.3 Nginx 反向代理 + HTTPS

如需 HTTPS 和域名访问，在宿主机安装 Nginx：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;
    }

    location /api/v1/aip/chat/stream {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 600s;
    }
}
```

> SSE 流式对话接口 (`/api/v1/aip/chat/stream`) 需要关闭 Nginx 缓冲。

### 10.4 生成安全密钥

```bash
# 生成 SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(48))"

# 生成 ENCRYPTION_KEY（32 字节）
python3 -c "import secrets; print(secrets.token_urlsafe(24)[:32])"
```

---

## 附录

### A. 文件结构

```
ontoforge/
├── docker-compose.yml          # Docker 编排配置
├── backend/
│   ├── Dockerfile              # 后端镜像构建
│   ├── requirements.txt        # Python 依赖
│   ├── .env                    # 环境变量（需手动创建）
│   └── app/
│       ├── main.py             # FastAPI 入口
│       ├── config.py           # 配置读取
│       ├── database.py         # 数据库引擎
│       ├── api/v1/             # API 路由
│       ├── models/             # SQLAlchemy 模型
│       ├── schemas/            # Pydantic 模型
│       └── services/           # 业务逻辑
├── frontend/
│   ├── Dockerfile              # 前端镜像构建
│   ├── package.json            # Node.js 依赖
│   ├── vite.config.ts          # Vite 配置（含 API 代理）
│   └── src/                    # React 源码
├── demo/
│   ├── generate_data.py        # 演示数据生成器
│   ├── setup_demo.sh           # 一键部署演示数据
│   ├── DEMO.md                 # 演示操作指南
│   └── *.csv                   # 生成的 CSV 数据文件
├── DEPLOY.md                   # 本文档
├── README.md                   # 项目说明
├── CASES.md                    # 案例分析
└── ROADMAP.md                  # 开发路线图
```

### B. 默认账户

| 角色 | 用户名 | 密码 | 权限 |
|------|--------|------|------|
| admin | admin | admin123 | 全部权限 + 用户管理 + 审计日志 |
| editor | editor | editor123 | 读写（CRUD 本体/数据/应用） |
| viewer | viewer | viewer123 | 只读 + AI 对话 + Workshop 查看 |

> 首次注册的用户自动成为 admin。Demo 脚本会自动创建以上三个账户。

### C. 快速命令速查

```bash
# ─── 服务管理 ───
docker compose up -d              # 启动
docker compose down               # 停止
docker compose restart backend    # 重启后端
docker compose ps                 # 查看状态
docker compose logs -f backend    # 跟踪日志

# ─── 更新代码 ───
rsync -avz --exclude='.git' --exclude='node_modules' \
  --exclude='__pycache__' -e ssh . root@10.201.0.202:/root/ontoforge/
ssh root@10.201.0.202 "cd /root/ontoforge && docker compose restart backend"

# ─── 数据备份 ───
docker compose exec postgres pg_dump -U ontoforge ontoforge > backup.sql

# ─── 进入容器 ───
docker compose exec backend bash
docker compose exec frontend sh
docker compose exec postgres psql -U ontoforge

# ─── 清理空间 ───
docker system prune -af
docker builder prune -af
```
