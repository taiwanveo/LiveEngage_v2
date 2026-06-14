# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-14）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`01009f7` — Q&A/Quiz 投影、審核麵包屑與活動封存
- **typecheck**：`host` 通過
- **Zeabur**：push `master` 自動 redeploy（**host**、**api** 有變更）

### 已上線服務

| 服務 | URL |
|------|------|
| api | https://le-api.zeabur.app |
| host | https://le-host.zeabur.app |
| participant | https://le-participant.zeabur.app |

### 本輪重點（01009f7）

| 區塊 | 內容 |
|------|------|
| **Q&A 投影** | `QaPresentPage`：`#/rooms/.../moderation/present`；唯讀熱門已核准問題 + WS |
| **Quiz 投影** | `QuizPresentPage`：`#/rooms/.../sprint9/{quizId}/present`；當前子題 + 排行榜 |
| **投影入口** | Q&A 審核、Quiz 列表／控制台右上角「投影」；`presentHref` 統一 Host 同源 JWT |
| **Q&A 麵包屑** | 活動儀表板 → 活動 → Q&A 審核 |
| **活動封存** | 儀表板 `ended`/`draft` 可封存；列表隱藏 `archived` |

### 投影路由速查

| 類型 | 路由 |
|------|------|
| Poll | `#/rooms/{roomId}/polls/{pollId}/present` |
| Q&A | `#/rooms/{roomId}/moderation/present` |
| Quiz | `#/rooms/{roomId}/sprint9/{quizId}/present` |

### 先前已上線（84d992d）

參與者作答 WS 即時更新；投影按鈕同源 JWT 修復（a416d99）。

### 仍可做（非阻塞）

- Neon Pooler 環境變數
- Ideas / Survey 投影（若需要）
- Playwright E2E

---

## HISTORY

### 2026-06-14 — Q&A/Quiz 投影、麵包屑與活動封存（01009f7）

`QaPresentPage`、`QuizPresentPage`；`presentHref`；審核麵包屑；儀表板封存。

### 2026-06-14 — 參與者作答 Host 即時更新（84d992d）

`poll_response_submitted` WS 處理；open_text entries 補拉。

### 2026-06-14 — 投影 Token 修復（a416d99）

`presentAppUrl` 改 Host 同源路由。

### 2026-06-14 — Poll 控場延遲優化（edc9f56）

後端單一 commit + `pollActionCache` 樂觀更新。

### 2026-06-14 — 工作台控場與手機預覽（86813b5）

頂欄控場列；`hostWorkbenchPreview`；選項自動儲存。
