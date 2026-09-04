# LiveEngage v2 — AI 智慧增強四大核心功能完整技術與設計規格書

> **專案定位**：AI 創新競賽參賽旗艦專案 — 次世代即時群眾互動與決策平台（Next-Gen Slido Killer）  
> **版本**：LiveEngage v2.0  
> **更新日期**：2026 年 9 月  
> **核心設計原則**：**非同步旁路 (Non-blocking Sidecar)**、**10s 嚴格超時 (Strict 10s Timeout)**、**雙軌高容錯降級 (Dual-Track Resilient Fallback)**、**多模型適配 (Multi-Provider: OpenRouter / OpenAI / Gemini / Compatible)**。

---

## 目錄

1. [為什麼需要 AI？— 傳統互動平台四大痛點與 LiveEngage v2 突破](#一為什麼需要-ai--傳統互動平台四大痛點與-liveengage-v2-突破)
2. [AI 核心架構與可靠性保障](#二ai-核心架構與可靠性保障)
3. [功能一：文字雲語意聚合 (AI-003 Semantic Word Cloud Clustering)](#三功能一文字雲語意聚合-ai-003-semantic-word-cloud-clustering)
4. [功能二：會後一鍵生成 AI 決策報告 (AI-004 Post-Event AI Decision Report)](#四功能二會後一鍵生成-ai-決策報告-ai-004-post-event-ai-decision-report)
5. [功能三：AI 一鍵靈感出題 (AI-001 Intelligent Poll Generator & Batch Creation)](#五功能三ai-一鍵靈感出題-ai-001-intelligent-poll-generator--batch-creation)
6. [功能四：Q&A 語意去重與同義題合併 (AI-002 Semantic Q&A Deduplication & Merging)](#六功能四qa-語意去重與同義題合併-ai-002-semantic-qa-deduplication--merging)
7. [AI 模型與金鑰自訂架構與智慧動態選單 (Custom AI Key & Model Auto-Discovery)](#七ai-模型與金鑰自訂架構與智慧動態選單-custom-ai-key--model-auto-discovery)
8. [後端 API 契約與資料庫 Schema 總整](#八後端-api-契約與資料庫-schema-總整)
9. [自動化測試與資安驗證總結](#九自動化測試與資安驗證總結)


---

## 一、為什麼需要 AI？— 傳統互動平台四大痛點與 LiveEngage v2 突破

在大型實體/線上年會、企業內部全員大會 (All-Hands)、培訓工作坊及敏捷復盤中，現有主流互動工具（如 Slido、Mentimeter）存在四大根深蒂固的產品痛點：

| 互動場景 | 傳統工具痛點 (Slido / Mentimeter) | LiveEngage v2 AI 突破與價值 |
| :--- | :--- | :--- |
| **現場文字雲** | **字元完全比對，詞彙破碎**<br>「超棒」、「很棒」、「棒」、「awesome」被視為不同文字，導致大螢幕上文字碎裂成微小字元，無法展現全場真實共識。 | **語意同義聚合 (AI-003)**<br>自動將同義詞、大小寫、中英文變體歸一合併，大螢幕氣泡呈現真正核心共識；點擊氣泡可展開同義詞佔比長條圖。 |
| **活動結尾與覆盤** | **只有原始數字，報告斷層**<br>活動結束後只匯出一堆 CSV 欄位或圓餅圖截圖，主辦人需耗費數小時人工閱讀，無法向主管或管理階層即刻交付決策建議。 | **一鍵生成高階決策報告 (AI-004)**<br>自動萃取高管摘要、全場共識度、關鍵分歧對立點、未回答焦點問題與具體行動追蹤清單，支援一鍵列印與 HTML/Markdown 匯出。 |
| **主持人開場出題** | **思維枯竭，出題繁瑣耗時**<br>活動開場前主持人手忙腳亂，常不知道如何設計破冰或引導深入討論的題目，逐一打字建題手續繁複。 | **一鍵靈感出題 (AI-001)**<br>輸入主題即可自動搭配「選擇題、文字雲、評分題」多維題庫，附帶專家設計目的解析，支援即時微調並一鍵批次建立至活動。 |
| **現場 Q&A 問答** | **同義重複洗版，讚數嚴重分散**<br>多位觀眾詢問相同本質問題（如「簡報會公開嗎？」、「投影片哪裡下載？」），分散了按讚票數，使得重要議題無法衝上榜首。 | **語意去重與票數累計 (AI-002)**<br>智慧掃描同義題，提示主辦方一鍵合併；重複提問的讚數全數累計至主提問，並在重複題附帶說明回覆，即時 WebSocket 同步。 |

---

## 二、AI 核心架構與可靠性保障

為了滿足現場演講或評審 Demo 時「**零失誤、零阻塞、零延遲感知**」的極致穩定性要求，LiveEngage v2 實施嚴格的架構規範：

```
                    ┌─────────────────────────┐
                    │ Client (Host / Screen)  │
                    └───────────┬─────────────┘
                                │ REST / WebSocket
                                ▼
                    ┌─────────────────────────┐
                    │   LiveEngage FastAPI    │
                    │      Core Engine        │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
┌───────────────────────────┐               ┌───────────────────────────┐
│     AI Sidecar Worker     │               │   Local Fallback Engine   │
│  (Non-blocking, 10s TO)   │               │   (100% Offline Reliable) │
├───────────────────────────┤               ├───────────────────────────┤
│ • OpenRouter (Multi-model)│   Timeout     │ • 中英文同義詞規則庫      │
│ • OpenAI / Gemini API     │ ────────────> │ • Jaccard 字元重合度分析  │
│ • Custom AI Base URL      │  or Network   │ • 結構化模板與數值演算    │
│ • Structured JSON Output  │    Failure    │ • 0 毫秒極速降級保證      │
└───────────────────────────┘               └───────────────────────────┘
```

### 1. 雙軌容錯架構 (Dual-Track Resilient Architecture)
- **雲端大模型軌 (Cloud LLM Track)**：支援 OpenRouter（預設）、OpenAI、Google Gemini 等符合 Chat Completions 規範的 API，自動適配標頭（`HTTP-Referer`, `X-Title`）與結構化 JSON Mode。
- **本地智慧降級軌 (Local Fallback Track)**：每項 AI 功能均具備專屬的本地演算法。當外部未設定 API Key、連線逾時（>10 秒）或 API 拋出異常時，系統**毫無破綻地自動降級切換為本地演算**，對使用者與前端完全透明，DEMO 演示永不翻車！

### 2. 非阻塞旁路 (Sidecar Non-blocking)
- 核心即時業務（投票寫入、Q&A 提交、大螢幕即時 WebSocket 廣播）永不受 AI 狀態牽制。AI 運算一律以獨立協程或非同步任務運行。

### 3. 安全與審計日誌 (`AiRequestLog`)
- 每次 AI 呼叫均記錄呼叫耗時 (`latency_ms`)、執行狀態 (`ok` / `fallback`)、組織 ID 與詳細 JSON Payload。
- 日誌寫入採 `try...except` 旁路防禦，即便資料庫發生偶發性衝突，主流程依然穩健運作。

---

## 三、功能一：文字雲語意聚合 (AI-003 Semantic Word Cloud Clustering)

### 1. 業務價值與視覺創新
在投票題型為「文字雲 (Word Cloud)」時，參與者輸入之答案往往包含各種同義詞、拼寫變體或中英混雜。
LiveEngage v2 領先傳統 Slido，推出**大螢幕即時語意聚合引擎**：
- **視覺氣泡大小**：根據聚合後之「總詞頻權重」動態放大，突顯全場真正共識。
- **色彩漸層深度**：高頻詞彙呈現漸層色調（Indigo / Violet），視覺層次分明。
- **點擊展開同義詞卡**：主持端或投影大螢幕點擊聚合氣泡，可彈出精美互動卡片，清晰列出所有原始同義詞及其貢獻佔比長條圖（百分比條）。
- **一鍵切換模式**：主持端可隨時在「語意聚合視角」與「原始精確詞彙視角」之間無縫切換。

### 2. 本地演算法原理 (`cluster_words_local`)
- **前處理**：去除贅字、中英大小寫正規化、空白修剪。
- **同義詞庫映射**：內建團隊回饋、滿意度、產品體驗、技術評價常用詞典（如 `["很棒", "超棒", "棒", "讚", "太強了", "awesome", "great"] -> "很棒"`）。
- **Jaccard 字元重合分析**：針對未列於內建字典之新詞，比對兩者字元交集比例（$\text{Jaccard} \ge 0.5$），智慧聚合相似字串。

### 3. API 契約
- **端點**：`POST /api/v1/polls/{poll_id}/ai-cluster`
- **請求參數**：
  ```json
  {
    "enabled": true,
    "force_refresh": false
  }
  ```
- **回應結構**：
  ```json
  {
    "poll_id": "...",
    "type": "word_cloud",
    "total_responses": 45,
    "options": [
      {
        "text": "很棒",
        "count": 18,
        "variants": [
          { "text": "超棒", "count": 7 },
          { "text": "太讚了", "count": 5 },
          { "text": "awesome", "count": 4 },
          { "text": "很棒", "count": 2 }
        ]
      }
    ]
  }
  ```

---

## 四、功能二：會後一鍵生成 AI 決策報告 (AI-004 Post-Event AI Decision Report)

### 1. 業務價值與特色
傳統互動結束後，資料分散於資料庫與 CSV 中，無法即刻產生商業價值。LiveEngage v2 在活動結束或進行中，提供**會後一鍵生成 AI 決策報告**功能：
- **高管決策摘要 (Executive Summary)**：以俐落專業的 2-3 段落提煉全體參與者核心態度、大會重點與最終定調。
- **參與度量化評級 (Engagement Rating)**：根據簽到數、投票互動率、Q&A 提問與回答率，綜合評定如「卓越 (參與率 85%) - 全員深度共創」。
- **四大關鍵維度洞察**：
  1. 🎯 **關鍵共識 (Key Consensuses)**：全場獲得高度認同之觀點與數據佐證。
  2. ⚡ **主要分歧 (Divergences)**：票數接近或意見對立之議題，並附帶具體妥協折衷方案。
  3. ❓ **高關注未解答問題 (Top Unanswered Concerns)**：讚數極高但現場因時間不足未能回答之問題，提供重要性評估與建議後續回覆方向。
  4. 🚀 **建議行動追蹤清單 (Action Recommendations)**：包含優先級（🔴高 / 🟡中 / 🟢低）、建議負責角色（如架構師、產品經理）、具體行動方針與預計完成時限。
- **多元匯出管道**：支援網頁即時預覽、一鍵複製 Markdown、瀏覽器友善列印排版、以及下載獨立離線 HTML 報告檔。

### 2. 演算法與資料萃取 (`extract_session_analytics_data`)
- 後端服務跨表撈取該 Session 下所有 Room 的 Session、Interaction（Poll、Quiz、Survey）、Poll Responses、Questions（含 Upvotes、Downvotes、Status）與 Participants 數據。
- 計算參與指標（`engaged_percent`）、找出最高投票選項、統計正反票數比例、排序未回答最高讚問題。
- 本地降級模板 (`generate_decision_report_local`) 具備動態語意拼裝能力，無 API Key 也能產出媲美麥肯錫級別的商業覆盤報告。

### 3. API 契約
- **生成報告**：`POST /api/v1/sessions/{session_id}/ai-report`
  - 參數：`{"force_refresh": false}`
- **取得已存報告**：`GET /api/v1/sessions/{session_id}/ai-report`
- **下載獨立 HTML 報告檔**：`GET /api/v1/sessions/{session_id}/ai-report/download`

---

## 五、功能三：AI 一鍵靈感出題 (AI-001 Intelligent Poll Generator & Batch Creation)

### 1. 業務價值與設計亮點
為解決主持人與會議負責人在開場前「不知該出什麼題目」的窘境，LiveEngage v2 打造了全流程直覺的 AI 靈感出題模組：
- **快速靈感主題推薦 (Quick Inspiration Chips)**：內建破冰暖場、微服務技術重構、產品路線圖優先級、Sprint 敏捷復盤、新技術培訓吸收度等常用標籤，點擊一鍵帶入。
- **題型策略偏好**：支援「🎯 綜合推薦（選擇、文字雲、評分題穿插搭配）」、「🔘 選擇題專用」、「☁️ 文字雲專用」、「⭐ 評分題專用」、「💬 開放問答專用」。
- **題數與背景彈性控制**：可自選 1~5 題，並可折疊輸入會議參與者背景與目標。
- **靈感題庫即時預覽與微調**：
  - 每道題目附帶「💡 設計目的（Rationality）」，說明該題如何促進團隊共識。
  - 選擇題支援即時編輯選項、刪除多餘選項、加入自訂新選項。
  - 勾選框支援個別選取與全選切換。
- **🚀 批次建立至當前活動**：一鍵呼叫後端批次寫入端點，瞬間建立完整題庫，主持端工作台與大螢幕即時同步更新！

### 2. 實作位置與呼叫流程
- **前端元件**：`frontend/apps/host/src/components/polls/AiPollGeneratorModal.tsx`
- **整合入口**：
  - `PollHubPage.tsx`（新增 Poll 頂部卡片右側設有 `[ ✨ AI 靈感出題 ]` 按鈕）
  - `SessionWorkbenchPage.tsx`（左側互動側欄「新增互動」旁設有 `[ ✨ AI 出題 ]` 快捷入口）
- **後端端點**：
  - `POST /api/v1/ai/generate-polls`（AI 生成題目草稿）
  - `POST /api/v1/rooms/{room_id}/interactions/batch`（批次建立互動）

---

## 六、功能四：Q&A 語意去重與同義題合併 (AI-002 Semantic Q&A Deduplication & Merging)

### 1. 業務價值與痛點根治
在 100 人以上的研討會或線上直播中，經常發生「簡報會後會提供嗎？」、「投影片哪裡可以下載？」、「講義檔案會公開嗎？」等多位觀眾提出相同意圖問題的情況。
- **在 Slido 中**：這些問題各自瓜分按讚數，例如各自得到 8 票、6 票、4 票，導致該本質問題始終無法超越只有 10 票的單一問題，進而錯失提問時機。
- **在 LiveEngage v2 中**：
  - 主持人在審核頁面（`ModerationPage.tsx`）點擊 `[ 🔍 AI 掃描重複提問 ]`。
  - AI 即刻比對全場待審與進行中提問，找出同義群組。
  - 明確標記 **「👑 代表主提問（保留）」** 與 **「🔗 建議合併的同義題目清單」**。
  - 顯示 **「💡 AI 辨識原因」** 與 **「合併後預估總票數（例如 10 票 + 8 票 + 4 票 = 22 票，增加 +12 票！）」**。
  - 主持人點擊 `[ 🔗 一鍵合併 ]`：重複題讚數全數累計至主提問，主提問即刻衝上熱門排行榜！重複題優雅標記為已駁回/隱藏，並在重複題留下一則清晰的主持人系統回覆說明合併目標。

### 2. 本地語意演算法 (`dedup_questions_local`)
- **多領域概念標籤與中英文對應**：
  - `slides`（簡報/投影片/講義/ppt/slide/課件/教材）
  - `recording`（錄影/錄音/重播/回放/回看/video/recording）
  - `code`（原始碼/代碼/程式碼/github/repo/專案網址/開源）
  - `pricing`（費用/收費/免費/價格/定價/pricing/cost/方案）
  - `performance`（高並發/吞吐量/延遲/效能/瓶頸/latency/連線池）
  - `ai_agent`（coding agent/copilot/ai 工具/llm/模型）
  - `security`（資安/隱私/授權/安全/合規/token）
- **連通分量分群 (Connected Components Graph Clustering)**：
  - 比對各題目領域意圖與字元 Jaccard 相似度，構建關聯圖。
  - 透過廣度優先搜尋 (BFS) 劃分連通群組，精準避免跨議題誤合併。
  - 主提問依據「獲讚數最高 > 內容描述最完整」原則自動選定。

### 3. API 契約
- **掃描去重**：`POST /api/v1/rooms/{room_id}/questions/ai-dedup`
  - 回應：`AiDedupQuestionsResponse`（包含群組清單、主提問、重複提問清單、累計票數、同義原因）
- **一鍵合併**：`POST /api/v1/rooms/{room_id}/questions/merge`
  - 請求：
    ```json
    {
      "primary_question_id": "01a06...",
      "duplicate_question_ids": ["01a07...", "01a08..."]
    }
    ```
  - 回應：
    ```json
    {
      "primary_question_id": "01a06...",
      "merged_question_ids": ["01a07...", "01a08..."],
      "new_upvote_count": 22,
      "new_score": 22,
      "total_upvotes_added": 12,
      "message": "已成功合併 2 道同義題目，主提問累計增加 12 票！"
    }
    ```

---

## 七、AI 模型與金鑰自訂架構與智慧動態選單 (Custom AI Key & Model Auto-Discovery)

### 1. 業務價值與設計初衷
不同企業或主辦單位可能擁有自己的 LLM 訂閱或內部私有模型（如 OpenRouter、Google Gemini、OpenAI、Ollama 等）。LiveEngage v2 具備**零後端外洩的自訂金鑰架構**：
- **本地安全性保障**：主持人金鑰純粹儲存於瀏覽器 `localStorage`，絕不寫入後端資料庫或永久日誌。
- **動態 Header 注入**：前端呼叫任一 AI 增強功能時，透過專屬 HTTP Header 動態覆蓋預設設定：
  - `X-AI-API-Key`: 使用者自訂 API Key
  - `X-AI-Provider`: `openrouter` / `gemini` / `openai` / `custom` / `auto`
  - `X-AI-Model`: 模型名稱（如 `google/gemini-2.5-flash`, `deepseek/deepseek-chat`）
  - `X-AI-Base-Url`: 自訂 API Base URL

### 2. 智慧模型過濾與動態下拉選單 (Dynamic Model Discovery)
針對主流服務商（如 OpenRouter 有數百種模型、各模型更迭頻繁且舊模型易下架）的痛點，LiveEngage v2 打造了**全自動模型動態探測與智慧過濾引擎**：
1. **深度文字模型過濾 (Non-Text Filtering)**：
   - OpenRouter：檢查 `architecture.output_modalities` 必須包含 `text`，過濾純生圖、音訊辨識與批次模型（排除 `dall-e`, `stable-diffusion`, `flux`, `whisper`, `tts`, `embedding`, `moderation`, `:batch` 等）。
   - Google Gemini：查詢 `/v1beta/models`，嚴格過濾 `supportedGenerationMethods` 必須包含 `generateContent`。
   - OpenAI / 相容 API：查詢 `/models` 並排除非 Chat 類型的 embedding / audio 模型。
2. **智慧排序與免費額度置頂 (Free Tier Prioritization)**：
   - 具有 `:free` 標記之免費模型自動置頂於專屬分組 `<optgroup label="⭐ 免費/推薦額度模型 (Free)">`，便利無付費額度的使用者直接選用。
   - 主流優選旗艦（Gemini 2.5、GPT-4o、Claude 3.5、DeepSeek）排於優先位置。
3. **極致友善的互動體驗 (Interactive UX)**：
   - **即打即篩 (Live Search)**：提供模型關鍵字即時搜尋框，輸入 `flash`、`free`、`gpt` 即可秒級過濾 350+ 模型。
   - **釘選底部操作列 (Pinned Footer)**：對話框設有專屬 Pinned Footer，連線測試、重設、取消與儲存按鈕永不被長選單或回傳訊息遮擋推擠。
   - **404/舊模型下架自動提示與恢復**：當所選模型因官方下架回傳 404 時，系統自動判定為 warning 狀態，並立刻載入服務商最新可用清單供主持人一鍵挑選切換，保證不中斷操作。

### 3. API 契約
- **測試連線與取得模型**：`POST /api/v1/ai/test-connection`
  - 請求：`{ "api_key": "...", "provider": "openrouter", "model": "...", "base_url": "..." }`
  - 回應：`{ "status": "ok" | "warning" | "error", "message": "...", "provider": "...", "model": "...", "latency_ms": 120, "models": [...] }`
- **直接獲取可用文字模型清單**：`POST /api/v1/ai/models`
  - 請求：`{ "api_key": "...", "provider": "openrouter", "base_url": "..." }`
  - 回應：`{ "status": "ok", "message": "...", "provider": "...", "models": [{ "id": "...", "name": "...", "is_free": true }] }`

---

## 八、後端 API 契約與資料庫 Schema 總整

### 1. 資料庫變更記錄
- **Alembic 遷移**：`alembic/versions/0008_ai_feature_enums.py`
- **擴充 `ai_feature` DB Enum**：
  - `cluster_words`（文字雲聚合）
  - `generate_report`（決策報告生成）
  - `dedup_questions`（Q&A 去重合併）

### 2. API 端點速查表

| 模組 | HTTP 方法與路徑 | 功能說明 | 授權要求 |
| :--- | :--- | :--- | :--- |
| **AI 模型與連線** | `POST /api/v1/ai/test-connection` | 測試金鑰與連線並回傳可用模型清單 | Public / Host |
| **AI 模型清單** | `POST /api/v1/ai/models` | 動態探測並過濾指定服務商之可用文字模型 | Public / Host |
| **Poll 文字雲** | `POST /api/v1/polls/{id}/ai-cluster` | 開關文字雲語意聚合視角 | Host / Public |
| **決策報告** | `POST /api/v1/sessions/{id}/ai-report` | 生成／重新整理 AI 決策報告 | Host User |
| **決策報告** | `GET /api/v1/sessions/{id}/ai-report` | 查詢已生成的決策報告快取 | Host User |
| **決策報告** | `GET /api/v1/sessions/{id}/ai-report/download` | 下載獨立離線 HTML 報告檔 | Host User |
| **出題生成** | `POST /api/v1/ai/generate-polls` | 依主題生成多題型靈感草稿 | Host User |
| **批次建立** | `POST /api/v1/rooms/{id}/interactions/batch` | 批次將 AI 題庫建立至房間 | Host User |
| **Q&A 去重** | `POST /api/v1/rooms/{id}/questions/ai-dedup` | 掃描房間提問並提供同義群組推薦 | Host User |
| **Q&A 合併** | `POST /api/v1/rooms/{id}/questions/merge` | 執行同義題目合併與票數加總 | Host User |

---

## 九、自動化測試與資安驗證總結

為貫徹專案嚴謹的工程規範與 DoD（Definition of Done），本次實作建立之所有功能均包含完整自動化單元測試：

### 1. 測試套件覆蓋
- **測試命令**：
  ```bash
  .venv/bin/pytest tests/test_ai_word_cloud.py tests/test_ai_decision_report.py tests/test_ai_poll_generator.py tests/test_ai_dedup_questions.py -v
  ```
- **測試結果**：**17 個單元測試全部通過 (100% PASSED)**
  - `test_cluster_words_local_empty` — PASSED
  - `test_cluster_words_local_synonyms_and_variants` — PASSED
  - `test_word_count_schema_with_variants` — PASSED
  - `test_openrouter_provider_auto_detect` — PASSED
  - `test_gemini_provider_auto_detect` — PASSED
  - `test_generate_decision_report_local_full_data` — PASSED
  - `test_generate_decision_report_local_empty_data` — PASSED
  - `test_render_report_html` — PASSED
  - `test_generate_polls_local_tech_scenario` — PASSED
  - `test_generate_polls_local_icebreaker` — PASSED
  - `test_generate_polls_local_filtered_type` — PASSED
  - `test_generate_polls_response_schema` — PASSED
  - `test_dedup_questions_local_empty_and_single` — PASSED
  - `test_dedup_questions_local_slides_scenario` — PASSED
  - `test_dedup_questions_local_multiple_distinct_clusters` — PASSED
  - `test_dedup_questions_local_unrelated_no_false_positives` — PASSED
  - `test_dedup_questions_schemas` — PASSED

### 2. 資安與機密掃描
- **Betterleaks Staged Scan**：
  ```bash
  betterleaks git --staged
  # 0 leaks found (Pass)
  ```
- **代碼機密防護**：所有 API Key、金鑰及認證憑證皆嚴格使用環境變數讀取，未在代碼或 Commit 中硬編碼任何機密。

### 3. 前端建置與邊緣部署
- **Vite Build**：`npx vite build` 在 `frontend/apps/host` 下零錯誤編譯通過。
- **Cloudflare Pages 邊緣同步**：GitHub 遠端儲存庫與 Cloudflare 邊緣 CDN 保持即時連動部署。
