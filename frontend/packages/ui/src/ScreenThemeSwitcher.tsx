/** Screen 投影主題切換器 — 五種預設 + 自訂前景／背景色。 */

import * as React from "react";
import { THEMES, type ThemeId } from "./theme";
import type { ScreenThemePrefs } from "./screenTheme";
import { sanitizeScreenColor } from "./screenUrl";

interface Props {
  prefs: ScreenThemePrefs;
  onChange: (prefs: ScreenThemePrefs) => void;
  className?: string;
  compact?: boolean;
}

const DEFAULT_BG_PICKER = "#020617";
const DEFAULT_FG_PICKER = "#f8fafc";

export function ScreenThemeSwitcher({
  prefs,
  onChange,
  className = "",
  compact = false,
}: Props): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const current = THEMES.find((t) => t.id === prefs.theme) ?? THEMES[0]!;

  const setTheme = (theme: ThemeId): void => {
    onChange({ ...prefs, theme });
    setOpen(false);
  };

  const setBg = (value: string): void => {
    onChange({ ...prefs, bg: sanitizeScreenColor(value) });
  };

  const setFg = (value: string): void => {
    onChange({ ...prefs, fg: sanitizeScreenColor(value) });
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="切換投影主題（screen theme）"
        onClick={() => setOpen((v) => !v)}
        className="le-btn-secondary !min-h-[40px] !px-3 !py-2 gap-2"
      >
        <span
          className="flex h-5 w-5 overflow-hidden rounded-md border border-border shadow-sm"
          aria-hidden
        >
          <span
            className="h-full w-1/2"
            style={{ background: prefs.bg ?? current.preview.bg }}
          />
          <span
            className="h-full w-1/2"
            style={{ background: prefs.fg ?? current.preview.accent }}
          />
        </span>
        {!compact ? <span className="text-sm">投影主題</span> : null}
        <svg
          className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="投影主題列表"
          className="absolute right-0 z-50 mt-2 w-64 max-h-[min(calc(100dvh-5rem),22rem)] animate-slide-up overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface-elevated shadow-elevated"
        >
          <ul className="divide-y divide-border">
            {THEMES.map((t) => {
              const selected = t.id === prefs.theme;
              return (
                <li key={t.id} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors ${
                      selected ? "bg-accent-muted" : "hover:bg-surface"
                    }`}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 overflow-hidden rounded-md border border-border"
                      aria-hidden
                    >
                      <span className="h-full w-1/2" style={{ background: t.preview.bg }} />
                      <span className="h-full w-1/2" style={{ background: t.preview.accent }} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-tight text-foreground">
                        {t.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                        {t.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="space-y-2 border-t border-border px-2.5 py-2.5">
            <p className="text-[11px] font-medium text-muted">自訂色彩</p>
            <label className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-xs text-foreground">背景色</span>
              <input
                type="color"
                value={prefs.bg ?? DEFAULT_BG_PICKER}
                onChange={(e) => setBg(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
                aria-label="投影背景色"
              />
              {prefs.bg ? (
                <button
                  type="button"
                  onClick={() => onChange({ ...prefs, bg: null })}
                  className="text-[10px] text-muted hover:text-foreground"
                >
                  清除
                </button>
              ) : (
                <span className="text-[10px] text-muted">預設</span>
              )}
            </label>
            <label className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-xs text-foreground">前景色</span>
              <input
                type="color"
                value={prefs.fg ?? DEFAULT_FG_PICKER}
                onChange={(e) => setFg(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
                aria-label="投影前景色"
              />
              {prefs.fg ? (
                <button
                  type="button"
                  onClick={() => onChange({ ...prefs, fg: null })}
                  className="text-[10px] text-muted hover:text-foreground"
                >
                  清除
                </button>
              ) : (
                <span className="text-[10px] text-muted">預設</span>
              )}
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}
