# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-15）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`83d042f` — Quiz 子題開始修復、後台成員編輯、cohost Quiz UI
- **typecheck**：`host`、`participant`、`admin` 通過
- **整合測試**：`test_start_question_after_quiz_activated`、`test_fe011_quiz_submit_and_leaderboard` 通過（需 `LE_DATABASE_URL`）

### 本輪重點

| 區塊 | 內容 |
|------|------|
| **Quiz 子題開始** | 父 Quiz 已「開放」時 `start_question` 不再觸發 `uq_interactions_active_room`；父 `active`→`locked`，子題佔 active 名額，結束後恢復 |
| **參與者 reconnect** | `state_service` 含 `locked` Quiz 父題、排除 Quiz 子題 MC；`RoomPage` 以 active/locked 找 Quiz |
| **後台帳號管理** | `PATCH /admin/members/{id}` 支援姓名／密碼／角色；Admin「編輯」對話框 |
| **助理主持人 UI** | Quiz 控制台隱藏新增子題／編輯／刪除（對齊 Poll Hub） |

### Quiz 父／子狀態（控場時）

| 階段 | 父 Quiz | 子題 child |
|------|---------|------------|
| 已開放、等待子題 | `active` | `idle` |
| 子題進行中 | `locked` | `active` |
| 揭曉／子題結束 | `active` | `locked` / `stopped` |

### 部署

需 redeploy：**api**、**host**、**participant**、**admin**（api 啟動時自動 `alembic upgrade head`）。

---

## HISTORY

### 2026-06-15 — Quiz 子題開始 + 後台成員編輯 + cohost Quiz UI

`quiz_service._yield_room_active_slot_to_quiz_child`；`state_service` locked Quiz；Admin `updateMember`；Sprint9ConsolePage `canEditHostContent`。

### 2026-06-15 — 組織品牌 + 角色（3a36bec）

`OrgBrandingProvider`；`host_permissions`；migration 0007。

### 2026-06-15 — UI 按鈕設計系統（e3b1b1b）

`Button`／`PresentButton`；Poll／Quiz 投影統一；頂欄投影精簡並另開新視窗。

### 2026-06-15 — 錯誤訊息中文化（792f5a0）

`apiErrors.ts` + 三端 API client + 各頁 `formatUserFacingError`；Quiz 子題控場不再顯示英文 `Failed to fetch`。

### 2026-06-15 — 移除獨立 Present App（4e5e273）

刪除 `apps/present` 與 Zeabur 服務；投影僅 Host 同源。

### 2026-06-14 — 分享連結指向 participant（7d4420d）

Host「分享加入資訊」的 URL／QR 修正為 `le-participant.zeabur.app/#/join/{code}`。

### 2026-06-14 — Survey 作答、Quiz 重載與按鈕缺口修復（f82edc6）

Participant Survey 完整流程；Quiz active-question API；Ideas/Survey 投影；Host 麵包屑與 mutation 錯誤回饋。

### 2026-06-14 — Q&A/Quiz 投影、麵包屑與活動封存（01009f7）

`QaPresentPage`、`QuizPresentPage`；`presentHref`；審核麵包屑；儀表板封存。

### 2026-06-14 — 參與者作答 Host 即時更新（84d992d）

`poll_response_submitted` WS 處理；open_text entries 補拉。

### 2026-06-14 — 投影改 Host 同源（a416d99）

`presentAppUrl` 改 Host hash 路由，不再依賴跨網域 Present 站。

### 2026-06-14 — Poll 控場延遲優化（edc9f56）

後端單一 commit + `pollActionCache` 樂觀更新。

### 2026-06-14 — 工作台控場與手機預覽（86813b5）

頂欄控場列；`hostWorkbenchPreview`；選項自動儲存。
