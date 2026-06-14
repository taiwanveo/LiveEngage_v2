# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-14）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`84d992d` — 即時接收參與者作答 WS，修正答題人數延遲
- **typecheck**：`host` 通過（本輪變更範圍）
- **Zeabur**：**六服務** — push `master` 自動 redeploy（本輪僅 **host** 有變更）

### 已上線服務

| 服務 | URL |
|------|------|
| api | https://le-api.zeabur.app |
| host | https://le-host.zeabur.app |
| participant | https://le-participant.zeabur.app |
| present | https://le-present.zeabur.app |
| admin | https://le-admin.zeabur.app |
| worker | Celery（無公開 URL） |

### 本輪重點（84d992d）

| 區塊 | 內容 |
|------|------|
| **作答即時更新** | `pollActionCache` 處理 `poll_response_submitted` WS，套用 `response_count` / `aggregates` 快照 |
| **open_text** | WS 只帶人數 → 即時更新 count 並 `invalidate` 拉 `entries` 文字 |
| **備援輪詢** | 工作台／控制台／投影頁 `poll-results` 備援間隔 30s → **10s**（僅 WS 斷線時） |
| **guard 修正** | 自我控場去重不再擋住參與者作答事件 |

### 先前已上線（a416d99）

| 區塊 | 內容 |
|------|------|
| **投影修復** | 「投影」按鈕改開 Host 同源路由，共用 JWT |
| **控場延遲** | 後端單一 commit + reveal results 快照（edc9f56） |

### 生產 DB 連線（待手動）

| 項目 | 建議 |
|------|------|
| Neon Pooler | Zeabur api/worker 改 `-pooler` 主機名 |

### 仍可做（非阻塞）

- Neon Pooler 環境變數更新
- Webhook outbound 派送（Celery）
- Playwright E2E

---

## HISTORY

### 2026-06-14 — 參與者作答 Host 即時更新（84d992d）

`poll_response_submitted` WS 處理與聚合快取；open_text entries 補拉；備援輪詢 10s。

### 2026-06-14 — 投影 Token 已過期修復（a416d99）

`presentAppUrl` 改同源 Host 路由；Present app 補 refresh 與 postMessage auth bootstrap。

### 2026-06-14 — Poll 控場延遲優化與 Neon Pooler 指引（edc9f56）

後端單一 commit + reveal results 快照；`pollActionCache` 樂觀更新與 WS 去重。

### 2026-06-14 — 工作台控場、投票編輯與手機預覽（86813b5）

頂欄控場合併；Poll 狀態徽章；`hostWorkbenchPreview`；選項自動儲存。

### 2026-06-14 — Poll/Quiz 麵包屑 + 投票編輯回工作台（db1a4bc）

`HostBreadcrumb`；Poll/Quiz 管理麵包屑；PollBuilder「回到工作台」。
