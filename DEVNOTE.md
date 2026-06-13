# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。記錄專案現況快照、已知地雷與交付歷史。

---

## SNAPSHOT（最新狀態，2026-06-13）

### 專案基本資訊
- **Repo**：https://github.com/ColdRighter/LiveEngage.git（`master`）
- **本地路徑**：`c:\Vibe_Coidng_Local\LiveEngage`
- **最新 commit（已 push）**：`611b161` — Task 2b WS + state 快照
- **GitHub**：`origin/master` 已同步（Task 1/2a/2b 共 3 commits）
- **資料庫**：Neon Postgres（`taiwanveo@gmail.com` 帳號專案，`ap-southeast-1`）
- **Neon MCP**：`project-0-LiveEngage-neon` 已授權（org: TAIWANVEO，project: LiveEngage `damp-tooth-60940518`）

### 技術棧
- Python **3.14**、FastAPI、SQLAlchemy 2.0 async、Alembic、PyJWT、argon2-cffi
- **Neon 連線**：async `?ssl=require`；sync `?sslmode=require`；dev 用 `NullPool`
- ruff / mypy strict / pytest（**11 passed** on Neon，2026-06-13）

### 目前完成進度

| Sprint | 任務 | 狀態 |
|--------|------|------|
| Task 1 | backend 骨架 + migration 0001 | ✅ pushed |
| Task 2a | Auth + Session CRUD + join（FE-001/002） | ✅ pushed |
| Task 2b | WS Gateway + state 快照 API | ✅ pushed |

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
| WS | `/ws?token=&room=&mode=` | Gateway（廣播 only） |

---

## 已知地雷 / 注意事項

1. **`.env` 含 Neon 密碼，勿 commit**（已在 `.gitignore`）。
2. **Neon async URL** 必須用 `ssl=require`，不可用 `sslmode`（asyncpg 不支援）。
3. **StrEnum ORM** 須用 `pg_enum()` + `values_callable`，否則寫入 `OWNER` 而非 `owner`。
4. **Redis Pub/Sub** 尚未接上；WS 目前為程序內 in-memory fan-out（dev 單副本）。
5. **`updated_at` DB trigger** 仍待後續 migration（選項 A：暫用 SQLAlchemy onupdate）。

---

## HISTORY

### 2026-06-13 — Task 2b：WS + state 快照（本地）
- `GET /sessions/{id}/state`：rooms、active_interactions、participant_count
- `WS /ws`：JWT 驗證、25s ping、鐵律 1 不做寫入
- 測試：`test_rt002_state.py`、`test_ws_gateway.py`

### 2026-06-13 — Task 2a：Auth + Session + join（commit `683624e`）
- JWT access/refresh/participant；Session CRUD + join；FE-001/002 整合測試 9 passed
- Neon migration 0001 已套用；pytest 全綠

### 2026-06-13 — Task 1 初始 push（commit `8d0270a`）
- 6 表核心鏈 + Alembic 0001 + 工具鏈
