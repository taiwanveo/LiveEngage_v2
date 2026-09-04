/** Screen 投影主題偏好（與 Host UI 主題分開儲存）。 */

import { DEFAULT_THEME, isThemeId, type ThemeId } from "./theme";
import { sanitizeScreenColor } from "./screenUrl";

export const SCREEN_THEME_STORAGE_KEY = "liveengage-screen-theme-prefs";

export interface ScreenThemePrefs {
  theme: ThemeId;
  bg: string | null;
  fg: string | null;
}

const DEFAULT_PREFS: ScreenThemePrefs = {
  theme: DEFAULT_THEME,
  bg: null,
  fg: null,
};

const THEME_SCREEN_COLORS: Record<ThemeId, { bg: string; fg: string }> = {
  slido: { bg: "#f5f5f5", fg: "#0b6623" },
  light: { bg: "#f8fafc", fg: "#0f172a" },
  dark: { bg: "#020617", fg: "#e2e8f0" },
  cursor: { bg: "#14120b", fg: "#fef3c7" },
  claude: { bg: "#faf9f5", fg: "#7c2d12" },
};

export function readScreenThemePrefs(): ScreenThemePrefs {
  try {
    const raw = localStorage.getItem(SCREEN_THEME_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<ScreenThemePrefs>;
    const theme =
      typeof parsed.theme === "string" && isThemeId(parsed.theme)
        ? parsed.theme
        : DEFAULT_PREFS.theme;
    return {
      theme,
      bg: sanitizeScreenColor(parsed.bg ?? null),
      fg: sanitizeScreenColor(parsed.fg ?? null),
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function writeScreenThemePrefs(prefs: ScreenThemePrefs): void {
  try {
    localStorage.setItem(SCREEN_THEME_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function isLightColor(hex: string): boolean {
  const clean = hex.replace("#", "");
  let r = 0, g = 0, b = 0;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length === 6) {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  } else {
    return false;
  }
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160;
}

/** 將主題套用到 Screen App 的 document（URL 載入與 postMessage 共用）。 */
export function applyScreenThemePrefs(prefs: ScreenThemePrefs): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", prefs.theme);
  const defaults = THEME_SCREEN_COLORS[prefs.theme] ?? THEME_SCREEN_COLORS[DEFAULT_THEME];
  const effectiveBg = prefs.bg ?? defaults.bg;
  const effectiveFg = prefs.fg ?? defaults.fg;
  root.style.setProperty("--le-screen-bg", effectiveBg);
  root.style.setProperty("--le-screen-fg", effectiveFg);
  root.setAttribute("data-screen-theme-bg", "");

  // 僅在使用者明確傳入自訂 fg 時啟用 custom-fg
  if (prefs.fg) {
    root.setAttribute("data-screen-custom-fg", "");
  } else {
    root.removeAttribute("data-screen-custom-fg");
  }

  // 判斷是否為淺色系主題或淺色底
  const isLight =
    prefs.theme === "light" ||
    prefs.theme === "slido" ||
    prefs.theme === "claude" ||
    isLightColor(effectiveBg);

  if (isLight) {
    root.setAttribute("data-screen-light", "");
  } else {
    root.removeAttribute("data-screen-light");
  }
}

export const SCREEN_THEME_MESSAGE = "screen:theme";
