# 外部規格與需求（References）

本目錄存放**產品／需求／設計的權威來源文件**，通常由 PM、架構師或業主產出，**不是**開發過程中在 repo 內逐漸寫出的說明。

Agent 與開發者應以這些文件為「要做什麼、怎麼驗收、系統長怎樣」的最高依據；衝突時優先序見 [docs/LiveEngage_AI_Coding_Agent_實作指引.md](../docs/LiveEngage_AI_Coding_Agent_實作指引.md)。

| 文件 | 說明 |
|------|------|
| [Product Requirement Document of LiveEngage（即時互動通）.docx](./Product%20Requirement%20Document%20of%20LiveEngage（即時互動通）.docx) | **PRD（產品需求文件）** — 產品願景、使用者故事、功能邊界 |
| [LiveEngage_SRS_軟體需求規格書.docx](./LiveEngage_SRS_軟體需求規格書.docx) | **SRS（軟體需求規格書）** — 功能需求、驗收條件（AC）、非功能需求 |
| [LiveEngage_SDS_軟體設計規格書.docx](./LiveEngage_SDS_軟體設計規格書.docx) | **SDS（軟體設計規格書）** — 架構、API／WS 契約、資料模型、狀態機 |

## 與 `docs/` 的差別

| | `references/` | `docs/` |
|---|---------------|---------|
| **誰寫的** | 產品／需求／設計方（較固定） | 開發團隊在 repo 內維護 |
| **典型內容** | PRD、SRS、SDS、外部設計稿 | 實作指引、架構說明、部署、Runbook |
| **變更頻率** | 版本化修訂（v1.0 → v1.1） | 隨 sprint／PR 持續更新 |
| **Agent 用法** | `@references/…` 查驗收與契約 | `@docs/…` 查怎麼在本 repo 開發 |
