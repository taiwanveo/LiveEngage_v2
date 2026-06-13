# LiveEngage Design System（設計系統）

> 全域視覺規範 — 套件 `@liveengage/ui` + `frontend/packages/ui/src/theme.css`

## 主題（Themes）

| ID | 名稱 | 風格 | 預設對象 |
|----|------|------|----------|
| `slido` | Slido | 白底深綠、扁平控場（**預設**） | Host / Admin / Participant |
| `light` | 專業淺色 | DM Sans + Instrument Sans，藍色強調 | 全 app |
| `dark` | 專業深色 | 低眩光控場介面 | 長時間操作 |
| `cursor` | Cursor | `#14120b` 底 + `#f54e00` 琥珀、JetBrains Mono | IDE 風格偏好者 |
| `claude` | Claude | `#faf9f5` 奶油底 + `#d97757` 赤陶、Source Serif 4 | 暖色編輯感 |

持久化：`localStorage` 鍵 `liveengage-theme`；`data-theme` 掛在 `<html>`。

## 語意 Token（Semantic Tokens）

元件與頁面應使用 Tailwind 語意類別，**禁止**硬編碼 `slate-*` / `gray-*`：

- 背景：`bg-background`、`bg-surface`、`bg-surface-elevated`
- 文字：`text-foreground`、`text-muted`
- 邊框：`border-border`
- 強調：`text-accent`、`bg-accent`、`bg-accent-muted`
- 狀態：`text-success`、`text-warning`、`text-danger`

## 結構元件（`.le-*`）

| Class | 用途 |
|-------|------|
| `.le-page-bg` | 全頁背景 + 網格紋理 |
| `.le-card` / `.le-card-elevated` | 卡片 |
| `.le-input` | 表單輸入 |
| `.le-btn-primary` / `.le-btn-secondary` / `.le-btn-ghost` | 按鈕 |
| `.le-nav-link` / `.le-nav-link-active` | 導覽 |
| `.le-badge-live` / `.le-status-dot-live` | 即時狀態 |

## React 元件

```tsx
import {
  ThemeProvider,
  initTheme,
  ThemeSwitcher,
  AuthCard,
  AppHeader,
  AdminSidebarShell,
} from "@liveengage/ui";
```

## App 接線清單

1. `tailwind.config.js` → `presets: [ui/tailwind.preset.js]`
2. `index.css` → `@import "../../../packages/ui/src/theme.css"`
3. `vite.config.ts` / `tsconfig.json` → `@liveengage/ui` alias
4. `main.tsx` → `initTheme()` + `<ThemeProvider>`
5. `index.html` → 內嵌主題腳本（防 FOUC），移除硬編碼 body 色

## 反模式（Anti-patterns）

- 勿用 emoji 當圖示
- 勿在元件內寫死 hex 色（除主題定義檔）
- 勿混用 `slate` 與語意 token
- 觸控目標最小 44px（`.le-btn-*` 已內建）
