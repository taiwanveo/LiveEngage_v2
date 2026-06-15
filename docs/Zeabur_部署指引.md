# Zeabur 部署指引

> **五大服務分工**（各負責什麼）→ [服務架構.md](./服務架構.md)

## 正確架構（勿搞錯）

LiveEngage 是 **monorepo**（單一 repo 多目錄），不能直接把 repo 根目錄當靜態站上線。

| 錯誤做法 | 結果 |
|---------|------|
| GitHub → 選整個 repo、Root Directory = `/`、無 Dockerfile | Zeabur 用 Caddy 把整包原始碼當靜態檔，**不是 API** |

| 正確做法 | 說明 |
|---------|------|
| **後端 API** | Docker 服務，使用 repo 根目錄的 `Dockerfile`（`COPY backend/...`） |
| **前端**（第二階段） | 各 app 獨立 Static Site，Root Directory 設為對應子目錄 |

## 目前已部署（2026-06-15）

| 服務 | 網址 | Dockerfile / 目錄 |
|------|------|-------------------|
| **api** | https://le-api.zeabur.app | 根目錄 `Dockerfile` |
| **host** | https://le-host.zeabur.app | `frontend/Dockerfile.host` |
| **participant** | https://le-participant.zeabur.app | `frontend/Dockerfile.participant` |
| **admin** | https://le-admin.zeabur.app | `frontend/Dockerfile.admin` |
| **worker** | （無公開網域） | 根目錄 `Dockerfile.worker` — Celery 匯出 Worker |

> **大螢幕投影**已整合在 **Host**（`#/rooms/…/present` 同源路由），不再部署獨立 Present 靜態站。

Worker 需與 **api** 相同的核心 env：`LE_DATABASE_URL`、`LE_DATABASE_URL_SYNC`、`LE_REDIS_URL`、`LE_JWT_SECRET`、`LE_ENV=production`。建議另設 `LE_CELERY_TASK_ALWAYS_EAGER=false`。

| 項目 | 值 |
|------|-----|
| Zeabur 專案 | [liveengage](https://zeabur.com/projects/6a2d1bc82871baed5fc633ef?envID=6a2d1bc9cf558888ca4bc9da) |
| GitHub | `ColdRighter/LiveEngage`，分支 **`master`**（各服務連動，push 自動 redeploy） |
| Repo ID | `1267983204` |

前端 Docker 建置會安裝 `packages/renderers`、`packages/realtime`（admin 僅 realtime）依賴，並以 `VITE_API_BASE=https://le-api.zeabur.app` 編譯。

舊服務 `liveengage`、`liveengage-api`、`present`（`le-present`）已刪除或停用；若 Dashboard 仍顯示殘留項目，請手動刪除以免混淆。

## Dashboard 手動部署（推薦）

1. **Add Service → GitHub** → `ColdRighter/LiveEngage`，分支 **`master`**
2. 服務名稱：`api`（或 `liveengage-api`）
3. **不要**選 Static Site；應偵測為 **Dockerfile** 建置
4. Root Directory：留空 `/`（使用 repo 根目錄的 `Dockerfile`）
5. **Settings → Variables** 設定：

| 變數 | 說明 |
|------|------|
| `LE_DATABASE_URL` | Neon **async Pooler** DSN（主機名含 `-pooler`，`?ssl=require`） |
| `LE_DATABASE_URL_SYNC` | Neon sync DSN（migration；可用 pooler 或 direct） |
| `LE_REDIS_URL` | Upstash `rediss://...`（建議與 API 同區域） |
| `LE_JWT_SECRET` | 生產用強隨機密鑰（勿用 dev 值） |
| `LE_ENV` | `production` |

6. **Networking → Port**：HTTP `8000`（id: `web`）
7. **Networking → Generate Domain**（例如 `le-api.zeabur.app`）

`Dockerfile` 啟動時會執行 `alembic upgrade head` 再跑 `uvicorn`。

## Zeabur MCP / CLI

- **MCP**（`user-zeabur`）：可用 `deploy-from-specification`、`create-service`、`add-domain` 等
- **CLI**：`npx zeabur project list`、`npx zeabur service list --project-id <id>`

MCP 部署 Dockerfile 路徑若報 `path not found`，可改傳 `dockerfile.content`（內容需 `COPY backend/...`）。

## 前端（四個 app 已部署）

各 app 為獨立 Zeabur 服務；生產環境以 `VITE_API_BASE` 指向 API，無需反向代理。

| App | Dockerfile | 網域前綴 |
|-----|------------|----------|
| Host | `frontend/Dockerfile.host` | `le-host`（含投影路由） |
| Participant | `frontend/Dockerfile.participant` | `le-participant` |
| Admin | `frontend/Dockerfile.admin` | `le-admin` |

MCP 部署時 `ref` 請用 `master`（勿寫 `refs/heads/master`，會重複前綴導致 clone 失敗）。

## 常見問題

- **build 失敗 `COPY app: not found`**：build context 是 repo 根目錄，需用根目錄 `Dockerfile`（含 `COPY backend/app`），或 Dashboard 設 Root Directory = `backend` 並用 `backend/Dockerfile`。
- **服務 SUSPENDED**：免費方案可能暫停舊服務；刪除後建新服務，或於 Dashboard 恢復。
- **網域被占用**：同一 subdomain 不能綁兩個服務，換前綴或刪舊服務的 domain。

## 效能與延遲（生產必讀）

| 項目 | 建議 |
|------|------|
| **Neon 區域** | 選 **Asia Pacific（東京 ap-northeast-1）** 或鄰近區，與 Zeabur（首爾）同區可降低 RTT |
| **連線方式** | `LE_DATABASE_URL` 一律用 **Pooler** URL（`-pooler` 主機名），勿用 direct |
| **Redis** | Upstash 區域盡量與 API 一致 |
| **控場延遲** | Host 已改為 mutation 樂觀更新 + reveal 附帶 `results` 快照，避免每次動作 4～6 次 GET |

Neon Console → Connection details → **Pooled connection** → 複製 async（asyncpg）與 sync（psycopg）字串至 Zeabur api / worker env。
