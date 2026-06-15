# LiveEngage（即時互動通）— AI Coding Agent 實作指引

> 本文件供 AI Coding Agent（Claude Code / Cursor 等）作為開發指引；根目錄 `AGENTS.md` 指向此檔。
> 權威依據：[SRS](../references/LiveEngage_SRS_軟體需求規格書.docx)（需求與驗收條件）、[SDS](../references/LiveEngage_SDS_軟體設計規格書.docx)（架構與契約）、[PRD](../references/Product%20Requirement%20Document%20of%20LiveEngage（即時互動通）.docx)（產品願景）。
> 衝突時優先序：SRS 驗收條件 > SDS 設計 > 本文件 > 自行判斷。

---

## 1. 專案一句話

Slido 類即時互動平台：Host 建活動 → 參與者掃 QR 免登入加入 → Q&A / 投票即時互動 → 大螢幕展示 → 活動後分析匯出。

## 2. 不可違反的鐵律（出自 SRS/SDS，違反即為 bug）

1. **所有寫入走 REST API；WebSocket 只做廣播通知**，前端不得用 WS 寫資料。
2. **投票/計數一律後端聚合**，前端不得自行累加總數；事件 payload 帶絕對值非增量。
3. **匿名遮蔽只在統一 serializer 層做**（`mask_identity`），任何 API / WS / 匯出輸出路徑都必須經過它；`is_anonymous=true` 時對外 display_name=`Anonymous`、email=null。
4. **所有寫入端點支援 `Idempotency-Key` header**（Redis SETNX 去重，TTL 24h）。
5. **同一 Room 同時只能有一個 active Poll**（Redis 鎖 + DB 樂觀鎖，見 SDS §5.4）。
6. **AI 是旁路**：timeout 10s、失敗回 503 `AI_UNAVAILABLE`，絕不阻塞核心流程；AI 產物標 `is_ai_generated=true`；prompt/輸出寫 `ai_request_logs`。
7. **時間一律 UTC 儲存**（ISO 8601），顯示才轉時區；ID 用 UUID v7。
8. **權限在伺服端強制**（FastAPI dependency `require_role` + cohost permission flags），前端只做 UI 隱藏。
9. 機密（SSO token、passcode、JWT）**不得進 log**；passcode 用 argon2id。
10. 審核/控場/匯出/設定變更/權限變更 **必寫 audit log**。

## 3. 技術棧與目錄

- 後端：Python 3.12、FastAPI、SQLAlchemy 2.0 async、Alembic、PostgreSQL 16、Redis 7、Celery。
- 前端：React 19 + TypeScript strict + Vite + Tailwind；Zustand + TanStack Query；Recharts + d3-cloud。
- Monorepo：

```
backend/
  app/
    api/v1/          # routers（依資源切檔：sessions.py, questions.py, polls.py…）
    core/            # config, security(jwt/argon2), deps(require_role), errors
    models/          # SQLAlchemy models（對應 SDS §7.2 DDL）
    schemas/         # Pydantic（含 answer_jsonb discriminated union）
    services/        # 業務邏輯（qa.py, poll.py, session.py, export.py, ai.py…）
    realtime/        # gateway(ws), events(envelope/types), redis_pubsub, replay
    serializers/     # mask_identity 與輸出組裝（鐵律 3）
    workers/         # celery tasks: export, analytics, retention, notification
  alembic/
  tests/             # 測試名稱需含 SRS AC 編號，如 test_fe004_ac1_realtime_receive
frontend/
  apps/{participant,host,admin}
  packages/{ui,charts,renderers,realtime,api,i18n}
```

## 4. 核心契約速查（細節見 SDS）

### 4.1 狀態機

- Poll：`idle → active → locked ⇄ active → stopped`；任意 → `reset` → idle（清資料，需確認）。非法轉移回 409 `POLL_INVALID_STATE`。
- Question：`pending → approved | dismissed`；`approved → answered | archived`；dismissed 可還原 pending。
- Quiz 題：`pending → active → revealed → closed`。
- Session：`draft → live → ended → archived`。

### 4.2 WS 事件信封

```json
{ "id": "evt_ULID", "type": "poll_started", "room_id": "…", "ts": "…", "payload": { } }
```

- Channel：`evt:room:{roomId}`（Redis Pub/Sub）；Stream `stream:room:{id}` 留最近 1000 筆供 replay。
- 22 個事件型別見 SRS §7.1 / SDS §6.3；WebSocket 客戶端 `mode` 含 participant / present / host（**present** 指投影視圖連線模式，由 Host 大螢幕路由使用，非獨立網域）。
- 節流：upvote 計數同題 ≥300ms 合併、poll 聚合 ≥250ms 合併。

### 4.3 錯誤格式

```json
{ "error": { "code": "POLL_LOCKED", "message": "…", "details": {}, "request_id": "…" } }
```

錯誤碼表見 SDS §5.6（VALIDATION_ERROR / FORBIDDEN / ALREADY_RESPONDED / QA_CLOSED / RATE_LIMITED…）。

### 4.4 answer_jsonb（Pydantic discriminated union）

| type | 結構 |
| --- | --- |
| multiple_choice | `{"option_ids": [uuid…]}` |
| word_cloud | `{"words": [str…]}` |
| open_text | `{"text": str}` |
| rating | `{"value": int}` |
| ranking | `{"ranked_option_ids": [uuid…]}` |

### 4.5 計分（Quiz）

答對：`score = round(base_points × (1 − elapsed/time_limit × 0.5))`（速度加權開啟時），否則 base_points；答錯 0。排行榜：總分 DESC → 累計 elapsed ASC。

### 4.6 Rate limit 預設

提問 5/min、upvote 30/min、poll 提交 10/min（per participant）；passcode 5/min/IP；by-code 查詢 30/min/IP。可由 `privacy_settings.rate_limit_jsonb` 覆寫。

## 5. 開發順序（每步完成需通過對應 AC 測試才前進）

1. **Sprint 1–2 骨架**：models + migrations（organizations→interactions）、Auth、Session CRUD、join 流程（FE-001/002 全 AC）、WS Gateway + state 快照 API、Present join_info view。
2. **Sprint 3–4 Q&A**：FE-004/005、BE-004、PM-002 全 AC；Redis 計數 + 批次回寫；審核三欄 UI。
3. **Sprint 5–6 Poll**：FE-006/007/008/009、BE-003/005、PM-003/004；控場狀態機 + 並發鎖；renderers 三模式共用。
4. **Sprint 7–8 管理**：BE-008/009/010/012、Branding 基礎、rate limit、audit log、匯出 Worker（XLSX/CSV、72h 簽名連結）。
5. **Sprint 9+**：FE-010/011/012、BE-006/007、多房間、AI（AI-001~003）、FE-013 + AI-004、Integrations、Admin。

## 6. Definition of Done（每個 PR）

- [ ] 對應 SRS AC 有自動化測試（測試名含 AC 編號）且通過。
- [ ] `mypy --strict` / `tsc --strict` / ruff / eslint 乾淨。
- [ ] 寫入端點具 Idempotency-Key 測試；權限矩陣相關端點具 403 測試。
- [ ] 涉及匿名資料的輸出有遮蔽回歸測試。
- [ ] 新增/變更事件已更新事件型別定義（前後端共用 schema）。
- [ ] migration 可向前向後相容（expand-contract）。
- [ ] 不引入鐵律違反（§2 自查）。

## 7. 建議補齊的其他文件（後續可再請 AI 產出）

| 文件 | 用途 | 建議時機 |
| --- | --- | --- |
| OpenAPI 規格凍結版（openapi.yaml） | 前後端並行開發的契約 | Sprint 1 結束 |
| 測試計畫書 STP / 測試案例 STD | QA 依 AC 展開案例 | Sprint 2 |
| UI/UX Wireframe 與 Design Token 規格 | 三端一致的視覺語言 | Sprint 1–2 |
| 資料庫 ERD 圖 + migration 規範 | Schema 演進治理 | Sprint 1 |
| 運維手冊 Runbook（含降級 SOP） | 大型活動現場應變 | MVP 上線前 |
| 資安威脅模型（STRIDE）與隱私影響評估 | 企業客戶審查、GDPR | V1 前 |
| API / Webhook 對外開發者文件 | V2 Integrations | V2 |
