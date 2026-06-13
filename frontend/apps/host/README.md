# LiveEngage Host App

PM-002 主持人審核三欄 UI（pending / approved / answered）。

## 開發

```powershell
cd frontend/apps/host
npm install
npm run dev    # http://localhost:5173
```

`vite.config.ts` 已設 proxy：`/api` 與 `/ws` 轉發至 `localhost:8000`（本地後端）。

## 路由

- `#/`（無 hash）：登入頁。
- `#/rooms/<roomId>/moderation`：PM-002 審核頁。

登入後手動將 `<roomId>` 換成實際 UUID 即可進入審核。

## 鐵律落點

- 所有寫入呼叫 `/api/v1/...`，並以 `Idempotency-Key` header 去重（鐵律 1、4）。
- 計數顯示直接讀後端 `upvote_count`／`score`，前端不累加（鐵律 2）。
- 匿名顯示來自後端 `mask_identity` 的 `author_display`（鐵律 3）。
