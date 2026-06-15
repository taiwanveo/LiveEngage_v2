# LiveEngage（即時互動通）

Slido 類即時互動平台。Host 建活動 → 參與者掃 QR 免登入加入 → Q&A / 投票即時互動 → 大螢幕展示 → 活動後分析匯出。

> 規格權威：[references/](./references/)（PRD / SRS / SDS）。  
> 開發指引：[docs/](./docs/)。**五大服務分工**：[docs/服務架構.md](./docs/服務架構.md)。  
> Agent 入口：[AGENTS.md](./AGENTS.md)。

## 部署架構（Zeabur 五大服務）

| 服務 | 用途 |
|------|------|
| **api** | 後端 REST + WebSocket（唯一對外 API） |
| **host** | 主持人／助理主持人控場與投影 |
| **participant** | 參與者加入與作答 |
| **admin** | 組織管理、匯出、稽核 |
| **worker** | Celery 背景匯出（無公開網域） |

詳見 [docs/服務架構.md](./docs/服務架構.md) 與 [docs/Zeabur_部署指引.md](./docs/Zeabur_部署指引.md)。

## 目前進度

Monorepo 已含完整前後端與 Zeabur 五服務部署；細節與近期變更見 [DEVNOTE.md](./DEVNOTE.md)。

## 技術棧（後端）

Python 3.14、FastAPI、SQLAlchemy 2.0（async）、Alembic、PostgreSQL 16、Redis 7。

## 本地啟動

### 1. 起依賴服務（PostgreSQL + Redis）

```bash
docker compose up -d
```

### 2. 建立 Python 環境並安裝依賴

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
# macOS / Linux
# source .venv/bin/activate
pip install -e ".[dev]"
```

### 3. 設定環境變數

```bash
# 於專案根目錄
cp .env.example .env   # Windows: copy .env.example .env
```

### 4. 套用資料庫 migration

```bash
cd backend
alembic upgrade head
```

> 無 DB 時可離線檢視將執行的 DDL：`alembic upgrade head --sql`

### 5. 啟動 API

```bash
cd backend
uvicorn app.main:app --reload
```

- 健康檢查：`GET http://localhost:8000/health`
- 就緒檢查（含 DB 連線）：`GET http://localhost:8000/ready`
- OpenAPI 文件：`http://localhost:8000/docs`

## 測試與品質

```bash
cd backend
ruff check .
mypy app
pytest
```

需要實機 PG 的 migration 套用測試會在未設定 `LE_DATABASE_URL` 或 DB 不可連線時自動跳過。
