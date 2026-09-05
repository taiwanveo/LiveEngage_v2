# 主持人工作台：進行中題目醒目標示與預覽區塊滾動跟隨實作計畫 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在主持人工作台（Host Workbench）中，為「進行中」題目卡片加上強烈且清晰的翡翠綠外框、背景與呼吸燈標示，為其他題目狀態文字上色；並讓中欄「投影預覽」與右欄「預覽參與者畫面」在向下滑動時自動吸頂跟隨滾動（Sticky），確保視窗內全貌完整可見。

**Architecture:** 
1. 在 `lib/pollTypes.ts` 新增狀態色彩映射函式 `interactionStatusTextColor`，為不同生命週期狀態賦予語意色彩。
2. 在 `WorkbenchInteractionSidebar.tsx` 分離 `isLive`（進行中）與 `isSelected`（選取檢視中）兩種維度，進行中卡片採用雙層綠框、微透背景、呼吸光暈與「進行中」微章標示。
3. 在 `WorkbenchLayout.tsx`、`SessionWorkbenchPage.tsx` 與 `PollWorkbenchMain.tsx` 定義頂部控制列吸頂下緣高度 `--workbench-header-offset`，中欄「投影預覽」與右欄「預覽參與者畫面」設定 `lg:sticky`、自適應最大高度 `max-h-[calc(100vh-var(--workbench-header-offset)-1.5rem)]` 與內部捲動保護，達成全貌完整能見度。

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vite.

## Global Constraints
- 遵循 LiveEngage 主題與 Design Token，支援明暗主題（Light / Dark mode）。
- 嚴格維持型別安全，所有新增函式均標註明確參數與回傳型別。
- 專案建置指令：`npm run build` 在 `frontend/apps/host` 必須通過無錯誤。

---

### Task 1: 狀態文字語意色彩對照函式 (`pollTypes.ts`)

**Files:**
- Modify: `frontend/apps/host/src/lib/pollTypes.ts:100-144`

**Interfaces:**
- Produces: `interactionStatusTextColor(status: InteractionStatus | string): string`

- [ ] **Step 1: 在 `pollTypes.ts` 實作 `interactionStatusTextColor`**

在 `frontend/apps/host/src/lib/pollTypes.ts` 中新增以下輔助函式：
```typescript
/** 互動狀態文字語意色彩（支援 Tailwind 深淺主題） */
export function interactionStatusTextColor(status: InteractionStatus | string): string {
  switch (status) {
    case "active":
      return "text-emerald-600 dark:text-emerald-400 font-semibold";
    case "locked":
      return "text-amber-600 dark:text-amber-400 font-medium";
    case "stopped":
      return "text-neutral-500 dark:text-neutral-400";
    case "idle":
      return "text-sky-600 dark:text-sky-400 font-medium";
    default:
      return "text-muted";
  }
}
```

- [ ] **Step 2: 驗證 `pollTypes.ts` 建置**

執行：`cd /home/administrator/projs/LiveEngage/frontend/apps/host && npm run build`
預期：PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/apps/host/src/lib/pollTypes.ts
git commit -m "feat(host): add interactionStatusTextColor helper for semantic status styling"
```

---

### Task 2: 側邊欄進行中卡片醒目標示與狀態色彩 (`WorkbenchInteractionSidebar.tsx`)

**Files:**
- Modify: `frontend/apps/host/src/components/workbench/WorkbenchInteractionSidebar.tsx:240-335`

**Interfaces:**
- Consumes: `interactionStatusTextColor`, `interactionStatusLabel`, `interactionTypeLabel` from `../../lib/pollTypes`

- [ ] **Step 1: 匯入 `interactionStatusTextColor`**

在 `WorkbenchInteractionSidebar.tsx` 的匯入清單加入 `interactionStatusTextColor`。

- [ ] **Step 2: 改寫卡片樣式邏輯以區分 `isLive` 與 `isSelected`**

在 `props.items.map((item, index) => { ... })` 中：
```typescript
const isSelected = item.id === props.selectedId;
const isLive = item.status === "active";
const isDragging = dragIndex === index;
const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;
```
調整卡片容器 `div` 的 className：
```typescript
const cardStyles = isLive
  ? isSelected
    ? "border-2 border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/30 shadow-[0_0_12px_rgba(16,185,129,0.3)] ring-2 ring-emerald-500/40"
    : "border-2 border-emerald-500 dark:border-emerald-400 bg-emerald-500/10 dark:bg-emerald-950/25 shadow-[0_0_10px_rgba(16,185,129,0.2)] hover:bg-emerald-500/15"
  : isSelected
    ? "border-accent bg-accent-muted shadow-sm"
    : "border-border bg-surface hover:border-accent/40";
```

- [ ] **Step 3: 卡片內部呈現「進行中」動態光點徽章與狀態文字色彩**

在標題處加入：
```tsx
<div className="flex items-center gap-1.5 min-w-0">
  {isLive ? (
    <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-bold text-emerald-600 dark:text-emerald-300">
      <span className="le-status-dot le-status-dot-live !size-1.5" />
      進行中
    </span>
  ) : null}
  <p className="truncate text-xs font-medium text-foreground">
    {item.title ?? "未命名"}
  </p>
</div>
<p className="mt-0.5 text-[10px] text-muted">
  {interactionTypeLabel(item.type)} ·{" "}
  <span className={interactionStatusTextColor(item.status)}>
    {interactionStatusLabel(item.status)}
  </span>
</p>
```

- [ ] **Step 4: 驗證建置**

執行：`cd /home/administrator/projs/LiveEngage/frontend/apps/host && npm run build`
預期：PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/apps/host/src/components/workbench/WorkbenchInteractionSidebar.tsx
git commit -m "feat(host): highlight active question card with vibrant emerald styling and semantic status colors"
```

---

### Task 3: 吸頂高度對齊與預覽欄位黏性排版 (`WorkbenchLayout.tsx` & `SessionWorkbenchPage.tsx`)

**Files:**
- Modify: `frontend/packages/ui/src/WorkbenchLayout.tsx:18-35`
- Modify: `frontend/apps/host/src/pages/SessionWorkbenchPage.tsx:568-693`

**Interfaces:**
- Consumes: CSS variable `--workbench-header-offset`

- [ ] **Step 1: 在 `WorkbenchLayout.tsx` 優化側邊與預覽欄位的滾動結構**

在 `WorkbenchLayout.tsx` 中：
1. 確保外層容器定義 `--workbench-header-offset: 136px;`（或自適應計算）。
2. 在 `aside`（右側 preview）加上：
   `lg:sticky lg:top-[var(--workbench-header-offset,136px)] lg:self-start lg:max-h-[calc(100vh-var(--workbench-header-offset,136px)-1.5rem)] lg:overflow-y-auto`
3. 確保 `section`（中欄）在桌面端不會有不必要的 overflow 截斷：
   `min-h-[320px] min-w-0 bg-background p-4 sm:p-5 lg:overflow-visible`

- [ ] **Step 2: 驗證建置**

執行：`cd /home/administrator/projs/LiveEngage/frontend/apps/host && npm run build`
預期：PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/packages/ui/src/WorkbenchLayout.tsx
git commit -m "feat(ui): support sticky preview sidebar and non-blocking layout in WorkbenchLayout"
```

---

### Task 4: 中欄「投影預覽」卡片吸頂滾動跟隨與全貌能見度 (`PollWorkbenchMain.tsx`)

**Files:**
- Modify: `frontend/apps/host/src/components/workbench/PollWorkbenchMain.tsx:175-215`

- [ ] **Step 1: 為「投影預覽」卡片加入 `sticky` 與全貌最大高度**

在 `PollWorkbenchMain.tsx` 中的「投影預覽」卡片容器：
```tsx
<div className="le-card overflow-hidden p-4 lg:sticky lg:top-[var(--workbench-header-offset,136px)] lg:max-h-[calc(100vh-var(--workbench-header-offset,136px)-1.5rem)] lg:overflow-y-auto">
  <div className="mb-3 flex items-center justify-between">
    <h3 className="text-sm font-semibold text-foreground">投影預覽</h3>
    {isWordCloud && isClustered && (
      ...
    )}
  </div>
  <PollRenderer ... />
</div>
```

- [ ] **Step 2: 驗證建置**

執行：`cd /home/administrator/projs/LiveEngage/frontend/apps/host && npm run build`
預期：PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/apps/host/src/components/workbench/PollWorkbenchMain.tsx
git commit -m "feat(host): make projection preview card sticky with viewport-bounded scrolling"
```

---

### Task 5: 完整整合驗證與交付審查

**Files:**
- All modified files in `frontend/apps/host` and `frontend/packages/ui`

- [ ] **Step 1: 執行完整前端 Build 驗證**

執行：`cd /home/administrator/projs/LiveEngage/frontend/apps/host && npm run build`
預期：0 errors, clean bundle output.

- [ ] **Step 2: 審視 Git diff 確認無未預期變更**

執行：`git status` 及 `git diff`
預期：所有修改皆符合規格書 AC-01 至 AC-05。

- [ ] **Step 3: Final Commit & Summary**

若有任何微調，完成最後 Commit 並回報使用者。
