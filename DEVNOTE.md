# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-14）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`c08e157` — Quiz 開放修復、Admin 版型、Host 導覽統一
- **pytest**：含 `test_activate_quiz_stops_existing_active_poll`；全 suite 建議 CI 再跑
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

### 本輪重點

| 區塊 | 內容 |
|------|------|
| **Quiz 開放 BUG** | `interaction_service` activate 前先 stop 同 room 其他 active；Sprint9 前端 `onError` |
| **Admin 後台** | 移除總覽「快捷入口」；`AdminLayout` 統一頁標題／欄位標籤 typography |
| **Host 導覽** | 三項選單：**Q&A 審核**、**Poll 管理**、**Quiz 管理**（`le-nav-link` 一致） |
| **Q&A 審核** | 改用 `HostShell`；「重新整理」移至標題旁（移除 refresh 英文） |
| **工作台 / Poll** | `PollControlBar` 共用 toggle；投影預設 `le-present.zeabur.app`；三欄 25/55/20 |

### 生產環境新增/可選 env（api）

| 變數 | 用途 |
|------|------|
| `LE_SSO_ENABLED` | 啟用 SSO |
| `LE_SSO_OIDC_*` | IdP 設定 |
| `LE_API_PUBLIC_URL` | `https://le-api.zeabur.app` |
| `LE_SSO_*_FRONTEND_URL` | 各前端 Zeabur 網域 |
| `LE_AI_ENABLED` / `LE_AI_API_KEY` | 真實 LLM（可選） |

### 仍可做（非阻塞）

- Webhook 實際 outbound 派送（Celery task）
- Playwright 完整 join→poll 瀏覽器流程
- Admin Integrations 管理 UI 頁

---

## HISTORY

### 2026-06-14 — Quiz 開放 + Admin 版型 + Host 導覽（c08e157）

後端 unique index 衝突修復；Admin 移除開發代號快捷入口與 typography 統一；Host 頂欄三選單與 Q&A 重新整理位置調整。

### 2026-06-14 — 深色主題 + 頂欄一致 + 工作台版面（3d8edd6）

深色相容層與 le-card 全端接線；AppHeaderChrome 四端對齊；Host 工作台三欄、手機預覽、Poll toggle 控場。

### 2026-06-14 — Slido UI + SSO + Phase D 接續（22e4015）

Slido 風格控場 UI；Host 三欄工作台；Admin Analytics；OIDC 三端 SSO；Poll 修復；LLM/Integrations/多房間/E2E 最小實作。

### 2026-06-13 — UI 設計系統（d6a0499 / b2feac5）

`@liveengage/ui` 四主題 light/dark/cursor/claude。

### 2026-06-13 — Phase D Sprint 9（5c98f3e）

Quiz / Ideas / Survey；Zeabur worker。

### 2026-06-13 — Phase C+（0fbde82）/ Phase A（c4e0eff）

Rate limit、Celery export、Runbook。
