# Sprint 5–6 Poll — 開工前設計（migration / 狀態機 / 鎖策略）

> 本文件為 Sprint 5–6 的權威實作藍本，由 Opus 4.8 依 SRS v1.0 + SDS v1.0 推導。
> 衝突時優先序：**SRS 驗收 > SDS 設計 > 本文件**。
> 對應 AC：FE-006/007/008/009/010、BE-003/005、PM-003/004。

---

## 0. 既有基礎（Sprint 1–4 已完成，可直接複用）

- `interactions` 表已存在，`type` enum 含九型、`status` enum 含 `idle/active/locked/stopped`。
- `interaction_service`：建立 / 開關 / 讀設定（BE-002 子集）。
- Redis：`core/redis.py`（降級 fallback）、`qa_redis.py`（HINCRBY + flush + 節流範式）。
- 事件：`realtime/events.py` + `redis_pubsub.py`（Pub/Sub + `stream:room:{id}` replay）。
- Idempotency middleware（鐵律 4）、audit_service（鐵律 10）已可直接呼叫。
- 前端 `frontend/apps/host`（React 19 + TS strict + Tailwind + TanStack Query）。

**結論**：Poll 不需重建互動骨架，只需新增 `poll_options` / `poll_responses` 兩表與 Poll 專屬 service / API / renderer。

---

## 1. Migration 拆解（`0004_poll_tables`）

> expand-only；沿用 0003 的 idempotent 範式（`inspector.has_table` 跳過已存在）。

### 1.1 新增表 `poll_options`（SDS §7.2）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | UUID v7 PK | |
| `interaction_id` | UUID FK → interactions(id) ON DELETE CASCADE | |
| `text` | VARCHAR(100) NOT NULL | FE-006-FR4 選項上限 100 字 |
| `is_correct` | BOOL NOT NULL DEFAULT false | FE-006-FR3 / Quiz 用 |
| `order_no` | INT NOT NULL DEFAULT 0 | |
| `created_at` | TIMESTAMPTZ NOT NULL | |

索引：`INDEX idx_poll_options_interaction ON (interaction_id, order_no)`。

### 1.2 新增表 `poll_responses`（SDS §7.2）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | UUID v7 PK | |
| `interaction_id` | UUID FK → interactions(id) ON DELETE CASCADE | |
| `participant_id` | UUID FK → participants(id) ON DELETE CASCADE | |
| `answer_jsonb` | JSONB NOT NULL | 結構依題型，§3 |
| `is_correct` | BOOL NULL | Quiz 用，本 Sprint 留 NULL |
| `score` | NUMERIC NULL | Quiz 用，本 Sprint 留 NULL |
| `idempotency_key` | UUID NULL | 鐵律 4 |
| `submitted_at` | TIMESTAMPTZ NOT NULL | FE-008-AC1 UTC 儲存 |

約束與索引：
- `UNIQUE (idempotency_key)`（部分索引 `WHERE idempotency_key IS NOT NULL`）。
- **單次提交唯一**：`UNIQUE (interaction_id, participant_id)` —— 但僅在 `settings.allow_multiple_submissions=false` 時語意成立。
  - 做法：建立 **partial unique index** 不可行（settings 在 row 外）。改為**應用層保證** + 一個一般 unique 索引在「不允許多次」的題型上由 service 以 `ON CONFLICT` 處理。
  - **決策**：建立 `UNIQUE (interaction_id, participant_id)` 為**預設**（多數 Poll 單次提交）；允許多次提交的題型（word_cloud 多次、open_text 多答）改寫 `answer_jsonb`（append 進同一 row）或另以 `submission_no` 區分。**本 Sprint 採「單 row／participant，update answer」模型**，下方 §3.3 說明。
- `INDEX idx_responses_interaction ON (interaction_id, submitted_at)`（SDS §7.3 列表覆蓋）。

> ⚠️ migration 注意：`interactions` 表 0001 已建，Poll 子表 FK 指向它即可，無需改 0001。

### 1.3 不需要的 enum

`interaction_status` / `interaction_type` 已於 0001 建立，**不重建**。

---

## 2. 狀態機（BE-005-FR2）

```
        ┌──────── reset（清資料，需二次確認）────────┐
        │                                            │
        ▼                                            │
     [idle] ──start──▶ [active] ──lock──▶ [locked]   │
                          ▲                  │        │
                          └─────unlock───────┘        │
                          │                  │        │
                          └──stop──▶ [stopped] ◀─stop─┘
                                        │
       任一非 idle 狀態 ──reset──▶ [idle]（清 poll_responses + Redis agg）
```

### 2.1 合法轉移表（service 內以 dict 宣告，違反回 409 `POLL_INVALID_STATE`）

| action | 允許來源狀態 | 目標狀態 | 副作用 |
|--------|------------|---------|--------|
| `start` | idle, stopped | active | 設 `started_at`；**搶房間鎖**（§4）；廣播 `poll_started` |
| `lock` | active | locked | 廣播 `poll_locked` |
| `unlock` | locked | active | 廣播 `poll_unlocked` |
| `stop` | active, locked | stopped | 設 `stopped_at`；釋房間鎖；固化 Redis agg → DB；廣播 `poll_stopped` |
| `reset` | active, locked, stopped | idle | **刪 poll_responses + 清 Redis agg**；釋鎖；需 `confirm=true` |
| `reveal` | active, locked, stopped | （狀態不變）`result_visible=true` | 廣播 `poll_result_revealed` |
| `hide` | active, locked, stopped | （狀態不變）`result_visible=false` | 廣播 `poll_result_hidden` |
| `next` / `prev` | 任意 | （切換 active 題目，非單題狀態轉移） | 由控制台層處理：stop 當前 → start 下一/上一題 |

> `reveal/hide` 不改 `status`，只改 `result_visible`；屬 PM-003-FR2 / BE-005-FR1。

### 2.2 不變式（invariant）

- **同一 Room 同時僅一個 `active` Poll**（BE-005-FR2 末句、鐵律 5）。由 §4 鎖保證。
- 作答 API 僅在 `status=active` 接受；`idle/locked/stopped` 一律 409（FE-006-AC2/AC4）。

### 2.3 DB 樂觀鎖（SDS §5.4）

狀態轉移一律：

```sql
UPDATE interactions
SET status = :target, started_at = :maybe, stopped_at = :maybe, updated_at = now()
WHERE id = :poll_id AND status = :expected_source
```

`rowcount == 0` → 表示狀態已被他人改變 → 回 409 `POLL_INVALID_STATE`（避免 race）。

---

## 3. answer_jsonb（Pydantic discriminated union，SDS §7.4）

依 `interactions.type` 切換 payload schema；無效結構回 400 `VALIDATION_ERROR`。

| type | answer_jsonb | 後端驗證重點 |
|------|-------------|-------------|
| `multiple_choice` | `{"option_ids": ["uuid", ...]}` | option_ids ⊆ 該題 options；單選長度=1；多選符合 min/max（FE-006-FR1/AC5） |
| `word_cloud` | `{"words": ["效率", ...]}` | 每詞 ≤ max_word_length（預設 25，FE-007-FR1）；提交次數 ≤ max_submissions（FE-007-FR2）；敏感詞過濾 |
| `open_text` | `{"text": "..."}` | 短答 ≤200 / 長答 ≤1000（FE-008-FR1）；敏感詞 |
| `rating` | `{"value": 4}` | min ≤ value ≤ max，步進 1（FE-009-AC2） |
| `ranking` | `{"ranked_option_ids": [...]}` | 無重複（FE-010-AC2）；數量符合必填 N（FE-010-AC1）；⊆ options |

### 3.1 各題型 settings（存 `interactions.settings_jsonb`，仿 `QaSettings`）

- `MultipleChoiceSettings`：`multi_select`, `min_select`, `max_select`, `shuffle_options`, `has_correct`, `show_result`, `allow_change`, `show_voter_names`, `anonymous`。
- `WordCloudSettings`：`max_word_length=25`, `max_submissions=3`, `stopwords`, `synonyms`, `profanity_mode`。
- `OpenTextSettings`：`multiline`, `max_length`, `allow_multiple`, `sort`(newest/oldest/top), `reactions_enabled`, `moderation`。
- `RatingSettings`：`min=1`, `max=5`, `display`(number/star/emoji), `labels`。
- `RankingSettings`：`top_n`, `shuffle_options`, `ranking_mode`(average/borda)。

### 3.2 計分聚合（後端，鐵律 2）

- multiple_choice / ranking：票數聚合 → Redis hash `agg:poll:{id}`（option_id → count）。
- rating：累計 sum + count → 平均（`agg:poll:{id}` 存 `sum`/`count`）。
- word_cloud：詞頻 → Redis hash（正規化小寫 key，顯示用首次原樣）。
- open_text：明細列表（不入 agg hash，走 DB 分頁 + 可選 reaction 計數）。

### 3.3 多次提交 / 修改答案模型

- **單次提交題型**（multiple_choice / rating / ranking，預設）：一 participant 一 row；`allow_change=true` 時 update 同 row 的 `answer_jsonb` 並修正 agg 差量（仿 qa vote delta）。
- **多次提交題型**（word_cloud 多詞、open_text 多答）：每次提交 append 一筆 row（不套 UNIQUE）。→ 需在 service 層依 settings 分流，不能單靠 DB 約束。

> ⚠️ 因此 `UNIQUE (interaction_id, participant_id)` **只對單次題型有效**。實作時：
> - 單次題型：service 以 `INSERT ... ON CONFLICT (interaction_id, participant_id) DO UPDATE`。
> - 多次題型：略過唯一鍵，純 INSERT，並以 Redis/settings 檢查提交次數上限。

---

## 4. 鎖策略（SDS §5.4，鐵律 5）

`POST /api/v1/polls/{id}/actions`（action=start）流程：

```
1. 取 Redis 分散鎖 lock:room:{roomId}:active_poll（SET NX PX 5000）
   └─ 取不到 → 重試極短退避；仍失敗 → 409 POLL_LOCKED
2. 鎖內：
   a. 查該 room 既有 active poll；若存在且 ≠ 本題 → 先 stop 它（DB 樂觀鎖 + 廣播 poll_stopped + 固化 agg）
   b. 對本題執行 idle/stopped → active 的樂觀鎖 UPDATE
      └─ rowcount=0 → 409 POLL_INVALID_STATE
   c. 寫 audit log（action=poll.start）
   d. PUBLISH poll_started 至 evt:room:{roomId}
3. 釋放鎖（Lua 比對 token 後 DEL，避免誤刪他人鎖）
4. 回 200
```

- 鎖 **僅** 包住 start/stop/reset 等「會改變房間 active 不變式」的動作。lock/unlock/reveal/hide 只動單題，走 DB 樂觀鎖即可，不需房間鎖。
- 鎖 TTL 5s 是上限保護；正常路徑會在動作完成後主動釋放。
- Redis 不可用時：降級為「僅 DB 樂觀鎖 + `idx_interactions_active` partial unique」保證（見下）。

### 4.1 DB 層硬保證（雙保險）

SDS §7.2 已定義 `PARTIAL INDEX idx_interactions_active ON (room_id) WHERE status='active'`。
**強化為 partial UNIQUE index**：`UNIQUE (room_id) WHERE status='active'` → 即使 Redis 鎖失效，DB 也擋下「同房兩個 active」。

> 此 partial unique 需在 `0004` migration 補上（0001 可能只建了非 unique 版本，實作時確認並改為 unique）。

---

## 5. 事件（SDS §6.3；複用 `events.publish` + `target_modes`）

| event type | payload | 接收端（target_modes） | 節流 |
|-----------|---------|----------------------|------|
| `poll_started` | `poll{id,type,title,options(無正解),settings_public,ends_at?}` | all | — |
| `poll_stopped` / `poll_locked` / `poll_unlocked` | `poll_id, status` | all | — |
| `poll_result_revealed` / `poll_result_hidden` | `poll_id` | all | — |
| `poll_response_submitted` | `poll_id, response_count, aggregates` | present, host | **≥250ms 合併**（仿 qa 300ms） |

- `poll_started` 的 `options` **不得含 is_correct**（正解只在揭示時才送，PM-003-FR5）。
- 聚合事件帶**絕對值**（鐵律 2）；節流用 `qa_redis` 既有 debounce 範式抽出共用 helper。
- 新增 `events.py` 常數：`POLL_STARTED` 等 7 個型別。

---

## 6. API 端點（SDS §5.3）

| Method | Path | 對應 | 權限 |
|--------|------|------|------|
| POST | `/api/v1/rooms/{roomId}/interactions` | 建 Poll（已存在，擴充支援 options） | host |
| PATCH | `/api/v1/interactions/{id}` | 編輯題目 / options（已存在，擴充） | host |
| POST | `/api/v1/interactions/{id}/duplicate`、`/reorder`、`/move` | BE-002 控場 | host |
| GET | `/api/v1/polls/{id}` | 題目內容 + 個人作答狀態 | participant |
| POST | `/api/v1/polls/{id}/responses` | 提交作答（Idempotency-Key、rate limit 10/min） | participant |
| GET | `/api/v1/polls/{id}/results` | 結果（先讀 Redis，fallback DB） | participant（受 result_visible 控制）/ host |
| POST | `/api/v1/polls/{id}/actions` | 控場 `start/stop/lock/unlock/reveal/hide/reset/next/prev` | host |

- `GET /polls/{id}` 與 `/results` 對 participant 需經 `mask_identity`（鐵律 3）；正解僅在揭示後輸出。
- 作答端點：rate limit `poll 提交 10/min/participant`（SDS §8），新增 `qa_redis.check_poll_submit_rate_limit` 類函式。

---

## 7. 垂直切片（PR 拆解）與建議模型

> 每個切片 = 一次對話 = 一個可獨立測試的 AC 子集。**逐切片做，勿一次全包**（省 Token）。

| # | 切片 | 內容 | AC | 建議模型 |
|---|------|------|----|---------|
| **S5-1** | Migration + Models + Schemas | `0004` 兩表 + partial unique；ORM；answer discriminated union；各題型 settings | — | **Opus/Sonnet thinking**（schema 設計關鍵） |
| **S5-2** | Poll 控場狀態機 + 鎖 | `poll_service` actions + Redis 鎖 + DB 樂觀鎖 + audit + 事件 | BE-005、PM-004 | **Sonnet thinking**（並發核心） |
| **S5-3** | 作答 + 聚合（multiple_choice 先） | responses 端點、Redis agg、results、rate limit、Idempotency | FE-006、PM-003 | **Sonnet medium / Codex** |
| **S5-4** | 其餘題型聚合 | word_cloud / open_text / rating / ranking 驗證與聚合 | FE-007/008/009/010 | **Sonnet medium** |
| **S6-1** | renderers 核心（3 mode） | `mode: answer/present/preview` 共用元件 | FE-006~010、PM-003 | **Composer 2.5** |
| **S6-2** | Host Builder + 控制台 UI | Poll Builder、現場控制台、participant view | BE-003、BE-005 | **Composer 2.5** |
| **S6-3** | Present Mode 控制列 + 圖表 | PM-004 控制列、快捷鍵、Recharts 圖表 | PM-003/004 | **Composer 2.5** |
| **S*** | lint/test 修紅、DEVNOTE | ruff/mypy/pytest/tsc 收尾 | DoD | **Composer Fast** |

---

## 8. Definition of Done 自查（每個 PR）

- [ ] 對應 SRS AC 有自動化測試，測試名含 AC 編號（如 `test_fe006_ac2_locked_returns_409`）。
- [ ] ruff / mypy --strict / pytest 綠；前端 tsc strict + vite build 綠。
- [ ] 作答端點具 Idempotency-Key 測試；控場端點具 403（非 host）測試。
- [ ] 匿名輸出有遮蔽回歸測試（show_voter_names=false / is_anonymous）。
- [ ] 新增事件型別已更新 `events.py` 常數與前端 types。
- [ ] migration expand-only 且 idempotent（Neon 已有表時可 stamp）。

## 9. 鐵律落點對照

| 鐵律 | Poll 落點 |
|------|----------|
| 1 寫入走 REST，WS 只廣播 | 作答 / 控場皆 REST；WS 只送 poll_* 通知 |
| 2 計數後端聚合、絕對值 | Redis `agg:poll:{id}`；事件帶絕對值 |
| 3 匿名只在 mask_identity | results / open_text 明細經 serializer |
| 4 Idempotency-Key | `poll_responses.idempotency_key` + middleware |
| 5 同房一個 active Poll | Redis 房間鎖 + DB partial unique |
| 7 UTC / UUID v7 | `submitted_at` TIMESTAMPTZ；uuid7 PK |
| 8 伺服端強制權限 | 控場 `require host`；作答驗 participant room 綁定 |
| 10 audit log | start/stop/lock/unlock/reset/reveal/hide 寫入 |
```
