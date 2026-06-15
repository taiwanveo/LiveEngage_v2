# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-15）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`792f5a0` — 全專案 API／網路錯誤訊息中文化
- **typecheck**：`realtime`、`host`、`participant`、`admin` 通過
- **Zeabur**：api / host / participant / admin / worker（**已刪除** `present` / `le-present`）

### 已上線服務

| 服務 | URL |
|------|------|
| api | https://le-api.zeabur.app |
| host | https://le-host.zeabur.app（含大螢幕投影 `#/…/present`） |
| participant | https://le-participant.zeabur.app |
| admin | https://le-admin.zeabur.app |

### 本輪重點

| 區塊 | 內容 |
|------|------|
| **錯誤訊息中文化** | 新增 `formatUserFacingError`；`Failed to fetch` 等英文改為「無法連上伺服器，請確認網路連線或稍後再試」 |
| **API client** | host / participant / admin 的 `fetch` 失敗統一拋中文 `ApiException` |
| **Quiz 控場** | `Sprint9ConsolePage` 子題「開始」等 mutation 錯誤改走統一格式化 |

### 投影路由速查（Host）

| 類型 | 路由 |
|------|------|
| Poll | `#/rooms/{roomId}/polls/{pollId}/present` |
| Q&A | `#/rooms/{roomId}/moderation/present` |
| Quiz / Ideas / Survey | `#/rooms/{roomId}/sprint9/{interactionId}/present` |

### 仍可做（非阻塞）

- Neon Pooler 環境變數
- Playwright E2E

---

## HISTORY

### 2026-06-15 — 錯誤訊息中文化（792f5a0）

`apiErrors.ts` + 三端 API client + 各頁 `formatUserFacingError`；Quiz 子題控場不再顯示英文 `Failed to fetch`。

### 2026-06-15 — 移除獨立 Present App（4e5e273）

刪除 `apps/present` 與 Zeabur 服務；投影僅 Host 同源。

### 2026-06-14 — 分享連結指向 participant（7d4420d）

Host「分享加入資訊」的 URL／QR 修正為 `le-participant.zeabur.app/#/join/{code}`。

### 2026-06-14 — Survey 作答、Quiz 重載與按鈕缺口修復（f82edc6）

Participant Survey 完整流程；Quiz active-question API；Ideas/Survey 投影；Host 麵包屑與 mutation 錯誤回饋。

### 2026-06-14 — Q&A/Quiz 投影、麵包屑與活動封存（01009f7）

`QaPresentPage`、`QuizPresentPage`；`presentHref`；審核麵包屑；儀表板封存。

### 2026-06-14 — 參與者作答 Host 即時更新（84d992d）

`poll_response_submitted` WS 處理；open_text entries 補拉。

### 2026-06-14 — 投影改 Host 同源（a416d99）

`presentAppUrl` 改 Host hash 路由，不再依賴跨網域 Present 站。

### 2026-06-14 — Poll 控場延遲優化（edc9f56）

後端單一 commit + `pollActionCache` 樂觀更新。

### 2026-06-14 — 工作台控場與手機預覽（86813b5）

頂欄控場列；`hostWorkbenchPreview`；選項自動儲存。
