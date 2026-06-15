# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-15）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`3a36bec` — 組織品牌套用 + 角色模型（host／cohost）
- **typecheck**：`ui`、`host`、`participant`、`admin` 通過
- **DB migration**：`0007_user_roles_host_cohost`（部署 api 時需跑 alembic upgrade）

### 本輪重點

| 區塊 | 內容 |
|------|------|
| **組織品牌** | `GET /api/v1/branding/me`（Host）、`/by-code/{code}`（Participant）；頂欄 Logo、favicon、主色 |
| **角色** | `member`→`host`（主持人）；新增 `cohost`（助理主持人）；停用 `guest` 邀請 |
| **助理主持人** | 可控場／投影／審核；不可建立／編輯／刪除 Poll／Quiz（後端 `host_permissions` 強制） |

### 角色速查

| role | 中文 | 說明 |
|------|------|------|
| owner / admin | 擁有者／管理員 | 後台 + 完整控場 |
| host | 主持人 | 原 member；Host 登入、建立與編輯內容 |
| cohost | 助理主持人 | 現場控場，不可改 Poll／Quiz 結構 |
| guest | 訪客 | 已停用邀請；參與者走 QR，不用此帳號 |

---

## HISTORY

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
