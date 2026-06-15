# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-15）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`e634fe4` — api migration 修復（enum autocommit）
- **typecheck**：`host`、`participant`、`admin` 通過
- **接手文件**：[`docs/服務架構.md`](docs/服務架構.md) — api / host / participant / admin / worker 分工
- **api 健康**：https://le-api.zeabur.app/health → `{"status":"ok"}`

### 本輪重點（api 502 / 後台無法登入）

| 問題 | 根因 | 修復 |
|------|------|------|
| Admin 登入「無法連上伺服器」 | `le-api.zeabur.app` 502，api 服務 crash loop | 見下方兩次 migration 修正 |
| Alembic KeyError | `0007` 的 `down_revision` 寫成不存在的 `0006_sprint9_phase_d` | 改為 `"0006"`（`ea460f7`） |
| PostgreSQL enum 錯誤 | `ADD VALUE` 與 `UPDATE` 同一 transaction | `autocommit_block()` 分開 commit（`e634fe4`） |

### 本輪重點（文件，3ccb83c）

| 文件 | 內容 |
|------|------|
| **docs/服務架構.md** | 新增：五大服務職責、api vs worker、本地開發對照 |
| **AGENTS / README / docs/README** | 入口連結與過時描述修正 |
| **RUNBOOK / Zeabur 指引** | 改為五服務、交叉引用 |

### 本輪重點（功能，10cc916）

| 區塊 | 內容 |
|------|------|
| **Quiz 子題開始** | 父 Quiz 已「開放」時 `start_question` 不再觸發 unique index 衝突 |
| **後台帳號管理** | 成員編輯（姓名／密碼／角色） |
| **cohost Quiz UI** | 控制台隱藏新增／編輯／刪除子題 |

### 部署

需 redeploy：**api**、**host**、**participant**、**admin**（功能變更）；文件-only push 無需 redeploy。

---

## HISTORY

### 2026-06-15 — api 502 修復（ea460f7 + e634fe4）

管理後台／Host／Participant 皆因 api 掛掉而無法登入或 fetch。Zeabur api 在 `alembic upgrade head` 階段失敗；修正 migration 鏈與 PostgreSQL enum 交易後 redeploy，health 恢復 200。

### 2026-06-15 — 五大服務架構文件

新增 `docs/服務架構.md`；更新 AGENTS、README、RUNBOOK、Zeabur 指引索引。

### 2026-06-15 — Quiz 子題開始 + 後台成員編輯 + cohost Quiz UI（10cc916）

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
