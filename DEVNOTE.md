# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-14）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`edc9f56` — Poll 控場延遲優化與 Neon Pooler 部署指引
- **測試**：`test_poll_sprint5.py` 12 passed（本輪後端變更）
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

### 本輪重點（edc9f56）

| 區塊 | 內容 |
|------|------|
| **後端控場** | `poll_service` 改為 DB 單一 commit；Redis / WS 在 commit 後執行（`PostCommitHook`） |
| **reveal 快照** | `PollActionResponse.results`：reveal / reset 附 `PollResults`，Host 免再打 GET /results |
| **Host 快取** | 新增 `pollActionCache.ts`：mutation 後 `setQueryData`、2.5s WS 自我動作去重 |
| **套用頁面** | `SessionWorkbenchPage`、`PollConsolePage`、`PresentPage` |
| **部署文件** | `.env.example`、`Zeabur_部署指引`、`RUNBOOK`：Neon **Pooler**（`-pooler` 主機名）與區域建議 |

### 生產 DB 連線（待手動）

| 項目 | 現況 | 建議 |
|------|------|------|
| Neon 區域 | 新加坡 `ap-southeast-1` | 遷東京需新建專案；短期先換 **Pooler** 效益較大 |
| Zeabur api/worker | 目前 **direct** 連線 | 改 `LE_DATABASE_URL*` 主機名為 `ep-xxx-**pooler**.c-2...` |

Neon Console → Connection details → **Pooled connection** → 更新 Zeabur **api** / **worker** env → redeploy → `GET /ready` 驗證。

### 先前已上線（86813b5）

| 區塊 | 內容 |
|------|------|
| **工作台控場** | 頂欄單排控場列；Poll 狀態徽章；開始／結束 toggle |
| **參與者預覽** | `hostWorkbenchPreview`；滿寬手機預覽 |
| **投票編輯** | 選項 700ms 自動儲存；雙「儲存題目」 |

### Host 導覽速查

1. **儀表板** → 建立／進行中活動 → **工作台**（三欄）
2. 頂欄控場列：開始／結束、題目切換、鎖定、揭曉答案
3. 右欄手機預覽：即時反映參與者畫面
4. **投票編輯**：選項自動儲存；可「回到工作台」

### 仍可做（非阻塞）

- Zeabur api/worker 改用 Neon Pooler URL
- Webhook outbound 派送（Celery）
- Playwright join→poll→Q&A E2E
- Q&A 審核頁麵包屑（與 Poll/Quiz 對齊）
- Admin Integrations UI

---

## HISTORY

### 2026-06-14 — Poll 控場延遲優化與 Neon Pooler 指引（edc9f56）

後端單一 commit + reveal results 快照；`pollActionCache` 樂觀更新與 WS 去重；部署文件補 Pooler 與區域建議。

### 2026-06-14 — 工作台控場、投票編輯與手機預覽（86813b5）

頂欄控場合併；Poll 狀態徽章；`hostWorkbenchPreview`；選項自動儲存；手機預覽滿寬；側欄「新增題目」。

### 2026-06-14 — Poll/Quiz 麵包屑 + 投票編輯回工作台（db1a4bc）

`HostBreadcrumb`；Poll/Quiz 管理麵包屑；PollBuilder「回到工作台」。

### 2026-06-14 — 工作台手機預覽 UX（f9211a9）

長形 9:19.5 外框；即時時鐘與閃爍冒號；暗色捲軸。

### 2026-06-14 — 活動開始通知 + Sprint9 開放修復 + Modal 統一（f531f6e）

`session_started`／`interaction_started` 廣播；Sprint9 開放房間鎖修復；`useSystemNotice` 全系統 Modal。
