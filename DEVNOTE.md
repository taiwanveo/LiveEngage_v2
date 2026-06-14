# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-14）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`3d8edd6` — 深色主題、四端頂欄一致、Host 工作台版面
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

### 本輪重點（3d8edd6）

| 區塊 | 內容 |
|------|------|
| **深色主題** | `theme.css` 相容層（slate/gray → token）；`le-card` 取代硬編碼白底 |
| **四端頂欄** | `AppHeaderChrome` 固定 viewport 右上；Admin 主題/登出移出側欄左下 |
| **Participant** | Q&A/Ideas/Poll/Join/CodeEntry 接設計系統 |
| **Host 工作台** | 三欄 **25% / 60% / 15%**；手機外框 Participant 預覽 |
| **控場 UX** | Stop/Prev/Next 左上；Poll **toggle**（開始/鎖定/揭示）+ 重置 |
| **Analytics** | 深色下 `le-analytics-accent-*` 可讀 |

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

### 2026-06-14 — 深色主題 + 頂欄一致 + 工作台版面（3d8edd6）

深色相容層與 le-card 全端接線；AppHeaderChrome 四端對齊；Host 工作台 25/60/15、手機預覽、Poll toggle 控場。

### 2026-06-14 — Slido UI + SSO + Phase D 接續（22e4015）

Slido 風格控場 UI；Host 三欄工作台；Admin Analytics；OIDC 三端 SSO；Poll 修復；LLM/Integrations/多房間/E2E 最小實作。

### 2026-06-13 — UI 設計系統（d6a0499 / b2feac5）

`@liveengage/ui` 四主題 light/dark/cursor/claude。

### 2026-06-13 — Phase D Sprint 9（5c98f3e）

Quiz / Ideas / Survey；Zeabur worker。

### 2026-06-13 — Phase C+（0fbde82）/ Phase A（c4e0eff）

Rate limit、Celery export、Runbook。
