# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-14）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`86813b5` — 工作台控場、投票編輯與手機預覽體驗強化
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

### 本輪重點（86813b5）

| 區塊 | 內容 |
|------|------|
| **工作台控場** | 頂欄合併為單一排：回到活動列表、開始／結束、上一題／下一題、鎖定、揭曉答案；狀態徽章改跟 Poll 即時狀態 |
| **參與者預覽** | `hostWorkbenchPreview`：揭曉／鎖定／結束等控場狀態同步右欄手機預覽；滿寬排版、去除巢狀卡片留白 |
| **投票編輯** | 選項自動儲存（700ms debounce）；雙「儲存題目」+ 至少一選項驗證 |
| **側欄 UX** | 「新增題目」按鈕移至標題輸入下方；與題目列表留距 |

### 先前已上線（db1a4bc 一帶）

| 區塊 | 內容 |
|------|------|
| **麵包屑** | Poll／Quiz 管理頁「活動儀表板 / {活動名} / 目前頁」 |
| **手機預覽** | 9:19.5 長形外框；即時時鐘、暗色捲軸 |
| **活動／互動通知** | `SESSION_STARTED`／`INTERACTION_STARTED`；`useSystemNotice` Modal |

### Host 導覽速查

1. **儀表板** → 建立／進行中活動 → **工作台**（三欄）  
2. 頂欄控場列：開始／結束、題目切換、鎖定、揭曉答案  
3. 右欄手機預覽：即時反映參與者畫面  
4. **投票編輯**：選項自動儲存；可「回到工作台」  

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

### 2026-06-14 — 工作台控場、投票編輯與手機預覽（86813b5）

頂欄控場合併；Poll 狀態徽章；`hostWorkbenchPreview`；選項自動儲存；手機預覽滿寬；側欄「新增題目」。

### 2026-06-14 — Poll/Quiz 麵包屑 + 投票編輯回工作台（db1a4bc）

`HostBreadcrumb`；Poll/Quiz 管理麵包屑；PollBuilder「回到工作台」。

### 2026-06-14 — 工作台手機預覽 UX（f9211a9）

長形 9:19.5 外框；即時時鐘與閃爍冒號；暗色捲軸。

### 2026-06-14 — 活動開始通知 + Sprint9 開放修復 + Modal 統一（f531f6e）

`session_started`／`interaction_started` 廣播；Sprint9 開放房間鎖修復；`useSystemNotice` 全系統 Modal。

### 2026-06-14 — 結束活動通知 + Quiz 編輯 + Poll/Quiz 刪除（c9b53f1）

`session_ended` 廣播；參與者結束 Modal；Quiz 子題 PATCH/DELETE 與編輯頁；互動 DELETE。
