# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。記錄專案現況快照、已知地雷與交付歷史。

---

## SNAPSHOT（最新狀態，2026-06-13）

### 專案基本資訊
- **Repo**：https://github.com/ColdRighter/LiveEngage.git（`master`）
- **本地路徑**：`c:\Vibe_Coidng_Local\LiveEngage`
- **最新 commit（已 push）**：`5eea6bb` Present app + S7-1 Admin 骨架
- **GitHub**：`origin/master` 同步至 Present + S7-1
- **資料庫**：Neon Postgres（`taiwanveo@gmail.com` 帳號專案，`ap-southeast-1`）
- **Redis**：Upstash 雲端（`LE_REDIS_URL=rediss://default:<token>@sweeping-gecko-35121.upstash.io:6379`）
- **Neon MCP**：`project-0-LiveEngage-neon` 已授權（org: TAIWANVEO，project: LiveEngage `damp-tooth-60940518`）
- **GitHub CLI**：`gh` 已安裝（使用者目錄免安裝版）並登入 `ColdRighter`，Agent 可直接 push / 開 PR

### 技術棧
- Python **3.14**、FastAPI、SQLAlchemy 2.0 async、Alembic、PyJWT、argon2-cffi
- **venv 在 `backend/.venv`**；驗證指令：`.\.venv\Scripts\python.exe -m ruff/mypy/pytest`
- **Neon 連線**：async `?ssl=require`；sync `?sslmode=require`；dev 用 `NullPool`
- ruff / mypy strict / pytest（**31 passed** on Neon，2026-06-13）

### 目前完成進度

| Sprint | 任務 | 狀態 |
|--------|------|------|
| Task 1 | backend 骨架 + migration 0001 | ✅ pushed |
| Task 2a | Auth + Session CRUD + join（FE-001/002） | ✅ pushed |
| Task 2b | WS Gateway + state 快照 API | ✅ pushed |
| Sprint 3 | Q&A：提問/列表/投票/審核（FE-004/005、BE-004） | ✅ migration 0002 + 8 AC 測試 |
| Sprint 4 | Redis（Pub/Sub + Stream replay）、Idempotency、Q&A flush/節流/rate limit、audit log、PM-002 審核 UI | ✅ pushed `085c7b3` |
| S5-1 | Poll Migration（0004）+ Models + Schemas | ✅ pushed |
| S5-2 | Poll Service + 狀態機 + Redis 分散式鎖 | ✅ pushed `11fcef5` |
| S5-3 | Poll REST API + multiple_choice 作答與結果 | ✅ pushed `31bc8f0` |
| S5-4 | word_cloud / open_text / rating / ranking 作答與聚合 | ✅ pushed `1365be4` |
| S6-1 | renderers 核心（3 mode） | ✅ pushed `7fbbc8b` |
| S6-2 | Host Builder + 控制台 UI | ✅ pushed `e043c82` |
| S6-3 | Present 控制列 + Recharts | ✅ pushed `e043c82` |
| P-1~P-3 | Participant app（join + Poll 作答 E2E） | ✅ pushed `8425411` |
| P-4/P-WS-1 | WS 即時推送，取代 REST 輪詢 | ✅ pushed `51643a0` |
| P-fix-1 | ModerationPage 繁中還原 | ✅ pushed `94288a5` |
| Present app | 獨立投影端（mode=present WS） | ✅ pushed `5eea6bb` |
| S7-1 | Admin 管理後台骨架 | ✅ pushed `5eea6bb` |

### API 端點（已實作）
| Method | Path | 說明 |
|--------|------|------|
| POST | `/api/v1/auth/login` | Host 登入 |
| POST | `/api/v1/auth/refresh` | 換發 token |
| POST | `/api/v1/sessions` | 建立活動 + 預設 Room |
| PATCH | `/api/v1/sessions/{id}` | 更新 / 切 live |
| GET | `/api/v1/sessions/by-code/{code}` | 解析代碼 |
| POST | `/api/v1/sessions/{id}/join` | 參與者加入 |
| GET | `/api/v1/sessions/{id}/state` | 活動快照（RT-002） |
| WS | `/ws?token=&room=&mode=` | Gateway（廣播 only，含房間綁定 + mode 過濾） |
| GET | `/api/v1/rooms/{roomId}/interactions` | 列出房間互動（S6-2 Builder） |
| POST | `/api/v1/rooms/{roomId}/interactions` | 建立互動（Poll / Q&A） |
| PATCH | `/api/v1/interactions/{id}` | 開關 Q&A / 改設定 |
| POST | `/api/v1/rooms/{roomId}/questions` | 提問（FE-004） |
| GET | `/api/v1/rooms/{roomId}/questions` | 公開列表 top/newest（FE-005） |
| POST | `/api/v1/questions/{id}/vote` | upvote/downvote toggle（FE-005） |
| GET | `/api/v1/rooms/{roomId}/questions/moderation` | 審核清單（BE-004） |
| POST | `/api/v1/questions/{id}/moderate` | 審核/答覆/高亮（BE-004） |
| POST | `/api/v1/questions/{id}/replies` | Host 回覆（BE-004） |
| WS | `/ws?...&last_event_id=` | 重放 `stream:room:{id}` 中遺漏事件（Sprint 4） |
| GET | `/api/v1/polls/{id}` | Poll 題目內容 + 個人作答狀態（S5-3） |
| PUT | `/api/v1/polls/{id}/options` | 取代 Poll 選項（BE-003 Builder） |
| POST | `/api/v1/polls/{id}/responses` | 提交作答（Idempotency-Key、10/min） |
| GET | `/api/v1/polls/{id}/results` | 結果聚合（後端絕對值；participant 受 result_visible） |
| POST | `/api/v1/polls/{id}/actions` | 控場 start/stop/lock/unlock/reveal/hide/reset |

### 前端
| App | 路徑 | 狀態 |
|-----|------|------|
| Host | `frontend/apps/host` | ✅ Q&A 審核 + Poll Hub/Builder/Console/Present/Answer 路由；**WS mode=host** |
| `@liveengage/renderers` | `frontend/packages/renderers` | ✅ 五題型三 mode + Recharts 投影圖表（S6-3） |
| `@liveengage/realtime` | `frontend/packages/realtime` | ✅ `useRoomWebSocket` hook（P-4/P-WS-1）：自動重連、replay、ping/pong |
| Participant | `frontend/apps/participant`（port **5174**） | ✅ P-1~P-3 E2E + **P-4 WS mode=participant** |
| Present | `frontend/apps/present`（port **5175**） | ✅ 唯讀投影 + **WS mode=present** |
| Admin | `frontend/apps/admin`（port **5176**） | ✅ S7-1 骨架：側欄 + 6 模組佔位頁 |

---

## 前端 dev ports 速查

| App | Port | 用途 |
|-----|------|------|
| Host | 5173 | 主持人控場 |
| Participant | 5174 | 參與者作答 |
| Present | 5175 | 大螢幕投影（唯讀） |
| Admin | 5176 | 組織管理後台 |

---

## 已知地雷 / 注意事項

1. **`.env` 含 Neon / Upstash 密碼，勿 commit**（已在 `.gitignore`）。
2. **Neon async URL** 必須用 `ssl=require`，不可用 `sslmode`（asyncpg 不支援）。
3. **StrEnum ORM** 須用 `pg_enum()` + `values_callable`，否則寫入 `OWNER` 而非 `owner`。
4. **Upstash Redis**：REST API（`UPSTASH_REDIS_REST_*`）**不能**做 Pub/Sub / HINCRBY；須用 `LE_REDIS_URL=rediss://default:<token>@<host>.upstash.io:6379`。
5. **`.env` 載入**：`config.py` 以專案根 `.env` 絕對路徑 + `load_dotenv(override=True)` 覆蓋 shell 殘留的 `LE_REDIS_URL=localhost`。
6. **pytest 不連雲端 Redis**：`conftest` 用 `disable_redis_for_tests()` + `TestClient` context manager，避免背景 task 與 event loop 衝突。
7. **`updated_at` DB trigger** 仍待後續 migration（選項 A：暫用 SQLAlchemy onupdate）。
8. **時區欄位地雷**：所有 `DateTime` 欄位 model 端務必加 `DateTime(timezone=True)`。
9. **Q&A score** 為 DB `GENERATED ALWAYS AS (upvote_count - downvote_count) STORED`；有 Redis 時計數先寫 Redis 待 flush，無 Redis 時直接寫 DB。

### Sprint 4 已完成（含本次 push）
- ✅ PM-002 審核三欄 UI（host app）
- ✅ audit log 持久化（migration 0003 idempotent；moderate / reply 寫入）
- ✅ Redis stream replay（`stream:room:{id}` XADD MAXLEN 1000；WS `last_event_id` 補送）
- ✅ upvote rate limit 30/min

### 仍待補（後續 Sprint）
- **S7-2**：BE-008/009 組織與活動管理 API + Admin UI
- **S7-3**：BE-010 audit log 查詢 API + Admin UI
- **S7-4**：Branding 基礎
- **S7-5**：BE-012 匯出 Worker（XLSX/CSV、72h 簽名連結）
- Sprint 9+：Quiz / Survey / Ideas / AI / Integrations

---

## HISTORY

### 2026-06-13 — Present app + S7-1 Admin 骨架（commit `5eea6bb`）

**`frontend/apps/present`**（dev port **5175**）
- Vite + React 19 + TS strict + Tailwind；alias `@liveengage/renderers`、`@liveengage/realtime`
- 路由 `#/rooms/{roomId}/polls/{pollId}/present`
- **PollPresentPage**：唯讀 `PollRenderer present`；**WS mode=present**；30s REST 備援
- 控場寫入留在 Host 控制台；投影端不做 REST 寫入（鐵律 1）

**`frontend/apps/admin`**（dev port **5176**）
- **S7-1 骨架**：`AdminShell` 側欄 + 登入頁
- 佔位模組：總覽、組織（BE-008）、活動（BE-009）、稽核（BE-010）、品牌、匯出（BE-012）
- `DashboardPage` 卡片導覽至各模組

**Host 小改**
- `PollConsolePage`：新增「投影模式（獨立 app）」連結 → `localhost:5175`；保留「內嵌投影」

**品質**：present / admin / host `tsc -b --noEmit` ✅

---

### 2026-06-13 — P-fix-1：ModerationPage 繁中編碼還原（commit `94288a5`）

**問題**：`ModerationPage.tsx` 所有繁體中文字元在編輯歷程中損壞成 `?`（包含檔案頭部 JSDoc、按鈕標籤、標題、提示文字，以及 `Poll 管理` 連結變成 `Poll ç®¡ç`）。

**修復**：完整重寫檔案，還原所有繁中文字，`tsc -b --noEmit` 通過（零錯誤）。

---

### 2026-06-13 — P-4/P-WS-1：WS 即時推送，取代 REST 輪詢（commit `51643a0`）

**新增 `frontend/packages/realtime`**（`@liveengage/realtime`）
- **`useRoomWebSocket(options)`** React hook
  - 自動重連：指數退讓 1 s → 最大 30 s；`intentionalClose` flag 防 unmount 重連
  - `last_event_id` 追蹤：斷線重連帶入 query param，由後端補送 Redis Stream 遺漏事件
  - ping/pong：收到 `{type:"ping"}` 自動回傳純文字 `"pong"`
  - 回傳 `{ connected: boolean }` 供 UI 顯示連線指示燈
- **`WsEvent` 型別**、`WsMode` union、`POLL_*` 事件常數（對齊 `backend/app/realtime/events.py`）

**Host app**
- `PollConsolePage`：`useRoomWebSocket(mode="host")`，Poll 事件立即 `invalidateQueries`；`refetchInterval` 降至 30s（安全備援）；標題列新增連線指示燈
- `PresentPage`：同上策略；投影右上角指示燈 + 「輪詢備援中」提示

**Participant app**
- `RoomPage`：`useRoomWebSocket(mode="participant")`，按事件類型精確 invalidate：
  - `poll_started / poll_stopped` → 先刷新 `session-state`（active_interactions 清單）
  - `poll_locked / poll_unlocked` → 刷新 `poll`
  - `poll_result_revealed / poll_result_hidden` → 刷新 `poll` + `poll-results`
  - `poll_response_submitted` → 刷新 `poll-results`（Host 廣播聚合計數）
- 標頭新增綠色連線指示燈

**品質**
- `tsc -b --noEmit` ✅（realtime / host / participant 三套件均零錯誤）

---

### 2026-06-13 — P-1~P-3：Participant app（join + Poll 作答 E2E）

**`frontend/apps/participant`**（dev port **5174**）
- **P-1**：Vite + React 19 + TS strict + Tailwind；alias `@liveengage/renderers`
- **P-2**：`#/join` / `#/join/{CODE}` → `by-code` + `join`；`participantAuth` 存 token
- **P-3**：`#/room` 輪詢 `session/state` 找同房 active Poll → `PollRenderer answer` → `POST /polls/{id}/responses`

**E2E**：Host live + Poll start → Participant join 代碼 → 提交成功

---

### 2026-06-13 — S6-2~S6-3：Poll Host UI + Present 控制列

**後端**
- `GET /api/v1/rooms/{roomId}/interactions` — Host 列出房間互動（Builder / 控制台）

**Host App（S6-2）**
- `pollApi` / `interactionApi`；路由 `#/rooms/{roomId}/polls[...]`
- **PollHubPage**：建立 Poll、列表、導向 Builder / 控制台 / 投影 / 參與者預覽
- **PollBuilderPage**：編輯標題、選項（multiple_choice / ranking）、`preview` mode
- **PollConsolePage**：控場按鈕 + 雙欄預覽（present / answer）+ 結果輪詢
- **PollAnswerPage**：`answer` mode（實際提交需 participant token）

**S6-3**
- **PresentPage**：全螢幕投影 + **PresentControlBar**（Space/L/R/Esc 快捷鍵）
- renderers 新增 **Recharts** `ResultBarChart` / `RatingBarChart`（present mode）

**品質**
- renderers typecheck ✅ · host `npm run build` ✅ · ruff/mypy（interactions 新增）✅

---

### 2026-06-13 — S6-1：Poll renderers 核心（3 mode）

**`frontend/packages/renderers`**
- **`PollRenderer`**：依 `poll.type` 分派五題型元件
- **Mode**：`answer`（作答 + onSubmit）、`present`（投影深色殼 + 結果視覺化）、`preview`（Builder 靜態預覽）
- **題型**：multiple_choice、word_cloud、open_text、rating、ranking
- **呈現**：`PollShell`、`ResultBars`（CSS 長條，非 Recharts）、`WordCloudDisplay`、`RatingDisplay`、`OpenTextList`
- **型別**：對齊 `backend/app/schemas/poll.py`（`PollDetail`、`PollResults`）

**Host 整合**
- Vite alias `@liveengage/renderers`、Tailwind content 掃描 renderers
- Demo 路由：`#/poll-renderers-demo`（免登入，mock 資料切換題型/mode）

**品質**
- renderers `npm run typecheck` ✅ · host `npm run build` ✅

---

### 2026-06-13 — S5-4：四題型作答與聚合（FE-007~010）

**後端 `poll_service.py`**
- **word_cloud**：多次提交（`submission_no` 遞增）、詞長驗證、`max_submissions` 上限、Redis 詞頻（casefold key）
- **open_text**：字數驗證、單次/多次（`allow_multiple`）、結果明細 + `mask_identity` / `show_voter_names`
- **rating**：區間驗證、Redis sum/count + `r:{value}` 分布
- **ranking**：無重複、Borda 計分（average 模式 DB 聚合）、`top_n` 必填數驗證
- 共用：`_finish_submit_broadcast`、DB fallback 支援無 Redis 測試環境

**品質**
- ruff ✅ · mypy --strict ✅（61 files）· pytest **31 passed**（+6 Poll S5-4）

---

### 2026-06-13 — S5-3：Poll REST API + multiple_choice 作答與結果

**後端**
- **`app/api/v1/polls.py`**（新建）
  - `GET /polls/{id}` — Host 或 Participant 讀題（揭示前不含正解）
  - `PUT /polls/{id}/options` — Builder 整批取代選項
  - `POST /polls/{id}/responses` — 作答（Idempotency-Key header、rate limit 10/min）
  - `GET /polls/{id}/results` — 後端聚合絕對值；participant 受 `result_visible` 控制
  - `POST /polls/{id}/actions` — 控場（回傳 `PollActionResponse`）
- **`poll_service.py` 擴充**
  - `submit_poll_response` / `_submit_multiple_choice`：驗證選項、單選/多選、allow_change、寫 DB + Redis agg
  - `get_poll_results`：Redis agg 優先，fallback DB 聚合
  - `execute_poll_action` 回傳最新狀態；修 audit `db.commit()`（避免 transaction already begun）
- **`poll_redis.py`**：`throttled_broadcast_result` 改為直接傳 payload dict
- **`schemas/poll.py`**：`PollActionResponse`、`PollOptionsUpdateRequest`
- **`tests/test_poll_sprint5.py`**：6 個整合測試（FE-006 AC2/AC4、作答、ALREADY_RESPONDED、BE-005 403、生命週期）

**品質**
- ruff ✅ · mypy --strict ✅（61 files）· pytest **25 passed**（+6 Poll）

---

### 2026-06-13 — S5-2：Poll Service + 狀態機 + Redis 鎖（commit `11fcef5`）

**後端**
- **`app/services/poll_redis.py`**
  - 房間分散式鎖：`lock:room:{roomId}:active_poll`（SET NX PX 5000，最多 3 次退避重試；Lua CAS DEL 釋鎖）
  - 聚合 hash：`agg:poll:{id}`（`increment_option_count`、`increment_rating_agg`、`get/clear/set_ttl`）
  - 作答 rate limit：10/min/participant
  - 結果廣播節流：250ms 防抖（`throttled_broadcast_result`，同 qa_redis 範式）
- **`app/services/poll_service.py`**
  - `TRANSITIONS` dict 宣告 7 個 action 合法來源→目標（`PollAction.NEXT/PREV` defer 至 Quiz）
  - `execute_poll_action`：驗狀態機 → 取房間鎖（僅 start/stop/reset）→ 執行 → audit → 釋鎖
  - DB 樂觀鎖：`UPDATE WHERE status=expected`，`rowcount=0 → 409 POLL_INVALID_STATE`
  - `start`：auto-stop 同房已有 active poll（廣播 `poll_stopped`）→ active 本題 → 廣播 `poll_started`（不含正解）
  - `stop`：active/locked → stopped，固化 agg TTL
  - `reset`：刪 `poll_responses` + 清 Redis agg + idle；需 `confirm=true`
  - `lock/unlock`：僅 DB 樂觀鎖，不搶房間鎖
  - `reveal/hide`：改 `result_visible`；reveal 時廣播正解 option_ids（PM-003-FR5）
  - `get_poll_detail`：揭示前隱藏 `is_correct`（PM-003-FR5）
  - `upsert_poll_options`：Builder UI 整批取代選項
- **`app/realtime/events.py`**：新增 `POLL_STARTED/STOPPED/LOCKED/UNLOCKED/RESULT_REVEALED/RESULT_HIDDEN/RESPONSE_SUBMITTED` + `MODE_PRESENT_HOST`

**品質**
- ruff ✅ · mypy --strict ✅（60 files）· pytest **19 passed**（無回歸）

---

### 2026-06-13 — S5-1：Poll Migration + Models + Schemas

**後端**
- **migration `0004_poll_tables`**（已套用至 Neon，`0004 head`；idempotent）
  - 建 `poll_options`：interaction_id / text / is_correct / order_no / created_at；`idx_poll_options_interaction`
  - 建 `poll_responses`：interaction_id / participant_id / answer_jsonb / submission_no / is_correct / score / idempotency_key / submitted_at
    - `uq_poll_responses_submission` UNIQUE(interaction_id, participant_id, submission_no)
    - `uq_poll_responses_idem` partial UNIQUE(idempotency_key) WHERE NOT NULL（鐵律 4）
  - `idx_interactions_active`（非唯一）→ **`uq_interactions_active_room` partial UNIQUE**（鐵律 5 DB 硬保證）
- **`app/models/poll.py`**：`PollOption`、`PollResponse`；`submission_no` 調和 SDS §7.2 UNIQUE 語意：單次提交題型固定 0，多次題型遞增 append
- **`app/schemas/poll.py`**
  - 5 題型 settings：MultipleChoiceSettings / WordCloudSettings / OpenTextSettings / RatingSettings / RankingSettings
  - answer 載荷（§7.4 外部 tag）+ `parse_answer()` / `parse_settings()` resolver
  - 控場 `PollAction`（start/stop/lock/unlock/reveal/hide/reset/next/prev）
  - 對外 `PollDetail`（揭示前不含正解）、`PollResults`（後端聚合絕對值，鐵律 2）
- `app/models/__init__.py`：新增 `PollOption`, `PollResponse` 匯出
- `docs/Sprint5-6_Poll_設計.md`：Sprint 5–6 設計文件（migration、狀態機、鎖策略、events、API 端點）

**品質**
- ruff ✅ · mypy --strict ✅（58 files）· pytest **19 passed**（無回歸）

---

### 2026-06-13 — Sprint 4 完整收斂（commit `085c7b3` pushed）

**後端**
- **Upstash 連線**：`LE_REDIS_URL=rediss://default:<token>@sweeping-gecko-35121.upstash.io:6379`（非 REST）
- `core/redis.py`：async 連線池、ping、降級 fallback
- `realtime/redis_pubsub.py`：
  - `evt:room:{id}` Pub/Sub 跨副本廣播
  - `stream:room:{id}` XADD（MAXLEN 1000）— `fetch_replay(last_event_id)` 重放
- `gateway.py`：WS 接 `last_event_id` query，連線後補送遺漏事件（依 mode 過濾）
- `core/idempotency.py`：`Idempotency-Key` middleware（SETNX，TTL 24h）
- `services/qa_redis.py`：
  - 投票 HINCRBY + 2s flush 回 DB
  - 投票廣播 ≥300ms 節流合併
  - 提問 5/min、**upvote 30/min** rate limit
- migration `0003_audit_logs`（idempotent — `inspector.has_table` 跳過已存在）
- `audit_service.log()`：moderate / reply 寫稽核（`details_jsonb` 含 action / reply_id 等）
- `config.py`：專案根 `.env` 絕對路徑 + `load_dotenv(override=True)` 覆蓋 shell 殘留

**前端（首次建立）**
- `frontend/apps/host`：Vite 6 + React 19 + TypeScript strict + Tailwind 3
- 登入頁（`/api/v1/auth/login`）+ PM-002 三欄審核（pending / approved / answered）
- `lib/api.ts`：JWT bearer + 統一錯誤信封；寫入帶 `Idempotency-Key`
- TanStack Query 4s 輪詢 + invalidate
- `tsc strict + vite build` 通過（246KB / gzip 76KB）

**品質**
- ruff ✅ · mypy --strict ✅ · pytest **19 passed**（含 8 個 Q&A AC 測試）
- 前端 `npm run build` ✅

### 2026-06-13 — Sprint 3：Q&A 核心（FE-004/005、BE-004）
- migration `0002_qa_tables`：questions / question_votes / question_replies / question_labels（+ enum question_status、reply_author_type）
- `qa_service`：提問（審核/匿名/字數）、公開列表（top/newest + my_vote）、投票 toggle（後端聚合）、審核狀態機、高亮（同房唯一）、Host 回覆
- `interaction_service`：最小 BE-002（建立/開關 qa、讀設定）
- WS 強化：gateway 驗證 participant 房間綁定；manager 依 mode 過濾廣播
- 修既有缺陷：`interactions.started_at/stopped_at` 補 `timezone=True`
- 測試：`test_qa_sprint3.py` 8 passed；全套 **19 passed** on Neon

### 2026-06-13 — Task 2b：WS + state 快照（本地）
- `GET /sessions/{id}/state`：rooms、active_interactions、participant_count
- `WS /ws`：JWT 驗證、25s ping、鐵律 1 不做寫入
- 測試：`test_rt002_state.py`、`test_ws_gateway.py`

### 2026-06-13 — Task 2a：Auth + Session + join（commit `683624e`）
- JWT access/refresh/participant；Session CRUD + join；FE-001/002 整合測試 9 passed
- Neon migration 0001 已套用；pytest 全綠

### 2026-06-13 — Task 1 初始 push（commit `8d0270a`）
- 6 表核心鏈 + Alembic 0001 + 工具鏈
