# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-13）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：5c98f3e Phase D — Sprint 9 Quiz/Ideas/Survey、worker SSL
- **pytest**：63+ passed（含 `test_s9_phase_d`：Quiz / Ideas / Survey / AI-001 / Co-host）
- **Zeabur**：**六服務** — api / host / participant / present / admin / **worker**

### 已上線服務

| 服務 | URL |
|------|------|
| api | https://le-api.zeabur.app |
| host | https://le-host.zeabur.app |
| participant | https://le-participant.zeabur.app |
| present | https://le-present.zeabur.app |
| admin | https://le-admin.zeabur.app |
| worker | Celery（無公開 URL，`Dockerfile.worker`） |

### Phase A+B（現場 Poll + Q&A）

Host 儀表板、Participant Q&A/Poll、Present 投影、主持人回覆、QR 分享。

### Phase C+（平台與營運）

IP rate limit、Celery export worker + Redis 快取、`docs/RUNBOOK.md`、測試帳號清理。

### Phase D（Sprint 9+ — 本輪）

| 項目 | 狀態 |
|------|------|
| Migration `0006_sprint9_phase_d`（quiz / ideas / cohost / survey / ai_request_logs） | done |
| BE-006 Survey、BE-007 Quiz、BE-012 Co-host、AI-001~003 stub | done |
| FE-011 Quiz 控制台、FE-012 Survey、FE-013 Ideas（Host + Participant 最小 UI） | done |
| Celery worker SSL（Upstash `rediss://`）+ `--pool=solo` | done |
| 整合測試 `tests/test_s9_phase_d.py` | done |

**仍 defer**：SSO、Integrations、多房間進階、E2E 自動化、真實 LLM（目前 AI stub + 503）

---

## HISTORY

### 2026-06-13 — Phase D Sprint 9（待填 commit）

Quiz / Ideas / Survey 後端 + 最小前端；Zeabur worker 服務；Celery rediss SSL 修復。

### 2026-06-13 — Phase C+ 平台營運（0fbde82）

Rate limit、Celery export、測試帳號清理、Runbook

### 2026-06-13 — Phase B（2661e3f）

### 2026-06-13 — Phase A（c4e0eff）
