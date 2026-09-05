/** 全域主題 Provider：持久化至 localStorage。 */

import * as React from "react";
import {
  DEFAULT_THEME,
  isThemeId,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "./theme";
import { syncBrandingThemeColors } from "./orgBranding";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  if (raw && isThemeId(raw)) return raw;
  return DEFAULT_THEME;
}

function applyTheme(id: ThemeId): void {
  document.documentElement.setAttribute("data-theme", id);
  if (id === "dark" || id === "cursor") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  syncBrandingThemeColors();
  localStorage.setItem(THEME_STORAGE_KEY, id);
}

/** 在 React 掛載前套用，避免 FOUC（Flash of Unstyled Content） */
export function initTheme(): ThemeId {
  const theme = readStoredTheme();
  applyTheme(theme);
  return theme;
}

interface Props {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: Props): React.JSX.Element {
  const [theme, setThemeState] = React.useState<ThemeId>(() => initTheme());

  const setTheme = React.useCallback((id: ThemeId) => {
    applyTheme(id);
    setThemeState(id);
  }, []);

  const value = React.useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme 必須在 ThemeProvider 內使用");
  }
  return ctx;
}
