# 主持人工作台：進行中題目醒目標示與預覽區塊滾動跟隨設計規格書 (Spec)

## 1. 背景與目標
在 LiveEngage 主持人工作台（`SessionWorkbenchPage`）中，主持人需要流暢掌控所有互動題目的進行狀態與大螢幕/手機端的實際顯示效果。
目前存在兩項使用體驗問題：
1. **無法一眼辨識「進行中」題目**：左側題目列表僅有當前選取編輯（`selectedId`）的聚焦效果，未針對真正「進行中（`status === 'active'`）」的題目做全卡片視覺醒目標記；且其他狀態（已結束、閒置、已鎖定）的文字色彩缺乏生命週期語意。
2. **滾動題目時預覽區塊離開視野**：當題目較多（例如 5 題以上），主持人向下滑動尋找或檢視其他題目時，中欄的「投影預覽」與右欄的「預覽參與者畫面」會隨頁面滑出視窗，無法在切換題目的同時掌握投影及手機端全貌。

本設計落實方案 A：
1. 「進行中」題目全卡片醒目雙層翡翠綠邊框、柔和背景與動態呼吸燈點標記；其他題目依狀態呈現語意色彩文字標籤。
2. 頂部黏性列（包含「上一題/下一題」及控場按鈕）維持吸頂，中欄「投影預覽」與右欄「預覽參與者畫面」自適應吸頂跟隨滾動，並設定最大高度與內部滾動保護，確保兩大預覽區塊全貌能見度始終完整。

---

## 2. 核心架構與元件修改範圍

### 2.1 左側題目列表 (`WorkbenchInteractionSidebar.tsx`)
- **進行中卡片 (`isLive = item.status === 'active'`)**：
  - 整張卡片邊框採用翡翠綠：`border-2 border-emerald-500 dark:border-emerald-400`。
  - 卡片底色採用微透綠：`bg-emerald-500/10 dark:bg-emerald-950/30`。
  - 外層光暈：`shadow-[0_0_12px_rgba(16,185,129,0.2)]`。
  - 卡片右上角或標題側加入**綠色呼吸脈衝點**（`le-status-dot le-status-dot-live`）與「進行中」標籤。
- **雙態分流（選中查看 `isSelected` vs 正在進行 `isLive`）**：
  - 若 `isLive && isSelected`：維持綠色 Live 風格，並疊加外層 Focus 環（`ring-2 ring-emerald-500/40`）。
  - 若 `!isLive && isSelected`：維持原有的選取外框風格（`border-accent bg-accent-muted shadow-sm`）。
  - 若 `isLive && !isSelected`：維持強烈綠色 Live 風格，即使主持人點別題查看，依然能一眼認出何者正在作答中。
  - 若 `!isLive && !isSelected`：一般中性表面底色（`border-border bg-surface hover:border-accent/40`）。
- **其他狀態文字顏色標示 (`interactionStatusTextColor`)**：
  - `active`：`text-emerald-600 dark:text-emerald-400 font-semibold`（進行中）
  - `locked`：`text-amber-600 dark:text-amber-400 font-medium`（已鎖定）
  - `stopped`：`text-neutral-500 dark:text-neutral-400`（已結束）
  - `idle`：`text-sky-600 dark:text-sky-400 font-medium`（閒置）

### 2.2 工作台佈局與黏性預覽 (`WorkbenchLayout.tsx` & `SessionWorkbenchPage.tsx`)
- **Header 吸頂下緣高度對齊**：
  - 頂部 `HostRoomNavHeader` 包含「上一題/下一題」那一列（`navControls`）與麵包屑。
  - 在 `SessionWorkbenchPage` 或 `WorkbenchLayout` 透過 CSS 變數 `--workbench-header-offset` 或計算實際高度（約 `128px` ~ `144px`），精確定義吸頂 top 偏移量。
- **預覽區塊滾動吸頂跟隨**：
  - 中欄「投影預覽」卡片（`PollWorkbenchMain` 內）：
    - 加上 `sticky` 定位：`lg:sticky lg:top-[var(--workbench-header-offset,136px)]`。
    - 自適應最大高度：`max-h-[calc(100vh-var(--workbench-header-offset,136px)-1.5rem)]`。
    - 卡片內部內容設為 `overflow-y-auto`，當投影內容（如大文字雲或多選項長圖）在矮螢幕下超出時，內部捲動，不讓卡片破出版面。
  - 右欄「預覽參與者畫面」（`WorkbenchPreviewPanel` / `ParticipantPreviewFrame`）：
    - 容器加上 `sticky` 定位：`lg:sticky lg:top-[var(--workbench-header-offset,136px)]`。
    - 自適應最大高度：`max-h-[calc(100vh-var(--workbench-header-offset,136px)-1.5rem)]`。
    - 手機外框維持置中且內容自適應，外框在較小垂直視窗下確保手機完整外框都在視窗內。
- **防止父容器溢出中斷 sticky**：
  - 檢視 `WorkbenchLayout` 與 `section`、`aside` 的 `overflow` 屬性，確保在桌面螢幕（`lg`）下，父層 grid 不會因為非捲動性的 `overflow-auto` 阻礙子元素的 viewport sticky 定位。

---

## 3. 測試與驗收條件 (Acceptance Criteria)

1. **AC-01 進行中醒目標示**：
   - 當某互動題目狀態為 `active` 時，左側側邊欄對應卡片呈現明顯的綠色邊框、淺綠背景與呼吸綠點標示。
   - 主持人點選其他題目查看時，進行中卡片仍維持醒目的綠色外框與呼吸燈，不因失焦而變回灰黑中性色。
2. **AC-02 狀態文字色彩辨識**：
   - 非進行中的題目，副標題中的狀態文字依狀態呈現不同色彩（已結束為灰階、閒置為藍色、已鎖定為橙色）。
3. **AC-03 滾動跟隨 (Sticky)**：
   - 當題目列表中有多道題目導致頁面縱向滾動時，向下滾動頁面，「投影預覽」與「預覽參與者畫面」在碰到「上一題/下一題」列下緣時順暢吸頂，自動跟隨視窗滾動。
4. **AC-04 預覽全貌完整能見度**：
   - 在常見解析度（例如 1080p、1366x768 筆電螢幕）下，吸頂狀態中的「投影預覽」與「預覽參與者畫面」底部不會被截斷在螢幕外，主持人無需滾動視窗到底部即可看到完整預覽。
5. **AC-05 編譯與型別安全**：
   - 前端專案 `npm run build` 通過無報錯。
