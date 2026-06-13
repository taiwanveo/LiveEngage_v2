# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。記錄專案現況快照、已知地雷與交付歷史。

---

## SNAPSHOT（最新狀態，2026-06-13）

### 專案基本資訊
- **Repo**：https://github.com/ColdRighter/LiveEngage.git（`master`）
- **本地路徑**：`c:\Vibe_Coidng_Local\LiveEngage`
- **最新 commit**：`8d0270a` — Sprint 1/Task 1 initial commit

### 技術棧（已確認）
- Python **3.14**（`requires-python = ">=3.14"`）
- FastAPI、SQLAlchemy 2.0 async、Alembic、argon2-cffi、pydantic-settings
- PostgreSQL 16、Redis 7（docker-compose dev 環境）
- ruff / mypy strict / pytest

### 目前完成進度

| Sprint | 任務 | 狀態 |
|--------|------|------|
| Sprint 1 | Task 1：backend 骨架 + 核心資料模型 + 初始 migration | ✅ 完成並 push |
| Sprint 1 | Task 2+：Auth、WebSocket、Session CRUD | ⏳ 待開始 |

### 已建立的核心結構
```
backend/
  app/
    core/         config, db(async), ids(UUID v7), security(argon2id),
                  deps(require_role骨架), errors(SDS §5.6信封), logging(JSON+遮蔽)
    models/       6 表核心鏈：organizations→users→sessions→rooms→participants→interactions
    serializers/  mask_identity（鐵律 3 單點匿名遮蔽）
    api/v1/       空骨架（待後續任務掛載 router）
    realtime/     空佔位（WS 本回合不實作）
    workers/      空佔位（Celery 留後期）
    schemas/      空佔位
    services/     空佔位
    main.py       /health + /ready endpoints
  alembic/        env.py（URL 由環境變數注入）+ 0001 初始 migration
  tests/          health smoke + metadata + skipif live migration
```

### 驗證結果（本機 Python 3.14，無 docker）
- `ruff check .` ✅
- `mypy app --strict` ✅
- `pytest` ✅（4 passed, 1 skipped 實機 DB）
- `alembic upgrade head --sql`（離線 DDL）✅

---

## 已知地雷 / 注意事項

1. **`updated_at` trigger**：SDS §7.1 指定 DB trigger 維護，目前以 SQLAlchemy `onupdate` 代替（選項 A）。後續任務補 migration trigger 時注意不要破壞現有資料。

2. **實機 migration 未跑**：本機無 docker，`alembic upgrade head` 尚未對真實 PG 執行。取得 docker 環境後務必跑一次確認。

3. **Auth 尚未實作**：`app/core/deps.py::require_role` 為骨架，所有端點目前無真實鑑權。Sprint 1 Task 2 補上 JWT。

4. **git user**：首次 commit 使用 `agent@liveengage.dev / LiveEngage Agent`，後續可改為個人帳號（`git config --global user.email`）。

5. **`alembic.ini` 中文問題**：Windows cp950 環境下，`alembic.ini` 的中文注解會導致 UnicodeDecodeError。已全部改為 ASCII 注解，後續維護此檔案時勿加中文。

---

## HISTORY

### 2026-06-13 — Sprint 1 / Task 1 初始 push

**commit**：`8d0270a`
**push 內容**：50 個檔案，1812 行新增

**交付摘要**：
- 建立 repo 從零到一的 backend 骨架（不含 frontend、WS、Auth、Celery）
- 依 SDS §7.2 DDL 完整建立核心鏈 6 資料表（6 ENUM、FK、partial index）
- Alembic 初始 migration（expand-contract，forward only）
- 鐵律落點：mask_identity（#3）、UUID v7（#7）、UTC 時間（#7）、機密不進 log（#9）、require_role 骨架（#8）
- 工具鏈全綠：ruff / mypy strict / pytest / alembic offline DDL
- references/：PRD + SRS + SDS 三份規格文件進版控
