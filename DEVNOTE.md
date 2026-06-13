# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-14）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`22e4015` — Slido UI、SSO、工作台、Phase D 接續
- **pytest**：19+（SSO + admin + poll lifecycle）；全 suite 建議 CI 再跑
- **Zeabur**：**六服務** — api / host / participant / present / admin / worker（push `master` 自動 redeploy）

### 已上線服務

| 服務 | URL |
|------|------|
| api | https://le-api.zeabur.app |
| host | https://le-host.zeabur.app |
| participant | https://le-participant.zeabur.app |
| present | https://le-present.zeabur.app |
| admin | https://le-admin.zeabur.app |
| worker | Celery（無公開 URL） |

### 本輪重點（22e4015）

| 區塊 | 內容 |
|------|------|
| **Slido UI** | 新主題 `slido`（白底深綠、預設）；`SessionToolbar` / `WorkbenchLayout` / `ParticipantPreviewFrame` |
| **Host 工作台** | `#/rooms/:roomId/workbench/:pollId?` 三欄：互動清單｜控場｜Participant 預覽 |
| **Admin Analytics** | `GET /admin/stats/overview`、`/analytics/engagement`；Dashboard 三欄儀表板 |
| **SSO** | OIDC Host/Admin/Participant；`/auth/sso/*`；Participant `/sso/participant-join` |
| **Auth UX** | Admin/Host JWT **refresh token** 自動換發（修復邀請成員 Token 過期） |
| **Poll BUG** | `result_visible` 預設 false；Participant 不再閃現答案 |
| **LLM** | `LE_AI_ENABLED` + OpenAI-compatible API；失敗降級 stub |
| **Integrations** | Webhook CRUD → org `settings_jsonb.webhooks` |
| **多房間** | `GET/POST /sessions/{id}/rooms` |
| **E2E** | `e2e/smoke.spec.ts`（Playwright API smoke） |

### 生產環境新增/可選 env（api）

| 變數 | 用途 |
|------|------|
| `LE_SSO_ENABLED` | 啟用 SSO |
| `LE_SSO_OIDC_*` | IdP 設定 |
| `LE_API_PUBLIC_URL` | `https://le-api.zeabur.app` |
| `LE_SSO_HOST_FRONTEND_URL` | `https://le-host.zeabur.app` |
| `LE_SSO_ADMIN_FRONTEND_URL` | `https://le-admin.zeabur.app` |
| `LE_SSO_PARTICIPANT_FRONTEND_URL` | `https://le-participant.zeabur.app` |
| `LE_AI_ENABLED` / `LE_AI_API_KEY` | 真實 LLM（可選） |

### 仍可做（非阻塞）

- Webhook 實際 outbound 派送（Celery task）
- Playwright 完整 join→poll 瀏覽器流程
- Admin Integrations 管理 UI 頁

---

## HISTORY

### 2026-06-14 — Slido UI + SSO + Phase D 接續（22e4015）

Slido 風格控場 UI；Host 三欄工作台；Admin Analytics；OIDC 三端 SSO；Poll 修復；LLM/Integrations/多房間/E2E 最小實作。

### 2026-06-13 — UI 設計系統（d6a0499 / b2feac5）

`@liveengage/ui` 四主題 light/dark/cursor/claude。

### 2026-06-13 — Phase D Sprint 9（5c98f3e）

Quiz / Ideas / Survey；Zeabur worker。

### 2026-06-13 — Phase C+（0fbde82）/ Phase A（c4e0eff）

Rate limit、Celery export、Runbook。
