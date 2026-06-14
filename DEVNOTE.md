# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-14）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`db1a4bc` — Poll/Quiz 麵包屑、投票編輯回到工作台
- **typecheck**：`host` 通過（本輪變更範圍）
- **Zeabur**：**六服務** — api / host / participant / present / admin / worker（push `master` 自動 redeploy）

### 已上線服務

| 服務 | URL |
|------|------|
| api | https://le-api.zeabur.app |
| host | https://le-host.zeabur.app |
| participant | https://le-participant.zeabur.app |
| present | https://le-present.zeabur.app |
| admin | https://le-admin.zeabur.app |
| worker | Celery（無公開 URL） |

### 本輪重點（db1a4bc）

| 區塊 | 內容 |
|------|------|
| **麵包屑** | `HostBreadcrumb`／`HostRoomHubBreadcrumb`；Poll／Quiz 管理頁顯示「活動儀表板 / {活動名} / 目前頁」，可點擊跳轉 |
| **投票編輯** | `PollBuilderPage` 標題列「回到工作台」→ `#/rooms/{roomId}/workbench/{pollId}` |

### 先前已上線（f9211a9 一帶）

| 區塊 | 內容 |
|------|------|
| **手機預覽** | `ParticipantPreviewFrame` 9:19.5 長形外框；即時時鐘、暗色捲軸 |
| **活動／互動通知** | `SESSION_STARTED`／`INTERACTION_STARTED`；`useSystemNotice` Modal |
| **結束活動／Quiz** | `SESSION_ENDED`；Quiz 編輯刪除；Poll/Quiz 刪除 |

### Host 導覽速查

1. **儀表板** → 建立／進行中活動 → **工作台**（三欄）  
2. **Poll 管理**／**Quiz 管理**：頂欄下方麵包屑可回儀表板或工作台  
3. **投票編輯**：可「回到工作台」或「前往控制台」  

### 生產環境 env（api）

| 變數 | 用途 |
|------|------|
| `LE_SSO_ENABLED` / `LE_SSO_OIDC_*` | SSO |
| `LE_API_PUBLIC_URL` | `https://le-api.zeabur.app` |
| `LE_SSO_*_FRONTEND_URL` | 各前端 Zeabur 網域 |
| `LE_AI_ENABLED` / `LE_AI_API_KEY` | 真實 LLM（可選） |

### 仍可做（非阻塞）

- Webhook outbound 派送（Celery）
- Playwright join→poll→Q&A E2E
- Q&A 審核頁麵包屑（與 Poll/Quiz 對齊）
- Admin Integrations UI

---

## HISTORY

### 2026-06-14 — Poll/Quiz 麵包屑 + 投票編輯回工作台（db1a4bc）

`HostBreadcrumb`；Poll/Quiz 管理麵包屑；PollBuilder「回到工作台」。

### 2026-06-14 — 工作台手機預覽 UX（f9211a9）

長形 9:19.5 外框；即時時鐘與閃爍冒號；暗色捲軸。

### 2026-06-14 — 活動開始通知 + Sprint9 開放修復 + Modal 統一（f531f6e）

`session_started`／`interaction_started` 廣播；Sprint9 開放房間鎖修復；`useSystemNotice` 全系統 Modal。

### 2026-06-14 — 結束活動通知 + Quiz 編輯 + Poll/Quiz 刪除（c9b53f1）

`session_ended` 廣播；參與者結束 Modal；Quiz 子題 PATCH/DELETE 與編輯頁；互動 DELETE。

### 2026-06-14 — 繁中 UI + Q&A 審核增強（e930fec）

Host 題型／狀態中文化；Q&A 審核開關／取消核准；參與者標記星號。

---

## 契約速查（鐵律）

1. 寫入走 REST；WebSocket 只做廣播  
2. 投票／計數後端聚合  
3. 匿名遮蔽只在 `mask_identity`  
4. 寫入端點支援 `Idempotency-Key`  
5. 同一 Room 同時僅一 active Poll（互動）  
6. AI 旁路、10s timeout、失敗 503  
7. UTC 儲存、UUID v7、伺服端強制權限  

完整規格見 `docs/LiveEngage_AI_Coding_Agent_實作指引.md`。
