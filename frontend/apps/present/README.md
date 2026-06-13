# LiveEngage Present App

大螢幕投影端（唯讀展示），dev port **5175**。

## 啟動

```bash
cd frontend/apps/present
npm install
npm run dev
```

後端需同時運行於 `http://localhost:8000`。

## 路由

| Hash | 說明 |
|------|------|
| `#/rooms/{roomId}/polls/{pollId}/present` | Poll 投影全螢幕 |

## 設計

- **唯讀**：不做控場寫入（start/stop/lock 等在 Host 控制台操作）
- **WS**：`mode=present`，接收 Poll 事件即時更新
- **登入**：使用 Host 帳號 JWT（與 Host app 相同 `/api/v1/auth/login`）

## 手動測試

1. Host 建立 Poll 並按「開始」
2. 開啟 `http://localhost:5175/#/rooms/{roomId}/polls/{pollId}/present`
3. 登入 Host 帳號
4. 參與者提交作答 → 投影畫面應即時更新結果
