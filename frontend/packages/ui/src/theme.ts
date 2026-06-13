/** 主題識別與中繼資料。 */

export type ThemeId = "light" | "dark" | "cursor" | "claude";

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  description: string;
  /** 預覽色（用於切換器色塊） */
  preview: { bg: string; accent: string };
}

export const THEMES: ThemeMeta[] = [
  {
    id: "light",
    label: "專業淺色",
    description: "清爽、適合日間控場",
    preview: { bg: "#f8fafc", accent: "#2563eb" },
  },
  {
    id: "dark",
    label: "專業深色",
    description: "低眩光、適合長時間操作",
    preview: { bg: "#0f172a", accent: "#60a5fa" },
  },
  {
    id: "cursor",
    label: "Cursor",
    description: "深色底 + 琥珀強調（IDE 風格）",
    preview: { bg: "#14120b", accent: "#f54e00" },
  },
  {
    id: "claude",
    label: "Claude",
    description: "暖色奶油底 + 赤陶強調",
    preview: { bg: "#faf9f5", accent: "#d97757" },
  },
];

export const THEME_STORAGE_KEY = "liveengage-theme";

export const DEFAULT_THEME: ThemeId = "light";

export function isThemeId(value: string): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}
