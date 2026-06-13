# LiveEngage — 開發筆記（DEVNOTE）

> 每次 push 後由 Agent 更新。

---

## SNAPSHOT（2026-06-13）

- **Repo**：https://github.com/ColdRighter/LiveEngage.git（master）
- **最新 commit**：（Phase B push 後更新）
- **pytest**：53+ passed（含 Q&A 回覆、answered 公開列表）
- **Zeabur 專案**：[liveengage](https://zeabur.com/projects/6a2d1bc82871baed5fc633ef?envID=6a2d1bc9cf558888ca4bc9da)
- push `master` → 五服務自動 redeploy

### 已上線服務

| 服務 | 網址 |
|------|------|
| api | https://le-api.zeabur.app |
| host | https://le-host.zeabur.app |
| participant | https://le-participant.zeabur.app |
| present | https://le-present.zeabur.app |
| admin | https://le-admin.zeabur.app |

### 現場可用範圍（Phase A + B）

| 角色 | 能力 |
|------|------|
| Host | 儀表板建活動、go live、QR/代碼/連結分享、Q&A 審核與**文字回覆**、Poll 五題型建立與控場 |
| Participant | 加入活動、Poll/Q&A 分頁切換、WS 即時更新、看主持人回覆 |
| Present | 選 live session 投影 Poll |

**尚非完整企業版**：Quiz/Survey/AI、Celery export、SSO、多房間進階、自動化 E2E 套件。

### Phase B 完成項

- Host `ModerationPage` 回覆 UI（公開/私密）
- API `QuestionPublic.replies`；公開列表含 `answered` 狀態
- WS `question_replied` 事件
- `JoinShareCard`：QR + 代碼 + 複製連結
- Participant：Q&A WS 刷新、Poll 進行中指示、已回答標籤

---

## HISTORY

### 2026-06-13 — Phase B 體驗補齊

### 2026-06-13 — Phase A 現場主流程（c4e0eff）

Host 儀表板、Participant Q&A、Present 選活動、sessions API

### 2026-06-13 — ModerationPage 繁中（44f9b1a）

### 2026-06-13 — VITE_API_BASE（70732de）

### 2026-06-13 — seed_admin / Zeabur 五服務 / S7
