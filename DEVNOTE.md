# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-13）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：（Phase C+ push 後更新）
- **pytest**：58+ passed（含 Phase C rate limit、Celery export eager、XLSX）
- **Zeabur**：五服務 + 可選 **worker**（`Dockerfile.worker`）

### 已上線服務

| 服務 | URL |
|------|------|
| api | https://le-api.zeabur.app |
| host | https://le-host.zeabur.app |
| participant | https://le-participant.zeabur.app |
| present | https://le-present.zeabur.app |
| admin | https://le-admin.zeabur.app |

### Phase A+B（現場 Poll + Q&A）

Host 儀表板、Participant Q&A/Poll、Present 投影、主持人回覆、QR 分享。

### Phase C+（平台與營運）

| 項目 | 狀態 |
|------|------|
| IP rate limit（passcode / by-code） | done |
| org `settings_jsonb.rate_limit` 覆寫 participant 限流 | done |
| Celery export worker + Redis 檔案快取 | done（需部署 worker 或 `LE_CELERY_TASK_ALWAYS_EAGER`） |
| `scripts/cleanup_test_accounts.py` | done |
| `docs/RUNBOOK.md` | done |

### 仍待 Phase D（Sprint 9+）

Quiz / Survey / Ideas、AI 旁路、SSO、Co-host、Integrations、E2E 自動化套件

---

## HISTORY

### 2026-06-13 — Phase C+ 平台營運

Rate limit、Celery export、測試帳號清理、Runbook

### 2026-06-13 — Phase B（2661e3f）

### 2026-06-13 — Phase A（c4e0eff）
