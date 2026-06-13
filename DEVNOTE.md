# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-13）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：f0c9327 Zeabur 全端部署（API + Host + Participant）
- **pytest**：50 passed（本地；未重跑）
- **Zeabur 專案**：[liveengage](https://zeabur.com/projects/6a2d1bc82871baed5fc633ef?envID=6a2d1bc9cf558888ca4bc9da)
- **Zeabur MCP**：可用（user-zeabur）

### 已上線服務

| 服務 | 網址 | 說明 |
|------|------|------|
| api | https://le-api.zeabur.app | FastAPI；根目錄 `Dockerfile` |
| host | https://le-host.zeabur.app | Host 前端；`frontend/Dockerfile.host` |
| participant | https://le-participant.zeabur.app | 參與者前端；`frontend/Dockerfile.participant` |

- 前端建置內嵌 `VITE_API_BASE=https://le-api.zeabur.app`
- API 已設 `LE_CORS_ORIGIN_REGEX=https://.*\.zeabur\.app`
- push `master` 後 GitHub 連動服務應自動 redeploy（Dashboard 確認各服務 Git 觸發）

### Sprint 7 進度

| 任務 | 狀態 |
|------|------|
| S7-1～S7-5 | done |

### 仍待完成

- Present / Admin 前端 Zeabur 部署
- Host 活動儀表板（建 session UI）
- Participant Q&A 提問頁
- Sprint 9+：Quiz / Survey / Ideas / AI

---

## HISTORY

### 2026-06-13 — Zeabur 部署（f0c9327）

- 根目錄 `Dockerfile`（API monorepo 建置）
- `frontend/Dockerfile.host` / `Dockerfile.participant`
- `VITE_API_BASE` + `apiBase.ts`；後端 CORS 設定
- MCP 建立服務 api / host / participant 並驗證 health

### 2026-06-13 — S7-4/S7-5（43854ce）

Branding、Export、backend/Dockerfile 初版

### 2026-06-13 — S7-2/S7-3（4be10c8）

Admin API + UI
