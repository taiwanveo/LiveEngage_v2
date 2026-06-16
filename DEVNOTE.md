# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-16 — 長條圖票數放大與彈跳動畫）

- **最新 commit**：`755d27e` — 中央票數 +25px、CSS keyframes 彈跳／閃光
- **Zeabur**：**host**、**screen** redeploy

| 變更 | 說明 |
|------|------|
| `BarCountLabel` | 投影字級約 39–49px（原 14–24 +25） |
| `barCountLabel.css` | `le-bar-count-pop` scale 彈跳 + 光暈 + 黃色閃光 |
| `ResultBarChart` | 投影圖表高度 280→320px |

---

## SNAPSHOT（2026-06-16 — Screen 預設／組織 favicon）

- **最新 commit**：`9592b3f` — Screen 與全端 favicon 修復
- **Zeabur**：**api**、**host**、**screen** redeploy

| 問題 | 根因 | 修復 |
|------|------|------|
| le-screen 無 favicon | Screen 未載入 `OrgBrandingProvider`；`index.html` 無預設 icon | `ScreenBrandingRoot` + `/favicon.png` |
| 後台已設組織 favicon 仍不顯示 | Screen 無 branding API 呼叫 | 新增 `GET /branding/by-session/{id}` |
| 未設定組織 favicon 時空白 | `applyOrgBranding` 僅在有 URL 時才寫入 | 改為 fallback `DEFAULT_LIVEENGAGE_FAVICON` |

### 部署

| 服務 | deployment |
|------|------------|
| api | `6a30edf4…` |
| screen | `6a30ee04…` |
| host | `6a30ee05…` |

---

## SNAPSHOT（2026-06-16 — 即時聚合雙 Toggle）

- **最新 commit**：`68bfe88` — 投影／Join 即時聚合雙開關（`live_aggregate_screen` / `live_aggregate_join`）
- **Zeabur**：**api**、**host**、**screen**、**join** redeploy

| 層級 | 變更 |
|------|------|
| 後端 | `live_aggregate_settings.py`；`get_poll_results` 依身分與開關授權；WS `poll_response_submitted` / Ideas 事件依開關決定 `target_modes` |
| renderers | `shouldShowAggregateResults` 取代文字雲特例；Poll 全系預設 screen ON / join OFF；Ideas 預設兩邊 ON |
| Host | 工作台控場列「投影即時」「Join 即時」雙 Toggle |
| Screen / Join | 僅在開關或揭曉後拉取／顯示聚合結果 |

### 顯示邏輯（共識）

| 端 | 規則 |
|----|------|
| Host 工作台 | 永遠可看聚合 |
| Screen | `(active/locked && live_aggregate_screen) \|\| result_visible` |
| Join | `(active/locked && live_aggregate_join) \|\| result_visible` |
| 揭曉答案 | 維持既有流程，揭曉後 Join/Screen 一律可看最終結果 |

### 部署（本輪）

| 服務 | deployment | URL |
|------|------------|-----|
| **api** | `6a30ec19…` | https://le-api.zeabur.app |
| **host** | `6a30ec1b…` | https://le-host.zeabur.app |
| **screen** | `6a30ec1e…` | https://le-screen.zeabur.app |
| **join** | `6a30ec1f…` | https://le-join.zeabur.app |

### 驗收建議

1. 建立選擇題 → 預設投影即時 ON、Join 即時 OFF → 參與者作答後投影即時更新、Join 不顯示票數
2. 開啟 Join 即時 → 參與者端即時看到長條圖／文字雲
3. 關閉投影即時 → Screen 進行中不顯示聚合；揭曉後仍顯示
4. 點子牆預設兩邊 ON；關閉 Join 即時後參與者僅見自己的點子

---

## SNAPSHOT（2026-06-16 — 長條圖中央票數與動畫）

- **最新 commit**：`cc8ed7f` — 投影選擇題長條圖中央顯示票數、增加時彈跳動畫
- **Zeabur**：**host**、**screen** redeploy（共用 `@liveengage/renderers`）

| 變更 | 說明 |
|------|------|
| `BarCountLabel` | 長條正中白色粗體票數 |
| `useCountBumps` | 票數增加時標籤 scale 彈跳 |
| `ResultBarChart` | 長條寬度 480ms 過渡 + `LabelList` |

### 部署

| 服務 | URL |
|------|-----|
| **host** | https://le-host.zeabur.app |
| **screen** | https://le-screen.zeabur.app |

---

## SNAPSHOT（2026-06-16 — 文字雲即時顯示修復）

- **最新 commit**：`3a66613` — 文字雲進行中即時顯示於 Host 與 Screen
- **Zeabur**：**api**、**host**、**screen** 皆 redeploy → RUNNING

| 症狀 | 根因 | 修復 |
|------|------|------|
| 參與者送詞後 Host／投影皆空白 | ① `poll_response_submitted` 只廣播至 `present`+`host`，**Screen WS 收不到** ② 投影 `showResults` 需 `result_visible` 才帶入 results ③ Host 右欄預覽 `shouldShowParticipantResults` 在 `result_visible=false` 時直接 return | 後端 `MODE_POLL_LIVE_AGG` 含 screen；`shouldPresentPollResults` 文字雲進行中即顯示；修正 host 預覽邏輯 |

### 部署（本輪）

| 服務 | URL | 狀態 |
|------|-----|------|
| **api** | https://le-api.zeabur.app | **RUNNING**（deployment `6a30cb83…`） |
| **host** | https://le-host.zeabur.app | **RUNNING** |
| **screen** | https://le-screen.zeabur.app | **RUNNING** |

### 驗收

- [ ] 文字雲 Poll 開始後，Join 送詞 → Host 中欄「投影預覽」與右欄即時出現詞彙
- [ ] 同一時間 Screen 投影同步更新（無需按「揭曉答案」）

---

## SNAPSHOT（2026-06-16 — Host Screen 同步 CPU／切題修復）

- **最新 commit**：`3bfeec8` — 修復 Host Screen 同步 CPU 飆高與結束切題競態
- **Zeabur**：僅 **host** redeploy（deployment `6a30c7b0…`）；**screen** 本輪無程式變更，不需重部署

| 症狀 | 根因 | 修復 |
|------|------|------|
| 瀏覽器 CPU ~100% | 工作台與頂欄各呼叫 `useScreenControl`；Screen PUT 重複觸發；WS 連線時仍輪詢 | 共用單一 screen 實例；PUT 去重＋佇列；`wsConnected` 時停 poll／nav 輪詢 |
| 結束 Poll 後切下一題失敗 | 操作進行中仍同步 Screen；Sprint9 狀態綁錯 `selectedId` | `paused` 暫停跟隨；`interactionId` 綁定；`lastSyncedId` 去重 |

### 部署（本輪）

| 服務 | URL | 狀態 |
|------|-----|------|
| **host** | https://le-host.zeabur.app | **RUNNING**（deployment `6a30c7b0…`） |
| screen | https://le-screen.zeabur.app | **無變更**（沿用現版） |
| api／join／admin | （同前） | 無變更 |

### 驗收（上線後手測）

- [ ] 工作台開啟後工作管理員 CPU 應明顯低於修復前
- [ ] Poll A「結束」→ 選 Poll B → Screen 穩定切到 B
- [ ] 頂欄 Screen「測試」／「全螢幕」仍正常

---

## SNAPSHOT（2026-06-16 — 測試／全螢幕按鈕修復）

- **最新 commit**：`7d385fc` — 測試畫面與全螢幕遙控可感知
- **host + screen** redeploy

| 按鈕 | 設計用途 | 先前無反應原因 | 修復後 |
|------|----------|----------------|--------|
| **測試** | 投影切換大寫 **TEST** 畫面，確認通道 | Host 無提示；跟隨工作台 120ms 內覆蓋回 Poll | Host 成功提示；暫停跟隨 8s |
| **全螢幕** | 通知投影視窗進入全螢幕 | `noopener` 導致無視窗參考；跨網域無法代按 requestFullscreen | 投影視窗彈出「進入全螢幕」確認層；F 鍵仍可用 |

---

## SNAPSHOT（2026-06-16 — 工作台切題 Screen 閃爍修復）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`06e4fac` — 修復工作台結束／切題時 Screen 閃爍與 Poll 控場競態
- **api 健康**：https://le-api.zeabur.app/health → 200
- **Zeabur**：**host** redeploy → RUNNING

### 本輪重點

| 區塊 | 內容 |
|------|------|
| **症狀** | 結束 Poll 後切下一題：Host 彈「無法連上伺服器」；Screen 在兩題間來回切換 |
| **根因 1** | `useScreenWorkbenchSync` 依賴 `syncWorkbenchItem`，而該 callback 隨每次 Screen PUT 完成而變參考 → **每次 PUT 成功又觸發一次同步**，與切題 PUT 競態 |
| **根因 2** | `actionMutation` 用當前 `selectedId` 處理 onSuccess；**結束 A 後快速選 B** 時，stop 回應被誤套到 B |
| **修復** | `mutateScreenState` 穩定引用 + 120ms debounce；Poll action 變數綁定 `pollId`；`applyHostPollActionSuccess` 優先 `data.poll_id` |

### 踩雷與教訓（本輪）

| 問題 | 解法 |
|------|------|
| React Query `useMutation` 整包物件不可放 `useCallback` deps | 解構 `mutate`（穩定引用） |
| 跟隨類 effect 勿依賴會隨 mutation 變化的 callback | 用 `useRef` 保存最新函式，deps 只放 selection id |

---

## SNAPSHOT（2026-06-16 — 登入錯誤提示與 Screen 啟動修復）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`e4f05aa` — 登入表單內嵌錯誤提示；Screen 從 JWT 解析 `room_id`；Host 改產生 `room=` 投影連結
- **api 健康**：https://le-api.zeabur.app/health → 200
- **Zeabur**：`e4f05aa` push 後 **screen**、**host**、**admin** 皆手動 `deploy-from-specification` → **RUNNING**

### 本輪重點

| 區塊 | 內容 |
|------|------|
| **登入 UX** | Host／Admin 登入改表單內嵌紅色提示（`LoginErrorBanner`）；客戶端驗證空欄位／Email 格式／密碼長度；`formatLoginError` 對 401／429 給明確中文 |
| **Screen bug** | `event=` 模式誤依賴 `by-code` 的 `default_room_id`，但公開 API 不含此欄 → 顯示「請提供 event= 或 room=」 |
| **Screen 修復** | `parseScreenTokenPayload` 從 JWT 讀 `room_id`／`session_id`；舊 `event=…&token=…` 連結可正常啟動 |
| **Host** | `useScreenControl` 一律 `screenUrlByRoom(roomId, token)`，不再產生 `event=` URL |

### 部署（本輪）

| 服務 | URL | 狀態 |
|------|-----|------|
| **screen** | https://le-screen.zeabur.app | RUNNING（deployment `6a30bdf8…`） |
| **host** | https://le-host.zeabur.app | RUNNING（deployment `6a30bdf8…`） |
| **admin** | https://le-admin.zeabur.app | RUNNING（deployment `6a30bdf9…`） |
| api／join／worker | （同前） | 本輪無變更 |

### 踩雷與教訓（本輪）

| 問題 | 原因 | 解法 |
|------|------|------|
| Screen 開啟後卡在「解析活動代碼…」再報缺參數 | `SessionPublicResponse`（by-code）**不含** `default_room_id`；Screen 卻讀 `codeQuery.data.default_room_id` | 從 **screen JWT** 取 `room_id`；Host 改發 `room=` URL |
| 登入錯誤看不到 | 僅 Modal `showError`，易被忽略或誤關 | 改表單內嵌 `LoginErrorBanner` + 客戶端驗證 |

### 驗收（上線後手測）

- [ ] Host 頂欄 **Screen** → 投影 standby（URL 含 `room=` + `token=`）
- [ ] 故意輸錯 Host 帳密 → 表單內顯示「帳號或密碼錯誤」
- [ ] Admin 登入空欄位 → 「請輸入 Email」／「請輸入密碼」

---

## SNAPSHOT（2026-06-16 — Screen 獨立投影 App）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`123cf8a` — Screen 獨立投影 App 與 Host 遙控
- **api 健康**：https://le-api.zeabur.app/health → 200
- **Zeabur**：`123cf8a` push 後 **screen** 服務已建立並 **RUNNING**；api 重建中；host 已觸發含 `VITE_SCREEN_BASE` 的 redeploy

### 本輪重點（重大變動）

| 區塊 | 內容 |
|------|------|
| **架構** | 投影從 Host 同源 `#/present` 升級為獨立 **Screen App**（`le-screen.zeabur.app`）；Host 經 REST 寫入 display state，Screen 經 WS `screen_view_changed` 切畫面 |
| **後端** | `screen.py`、`screen_service`（Redis `screen:room:{id}`）、`screen` JWT + epoch 撤銷、`WsMode.SCREEN`、Idempotency middleware |
| **讀取授權** | Screen token 擴及 Poll／Quiz／Survey／Overview／Ideas 唯讀 API（`screen_reader_auth.py`）；Poll 另驗 `screen_room_id` 防跨房讀取 |
| **Screen App** | `frontend/apps/screen` + `Dockerfile.screen`；standby／test／poll／qa／quiz／ideas／survey／overview 全覆蓋 |
| **Host** | `ScreenControlPanel`、`useScreenControl`（跟隨工作台、Poll 揭曉同步）、`VITE_SCREEN_BASE` |
| **URL** | `screenUrlByEvent` / `screenUrlByRoom`；`?theme` `?bg` `?fg` |
| **過渡** | Host 內 `#/…/present` 路由保留；頂欄改開 Screen |

### 部署（本輪）

| 服務 | URL | 變更 |
|------|-----|------|
| **screen**（新） | https://le-screen.zeabur.app | 服務 ID `6a30b4bf…`、deployment RUNNING（2026-06-16） |
| **api** | https://le-api.zeabur.app | Screen REST + WS — push 後 BUILDING |
| **host** | https://le-host.zeabur.app | 手動 redeploy 含 `VITE_JOIN_BASE` + `VITE_SCREEN_BASE` |
| join／admin／worker | （同前） | 本輪無變更 |

### 開始使用（含 Screen）

| 角色 | 入口 | 典型流程 |
|------|------|----------|
| **Host** | https://le-host.zeabur.app | 控場 → 頂欄 **Screen** → 跟隨工作台 |
| **Screen** | https://le-screen.zeabur.app | 外接螢幕／OBS（URL 含 token） |
| **Join** | https://le-join.zeabur.app | 參與者掃碼加入 |

### Screen 使用流程

1. Host 登入 → 進 Room → 頂欄 **Screen** 開投影窗（拖到外接螢幕一次）
2. 勾選「跟隨工作台」→ 切 Poll／Quiz 等時投影自動切換（**不換網址**）
3. 投影端按 **F** 全螢幕；同機 Host 可按「全螢幕」`postMessage`
4. Screen token 在 URL 中 — 視為機密連結；可 `POST …/screen-token/revoke` 輪換

### 踩雷與教訓（本輪）

| 問題 | 原因 | 解法 |
|------|------|------|
| Screen 開了 Poll 但 API 401 | 舊設計僅 participant／host JWT 可讀 `/polls/{id}`；screen token 未被 `get_poll_viewer` 接受 | 擴充 viewer 鏈：participant → **screen** → host；Poll service 加 `screen_room_id` 校驗 |
| Quiz／Survey／Overview 投影無資料 | 原端點硬綁 `get_current_user` | `HostOrScreenAuth` + service 層 `_load_*_for_screen` |
| `idempotent_response` 不存在 | 計畫草稿引用不存在的 helper | 改依現有 **IdempotencyMiddleware**（寫入帶 `Idempotency-Key` 即可） |
| `room=` URL 缺 sessionId | Overview 需 `session_id` 打 `/sessions/{id}/overview` | display state 持久化 **`session_id`**；Screen App 從 state 或 by-code 解析 |
| TypeScript `exactOptionalPropertyTypes` | `session_title: undefined` 不能賦給 `string \| null` | 用條件 spread `...(title != null ? { session_title: title } : {})` |
| `isPollType` import 錯誤 | 從 `workbenchTypes` 匯入但未 re-export | 改從 `pollTypes` 匯入 |
| Overview 複製到 screen | `OverviewDashboard` 依賴 host 路徑 | 複製到 `apps/screen/src/components` 並改 import；內嵌 `pollTypeLabel` |
| Zeabur 新前端服務 | `dockerfile.path` 有時失敗（Join 建服務時） | 與 join 相同：用 **`deploy-from-specification` + `dockerfile.content`** 內嵌 Dockerfile |
| Host Zeabur spec 過期 | Git push 觸發 redeploy 但 spec 內 Dockerfile 可能缺 `VITE_*` | push 後對 **host** 再跑一次 `deploy-from-specification`，內嵌完整 `Dockerfile.host` |
| 外接螢幕無法程式指定 | 瀏覽器安全限制 | 僅能第一次手動拖曳；文件與 UI 需說明按 F |

### 驗收清單（上線後手測）

- [ ] Host 開 Screen → standby 顯示連線綠點
- [ ] 工作台切 Poll + 揭曉 → 投影切題／長條圖不換 URL
- [ ] Q&A／Quiz／Ideas／Survey／Overview 各切一次
- [ ] `event=CODE` 與 `room=UUID` 雙 URL 皆可開
- [ ] 斷網 10s 後 WS 自動重連

---

## SNAPSHOT（2026-06-16，Join 更名）
- **api 健康**：https://le-api.zeabur.app/health → 200
- **Zeabur 部署**：push `f29e616` 後；**join**、**host**、**participant（轉址）** 皆 `RUNNING`（2026-06-16 01:01 UTC）

### 本輪重點

| 區塊 | 內容 |
|------|------|
| **Join App 更名** | `frontend/apps/participant` → `join`；`Dockerfile.join`；網域 `le-join.zeabur.app` |
| **舊網域轉址** | `le-participant.zeabur.app` 改部署 HTML+JS 導向頁（保留 `#/join/…` hash） |
| **分享連結** | `joinUrl()` + `VITE_JOIN_BASE`；Host 建置預設 `https://le-join.zeabur.app` |
| **API SSO** | `LE_SSO_JOIN_FRONTEND_URL=https://le-join.zeabur.app` |
| **工作台手機排序** | 左欄互動項目 Pointer 觸控拖曳 + ↑↓ 按鈕 |

### 部署（本輪）

| 服務 | URL | 變更 |
|------|-----|------|
| **join**（新） | https://le-join.zeabur.app | Join App 主站 — RUNNING |
| participant（轉址） | https://le-participant.zeabur.app | 導向 join — RUNNING |
| host | https://le-host.zeabur.app | `VITE_JOIN_BASE` 分享連結 — RUNNING |
| api | https://le-api.zeabur.app | `LE_SSO_JOIN_FRONTEND_URL` — RUNNING |
| admin | https://le-admin.zeabur.app | 本輪無變更 — RUNNING |
| worker | （內部） | 本輪無變更 — RUNNING |

### 開始使用（LiveEngage 上線試用）

| 角色 | 入口 | 典型流程 |
|------|------|----------|
| **Admin** | https://le-admin.zeabur.app | 建立組織／Room → 邀請 Host |
| **Host** | https://le-host.zeabur.app | 登入 → 控場 → 頂欄 **Screen** 開投影 → 分享 **le-join** |
| **Join** | https://le-join.zeabur.app | 輸入代碼加入 → 即時作答 |
| **Screen** | https://le-screen.zeabur.app | Host 開啟的投影連結（含 token） |
| **API** | https://le-api.zeabur.app | REST + WebSocket |

舊 QR（`le-participant`）仍可用，會自動導向 join。

---

## SNAPSHOT（2026-06-15，歷史）

- **最新 commit（舊）**：`a7638b9` — Poll 揭曉限制、投影刻度與正解標記
- **api 健康**：https://le-api.zeabur.app/health → 200
- **Zeabur 部署**：push `a7638b9` 後自動建置；**host**、**participant** 皆 `RUNNING`（2026-06-15 16:40 UTC）
- **狀態**：核心流程可上線試用（見下方「開始使用」）

### 本輪重點

| 區塊 | 內容 |
|------|------|
| **揭曉答案限制** | Poll `idle` 時「揭曉答案」disabled；hover 提示「必須在互動項目開始或停止之後才可揭曉答案」；工作台頂欄與控場列共用 |
| **投影刻度** | `ResultBarChart` X 軸改整數次數刻度（`allowDecimals` + `chartUtils` 自訂 ticks），不再出現 0.25／0.5 等小數 |
| **投影正解** | 主持人揭曉答案後，投影長條圖正確選項左側顯示綠色「正解」 |

### 部署（本輪）

| 服務 | URL | 變更 |
|------|-----|------|
| host | https://le-host.zeabur.app | 揭曉限制、投影刻度／正解 — RUNNING |
| participant | https://le-participant.zeabur.app | renderers 共用（作答端結果 UI）— RUNNING |
| api | https://le-api.zeabur.app | 本輪無變更 — RUNNING |
| admin | https://le-admin.zeabur.app | 本輪無變更 — RUNNING |
| worker | （內部） | 本輪無變更 — RUNNING |

### 開始使用（LiveEngage 上線試用）

| 角色 | 入口 | 典型流程 |
|------|------|----------|
| **Admin** | https://le-admin.zeabur.app | 建立組織／Room → 邀請 Host |
| **Host** | https://le-host.zeabur.app | 登入 → 進 Room → 建立 Poll／Quiz／Q&A／問卷 → 控場 → 開投影 |
| **Participant** | https://le-participant.zeabur.app | 輸入 Room 代碼加入 → 即時作答 |
| **API** | https://le-api.zeabur.app | REST + WebSocket（前端已指向此生產 API） |

**建議試跑一輪**：Admin 開 Room → Host 建選擇題 Poll → 開始 → Participant 投票 → 停止 → 揭曉答案 → 開投影確認刻度與「正解」。

---

## SNAPSHOT（2026-06-15，歷史）

- **最新 commit（舊）**：`c74ce13` — 登入輸入框可見性、Host 手機 RWD
- **api 健康**：https://le-api.zeabur.app/health → 200
- **Zeabur 部署**：push `c74ce13` 後 redeploy；**host**、**admin**、**participant** 皆 `RUNNING`（2026-06-15 16:20 UTC）

### 本輪重點（登入可見性／Host RWD）

| 區塊 | 內容 |
|------|------|
| **登入輸入框** | 手機（iOS 深色模式）白字白底看不見；`color-scheme` 對齊主題、`text-foreground`、`-webkit-text-fill-color`；Host／Admin／Participant 登入頁共用 |
| **Host 頂欄 RWD** | `HostRoomNavHeader` 改為品牌列 → 標題 → 分頁橫向滑動 → 投影／分享獨列；控場列可換行 |
| **Hub 列表 RWD** | Poll／Quiz 管理列改直向堆疊；操作鈕 `flex-wrap`；`HubCreateCard` 手機全寬表單 |

### 部署（本輪）

| 服務 | URL | 變更 |
|------|-----|------|
| host | https://le-host.zeabur.app | 頂欄 RWD、工作台控場列 — RUNNING |
| admin | https://le-admin.zeabur.app | 登入輸入框可見性（ui）— RUNNING |
| participant | https://le-participant.zeabur.app | 加入頁輸入框可見性（ui）— RUNNING |
| api | https://le-api.zeabur.app | 本輪無變更 — RUNNING |
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

### 2026-06-16 — 工作台投影主題下拉 + Q&A 投影快捷（62a9bda）

- Host 工作台右上角新增「投影主題」下拉，沿用 Host 主題選單樣式，提供五種預設主題（Slido／專業淺色／專業深色／Cursor／Claude）。
- 下拉加入兩個調色盤按鈕：`背景色`、`前景色`，支援清除回預設；偏好以 `liveengage-screen-theme-prefs` 儲存在 localStorage。
- Screen URL 會帶入 `theme`／`bg`／`fg`；若投影視窗已開啟，Host 會以 `postMessage(screen:theme)` 即時套用，不必重開視窗。
- 工作台新增「Q&A 投影」按鈕，點擊直接呼叫 `screen.showQa(sessionTitle)`；Q&A 審核頁「開啟 Q&A」也會自動切 Screen 至 Q&A，「關閉 Q&A」回待機。
- Screen 新增 `ScreenThemeListener`，並在載入參數時統一走 `applyScreenThemePrefs`；`index.css` 補上自訂前景／背景覆寫規則。
- Redeploy：host deployment `6a30f9db3850703aa49b4fd4`、screen deployment `6a30f9db3850703aa49b4fd3`（觸發時間 2026-06-16 15:23 UTC+8）。

### 2026-06-16 — 投影主題按鈕位置調整 + 空白頁 bug 修復（89d4002）

- 將「切換投影畫面主題色彩」按鈕移到藍色 `Screen` 按鈕正下方，並加上 hover 提示文字：`切換投影畫面主題色彩`。
- 修正切換主題下拉可能打開空白頁問題：`resolveScreenWindow` 不再呼叫 `window.open("", "liveengage-screen")`，僅使用已開啟且已記錄的投影視窗 reference。
- 因此 Host 端變更主題色時，若 Screen 視窗已開啟，仍會透過 `postMessage(screen:theme)` 即時同步；若未開啟則不會再誤開 about:blank。
- Redeploy：host deployment `6a30fcfd3850703aa49b51c4`（觸發時間 2026-06-16 15:33 UTC+8）。

### 2026-06-16 — 投影控制列重排 + 主題切換實際生效（9a0986f）

- 依主持流程重排投影操作順序：`Screen` → `投影主題` → `Q&A 投影` → `跟隨工作台` → `複製投影網址` → `測試投影`，並以淺灰框群組投影相關控制，與 `分享` 保留間距。
- 移除 `全螢幕` 按鈕（避免再次誤開空白頁）；改採投影視窗直接按 `F` 進入全螢幕。
- `測試` 改為語意更清楚的 toggle：`測試投影` / `結束測試`；結束時切回待機畫面。
- `複製` 文案改為 `複製投影網址`。
- 修正主題切換「看起來沒生效」：`applyScreenThemePrefs` 會依五種主題套用預設 `--le-screen-bg/fg`，即使未選自訂色也會改變投影底色與文字色；`theme=light` 等 URL 參數現在可直接生效（例如 [le-screen 範例連結](https://le-screen.zeabur.app/#/?room=019ecb92-f676-77d9-abb3-f41d92c0591a&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXAiOiJzY3JlZW4iLCJyb29tX2lkIjoiMDE5ZWNiOTItZjY3Ni03N2Q5LWFiYjMtZjQxZDkyYzA1OTFhIiwic2Vzc2lvbl9pZCI6IjAxOWVjYjkyLWY1MTAtNzQxNS05NzhhLWE1NmRmY2U5YWY1ZiIsInRva2VuX2Vwb2NoIjowLCJpYXQiOjE3ODE1OTU4NzQsImV4cCI6MTc4MjIwMDY3NH0.Q44FfWNk4l2MnQfCWTNRLkwAYrKkQl9YcogGgH2mbgc&theme=light)）。
- Redeploy：host deployment `6a3103c53850703aa49b5623`、screen deployment `6a3103c23850703aa49b5621`（觸發時間 2026-06-16 16:05 UTC+8）。

### 2026-06-16 — 投影按鈕簡化為深/淺雙主題（41811c7）

- 依主持操作複雜度調整：移除「投影主題下拉」與多主題選擇，改成兩顆明確按鈕：
  - `投影（深色主題）`（套用 `dark`）
  - `投影（淺色主題）`（套用 `light`）
- 深/淺按鈕左右並排，淺色按鈕使用與深色按鈕反差風格（白底深色字），其後依序保留：`Q&A 投影`、`跟隨工作台`、`複製投影網址`、`測試投影`。
- 五個 Host 頁面（工作台、即時總覽、Q&A 審核、Poll 管理、Quiz 管理）統一共用同一組 `HostRoomHeaderActions`，切頁時操作位置與順序一致。
- 新增 `openScreenWithTheme(theme)` 與 `screenTheme.setTheme(theme)`；按深/淺按鈕時會同步更新投影 URL 與目前偏好，避免殘留自訂色影響。
- Deploy（push 後自動觸發）：host deployment `6a3104583850703aa49b5694`、screen deployment `6a3104553850703aa49b568f`（皆 RUNNING）。

### 2026-06-16 — 深/淺投影按鈕去除成功彈窗 + 淺色可讀性修正（fcb2fb7）

- 依主持操作回饋，`投影（深色主題）` / `投影（淺色主題）` 不再顯示成功 modal，避免操作時被多餘提示打斷。
- 保留必要失敗提示：若瀏覽器阻擋彈窗，仍顯示「請允許瀏覽器彈出視窗」。
- 修正淺色主題白底白字：`screen/index.css` 追加 `text-white`、`text-slate-50` 到主題前景覆寫，確保淺色投影文字對比可讀。
- Deploy（push 後自動觸發）：host deployment `6a310a353850703aa49b5aa8`、screen deployment `6a310a323850703aa49b5aa2`（皆 RUNNING）。
