# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-14）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`c9b53f1` — 結束活動 WS 通知、Quiz 編輯、Poll/Quiz 刪除與多項 UX 修正
- **pytest**：`test_s9_phase_d.py` + `test_poll_sprint5.py` 18 passed（約 6 分鐘，需 `LE_DATABASE_URL`）
- **typecheck**：`realtime` / `host` / `participant` 通過
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

### 本輪重點（c9b53f1）

| 區塊 | 內容 |
|------|------|
| **結束活動通知** | 後端 `SESSION_ENDED` WS 廣播（`session_service`／`admin_service`）；參與者 `RoomPage` Modal + 導回加入頁；`session-state.status === ended` 備援 |
| **Quiz 編輯（Sprint 9）** | `PATCH /quizzes/questions/{id}`、`DELETE` 子題；`QuizQuestionEditPage`；控制台 pending 子題「編輯／刪除」；路由 `#/rooms/.../sprint9/.../questions/.../edit` |
| **Poll / Quiz 刪除** | `DELETE /interactions/{id}`（`active` 不可刪）；`PollHubPage`／`Sprint9HubPage` 刪除按鈕 + confirm |
| **Q&A 審核 UX** | 操作按鈕 hover 顯示；WS 本機先 broadcast + Redis；5s 輪詢備援 |
| **參與者 UX** | Poll／Quiz／Q&A 提交成功改 Modal；頂欄分享按鈕（`ParticipantShareActions` + 共用 `JoinShareCard`） |
| **Admin** | 參與度 `participants_engaged` UNION 去重；稽核動作／目標類型中文下拉（`auditLabels.ts`） |
| **共用 UI** | `JoinShareCard`、`participantJoinUrl` 移至 `@liveengage/ui` |

### 先前已上線（e930fec 一帶）

| 區塊 | 內容 |
|------|------|
| **Host 繁中 UI** | 題型／狀態中文化；Q&A 審核開關／取消核准 |
| **儀表板** | 建立活動 Modal；分享 Modal portal 置中 |

### 現場流程速查

1. **Poll**：Poll 管理 → 建立 → Builder → 控制台 start → 參與者作答  
2. **Quiz**：Quiz 管理 → 建立 → 控制台新增子題 → 編輯（pending）→ 開始／揭曉  
3. **結束活動**：儀表板或 Admin 將 session 設為 `ended` → 參與者即時 Modal  
4. **刪除**：Poll／Quiz 須非 `active` 狀態方可刪除  

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
- `delete_interaction`／`broadcast_session_ended` 專項 pytest
- Admin Integrations UI

---

## HISTORY

### 2026-06-14 — 結束活動通知 + Quiz 編輯 + Poll/Quiz 刪除（c9b53f1）

`session_ended` 廣播；參與者結束 Modal；Quiz 子題 PATCH/DELETE 與編輯頁；互動 DELETE；Q&A 即時審核；參與度去重；稽核中文化；參與者分享與提交 Modal。

### 2026-06-14 — 繁中 UI + Q&A 審核增強（e930fec）

Host 題型／狀態中文化；Q&A 審核純中文按鈕與取消核准；審核開關；參與者標記星號；後端 `unapprove`。

### 2026-06-14 — Q&A 開關 + 儀表板 Modal + 分享／meta UI（3078a70）

`QaControlBar`；儀表板建立活動 Modal；`HostSessionMeta`；Modal portal＋關閉鈕；非工作台隱藏投影。

### 2026-06-14 — Admin 重組 + Host 儀表板／工作台 UI（ae6af17）

Admin 帳號管理、組織設定；Host 分享 Modal、工作台三欄、brand 回儀表板。

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
