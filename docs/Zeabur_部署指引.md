# Zeabur 部署指引

## 正確架構（勿搞錯）

LiveEngage 是 **monorepo**（單一 repo 多目錄），不能直接把 repo 根目錄當靜態站上線。

| 錯誤做法 | 結果 |
|---------|------|
| GitHub → 選整個 repo、Root Directory = `/`、無 Dockerfile | Zeabur 用 Caddy 把整包原始碼當靜態檔，**不是 API** |

| 正確做法 | 說明 |
|---------|------|
| **後端 API** | Docker 服務，使用 repo 根目錄的 `Dockerfile`（`COPY backend/...`） |
| **前端**（第二階段） | 各 app 獨立 Static Site，Root Directory 設為對應子目錄 |

## 目前已部署（2026-06-13）

| 服務 | 網址 | Dockerfile / 目錄 |
|------|------|-------------------|
| **api** | https://le-api.zeabur.app | 根目錄 `Dockerfile` |
| **host** | https://le-host.zeabur.app | `frontend/Dockerfile.host` |
| **participant** | https://le-participant.zeabur.app | `frontend/Dockerfile.participant` |
| **present** | https://le-present.zeabur.app | `frontend/Dockerfile.present` |
| **admin** | https://le-admin.zeabur.app | `frontend/Dockerfile.admin` |

| 項目 | 值 |
|------|-----|
| Zeabur 專案 | [liveengage](https://zeabur.com/projects/6a2d1bc82871baed5fc633ef?envID=6a2d1bc9cf558888ca4bc9da) |
| GitHub | `ColdRighter/LiveEngage`，分支 **`master`**（五服務皆連動，push 自動 redeploy） |
| Repo ID | `1267983204` |

前端 Docker 建置會安裝 `packages/renderers`、`packages/realtime`（admin 僅 realtime）依賴，並以 `VITE_API_BASE=https://le-api.zeabur.app` 編譯。

舊服務 `liveengage`、`liveengage-api`（SUSPENDED）已透過 CLI 排程刪除；若 Dashboard 仍顯示，請手動刪除以免混淆。

## Dashboard 手動部署（推薦）

1. **Add Service → GitHub** → `ColdRighter/LiveEngage`，分支 **`master`**
2. 服務名稱：`api`（或 `liveengage-api`）
3. **不要**選 Static Site；應偵測為 **Dockerfile** 建置
4. Root Directory：留空 `/`（使用 repo 根目錄的 `Dockerfile`）
5. **Settings → Variables** 設定：

| 變數 | 說明 |
|------|------|
| `LE_DATABASE_URL` | Neon async DSN（`?ssl=require`） |
| `LE_DATABASE_URL_SYNC` | Neon sync DSN（migration 用） |
| `LE_REDIS_URL` | Upstash `rediss://...` |
| `LE_JWT_SECRET` | 生產用強隨機密鑰（勿用 dev 值） |
| `LE_ENV` | `production` |

6. **Networking → Port**：HTTP `8000`（id: `web`）
7. **Networking → Generate Domain**（例如 `le-api.zeabur.app`）

`Dockerfile` 啟動時會執行 `alembic upgrade head` 再跑 `uvicorn`。

## Zeabur MCP / CLI

- **MCP**（`user-zeabur`）：可用 `deploy-from-specification`、`create-service`、`add-domain` 等
- **CLI**：`npx zeabur project list`、`npx zeabur service list --project-id <id>`

MCP 部署 Dockerfile 路徑若報 `path not found`，可改傳 `dockerfile.content`（內容需 `COPY backend/...`）。

## 前端（五個 app 皆已部署）

各 app 為獨立 Zeabur 服務；生產環境以 `VITE_API_BASE` 指向 API，無需反向代理。

| App | Dockerfile | 網域前綴 |
|-----|------------|----------|
| Host | `frontend/Dockerfile.host` | `le-host` |
| Participant | `frontend/Dockerfile.participant` | `le-participant` |
| Present | `frontend/Dockerfile.present` | `le-present` |
| Admin | `frontend/Dockerfile.admin` | `le-admin` |

MCP 部署時 `ref` 請用 `master`（勿寫 `refs/heads/master`，會重複前綴導致 clone 失敗）。

## 常見問題

- **build 失敗 `COPY app: not found`**：build context 是 repo 根目錄，需用根目錄 `Dockerfile`（含 `COPY backend/app`），或 Dashboard 設 Root Directory = `backend` 並用 `backend/Dockerfile`。
- **服務 SUSPENDED**：免費方案可能暫停舊服務；刪除後建新服務，或於 Dashboard 恢復。
- **網域被占用**：同一 subdomain 不能綁兩個服務，換前綴或刪舊服務的 domain。
