# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-14）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`073bba4` — 統一活動工作台、Q&A Modal、即時總覽投影
- **typecheck**：`host` build 通過（`npm run typecheck` + `vite build`）
- **接手文件**：[`docs/服務架構.md`](docs/服務架構.md)
- **api 健康**：https://le-api.zeabur.app/health

### 本輪重點（統一工作台 + 總覽投影，073bba4）

| 區塊 | 內容 |
|------|------|
| **統一活動工作台** | `#/rooms/:id/workbench` 管理 Poll 五型 + Quiz/Ideas/Survey；左欄全互動清單；中欄依類型切換控場；右欄參與者預覽 |
| **路由整合** | `/polls/:id/console`、`/sprint9/:id/console` 自動導向 workbench；Hub／Builder 連結更新 |
| **Q&A Modal** | 工作台頂欄「Q&A」+ 待審 badge；`QaModerationPanel` 抽出共用；可跳轉完整審核頁 |
| **文案** | 「控制台」統一為「工作台」；登入「活動主持工作台」 |
| **即時總覽** | 移除重複活動名稱（subtitle）；右上角投影按鈕；`#/overview/present` + `OverviewPresentPage` |
| **Poll 正解** | `shouldShowCorrectAnswer()`：僅 `result_visible` 或工作台預覽顯示正解標記 |
| **Host 導覽** | `HostShell` 頂欄新增「工作台」入口 |

### 部署（本輪）

Git push `073bba4` 後 Zeabur 自動建置；本輪僅 **host**（含 `renderers`/`ui`）必 redeploy；**api**／**worker** 無後端變更可略；**participant** 若共用 renderers 變更建議一併 redeploy。

### 本輪重點（Host Overview + 投影 + UX，35073c8）

| 區塊 | 內容 |
|------|------|
| **Host 即時總覽** | `GET /sessions/{id}/overview`、`/participants`；`RoomOverviewPage`（`#/rooms/:roomId/overview`）；KPI + Live Poll + 熱門 Q&A + Quiz/Survey + 參與者名單；WS + 12s 輪詢 |
| **Poll 投影** | `PresentPage` 改唯讀（移除底部控場列與快捷鍵）；狀態膠囊配色（綠／琥珀／紅）；移除「投影」標籤 |
| **文字雲** | `WordCloudDisplay` 依詞數自適應縮放；≥48 詞才捲動 |
| **Q&A 參與者** | 按讚 FLIP 平滑重排（`useAutoFlipList`、`qaSort`、`qaCache`） |
| **Join** | 匿名預設不勾選；暱稱空且非匿名時 Modal 提示 |
| **登入標題** | `productTitleLines()` 兩行（組織名 + 即時互動通） |
| **Host 控場** | 「結束」danger 紅；「重設」與鎖定／揭示同風格 |

### 部署（本輪）

需 redeploy：**api**、**host**、**participant**、**admin**（OrganizationPage 小改）；**worker** 無程式變更可略。

### 本輪重點（品牌／主題，24f4358）

| 區塊 | 內容 |
|------|------|
| **主題配色** | `override_theme_colors` 預設 `false`；未勾選時五種主題（Slido／Light／Dark／Cursor／Claude）各自 accent |
| **組織主色覆寫** | 後台核取方塊「使用組織主色覆蓋主題按鈕與連結配色」；勾選後 `syncBrandingThemeColors()` 寫入 `--le-accent` |
| **公開顯示名稱** | `_public_branding_from_org`：一律 `org.name`，不再讀 `branding.display_name` |
| **Admin 組織設定** | 「組織資料」與「品牌外觀」合併；移除「品牌顯示名稱」欄位；說明移至組織名稱下方 |
| **Admin 已登入** | `AdminBrandingRoot` 載入 `/api/v1/branding/me` 套用 favicon／主題色 |

### 部署（本輪）

已 redeploy：**api**、**admin**、**host**、**participant**（`24f4358`）；**worker** 無程式變更可略。

### 本輪重點（UI／登入／品牌，ab0e987）

| 區塊 | 內容 |
|------|------|
| **三端登入品牌** | `BrandedAuthShell`：組織名稱＋Logo；預設 LiveEngage 即時互動通／Logo |
| **公開 API** | `GET /api/v1/branding/site`（Admin／Host 登入頁） |
| **Host 文案** | 「Host 控制台」→「活動主持控制台」 |
| **Enter 登入** | Admin／Host 登入表單 Enter 提交 |
| **Modal** | 最大高度＋內容捲動，修正編輯成員按鈕被裁切 |
| **Admin 側欄** | 寬度 240px → 120px |
| **主題選單** | 更緊湊、分隔線、必要時可捲動 |

### 部署（ab0e987 輪）

需 redeploy：**api**、**admin**、**host**、**participant**；**worker** 無程式變更可略。

### 本輪重點（api 502，已修）

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

### 2026-06-14 — 統一活動工作台、Q&A Modal、即時總覽投影（073bba4）

單一 workbench 控 Poll + Sprint9；Q&A 審核 Modal；overview 投影頁；console 路由導向；正解顯示修正；總覽頁重複標題修正。

### 2026-06-15 — Host 即時總覽、投影唯讀化、文字雲自適應（35073c8）

Session overview/participants API；`RoomOverviewPage`；投影頁唯讀 + 狀態膠囊；文字雲自適應；Q&A FLIP 重排；Join／登入／控場 UX。

### 2026-06-15 — 組織主色可選覆蓋主題、合併後台組織設定（24f4358）

`override_theme_colors` 核取方塊；`orgBranding` 僅在勾選時覆寫 accent；公開品牌顯示名稱改組織名稱；Admin `OrganizationPage` 單一面板；`AdminBrandingRoot`。

### 2026-06-15 — 三端登入品牌、Modal／側欄／主題選單 UI

`BrandedAuthShell`、`/branding/site`、Enter 登入、Modal 捲動、Admin 側欄半寬、ThemeSwitcher 緊湊化。

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
