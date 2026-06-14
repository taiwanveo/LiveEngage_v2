# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-14）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`e930fec` — Host 繁中 UI、Q&A 審核開關／取消核准、參與者標記星號
- **pytest**：`test_unapprove_returns_to_pending_and_hides_from_public` 通過（需 `LE_DATABASE_URL`）
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

### 本輪重點（e930fec）

| 區塊 | 內容 |
|------|------|
| **Host 繁中 UI** | `pollTypes.ts` 統一 `interactionTypeLabel`／`interactionStatusLabel`／`quizQuestionStateLabel`；Poll 列表、控制台、Builder、工作台、Sprint9、儀表板不再顯示 `multiple_choice`／`idle` 等代碼 |
| **Q&A 審核** | 三欄標題與按鈕純中文；**取消核准**（`unapprove`）將已核准退回待審 |
| **Q&A 控場** | `QaControlBar`：開／關 Q&A、開／關審核（`moderation_enabled`）；狀態徽章；控制列高度壓縮 |
| **Q&A 即時** | 審核頁 `useRoomWebSocket` + `QA_EVENT_TYPES`；30s 輪詢備援 |
| **參與者 Q&A** | 主持人標記問題顯示 ★，hover 提示「這個問題已被活動主持人標記」 |
| **後端** | `ModerateAction.UNAPPROVE`；廣播 `question_dismissed` 至全端以更新公開列表 |

### 先前已上線（3078a70 一帶）

| 區塊 | 內容 |
|------|------|
| **活動儀表板** | 「建立新活動」Modal；全寬列表 |
| **頂欄 meta** | 活動名稱 + hover Room ID |
| **分享 Modal** | portal 置中、關閉鈕與複製連結同列 |
| **投影** | 僅工作台顯示 |

### 現場 Q&A 流程（主持人）

1. 活動儀表板建立活動 → 設為進行中 → 分享 QR／連結  
2. **Q&A 審核** → **開啟 Q&A**；可切換 **開啟／關閉審核**  
3. 參與者提問 → 待審（有審核）或直接已核准（免審）  
4. 核准／取消核准／標記／標為已答  

> 同一 room 同時僅一個 `active` 互動；開 Q&A 會 stop 進行中的 Poll／Quiz。

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
- Admin Integrations UI
- 參與者提問成功文案依審核開關動態顯示

---

## HISTORY

### 2026-06-14 — 繁中 UI + Q&A 審核增強（e930fec）

Host 題型／狀態中文化；Q&A 審核純中文按鈕與取消核准；審核開關；參與者標記星號；後端 `unapprove`。

### 2026-06-14 — Q&A 開關 + 儀表板 Modal + 分享／meta UI（3078a70）

`QaControlBar`；儀表板建立活動 Modal；`HostSessionMeta`；Modal portal＋關閉鈕；非工作台隱藏投影。

### 2026-06-14 — Admin 重組 + Host 儀表板／工作台 UI（ae6af17）

Admin 帳號管理、組織設定；Host 分享 Modal、工作台三欄、brand 回儀表板。

### 2026-06-14 — Quiz 開放 + Admin 版型 + Host 導覽（cbd1cfb）

Quiz 管理開放；Admin 選單重排；Host 跨頁分享與導覽。

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
