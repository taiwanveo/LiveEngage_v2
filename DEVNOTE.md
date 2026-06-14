# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-14）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`3078a70` — Q&A 開關、儀表板 Modal、分享 Modal 置中
- **pytest**：全 suite 建議 CI 再跑（本輪以 Host 前端為主）
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

### 本輪重點（Host）

| 區塊 | 內容 |
|------|------|
| **Q&A 開關** | `QaControlBar` 於 **Q&A 審核** 頂部「開啟／關閉 Q&A」；自動建立 `qa` 互動＋`moderation_enabled`；與 Quiz 分離 |
| **活動儀表板** | 「建立新活動」改為副標旁按鈕 → Modal 輸入名稱；「我的活動」全寬列表 |
| **頂欄 meta** | `HostSessionMeta` 顯示活動名稱，hover 顯示 `room: {UUID}` |
| **分享 Modal** | `Modal` portal 至 `document.body` 真正置中；底部「關閉」；Esc／backdrop 可關 |
| **投影按鈕** | 僅工作台（有 `presentPollId`）顯示；Q&A／Poll／Quiz 管理頁不再顯示 disabled 投影 |

### 先前已上線（ae6af17 一帶）

| 區塊 | 內容 |
|------|------|
| **Admin** | 選單重排、帳號管理、組織＋品牌合併、Analytics 繁中 |
| **Host 跨頁** | `HostRoomHeaderActions` 分享；`brandHref` 回儀表板 |
| **工作台** | 三欄 17%／55%／28%；「互動項目」；參與者預覽放大 |

### 現場 Q&A 流程（主持人）

1. 活動儀表板建立活動 → 設為進行中 → 分享 QR／連結  
2. **Q&A 審核** → **開啟 Q&A**（非 Quiz 管理）  
3. 參與者 Q&A 分頁提問 → 主持人於三欄審核  

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
- 活動儀表板列表卡片：Room ID 改 hover 顯示（頂欄 meta 已做）

---

## HISTORY

### 2026-06-14 — Q&A 開關 + 儀表板 Modal + 分享／meta UI（3078a70）

`QaControlBar`；儀表板建立活動 Modal；`HostSessionMeta`；Modal portal＋關閉鈕；非工作台隱藏投影。

### 2026-06-14 — Admin 重組 + Host 儀表板／工作台 UI（ae6af17）

Admin 帳號管理、組織設定；Host 分享 Modal、工作台三欄、brand 回儀表板。

### 2026-06-14 — Quiz 開放 + Admin 版型 + Host 導覽（cbd1cfb）

後端 activate 前先 stop 同 room active；Admin typography；Host 三選單。

### 2026-06-14 — 深色主題 + 頂欄一致 + 工作台版面（3d8edd6）

`AppHeaderChrome` 四端對齊；工作台三欄與 Poll 控場。

### 2026-06-14 — Slido UI + SSO + Phase D（22e4015）

Host 工作台、Admin Analytics、OIDC、Quiz／Ideas／Survey。

### 2026-06-13 — UI 設計系統（d6a0499 / b2feac5）

`@liveengage/ui` 四主題。

### 2026-06-13 — Phase D Sprint 9（5c98f3e）

Quiz；Zeabur worker。

### 2026-06-13 — Phase C+（0fbde82）/ Phase A（c4e0eff）

Rate limit、Celery export、Runbook。
