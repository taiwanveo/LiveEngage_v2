# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-13）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：43854ce S7-4/S7-5 + Zeabur 部署準備
- **pytest**：50 passed（含 S7-4/S7-5 新測試 4 項）
- **Zeabur 專案**：liveengage（ID 6a2d1bc82871baed5fc633ef）
- **Zeabur MCP**：Cursor 顯示 error；CLI 可用

### Sprint 7 進度

| 任務 | 狀態 |
|------|------|
| S7-1 Admin 骨架 | done |
| S7-2 組織與活動 API + UI | done 4be10c8 |
| S7-3 audit log 查詢 | done 4be10c8 |
| S7-4 Branding 基礎 | done 43854ce |
| S7-5 BE-012 匯出 Worker | done 43854ce |

### 仍待完成

- Sprint 9+：Quiz / Survey / Ideas / AI / Integrations
- Zeabur 正式部署（CLI upload 400，建議 GitHub 連動）
- Zeabur MCP 修復（見 docs/Zeabur_部署指引.md）

### 新增 API

| Method | Path | 說明 |
|--------|------|------|
| GET/PATCH | /api/v1/admin/branding | 組織品牌設定 |
| GET | /api/v1/branding/by-code/{code} | 公開品牌 |
| GET/POST | /api/v1/admin/exports | 匯出任務 |
| GET | /api/v1/exports/{id}/download | 72h 簽名下載 |

---

## HISTORY

### 2026-06-13 — S7-4/S7-5（43854ce）

S7-4：Branding API + BrandingPage；settings_jsonb.branding
S7-5：export_jobs migration、CSV/XLSX、HMAC 簽名連結、ExportsPage
Zeabur：專案 liveengage 已建立；backend/Dockerfile；CLI deploy upload 400

### 2026-06-13 — S7-2/S7-3（4be10c8）

Admin API BE-008/009/010 + 三頁面 UI

