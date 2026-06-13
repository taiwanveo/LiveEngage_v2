# LiveEngage Admin App

組織管理後台骨架（Sprint 7-1），dev port **5176**。

## 啟動

```bash
cd frontend/apps/admin
npm install
npm run dev
```

## 路由

| Hash | 說明 | 計畫切片 |
|------|------|----------|
| `#/dashboard` | 總覽與模組入口 | S7-1 |
| `#/organization` | 組織設定（BE-008） | S7-2 |
| `#/sessions` | 活動管理（BE-009） | S7-2 |
| `#/audit` | 稽核紀錄（BE-010） | S7-3 |
| `#/branding` | 品牌設定 | S7-4 |
| `#/exports` | 資料匯出（BE-012） | S7-5 |

## 設計

- 登入沿用 `/api/v1/auth/login`（admin/owner 角色後續由後端強制）
- 各模組目前為佔位頁，待 Sprint 7-2+ 接 API
