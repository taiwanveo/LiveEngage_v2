# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-15）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`e3b1b1b` — UI 按鈕設計系統與投影按鈕統一
- **typecheck**：`ui`、`host` 通過
- **Zeabur**：api / host / participant / admin / worker

### 本輪重點

| 區塊 | 內容 |
|------|------|
| **設計系統** | `@liveengage/ui` 新增 `Button`、`PresentButton`、`ListAction*`；`theme.css` 擴充 sm/xs、danger/success/muted |
| **投影按鈕** | 深綠填色 + 白字（修正 `text-accent-fg` 無效導致黑字）；圖示放大；移除「···」內嵌選單；一律 `openPresentWindow` |
| **列表操作列** | Poll／Quiz 管理「投影」同風格（accent 填色 + 圖示 + sm 尺寸） |

### 按鈕語意速查

| 用途 | variant |
|------|---------|
| 建立、投影、開始、開放 | `primary` / `success` |
| 編輯、控制台、預覽、結束 | `secondary` |
| 揭曉 | `muted` |
| 刪除 | `danger` |

---

## HISTORY

### 2026-06-15 — UI 按鈕設計系統（e3b1b1b）

`Button`／`PresentButton`；Poll／Quiz 投影統一；頂欄投影精簡並另開新視窗。

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
