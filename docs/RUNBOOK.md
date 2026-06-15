# LiveEngage 現場運維手冊（Runbook）

> 適用於 Zeabur **五大服務**部署（api / host / participant / admin / worker）。  
> 各服務職責詳見 [服務架構.md](./服務架構.md)。  
> 最後更新：2026-06-15

---

## 1. 服務一覽

> 完整分工、Dockerfile、api vs worker 差異 → [服務架構.md](./服務架構.md)

| 服務 | URL | 用途 |
|------|-----|------|
| api | https://le-api.zeabur.app | REST + WebSocket（即時互動主 API） |
| host | https://le-host.zeabur.app | 主持人（含大螢幕投影，同源 `#/…/present` 路由） |
| participant | https://le-participant.zeabur.app | 參與者（掃碼加入、投票／Quiz／Q&A） |
| admin | https://le-admin.zeabur.app | 管理後台（成員、匯出、稽核、組織設定） |
| **worker** | （無公開網域） | Celery 背景 Worker（活動資料匯出） |

健康檢查：

- `GET https://le-api.zeabur.app/health` → `{"status":"ok"}`
- `GET https://le-api.zeabur.app/ready` → DB / Redis 狀態

---

## 2. 現場活動標準流程

1. Host 登入 → **活動儀表板** 建立活動 → **設為進行中**
2. 複製參與連結或 QR（儀表板 `JoinShareCard`）
3. Participant 掃碼／輸入代碼加入
4. Host：**Q&A 審核**、**Poll 管理** 啟動投票；大螢幕點 **投影**（Host 新視窗，`#/rooms/…/present`）
5. 活動結束後：Admin **匯出** CSV/XLSX（72h 簽名連結）

---

## 3. 常見故障與處置

### 3.1 參與者無法加入（429）

- **現象**：提示「請求過於頻繁」
- **原因**：passcode 5/min/IP 或 by-code 30/min/IP
- **處置**：稍候 1 分鐘；現場改用 QR 一次成功加入；必要時 Admin 調高 `organizations.settings_jsonb.rate_limit`

### 3.2 Admin 登入 405 / 無法連 API

- **檢查**：瀏覽器 Network 是否打到 `le-api.zeabur.app`
- **處置**：確認前端 build 含 `VITE_API_BASE`；重新 deploy admin

### 3.3 WebSocket 斷線、Poll 不即時

- **現象**：綠點灰掉、需手動重整
- **處置**：Participant 有 30s 輪詢備援；檢查 api Redis（`/ready`）；大型活動確認 Upstash 配額

### 3.4 匯出一直 pending

- **原因**：未部署 Celery worker
- **處置**：
  - Zeabur 新增服務，Dockerfile：`Dockerfile.worker`
  - 環境變數與 api 相同（`LE_DATABASE_URL`、`LE_REDIS_URL` 等）
  - 或暫設 `LE_CELERY_TASK_ALWAYS_EAGER=true`（僅小流量，不建議生產）

### 3.5 API 503 / DB 連線失敗

- 檢查 Neon 控制台連線數、是否暫停
- Zeabur api 日誌；確認 `LE_DATABASE_URL` 使用 **Pooler** URL（主機名含 `-pooler`）
- Neon 區域建議 **ap-northeast-1（東京）**，與 Zeabur 首爾節點延遲較低

### 3.6 Host 控場按鈕反應慢

- **現象**：開始／揭曉／鎖定後 UI 停頓 0.5～2s
- **常見原因**：Neon 與 Zeabur 跨區 RTT；未用 Pooler；舊版前端重複 refetch（已於 2026-06-14 優化）
- **處置**：確認 Pooler + 東京區；`GET /ready` 檢查 Redis；強制重整 Host 快取（Ctrl+Shift+R）

---

## 4. 降級 SOP

| 層級 | 條件 | 動作 |
|------|------|------|
| L1 | Redis 不可用 | API 仍可服務；WS 改 in-memory fan-out；計數延遲回寫 |
| L2 | WS 大量斷線 | 告知參與者重整；Host 用 Poll 控制台手動重整 |
| L3 | DB 異常 | 停止 go live 新活動；維護頁；從 Neon 備份還原 |

---

## 5. 維運腳本

```bash
# 建立管理員（專案根目錄）
backend\.venv\Scripts\python.exe scripts\seed_admin.py --email you@company.com

# 清理測試帳號 *@example.com（Neon）
backend\.venv\Scripts\python.exe scripts\cleanup_test_accounts.py --dry-run
backend\.venv\Scripts\python.exe scripts\cleanup_test_accounts.py
```

---

## 6. Rate limit 預設（可於 org settings 覆寫）

```json
{
  "rate_limit": {
    "question_per_min": 5,
    "upvote_per_min": 30,
    "poll_submit_per_min": 10,
    "passcode_per_min_per_ip": 5,
    "by_code_per_min_per_ip": 30
  }
}
```

寫入路徑：`organizations.settings_jsonb`（Admin API PATCH organization）。

---

## 7. 聯絡與升級

- 程式問題：GitHub Issues / 開發團隊
- Zeabur / Neon 帳單與配額：各平台控制台
- 大型活動（>500 同時在線）：事先壓測 WS、考慮 Redis 專用實例
