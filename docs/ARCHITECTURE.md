# LiveEngage — 架構與實作現況

> 本檔記錄 **repo 實際建立** 的內容與技術選型，並明列**刻意未做**的範圍。
> 權威規格仍以 [references/](../references/) 的 SRS / SDS 為準。

## 1. 本回合（Sprint 1 / 任務 1）已建立

### 目錄結構

```
LiveEngage/
├── AGENTS.md                  # Agent 入口
├── README.md                  # 啟動與測試說明
├── docker-compose.yml         # 本地 PostgreSQL 16 + Redis 7（僅 dev）
├── .env.example               # 環境變數範本（無真實機密）
├── .gitignore
├── docs/                      # 工程文件（本檔、實作指引）
├── references/                # PRD / SRS / SDS（權威規格）
└── backend/
    ├── pyproject.toml         # 依賴 + ruff/mypy/pytest 設定
    ├── alembic.ini
    ├── alembic/
    │   ├── env.py             # 連線字串由環境變數注入（鐵律 9）
    │   └── versions/0001_initial_core_chain.py
    ├── app/
    │   ├── main.py            # app factory + /health + /ready
    │   ├── api/v1/router.py   # /api/v1 空聚合骨架
    │   ├── core/             # config, db, ids(uuid7), security, deps, errors, logging
    │   ├── models/           # base + enums + 核心鏈 6 表
    │   ├── serializers/      # mask_identity（鐵律 3 單點遮蔽）
    │   ├── schemas/          # 佔位
    │   ├── services/         # 佔位
    │   ├── realtime/         # 空 package（本回合不實作 WS）
    │   └── workers/          # 空 package（本回合不實作 Celery）
    └── tests/                 # health smoke + models/migration
```

### 技術選型（對齊 SDS §2）

| 層 | 選型 |
|----|------|
| 語言 | Python 3.14 |
| Web | FastAPI |
| ORM / Migration | SQLAlchemy 2.0 async + Alembic |
| DB | PostgreSQL 16（JSONB、partial / 函式索引、ENUM、UUID v7） |
| 密碼雜湊 | argon2id（argon2-cffi） |
| 日誌 | 結構化 JSON + 機密遮蔽 filter |

### 資料模型（核心鏈，SDS §7.2）

`organizations` → `users` → `sessions` → `rooms` → `participants` → `interactions`

- 主鍵 UUID v7（`app/core/ids.py`，相容 3.12 後備實作）。
- 時間欄位 UTC（`DateTime(timezone=True)`）。
- 特殊索引以原生 DDL 建於 migration：
  - `uq_sessions_code_active`：`lower(code) WHERE status IN ('draft','live')`
  - `idx_interactions_active`：`(room_id) WHERE status='active'`
- 6 個 PostgreSQL ENUM：`user_role`、`session_status`、`session_visibility`、`auth_method`、`interaction_type`、`interaction_status`。

## 2. 刻意未做（留待後續任務）

| 項目 | 任務 |
|------|------|
| React / frontend monorepo（participant/host/admin） | 後續 |
| WebSocket Gateway、Redis Pub/Sub、事件信封、replay | Sprint 1 後續 |
| 完整 Auth（JWT 簽發/驗證、SSO、participant token） | 任務 2 |
| Session CRUD、join by code/link、Present join_info view | 任務 2 |
| Idempotency-Key middleware（目前僅介面/欄位預留） | 任務 2–3 |
| 其餘 SDS §7.2 資料表（poll_options、questions*、quiz*、survey*、ideas*、cohosts、export_jobs、audit_logs、ai_request_logs、branding/privacy_settings…） | 任務 3+ |
| Celery worker（export / analytics / retention / notification） | Sprint 7+ |
| AI Orchestration（旁路） | Sprint 9+ |

## 3. 已預留的鐵律落點（§2）

| 鐵律 | 落點 |
|------|------|
| 3 匿名遮蔽單點 | `app/serializers/mask_identity.py` |
| 4 Idempotency-Key | `poll_responses.idempotency_key` 欄位（後續任務）+ middleware TODO |
| 7 UTC / UUID v7 | `app/core/ids.py`、`models/base.py` |
| 8 伺服端權限 | `app/core/deps.py::require_role`（骨架） |
| 9 機密不進 log | `app/core/logging.py` 遮蔽 filter；連線字串由環境注入 |

## 4. 已知技術債 / 待決

- **updated_at**：SDS §7.1 指定由 DB trigger 維護；目前以 SQLAlchemy `onupdate`
  維護（選項 A），待後續任務以 migration 補 trigger。
- **Python 版本**：確認以 3.14 為主（`pyproject.toml requires-python = ">=3.14"`）。
  實機 `alembic upgrade head` 需在具 docker 的環境執行（本回合以 `--sql` offline 驗證）。
