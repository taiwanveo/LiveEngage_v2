# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-14）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：`f82edc6` — Survey 參與者作答、Quiz 重載還原與全站按鈕缺口修復
- **typecheck**：`host`、`participant` 通過
- **Zeabur**：push `master` 觸發自動 redeploy（**api**、**host**、**participant** 有變更）

### 已上線服務

| 服務 | URL |
|------|------|
| api | https://le-api.zeabur.app |
| host | https://le-host.zeabur.app |
| participant | https://le-participant.zeabur.app |

### 本輪重點（f82edc6）

| 區塊 | 內容 |
|------|------|
| **Survey 參與者作答** | `GET /surveys/{id}/participant-questions`；`RoomSurveyPanel`（選擇／評分／開放題） |
| **Quiz 重載還原** | `GET /quizzes/{id}/active-question`；`RoomPage` 依 session state 還原進行中子題 |
| **Ideas / Survey 投影** | `IdeasPresentPage`、`SurveyPresentPage`、`Sprint9PresentRouter` |
| **Host 麵包屑** | Poll Builder／Console／Answer、Quiz 子題編輯、Sprint9 控制台 |
| **按鈕缺口修復** | Q&A 審核觸控可及性；各頁 mutation `onError`；Join SSO 邊界；分享 tooltip |

### 投影路由速查

| 類型 | 路由 |
|------|------|
| Poll | `#/rooms/{roomId}/polls/{pollId}/present` |
| Q&A | `#/rooms/{roomId}/moderation/present` |
| Quiz / Ideas / Survey | `#/rooms/{roomId}/sprint9/{interactionId}/present` |

### 參與者 API 新增

| 端點 | 用途 |
|------|------|
| `GET /surveys/{id}/participant-questions` | 問卷題目（含選項） |
| `GET /quizzes/{id}/active-question` | 可作答 Quiz 子題（reconnect fallback） |

### 仍可做（非阻塞）

- Neon Pooler 環境變數
- 獨立 Present App 支援 Sprint9 投影（目前 Host 同源已足夠）
- Playwright E2E

---

## HISTORY

### 2026-06-14 — Survey 作答、Quiz 重載與按鈕缺口修復（f82edc6）

Participant Survey 完整流程；Quiz active-question API；Ideas/Survey 投影；Host 麵包屑與 mutation 錯誤回饋。

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
