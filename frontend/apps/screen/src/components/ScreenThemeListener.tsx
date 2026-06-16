/** Host postMessage：即時更新投影主題（跨網域）。 */

import { useEffect } from "react";
import {
  SCREEN_THEME_MESSAGE,
  applyScreenThemePrefs,
  isThemeId,
  sanitizeScreenColor,
  type ScreenThemePrefs,
} from "@liveengage/ui";

function parseThemeMessagePrefs(value: unknown): ScreenThemePrefs | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.theme !== "string" || !isThemeId(raw.theme)) return null;
  return {
    theme: raw.theme,
    bg: sanitizeScreenColor(typeof raw.bg === "string" ? raw.bg : null),
    fg: sanitizeScreenColor(typeof raw.fg === "string" ? raw.fg : null),
  };
}

export function ScreenThemeListener(): null {
  useEffect(() => {
    const onMessage = (e: MessageEvent): void => {
      if (e.data?.type !== SCREEN_THEME_MESSAGE) return;
      const prefs = parseThemeMessagePrefs(e.data.prefs);
      if (prefs) applyScreenThemePrefs(prefs);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return null;
}
