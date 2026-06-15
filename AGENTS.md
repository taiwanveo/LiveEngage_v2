# LiveEngage（即時互動通）— Agent 入口

Slido 類即時互動平台。開發前請讀完整指引與權威規格。

## 必讀（依優先序）

1. [docs/服務架構.md](./docs/服務架構.md) — **五大服務**（api / host / participant / admin / worker）分工與部署對照
2. [references/LiveEngage_SRS_軟體需求規格書.docx](./references/LiveEngage_SRS_軟體需求規格書.docx) — 需求與驗收條件（AC）
3. [references/LiveEngage_SDS_軟體設計規格書.docx](./references/LiveEngage_SDS_軟體設計規格書.docx) — 架構與契約
4. [docs/LiveEngage_AI_Coding_Agent_實作指引.md](./docs/LiveEngage_AI_Coding_Agent_實作指引.md) — 鐵律、目錄、Sprint、DoD

衝突時：**SRS 驗收 > SDS 設計 > 實作指引 > 自行判斷**。

## 鐵律摘要（違反即 bug）

- 寫入走 REST；WebSocket 只做廣播
- 投票／計數後端聚合；payload 用絕對值
- 匿名遮蔽只在 `mask_identity` serializer
- 寫入端點支援 `Idempotency-Key`
- 同一 Room 同時僅一個 active Poll
- AI 旁路、10s timeout、失敗 503
- UTC 儲存、UUID v7、伺服端強制權限

完整十條與契約速查見 [docs/LiveEngage_AI_Coding_Agent_實作指引.md](./docs/LiveEngage_AI_Coding_Agent_實作指引.md)。
