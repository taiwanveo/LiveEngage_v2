# Zeabur 部署指引

## Zeabur MCP vs CLI

- **Zeabur MCP Server**：目前 Cursor 顯示 error，且專案 `.cursor/mcp.json` 未設定 Zeabur MCP。請至 **Cursor Settings → MCP** 檢查 `user-zeabur` 狀態並重新授權。
- **Zeabur CLI（可用）**：本機已登入，可用 `npx zeabur project list` 驗證。

## 後端 API

```bash
cd backend
npx zeabur deploy --create --name liveengage-api
```

環境變數（Zeabur Dashboard 或 `zeabur variable set`）：

| 變數 | 說明 |
|------|------|
| `LE_DATABASE_URL` | Neon async DSN（`?ssl=require`） |
| `LE_DATABASE_URL_SYNC` | Neon sync DSN（migration 用） |
| `LE_REDIS_URL` | Upstash `rediss://...` |
| `LE_JWT_SECRET` | 生產用強隨機密鑰 |
| `LE_ENV` | `production` |

`backend/Dockerfile` 會在啟動時執行 `alembic upgrade head`。

## 前端（靜態站）

各 app 獨立部署為 Static Site 或 Web Service：

| App | 目錄 | Build | 輸出 |
|-----|------|-------|------|
| Host | `frontend/apps/host` | `npm run build` | `dist` |
| Participant | `frontend/apps/participant` | `npm run build` | `dist` |
| Present | `frontend/apps/present` | `npm run build` | `dist` |
| Admin | `frontend/apps/admin` | `npm run build` | `dist` |

Vite proxy 僅開發用；生產環境需設定 API 基底 URL 或 Zeabur 反向代理將 `/api`、`/ws` 轉至後端服務。

## 建議 Zeabur 專案結構

1. `liveengage-api` — Python Web Service（port 8000）
2. `liveengage-host` — Static / Node preview
3. `liveengage-participant` — Static
4. `liveengage-admin` — Static
5. `liveengage-present` — Static

或使用單一 Gateway 服務掛多個靜態子路徑（進階）。
