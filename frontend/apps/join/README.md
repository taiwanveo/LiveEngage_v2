# LiveEngage Join App

參與者加入與作答端（Vite + React 19 + TS strict + Tailwind）。

## 開發

```bash
npm install
npm run dev   # http://localhost:5174
```

需同時啟動後端（`8000`）與 Host（`5173`）以便建立活動與控場。

## 路由

| Hash | 說明 |
|------|------|
| `#/join` | 輸入活動代碼 |
| `#/join/{CODE}` | 加入表單（FE-001/002） |
| `#/room` | 作答頁（自動顯示同房 active Poll） |

## 生產網域

- 主要：`https://le-join.zeabur.app`
- 舊網域 `le-participant.zeabur.app` 會導向 join（保留 QR／書籤）

## E2E 手動驗收

1. Host 建立活動並設為 **live**，記下活動代碼
2. Host 建立 Poll → 控制台 **開始**
3. Join 開 `#/join/{CODE}` → 加入 → 作答提交
4. Host 控制台應看到回應數增加
