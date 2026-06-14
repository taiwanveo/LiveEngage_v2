# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-14）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`f531f6e` — 活動開始通知、Sprint9 開放修復、全系統 Modal 提示
- **typecheck**：`realtime` / `host` / `participant` / `admin` / `present` 通過
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

### 本輪重點（f531f6e）

| 區塊 | 內容 |
|------|------|
| **活動開始通知** | `SESSION_STARTED` WS 廣播（`session_service`／`admin_service`）；參與者 `RoomPage` Modal「活動已開始」 |
| **互動開放通知** | `INTERACTION_STARTED` 廣播（Quiz／點子牆／問卷／Q&A 按「開放」）；參與者 Modal + 自動切換分頁 |
| **Poll／Quiz 開始** | 既有 `poll_started`／`quiz_question_started` 亦改 Modal 提示 |
| **Sprint9 開放修復** | `interaction_service` 房間鎖、狀態驗證、`IntegrityError` 中文錯誤；成功後 WS 廣播 |
| **全系統 Modal** | `@liveengage/ui` 新增 `useSystemNotice`；24 檔遷移（Host／Admin／Present／Participant 錯誤／成功訊息） |
| **共用標籤** | `interactionLabels.ts` 題型中文標籤 |

### 先前已上線（c9b53f1 一帶）

| 區塊 | 內容 |
|------|------|
| **結束活動** | `SESSION_ENDED` 廣播 + 參與者結束 Modal |
| **Quiz 編輯／刪除** | 子題 PATCH/DELETE、編輯頁、Poll/Quiz 刪除 |
| **Q&A／Admin UX** | 審核即時、參與度去重、稽核中文化、分享按鈕 |

### 現場流程速查

1. **開始活動**：儀表板設為進行中 → 參與者頁 Modal「活動已開始」  
2. **開放互動**：Quiz 管理「開放」→ 參與者 Modal「快問快答已開始」  
3. **Poll**：控制台 start → 參與者 Modal「投票已開始」  
4. **系統訊息**：成功／失敗皆以置中 Modal 顯示（點遮罩或關閉鈕可關）  

> 同一 room 同時僅一個 `active` 互動。

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
- `session_started`／`interaction_started` 專項 pytest
- Admin Integrations UI

---

## HISTORY

### 2026-06-14 — 活動開始通知 + Sprint9 開放修復 + Modal 統一（f531f6e）

`session_started`／`interaction_started` 廣播；Sprint9 開放房間鎖修復；`useSystemNotice` 全系統 Modal；參與者互動開始即時提示。

### 2026-06-14 — 結束活動通知 + Quiz 編輯 + Poll/Quiz 刪除（c9b53f1）

`session_ended` 廣播；參與者結束 Modal；Quiz 子題 PATCH/DELETE 與編輯頁；互動 DELETE；Q&A 即時審核；參與度去重；稽核中文化；參與者分享與提交 Modal。

### 2026-06-14 — 繁中 UI + Q&A 審核增強（e930fec）

Host 題型／狀態中文化；Q&A 審核純中文按鈕與取消核准；審核開關；參與者標記星號；後端 `unapprove`。

### 2026-06-14 — Q&A 開關 + 儀表板 Modal + 分享／meta UI（3078a70）

`QaControlBar`；儀表板建立活動 Modal；`HostSessionMeta`；Modal portal＋關閉鈕；非工作台隱藏投影。

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
