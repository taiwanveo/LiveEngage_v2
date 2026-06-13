# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。記錄專案現況快照、已知地雷與交付歷史。

---

## SNAPSHOT（最新狀態，2026-06-13）

### 專案基本資訊
- **Repo**：https://github.com/ColdRighter/LiveEngage.git（`master`）
- **本地路徑**：`c:\Vibe_Coidng_Local\LiveEngage`
- **最新 commit（已 push）**：Task 1/2a/2b + Sprint 3 Q&A
- **GitHub**：`origin/master` 已同步
- **資料庫**：Neon Postgres（`taiwanveo@gmail.com` 帳號專案，`ap-southeast-1`）
- **Neon MCP**：`project-0-LiveEngage-neon` 已授權（org: TAIWANVEO，project: LiveEngage `damp-tooth-60940518`）
- **GitHub CLI**：`gh` 已安裝（使用者目錄免安裝版）並登入 `ColdRighter`，Agent 可直接 push / 開 PR

### 技術棧
- Python **3.14**、FastAPI、SQLAlchemy 2.0 async、Alembic、PyJWT、argon2-cffi
- **venv 在 `backend/.venv`**；驗證指令：`.\.venv\Scripts\python.exe -m ruff/mypy/pytest`
- **Neon 連線**：async `?ssl=require`；sync `?sslmode=require`；dev 用 `NullPool`
- ruff / mypy strict / pytest（**19 passed** on Neon，2026-06-13）

### 目前完成進度

| Sprint | 任務 | 狀態 |
|--------|------|------|
| Task 1 | backend 骨架 + migration 0001 | ✅ pushed |
| Task 2a | Auth + Session CRUD + join（FE-001/002） | ✅ pushed |
| Task 2b | WS Gateway + state 快照 API | ✅ pushed |
| Sprint 3 | Q&A：提問/列表/投票/審核（FE-004/005、BE-004） | ✅ migration 0002 + 8 AC 測試 |

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
| POST | `/api/v1/rooms/{roomId}/interactions` | 建立互動（本 Sprint 供 Q&A 控場） |
| PATCH | `/api/v1/interactions/{id}` | 開關 Q&A / 改設定 |
| POST | `/api/v1/rooms/{roomId}/questions` | 提問（FE-004） |
| GET | `/api/v1/rooms/{roomId}/questions` | 公開列表 top/newest（FE-005） |
| POST | `/api/v1/questions/{id}/vote` | upvote/downvote toggle（FE-005） |
| GET | `/api/v1/rooms/{roomId}/questions/moderation` | 審核清單（BE-004） |
| POST | `/api/v1/questions/{id}/moderate` | 審核/答覆/高亮（BE-004） |
| POST | `/api/v1/questions/{id}/replies` | Host 回覆（BE-004） |

---

## 已知地雷 / 注意事項

1. **`.env` 含 Neon 密碼，勿 commit**（已在 `.gitignore`）。
2. **Neon async URL** 必須用 `ssl=require`，不可用 `sslmode`（asyncpg 不支援）。
3. **StrEnum ORM** 須用 `pg_enum()` + `values_callable`，否則寫入 `OWNER` 而非 `owner`。
4. **Redis Pub/Sub** 尚未接上；WS 目前為程序內 in-memory fan-out（dev 單副本）。
5. **`updated_at` DB trigger** 仍待後續 migration（選項 A：暫用 SQLAlchemy onupdate）。
6. **`.env` 缺 `LE_DATABASE_URL`（async）**，只有 `LE_DATABASE_URL_SYNC`；跑 async 測試前需自行設定（可由 sync URL 把 `psycopg→asyncpg`、`sslmode→ssl` 推導）。
7. **時區欄位地雷**：所有 `DateTime` 欄位 model 端務必加 `DateTime(timezone=True)`，否則 asyncpg 寫 tz-aware datetime 會報 `can't subtract offset-naive and offset-aware`（Sprint 3 修了 `interactions.started_at/stopped_at`）。
8. **Q&A score** 為 DB `GENERATED ALWAYS AS (upvote_count - downvote_count) STORED`；計數寫 `upvote_count/downvote_count`，score 自動維護。

### Sprint 3 刻意延後（待補）
- Redis 計數節流（HINCRBY）+ 週期回寫、廣播節流（≥300ms 合併）
- Idempotency-Key 去重（無 Redis；目前寫入端點尚未實作）
- rate limit（提問 5/min、upvote 30/min…）
- audit log 持久化（審核/高亮等動作；表尚未建立）
- 相似問題偵測、Question AI、participant 互相回覆、label CRUD
- Host/Present WS 連線的房間 org 歸屬查驗（participant 已綁定）

---

## HISTORY

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
