# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-13）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：（待 push）UI 設計系統 + 四主題切換
- **pytest**：63+ passed（含 `test_s9_phase_d`）
- **Zeabur**：**六服務** — api / host / participant / present / admin / **worker**

### 已上線服務

| 服務 | URL |
|------|------|
| api | https://le-api.zeabur.app |
| host | https://le-host.zeabur.app |
| participant | https://le-participant.zeabur.app |
| present | https://le-present.zeabur.app |
| admin | https://le-admin.zeabur.app |
| worker | Celery（無公開 URL） |

### UI 設計系統（本輪）

| 項目 | 狀態 |
|------|------|
| `@liveengage/ui` 共用套件（theme.css、Tailwind preset、ThemeProvider） | done |
| 四主題：`light` / `dark` / `cursor` / `claude` | done |
| 四前端 app 接線 + 核心頁重構（Login、Shell、Dashboard、Room） | done |
| `design-system/MASTER.md` | done |

**仍 defer（Phase D 範圍外）**：SSO、Integrations、多房間進階、E2E 自動化、真實 LLM

---

## HISTORY

### 2026-06-13 — UI 設計系統與主題切換

專業級視覺升級；Cursor / Claude 配色主題；語意 token 取代散落的 slate 類別。

### 2026-06-13 — Phase D Sprint 9（5c98f3e）

Quiz / Ideas / Survey 後端 + 最小前端；Zeabur worker；Celery rediss SSL。

### 2026-06-13 — Phase C+（0fbde82）

Rate limit、Celery export、Runbook

### 2026-06-13 — Phase B（2661e3f）/ Phase A（c4e0eff）
