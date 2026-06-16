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

/** 將主題套用到 Screen App 的 document（URL 載入與 postMessage 共用）。 */
export function applyScreenThemePrefs(prefs: ScreenThemePrefs): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", prefs.theme);

  if (prefs.bg) {
    root.style.setProperty("--le-screen-bg", prefs.bg);
    root.setAttribute("data-screen-custom-bg", "");
  } else {
    root.style.removeProperty("--le-screen-bg");
    root.removeAttribute("data-screen-custom-bg");
  }

  if (prefs.fg) {
    root.style.setProperty("--le-screen-fg", prefs.fg);
    root.setAttribute("data-screen-custom-fg", "");
  } else {
    root.style.removeProperty("--le-screen-fg");
    root.removeAttribute("data-screen-custom-fg");
  }
}

export const SCREEN_THEME_MESSAGE = "screen:theme";
