/** 主題切換器 — 四種明暗／風格主題。 */

import * as React from "react";
import { useTheme } from "./ThemeProvider";
import { THEMES, type ThemeId } from "./theme";

interface Props {
  className?: string;
  compact?: boolean;
}

export function ThemeSwitcher({
  className = "",
  compact = false,
}: Props): React.JSX.Element {
  const { theme, setTheme } = useTheme();
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

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0]!;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="切換主題（theme）"
        onClick={() => setOpen((v: boolean) => !v)}
        className="le-btn-secondary !min-h-[40px] !px-3 !py-2 gap-2"
      >
        <span
          className="flex h-5 w-5 overflow-hidden rounded-md border border-border shadow-sm"
          aria-hidden
        >
          <span className="h-full w-1/2" style={{ background: current.preview.bg }} />
          <span className="h-full w-1/2" style={{ background: current.preview.accent }} />
        </span>
        {!compact ? (
          <span className="text-sm">{current.label}</span>
        ) : null}
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
        <ul
          role="listbox"
          aria-label="主題列表"
          className="absolute right-0 z-50 mt-2 w-60 max-h-[min(calc(100dvh-5rem),17.5rem)] animate-slide-up divide-y divide-border overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface-elevated shadow-elevated"
        >
          {THEMES.map((t) => {
            const selected = t.id === theme;
            return (
              <li key={t.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    setTheme(t.id as ThemeId);
                    setOpen(false);
                  }}
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
      ) : null}
    </div>
  );
}
