# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-15）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`c74ce13` — 登入輸入框可見性、Host 手機 RWD
- **api 健康**：https://le-api.zeabur.app/health → 200
- **Zeabur 部署**：push `c74ce13` 後 redeploy；**host**、**admin**、**participant** 皆 `RUNNING`（2026-06-15 16:20 UTC）

### 本輪重點

| 區塊 | 內容 |
|------|------|
| **登入輸入框** | 手機（iOS 深色模式）白字白底看不見；`color-scheme` 對齊主題、`text-foreground`、`-webkit-text-fill-color`；Host／Admin／Participant 登入頁共用 |
| **Host 頂欄 RWD** | `HostRoomNavHeader` 改為品牌列 → 標題 → 分頁橫向滑動 → 投影／分享獨列；控場列可換行 |
| **Hub 列表 RWD** | Poll／Quiz 管理列改直向堆疊；操作鈕 `flex-wrap`；`HubCreateCard` 手機全寬表單 |

### 部署（本輪）

| 服務 | URL | 變更 |
|------|-----|------|
| host | https://le-host.zeabur.app | 頂欄 RWD、工作台控場列 |
| admin | https://le-admin.zeabur.app | 登入輸入框可見性（ui） |
| participant | https://le-participant.zeabur.app | 加入頁輸入框可見性（ui） |
| api | https://le-api.zeabur.app | 本輪無變更 |
| worker | （內部） | 本輪無變更 |

---

## SNAPSHOT（2026-06-15，歷史）

- **最新 commit（舊）**：`84b76ab` — 問卷填寫明細、頂欄「進行中」膠囊
- **測試**：`test_fe012_survey_multiple_choice_and_open_text` 涵蓋 `GET /surveys/{id}/submissions`
- **api 健康**：https://le-api.zeabur.app/health → 200
- **Zeabur 部署**：push `84b76ab` 後 `zeabur service redeploy`；**api**、**host** 皆 `RUNNING`（2026-06-15 15:47 UTC）

### 本輪重點（問卷填寫明細／頂欄膠囊）

| 區塊 | 內容 |
|------|------|
| **問卷填寫明細** | 後端 `GET /api/v1/surveys/{id}/submissions`（Host）；逐人完整答案（評分／選擇題文字／開放文字全文）；工作台「填寫明細」區塊每 8s 刷新 |
| **頂欄進行中膠囊** | Q&A 開啟 →「Q&A 審核」；Poll `active`/`locked` →「Poll 管理」；Quiz 進行中 →「Quiz 管理」；絕對定位於標籤右下角，不推擠文字 |
| **共用** | `useHostRoomNavLiveState` + `HostRoomNavItem.liveIndicator`；`isPollRunning` 移至 `pollTypes.ts` |

### 部署（本輪）

| 服務 | URL | 變更 |
|------|-----|------|
| api | https://le-api.zeabur.app | Survey submissions API — RUNNING |
| host | https://le-host.zeabur.app | 填寫明細 UI、頂欄膠囊 — RUNNING |
| participant | https://le-participant.zeabur.app | 本輪無變更 |
| admin | https://le-admin.zeabur.app | 本輪無變更 |
| worker | （內部） | 本輪無變更 |

---

## SNAPSHOT（2026-06-15，歷史）

- **最新 commit（舊）**：`8c611f2` — Quiz 揭曉、問卷多題型、Q&A 投票與工作台 UX 優化
- **測試**：`test_s9_phase_d` 新增 quiz reveal／host is_correct／survey 多題型用例
- **api 健康**：https://le-api.zeabur.app/health → 200
- **Zeabur 部署**：push `8c611f2` 後自動建置；**api**、**host**、**participant** 皆 `RUNNING`（2026-06-15）

### 本輪重點（Quiz／問卷／Q&A／工作台 UX）

| 區塊 | 內容 |
|------|------|
| **Quiz 揭曉** | `reveal` 先 flush 子題再恢復父 Quiz，避免 `uq_interactions_active_room` 衝突；參與者 `active-question` 支援 `revealed`；`POLL_RESULT_REVEALED` 同步揭曉 UI |
| **Quiz 編輯** | Host API 回傳 `is_correct`；子題編輯頁「本題工作台」藍色按鈕；儲存須恰好一個正解 |
| **問卷 Survey** | 工作台支援**評分／選擇／開放文字**三題型；Host 列表含選項；開放文字回應數自 submission 統計 |
| **Q&A 投票** | 參與者 👍／👎 toggle（灰階↔彩色）；樂觀更新含倒讚；`downvote_enabled` 預設 true；審核面板文案調整 |
| **工作台 UX** | 控場列（上一題／下一題／開放／編輯）固定於 `HostRoomNavHeader.navControls`；Poll 編輯頁標題「題目編輯」 |
| **其他** | 參與者等待文案 17px；`RoomWaitingPlaceholder` 統一 |

### 部署（本輪）

| 服務 | URL | 狀態 |
|------|-----|------|
| api | https://le-api.zeabur.app | RUNNING |
| host | https://le-host.zeabur.app | RUNNING |
| participant | https://le-participant.zeabur.app | RUNNING |
| admin | https://le-admin.zeabur.app | 本輪無變更（未觸發 redeploy） |
| worker | （內部） | 本輪無後端匯出變更 |

---

## SNAPSHOT（2026-06-15，歷史）

- **最新 commit（舊）**：`92c9365` — CSV 匯出 DictWriter 欄位聯集修復
- **typecheck**：`admin` 通過；`test_public_url` 2 passed
- **接手文件**：[`docs/服務架構.md`](docs/服務架構.md)
- **api 健康**：https://le-api.zeabur.app/health

### 本輪重點（匯出下載修復）

| 區塊 | 內容 |
|------|------|
| **根因** | `download_url` 可能用錯主機（proxy 內部 `base_url`）或相對路徑落在 **admin** 靜態站；Zeabur 未設 `LE_API_PUBLIC_URL` |
| **後端** | `api_public_base_url()` 優先 `LE_API_PUBLIC_URL`；`ProxyHeadersMiddleware` + uvicorn `--proxy-headers` |
| **Admin** | `resolveExportDownloadUrl()` 強制指向 `VITE_API_BASE`；pending/processing 每 3s 輪詢 |
| **Zeabur** | api 服務已設 `LE_API_PUBLIC_URL=https://le-api.zeabur.app` |

### 部署（本輪）

需 redeploy：**api**（public_url、proxy）、**admin**（下載連結重寫）；**worker** 無變更可略。

| 服務 | URL |
|------|-----|
| api | https://le-api.zeabur.app |
| admin | https://le-admin.zeabur.app |

---

## SNAPSHOT（2026-06-15，歷史）

- **最新 commit（舊）**：`e0bfeaf` — 品牌 Logo、參與者會場等待文案與登入頁精簡
- **typecheck**：`ui`／`host`／`admin`／`participant` 通過
- **接手文件**：[`docs/服務架構.md`](docs/服務架構.md)
- **api 健康**：https://le-api.zeabur.app/health

### 本輪重點（品牌／參與者 UX／文案，231abab，歷史）

| 區塊 | 內容 |
|------|------|
| **預設 Logo** | `OrgBrandMark` 未設定組織 Logo 時 fallback `/liveengage-logo.png`；`AppHeader` 左上角一律顯示 Logo（Admin／Host／Participant 共用 `@liveengage/ui`） |
| **參與者等待** | 新增 `RoomWaitingPlaceholder`；Poll／Quiz 統一「目前互動尚未開始，請等候活動主持人啟動互動項目」 |
| **Q&A 未開放** | `qaOpen` 閘道：未 active 不顯示表單，顯示「目前尚未開放發問，請等候活動主持人啟動Q&A」；標題改「發問問題」；頁籤 live 指示 |
| **Host 登入** | 移除 `BrandedAuthShell` `footer`（含分隔線與底部說明文字） |
| **Participant 首頁** | 活動代碼副標移除「以加入活動」 |

### 部署（本輪，歷史）

Git push `231abab` 後 Zeabur 自動建置；需 redeploy：**host**、**participant**、**admin**（皆含 `ui`）；**api**／**worker** 無後端變更可略。

| 服務 | URL |
|------|-----|
| api | https://le-api.zeabur.app |
| host | https://le-host.zeabur.app |
| participant | https://le-participant.zeabur.app |
| admin | https://le-admin.zeabur.app |

---

## SNAPSHOT（2026-06-14，歷史）

- **最新 commit（舊）**：`0a3866d` — 工作台與管理頁 UX 強化、點子隱藏切換與刪除修復

| 區塊 | 內容 |
|------|------|
| **工作台控場** | 「上一題／下一題／開放／Poll 控場」移至中欄置中；移除頂欄 Q&A 按鈕與 `QaModerationModal` |
| **編輯／刪除** | `WorkbenchInteractionActions`：編輯題目、刪除題目移至工具列末端（compact 樣式）；標題列僅留狀態徽章 |
| **Sprint9 開放** | 移除 `Sprint9ActivateBanner`；「開放」按鈕無狀態圓點（`showDot={false}`） |
| **點子牆** | Host 端隱藏／顯示切換；隱藏項灰色仍可見；參與者列表過濾 hidden；`POST …/show` + `idea_visibility_changed` WS |
| **刪除互動修復** | 列表排除 Quiz／Survey **子題** child interaction；DELETE 冪等（404 視成功）；Hub 刪除樂觀更新 |
| **Quiz 子題** | 各狀態可 `update_question`；`closed` 可重啟；新增 `hide` action；`result_visible` 欄位 |
| **Poll／Quiz 管理** | `HubCreateCard` 與 Q&A 提問同高；Quiz 標題「新增 Quiz」；空狀態「尚無 Quiz」 |
| **麵包屑** | 工作台、即時總覽補上 `HostRoomHubBreadcrumb`（活動列表／活動名／目前頁） |
| **文案** | 「活動儀表板」→「活動列表」；Logo hover「回到活動列表」 |
| **參與者會場** | 頂欄單行「LiveEngage 互動會場：{活動名}」；頁籤 Poll／Quiz／Q&A；Q&A「問題列表」文案 |

### 部署（本輪，歷史）

Git push `0a3866d` 後 Zeabur 自動建置；需 redeploy：**api**（ideas／interaction／quiz）、**host**、**participant**（含 `realtime`）；**worker** 無 Celery 變更可略。

| 服務 | URL |
|------|-----|
| api | https://le-api.zeabur.app |
| host | https://le-host.zeabur.app |
| participant | https://le-participant.zeabur.app |
| admin | https://le-admin.zeabur.app |

---

## SNAPSHOT（2026-06-14，歷史）

- **最新 commit（舊）**：`c51b348` — 三端登入文案、頁面標題與頂欄品牌統一

| 區塊 | 內容 |
|------|------|
| **useHostRoomSessionMeta** | `HostShell` 自動解析 session 列；Q&A／Poll／Quiz 管理頁與工作台／總覽一致 |
| **工作台頂欄** | 狀態徽章改為**活動** `session.status`（不再跟題目狀態） |
| **互動題狀態膠囊** | `WorkbenchInteractionStatusBadge`：右上角膠囊（進行中 accent／已結束 muted） |
| **Quiz 子題** | `close` 廣播 `quiz_question_closed` + `poll_stopped`；父 Quiz 結束時一併關閉子題 |
| **Quiz UX** | 編輯按鈕始終顯示；子題按鈕逐列 pending，避免「結束」被全域鎖定 |

### 部署（本輪）

Git push `1547a3d` 後 Zeabur 自動建置；需 redeploy：**api**、**host**、**participant**（含 `realtime`／`renderers`）；**worker** 無 Celery 變更可略。

---

## SNAPSHOT（2026-06-14，歷史）

- **最新 commit（舊）**：`9e7fd62` — 工作台/總覽頂欄 session 列與排序題手機操作

| 區塊 | 內容 |
|------|------|
| **hostSessionHeader** | 工作台／即時總覽共用 `hostSessionMetaFromSession()`：日期、代碼、可見性、活動名、狀態徽章 |
| **工作台頂欄** | 標題固定「工作台」；活動名稱（10px、主題色）顯示於狀態徽章左側 |
| **即時總覽頂欄** | 比照工作台 `sessionMeta` 列；移除舊 `HostSessionMeta` 重複活動名行 |
| **主題色** | `#代碼` 與活動名稱改 `text-accent` |
| **排序題** | 修正觸控拖曳（pointer 事件綁握把）；右側 ↑↓ 箭頭微調（首尾僅單向） |

### 部署（本輪）

Git push `9e7fd62` 後 Zeabur 自動建置；需 redeploy：**host**（含 `ui`）、**participant**（含 `renderers`）；**api**／**worker** 無後端變更可略。

---

## SNAPSHOT（2026-06-15，歷史）

- **最新 commit（舊）**：`37e4479` — 統一房間頂欄、Logo 回儀表板與 Poll/Quiz 操作列

| 區塊 | 內容 |
|------|------|
| **HostRoomNavHeader** | 工作台／總覽／審核／Poll／Quiz 五頁共用頂欄；Logo、導覽、投影／分享固定右上 |
| **Logo 導覽** | 組織 Logo 點擊回活動儀表板（hover tip「回到活動儀表板」）；頁面標題改純文字 |
| **即時總覽** | 移除「進行中」徽章、WS 連線字樣、多餘快捷鈕；活動代號 `( CODE )` 併入頂欄 meta |
| **Poll/Quiz 列表** | 固定五鍵：工作台（主題色）、開始、投影、編輯、刪除；精簡 `le-btn-present-compact` 尺寸 |
| **分享按鈕** | 與投影同尺寸；無投影 URL 時隱形佔位防位移 |

### 部署（本輪）

Git push `37e4479` 後 Zeabur 自動建置；需 redeploy：**host**（含 `ui` 套件）；**participant** 若共用 ui 變更可選；**api**／**worker** 無後端變更可略。

---

## SNAPSHOT（2026-06-15，歷史）

- **最新 commit（舊）**：`32912f0` — 工作台強化、排序題統計與可設定評分尺度

### 本輪重點（工作台強化 + 評分尺度，32912f0）

| 區塊 | 內容 |
|------|------|
| **評分尺度** | 主持人於 Poll 編輯頁設定 `min_value`／`max_value`（最高 100）；max≤5 按鈕、6–10 下拉、>10 數字輸入 |
| **排序題** | `RankingSortableList` 拖曳作答；`ranking_order_counts` 排列組合統計；`ResultRankingOrders` 結果頁 |
| **工作台 UX** | 左欄 HTML5 拖曳排序（`PUT …/interactions/reorder`）；雙擊標題編輯 `WorkbenchInteractionTitle` |
| **頂欄** | `SessionToolbar` 房間導覽；`AppHeader` 狀態徽章右上；儀表板按鈕順序調整 |
| **Poll** | 揭曉後顯示正解；工作台刪除題目 Modal；問卷新增評分題修復 |
| **後端** | `RatingSettings` 區間驗證；`test_interaction_reorder`；rating 自訂尺度測試 |

### 部署（本輪）

Git push `32912f0` 後 Zeabur 自動建置；需 redeploy：**api**、**host**、**participant**（renderers 共用）；**worker** 無 Celery 任務變更可略；**admin** 無變更可略。

---

## SNAPSHOT（2026-06-14，歷史）

- **最新 commit（舊）**：`073bba4` — 統一活動工作台、Q&A Modal、即時總覽投影

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

### 2026-06-15 — 統一房間頂欄、Logo 回儀表板與 Poll/Quiz 操作列（37e4479）

`HostRoomNavHeader` 五頁共用；Logo 取代標題連結回儀表板；即時總覽精簡；`HubInteractionRowActions` 精簡五鍵操作列。

### 2026-06-15 — 工作台強化、排序題統計與可設定評分尺度（32912f0）

評分題主持人可設 min/max 與三種作答 UI；排序題拖曳 + 排列統計；工作台拖曳排序與標題編輯；頂欄導覽與正解顯示等多項 Host UX。

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
