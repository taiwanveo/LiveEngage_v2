/** Host：Screen 投影主題偏好（localStorage + 通知已開啟的投影視窗）。 */

import { useCallback, useState } from "react";
import {
  SCREEN_THEME_MESSAGE,
  readScreenThemePrefs,
  writeScreenThemePrefs,
  type ScreenThemePrefs,
} from "@liveengage/ui";

export function useScreenTheme(
  resolveScreenWindow?: () => Window | null
): {
  prefs: ScreenThemePrefs;
  setPrefs: (prefs: ScreenThemePrefs) => void;
} {
  const [prefs, setPrefsState] = useState<ScreenThemePrefs>(() => readScreenThemePrefs());

  const notifyOpenScreen = useCallback(
    (next: ScreenThemePrefs) => {
      const win = resolveScreenWindow?.();
      if (win && !win.closed) {
        win.postMessage({ type: SCREEN_THEME_MESSAGE, prefs: next }, "*");
      }
    },
    [resolveScreenWindow]
  );

  const setPrefs = useCallback(
    (next: ScreenThemePrefs) => {
      setPrefsState(next);
      writeScreenThemePrefs(next);
      notifyOpenScreen(next);
    },
    [notifyOpenScreen]
  );

  return { prefs, setPrefs };
}
