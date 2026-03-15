# OntoForge

Open-source data operations platform with **Ontology**, **Data Integration**, and **AI** capabilities. Inspired by Palantir Foundry.

## Architecture

- **Backend**: Python 3.12 + FastAPI + SQLAlchemy + PostgreSQL
- **Frontend**: React 18 + TypeScript + Ant Design + React Flow
- **AI**: OpenAI-compatible LLM integration

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local frontend development)
- Python 3.12+ (for local backend development)

### Using Docker Compose

```bash
docker compose up -d
```

This starts PostgreSQL, Redis, backend (port 8000), and frontend (port 5173).

### Local Development

**Backend:**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

### 运行与运维

| 操作 | 命令 |
|------|------|
| 启动后端 | `cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` |
| 启动前端 | `cd frontend && npm run dev` |
| 查看后端进程 | `pgrep -af uvicorn` 或 `ps aux` 后筛选 uvicorn |
| 查看前端进程 | `pgrep -af vite` 或 `ps aux` 后筛选 vite/node |
| 查看后端日志 | 前台运行时日志在启动终端；可重定向到文件再 `tail -f`；nohup 时 `tail -f nohup.out` |
| 查看前端日志 | 前台运行时在启动终端；构建：`npm run build` 输出在终端 |

后端/前端以前台方式运行时，日志直接打在启动该命令的终端。需要保留日志时可重定向，例如：

```bash
# 后端日志写入文件（仍可 --reload）
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 2>&1 | tee backend.log
```

### Access

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### AIP Studio / LLM 超时

若在 AIP Studio 对话中看到 **"LLM call failed: Request timed out"**：

1. **确认 LLM 配置**：在 AIP Studio → LLM Providers 中检查 Base URL、API Key、默认模型是否正确；若使用代理或自建服务，确保 Base URL 可从运行后端的机器访问。
2. **加大超时**：后端默认 LLM 请求超时为 120 秒。可在 `backend/.env` 中设置 `LLM_TIMEOUT=300`（单位：秒），或通过环境变量 `LLM_TIMEOUT` 传入，然后重启后端。
3. **网络**：若访问外网 API（如 OpenAI）受限，可配置 HTTP 代理或改用本地/内网可用的 LLM 服务地址。

## Core Features

### Ontology Engine
- Define Object Types with typed properties
- Create Link Types to model relationships
- Visual graph editor (React Flow)
- Full-text search across object instances

### Data Integration
- Data source connectors: CSV upload, PostgreSQL, REST API
- Visual pipeline builder with field mapping
- Transform operations: rename, filter, drop, fill, cast
- Pipeline execution with run history

### AI Platform (AIP)
- Multi-provider LLM management (OpenAI, Anthropic, local)
- AI Agent Studio with ontology tool access
- AIP Functions (LLM-backed no-code functions)
- Natural language query over ontology data
- Conversation history

## API Reference

See http://localhost:8000/docs for the full interactive API documentation.
