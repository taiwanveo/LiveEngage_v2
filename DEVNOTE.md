# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-14）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`a416d99` — 投影按鈕改同源開啟，避免 Token 已過期
- **typecheck**：`host`、`present` 通過（本輪變更範圍）
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

### 本輪重點（a416d99）

| 區塊 | 內容 |
|------|------|
| **投影修復** | 工作台「投影」按鈕改開 **Host 同源** `#/rooms/.../present`，共用 `le.host` JWT，不再跳 `le-present` 導致 Token 已過期 |
| **Present app** | 補 refresh token、401 自動刷新、`hasValidSession()`；支援 `postMessage` 接收 Host 傳遞的 token（獨立開啟時） |

### 生產 DB 連線（待手動）

| 項目 | 現況 | 建議 |
|------|------|------|
| Neon 區域 | 新加坡 `ap-southeast-1` | 短期先換 **Pooler**（`-pooler` 主機名） |
| Zeabur api/worker | 可能仍為 **direct** | 更新 `LE_DATABASE_URL*` 後 redeploy |

### 先前已上線（edc9f56）

| 區塊 | 內容 |
|------|------|
| **控場延遲** | 後端單一 commit + reveal results 快照；`pollActionCache` 樂觀更新 |
| **工作台 UX** | 頂欄控場列、手機預覽、投票選項自動儲存（86813b5） |

### Host 導覽速查

1. **儀表板** → 活動 → **工作台**（三欄）
2. 右上角 **投影**：新分頁開 Host 同源全螢幕投影（含控場列）
3. 「···」：同頁內嵌投影路由

### 仍可做（非阻塞）

- Zeabur api/worker 改用 Neon Pooler URL
- Webhook outbound 派送（Celery）
- Playwright join→poll→Q&A E2E

---

## HISTORY

### 2026-06-14 — 投影 Token 已過期修復（a416d99）

`presentAppUrl` 改同源 Host 路由；Present app 補 refresh 與 postMessage auth bootstrap。

### 2026-06-14 — Poll 控場延遲優化與 Neon Pooler 指引（edc9f56）

後端單一 commit + reveal results 快照；`pollActionCache` 樂觀更新與 WS 去重；部署文件補 Pooler。

### 2026-06-14 — 工作台控場、投票編輯與手機預覽（86813b5）

頂欄控場合併；Poll 狀態徽章；`hostWorkbenchPreview`；選項自動儲存；手機預覽滿寬。

### 2026-06-14 — Poll/Quiz 麵包屑 + 投票編輯回工作台（db1a4bc）

`HostBreadcrumb`；Poll/Quiz 管理麵包屑；PollBuilder「回到工作台」。

### 2026-06-14 — 活動開始通知 + Sprint9 開放修復 + Modal 統一（f531f6e）

`session_started`／`interaction_started` 廣播；Sprint9 開放房間鎖修復；`useSystemNotice` 全系統 Modal。
